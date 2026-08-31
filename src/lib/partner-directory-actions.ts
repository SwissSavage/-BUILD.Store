/**
 * Partner directory admin actions.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS EXISTS (2026-08-31)
 *
 * The three partner directories — service partners, SaaS partners,
 * product affiliates — were seed-only. There was no surface anywhere
 * in the app to add, edit or remove a row, so the seeded examples sat
 * on the public homepage claiming FM had signed letters of intent
 * with seven orgs it hadn't, and the only way to remove them was a
 * code change and a deploy.
 *
 * These rows are public claims about who the cooperative works with.
 * That is exactly the kind of thing an admin needs to be able to
 * correct in a minute, from the app, without asking a developer.
 * ─────────────────────────────────────────────────────────────
 */
"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  ecosystemPartners,
  productAffiliates,
  servicePartners,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth-stub";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import type { Industry } from "@/lib/types";

const PILLARS: Industry[] = [
  "stem",
  "creative-media",
  "professional-services",
];

/** Revalidate every surface a partner row renders on. */
function revalidatePartnerSurfaces(): void {
  revalidatePath("/");
  revalidatePath("/partners");
  revalidatePath("/admin/partners");
  revalidatePath("/admin/referrals");
}

/**
 * Normalize a URL field. Empty becomes null rather than "" so the
 * render-time `{p.affiliateUrl && ...}` checks behave, and a bare
 * domain gets a scheme so the link doesn't resolve relative to our
 * own host.
 */
function normalizeUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

// ──────────────────────────────────────────────────────────────
//  Service partners — signed letters of intent, homepage surface
// ──────────────────────────────────────────────────────────────

export async function upsertServicePartner(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const capabilities = String(formData.get("capabilities") ?? "")
    .split(/[\n,]+/)
    .map((c) => c.trim())
    .filter(Boolean);
  const websiteUrl = normalizeUrl(String(formData.get("websiteUrl") ?? ""));
  const affiliateUrl = normalizeUrl(String(formData.get("affiliateUrl") ?? ""));
  const pillarRaw = String(formData.get("pillarHint") ?? "").trim();
  const pillarHint = PILLARS.includes(pillarRaw as Industry)
    ? (pillarRaw as Industry)
    : null;
  const shippedTogether = formData.get("shippedTogether") === "on";

  if (!name) throw new Error("Partner name is required.");

  const values = {
    name,
    capabilities,
    websiteUrl,
    affiliateUrl,
    pillarHint,
    shippedTogether,
  };

  if (id) {
    await db
      .update(servicePartners)
      .set(values)
      .where(eq(servicePartners.id, id));
  } else {
    await db
      .insert(servicePartners)
      .values({ id: `sp_${randomUUID()}`, ...values });
  }

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "config.setting_changed",
    resourceKind: "config",
    resourceId: "service_partners",
    before: null,
    after: { name, capabilities, shippedTogether },
    reason: id
      ? `Updated service partner ${name}.`
      : `Added service partner ${name}.`,
  });

  revalidatePartnerSurfaces();
}

export async function removeServicePartner(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("id is required");

  const [removed] = await db
    .delete(servicePartners)
    .where(eq(servicePartners.id, id))
    .returning({ id: servicePartners.id, name: servicePartners.name });
  if (!removed) throw new Error("Service partner not found.");

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "config.setting_changed",
    resourceKind: "config",
    resourceId: "service_partners",
    before: { name: removed.name },
    after: null,
    reason: `Removed service partner ${removed.name} from the public list.`,
  });

  revalidatePartnerSurfaces();
}

// ──────────────────────────────────────────────────────────────
//  SaaS partners
// ──────────────────────────────────────────────────────────────

export async function upsertEcosystemPartner(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "").trim();
  const websiteUrl = normalizeUrl(String(formData.get("websiteUrl") ?? ""));
  const affiliateUrl = normalizeUrl(String(formData.get("affiliateUrl") ?? ""));

  if (!name) throw new Error("Partner name is required.");
  if (!role) throw new Error("Role is required — it renders under the name.");

  const values = { name, role, websiteUrl, affiliateUrl };

  if (id) {
    await db
      .update(ecosystemPartners)
      .set(values)
      .where(eq(ecosystemPartners.id, id));
  } else {
    await db
      .insert(ecosystemPartners)
      .values({ id: `ep_${randomUUID()}`, ...values });
  }

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "config.setting_changed",
    resourceKind: "config",
    resourceId: "ecosystem_partners",
    before: null,
    after: { name, role, affiliateUrl },
    reason: id ? `Updated SaaS partner ${name}.` : `Added SaaS partner ${name}.`,
  });

  revalidatePartnerSurfaces();
}

export async function removeEcosystemPartner(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("id is required");

  const [removed] = await db
    .delete(ecosystemPartners)
    .where(eq(ecosystemPartners.id, id))
    .returning({ id: ecosystemPartners.id, name: ecosystemPartners.name });
  if (!removed) throw new Error("SaaS partner not found.");

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "config.setting_changed",
    resourceKind: "config",
    resourceId: "ecosystem_partners",
    before: { name: removed.name },
    after: null,
    reason: `Removed SaaS partner ${removed.name} from the public list.`,
  });

  revalidatePartnerSurfaces();
}

// ──────────────────────────────────────────────────────────────
//  Product affiliates — referral links
// ──────────────────────────────────────────────────────────────

export async function upsertProductAffiliate(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const websiteUrl = normalizeUrl(String(formData.get("websiteUrl") ?? ""));
  const affiliateUrl = normalizeUrl(String(formData.get("affiliateUrl") ?? ""));

  if (!name) throw new Error("Affiliate name is required.");

  const values = { name, websiteUrl, affiliateUrl };

  if (id) {
    await db
      .update(productAffiliates)
      .set(values)
      .where(eq(productAffiliates.id, id));
  } else {
    await db
      .insert(productAffiliates)
      .values({ id: `pa_${randomUUID()}`, ...values });
  }

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "config.setting_changed",
    resourceKind: "config",
    resourceId: "product_affiliates",
    before: null,
    after: { name, affiliateUrl },
    reason: id ? `Updated affiliate ${name}.` : `Added affiliate ${name}.`,
  });

  revalidatePartnerSurfaces();
}

export async function removeProductAffiliate(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("id is required");

  const [removed] = await db
    .delete(productAffiliates)
    .where(eq(productAffiliates.id, id))
    .returning({ id: productAffiliates.id, name: productAffiliates.name });
  if (!removed) throw new Error("Affiliate not found.");

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "config.setting_changed",
    resourceKind: "config",
    resourceId: "product_affiliates",
    before: { name: removed.name },
    after: null,
    reason: `Removed affiliate ${removed.name} from the public list.`,
  });

  revalidatePartnerSurfaces();
}
