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
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-07)
 *
 * The ledger is the record of what a member is owed when their
 * referral converts. All three actions wrote it to an in-memory array:
 * logReferral pushed onto the fixture, and both admin actions assigned
 * to the object the fixture lookup returned. /admin/referrals reads
 * partner_referrals from Postgres, so the page showed seed rows and
 * nothing a member had actually logged. A referral logged on Tuesday
 * did not exist on Wednesday, and the member has no other record that
 * they made the introduction.
 *
 * The partner registries stay as constants on purpose. They are a
 * static catalogue of who we have deals with, not member data.
 * ─────────────────────────────────────────────────────────────
 */
"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { partnerReferrals } from "@/db/schema";
import { getCurrentUser, requireAdmin } from "@/lib/auth-stub";
import { getUserById } from "@/lib/readers/users";
import { partnerReferralReader } from "@/lib/readers";
import { ECOSYSTEM_PARTNERS, PRODUCT_AFFILIATES } from "@/lib/mock-data/partners";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import type { PartnerReferral, PartnerReferralKind } from "@/lib/types";

const KINDS: readonly PartnerReferralKind[] = [
  "saas_partner",
  "product_affiliate",
];

function isKind(raw: string): raw is PartnerReferralKind {
  return (KINDS as readonly string[]).includes(raw);
}

function nextReferralId(): string {
  return `pref_${randomUUID()}`;
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

  const referrer = await getUserById(referrerUserId);
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
  await db.insert(partnerReferrals).values(row);

  await logAuditEvent({
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

  const row = await partnerReferralReader.byId(id);
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
  // Guarded on still being pending. Two admins on the referral queue
  // at once would otherwise both pass the check above and the second
  // would overwrite the first one's dollar figures.
  const converted = await db
    .update(partnerReferrals)
    .set({
      status: "converted",
      convertedAmountUsd: convertedAmount.toFixed(2),
      revshareEarnedUsd: revshare.toFixed(2),
      convertedAt: now,
      updatedAt: now,
    })
    .where(
      and(eq(partnerReferrals.id, id), eq(partnerReferrals.status, "pending"))!,
    )
    .returning({ id: partnerReferrals.id });
  if (converted.length === 0) {
    throw new Error(
      "This referral was just settled by someone else. Reload the queue.",
    );
  }

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "partner_referral.converted",
    resourceKind: "partner_referral",
    resourceId: row.id,
    before,
    after: {
      status: "converted",
      convertedAmountUsd: convertedAmount.toFixed(2),
      revshareEarnedUsd: revshare.toFixed(2),
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

  const row = await partnerReferralReader.byId(id);
  if (!row) throw new Error("Referral not found.");
  if (row.status !== "pending") {
    throw new Error(
      `Referral already ${row.status}; cannot mark declined.`,
    );
  }

  const now = new Date().toISOString();
  const before = { status: row.status };
  const declined = await db
    .update(partnerReferrals)
    .set({
      status: "declined",
      declineReason: reason,
      declinedAt: now,
      updatedAt: now,
    })
    .where(
      and(eq(partnerReferrals.id, id), eq(partnerReferrals.status, "pending"))!,
    )
    .returning({ id: partnerReferrals.id });
  if (declined.length === 0) {
    throw new Error(
      "This referral was just settled by someone else. Reload the queue.",
    );
  }

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "partner_referral.declined",
    resourceKind: "partner_referral",
    resourceId: row.id,
    before,
    after: { status: "declined", declineReason: reason },
    reason,
  });

  revalidatePath("/admin/referrals");
}
