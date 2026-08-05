/**
 * Partner referral attribution ledger — server actions.
 *
 * Three actions:
 *   - logReferral: member or admin creates a pending referral row
 *   - markReferralConverted: admin marks the referral as converted
 *     with dollar figures (convertedAmountUsd + revshareEarnedUsd)
 *   - markReferralDeclined: admin marks as declined with a reason
 *
 * When a referral converts, the referrer is due a kick per the
 * standard contract-intake referral split (85% of revshare to the
 * referring member, 12% admin, 1.5% Treasury, 1.5% LP). MVP
 * captures the ledger and audit log; wiring the actual split fire
 * into the settlement engine is a follow-on (calls
 * writeStandardSettlementSplits from settlement-splits.ts).
 */
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser, requireAdmin } from "@/lib/auth-stub";
import { MOCK_PARTNER_REFERRALS } from "@/lib/mock-data/partner-referrals";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { ECOSYSTEM_PARTNERS, PRODUCT_AFFILIATES } from "@/lib/mock-data/partners";
import {
  logAuditEvent,
  snapshotActorRole,
} from "@/lib/mock-data/audit-log";
import type { PartnerReferral, PartnerReferralKind } from "@/lib/types";

const KINDS: readonly PartnerReferralKind[] = [
  "saas_partner",
  "product_affiliate",
];

function isKind(raw: string): raw is PartnerReferralKind {
  return (KINDS as readonly string[]).includes(raw);
}

function nextReferralId(): string {
  return `pref_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 5)}`;
}

/**
 * Any signed-in user can log a referral they made — this is the
 * on-record channel for their kick when it converts. Admin can
 * also log referrals on behalf of members who reported them
 * verbally (referrerUserId is required either way).
 */
export async function logReferral(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in to log a referral.");

  const partnerId = String(formData.get("partnerId") ?? "").trim();
  const kindRaw = String(formData.get("partnerKind") ?? "").trim();
  const referrerUserId =
    String(formData.get("referrerUserId") ?? "").trim() || user.id;
  const leadContactName = String(formData.get("leadContactName") ?? "").trim();
  const leadContactEmail = String(
    formData.get("leadContactEmail") ?? "",
  ).trim();
  const leadCompany = String(formData.get("leadCompany") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!partnerId) throw new Error("Partner id required.");
  if (!isKind(kindRaw)) {
    throw new Error(
      `Unknown partner kind "${kindRaw}". Allowed: ${KINDS.join(", ")}`,
    );
  }
  const partnerKind = kindRaw;

  const registry =
    partnerKind === "saas_partner" ? ECOSYSTEM_PARTNERS : PRODUCT_AFFILIATES;
  const partner = registry.find((p) => p.id === partnerId);
  if (!partner) {
    throw new Error(
      `Partner ${partnerId} not found in the ${partnerKind} registry.`,
    );
  }

  if (!leadContactName) throw new Error("Lead contact name required.");
  if (!leadContactEmail) throw new Error("Lead contact email required.");

  const referrer = MOCK_USERS.find((u) => u.id === referrerUserId);
  if (!referrer) throw new Error(`Referrer ${referrerUserId} not found.`);

  const now = new Date().toISOString();
  const row: PartnerReferral = {
    id: nextReferralId(),
    partnerId,
    partnerKind,
    referrerUserId,
    leadContactName,
    leadContactEmail,
    leadCompany,
    notes,
    status: "pending",
    convertedAmountUsd: null,
    revshareEarnedUsd: null,
    convertedAt: null,
    declineReason: null,
    declinedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  MOCK_PARTNER_REFERRALS.push(row);

  logAuditEvent({
    actorUserId: user.id,
    actorRoleSnapshot: snapshotActorRole(user),
    action: "partner_referral.logged",
    resourceKind: "partner_referral",
    resourceId: row.id,
    before: null,
    after: {
      partnerId,
      partnerKind,
      referrerUserId,
      leadContactName,
      leadContactEmail,
    },
    reason: `Referral to ${partner.name} logged by ${user.firstName}`,
  });

  revalidatePath("/admin/referrals");
  revalidatePath("/profile");
}

/**
 * Admin marks a pending referral as converted. Requires both dollar
 * figures — total conversion amount + FM's revshare portion.
 * Follow-on: fire the split engine so the referring member's kick
 * lands automatically. MVP captures the ledger for accounting
 * clarity; admin can manually distribute for now.
 */
export async function markReferralConverted(
  formData: FormData,
): Promise<void> {
  const admin = await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  const amountRaw = String(formData.get("convertedAmountUsd") ?? "").trim();
  const revshareRaw = String(formData.get("revshareEarnedUsd") ?? "").trim();
  if (!id) throw new Error("Referral id required.");

  const row = MOCK_PARTNER_REFERRALS.find((r) => r.id === id);
  if (!row) throw new Error("Referral not found.");
  if (row.status !== "pending") {
    throw new Error(
      `Referral already ${row.status}; cannot mark converted.`,
    );
  }

  const convertedAmount = Number(amountRaw);
  const revshare = Number(revshareRaw);
  if (!Number.isFinite(convertedAmount) || convertedAmount <= 0) {
    throw new Error("Converted amount must be a positive number.");
  }
  if (!Number.isFinite(revshare) || revshare < 0) {
    throw new Error("Revshare earned must be a non-negative number.");
  }
  if (revshare > convertedAmount) {
    throw new Error(
      "Revshare cannot exceed the total converted amount.",
    );
  }

  const now = new Date().toISOString();
  const before = {
    status: row.status,
    convertedAmountUsd: row.convertedAmountUsd,
    revshareEarnedUsd: row.revshareEarnedUsd,
  };
  row.status = "converted";
  row.convertedAmountUsd = convertedAmount.toFixed(2);
  row.revshareEarnedUsd = revshare.toFixed(2);
  row.convertedAt = now;
  row.updatedAt = now;

  logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "partner_referral.converted",
    resourceKind: "partner_referral",
    resourceId: row.id,
    before,
    after: {
      status: row.status,
      convertedAmountUsd: row.convertedAmountUsd,
      revshareEarnedUsd: row.revshareEarnedUsd,
    },
    reason: `Converted — ${convertedAmount.toFixed(2)} total, ${revshare.toFixed(2)} revshare due. Referrer ${row.referrerUserId} earns their kick on next settlement.`,
  });

  revalidatePath("/admin/referrals");
}

export async function markReferralDeclined(
  formData: FormData,
): Promise<void> {
  const admin = await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  const reason = String(formData.get("declineReason") ?? "").trim();
  if (!id) throw new Error("Referral id required.");
  if (!reason) {
    throw new Error(
      "Decline reason required — captures why the lead didn't convert.",
    );
  }

  const row = MOCK_PARTNER_REFERRALS.find((r) => r.id === id);
  if (!row) throw new Error("Referral not found.");
  if (row.status !== "pending") {
    throw new Error(
      `Referral already ${row.status}; cannot mark declined.`,
    );
  }

  const now = new Date().toISOString();
  const before = { status: row.status };
  row.status = "declined";
  row.declineReason = reason;
  row.declinedAt = now;
  row.updatedAt = now;

  logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "partner_referral.declined",
    resourceKind: "partner_referral",
    resourceId: row.id,
    before,
    after: { status: row.status, declineReason: reason },
    reason,
  });

  revalidatePath("/admin/referrals");
}
