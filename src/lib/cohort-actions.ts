/**
 * Cohort spotlight admin actions.
 *
 * Author monthly onboarding spotlights — the forward-looking
 * editorial rail highlighting cooperators joining the cooperative in
 * real time. Complements the Future Modernist of the Month
 * (backward-looking, honoring shipped work) and annual Canonization
 * (year-end standing minted on-chain).
 *
 * Sandbox: mutate the in-memory MOCK_COHORT_SPOTLIGHTS store.
 * Production: persist to `cohort_spotlights` with an append-only
 * event log; a bot could pre-fill a draft when a new Member's
 * `createdAt` bucket lands, admin publishes.
 */
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-stub";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { MOCK_COHORT_SPOTLIGHTS } from "@/lib/mock-data/cohort-spotlights";
import {
  logAuditEvent,
  snapshotActorRole,
} from "@/lib/mock-data/audit-log";
import type { CohortSpotlight } from "@/lib/types";

function newSpotlightId(): string {
  return `cohort_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 5)}`;
}

/**
 * Format a period key like "2026-07" into a human label like
 * "July 2026". Keeps the surfaces consistent whether admin passes
 * a label explicitly or relies on the default from the key.
 */
function labelFromPeriodKey(periodKey: string): string {
  const [yearStr, monthStr] = periodKey.split("-");
  const year = Number.parseInt(yearStr, 10);
  const month = Number.parseInt(monthStr, 10);
  if (
    Number.isNaN(year) ||
    Number.isNaN(month) ||
    month < 1 ||
    month > 12
  ) {
    return periodKey;
  }
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

/**
 * Author a new cohort spotlight for a given period. Admin picks the
 * period key (year-month, e.g. "2026-07"), one or more cooperators to
 * spotlight, an editorial headline, and a narrative. Duplicate
 * spotlights per period are blocked — remove the existing one first
 * if the plan changes.
 */
export async function createCohortSpotlight(formData: FormData) {
  const admin = await requireAdmin();

  const periodKey = String(formData.get("periodKey") ?? "").trim();
  const headline = String(formData.get("headline") ?? "").trim();
  const narrative = String(formData.get("narrative") ?? "").trim();
  const paragraphSlugRaw = String(
    formData.get("paragraphSlug") ?? "",
  ).trim();
  const paragraphSlug = paragraphSlugRaw.length > 0 ? paragraphSlugRaw : undefined;

  // userIds arrive as multiple form entries under the same name.
  const userIds = formData
    .getAll("userIds")
    .map((v) => String(v).trim())
    .filter((v) => v.length > 0);

  if (!/^\d{4}-\d{2}$/.test(periodKey)) {
    throw new Error(
      "Period key must be in year-month format (e.g. 2026-07).",
    );
  }
  if (headline.length < 6) {
    throw new Error("Headline is too short — write it as a sentence.");
  }
  if (narrative.length < 50) {
    throw new Error(
      "Narrative must be at least 50 characters — spotlights ship with editorial weight.",
    );
  }
  if (userIds.length === 0) {
    throw new Error("Pick at least one cooperator to spotlight.");
  }
  if (userIds.length > 3) {
    throw new Error(
      "Spotlight up to three cooperators per period — the rail favors focus.",
    );
  }

  // Validate every userId resolves to a real Member/Partner.
  for (const uid of userIds) {
    const target = MOCK_USERS.find((u) => u.id === uid);
    if (!target) {
      throw new Error(`Unknown cooperator: ${uid}`);
    }
  }

  // Block duplicates on the same period. Change requires explicit
  // removal + re-create so the intent shows up in the audit trail.
  if (MOCK_COHORT_SPOTLIGHTS.some((s) => s.periodKey === periodKey)) {
    throw new Error(
      `A spotlight already exists for ${labelFromPeriodKey(periodKey)}. Remove it before authoring a new one.`,
    );
  }

  const row: CohortSpotlight = {
    id: newSpotlightId(),
    periodKey,
    periodLabel: labelFromPeriodKey(periodKey),
    userIds,
    headline,
    narrative,
    paragraphSlug,
    publishedAt: new Date().toISOString(),
    selectedByUserId: admin.id,
  };
  MOCK_COHORT_SPOTLIGHTS.push(row);

  logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "cohort.spotlight_created",
    resourceKind: "cohort_spotlight",
    resourceId: row.id,
    before: null,
    after: {
      periodKey,
      periodLabel: row.periodLabel,
      userIds,
      headline,
    },
    reason: narrative.slice(0, 400),
  });

  revalidatePath("/cohort");
  revalidatePath(`/cohort/${periodKey}`);
  revalidatePath("/");
  revalidatePath("/admin/cohort");
}

/**
 * Remove an existing spotlight. Sandbox mutates the array; production
 * should switch to soft-delete + audit-preserved removal record.
 */
export async function removeCohortSpotlight(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Spotlight id is required.");

  const idx = MOCK_COHORT_SPOTLIGHTS.findIndex((s) => s.id === id);
  if (idx === -1) throw new Error("Spotlight not found.");

  const [removed] = MOCK_COHORT_SPOTLIGHTS.splice(idx, 1);

  logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "cohort.spotlight_removed",
    resourceKind: "cohort_spotlight",
    resourceId: removed.id,
    before: {
      periodKey: removed.periodKey,
      periodLabel: removed.periodLabel,
      userIds: removed.userIds,
      headline: removed.headline,
    },
    after: null,
    reason: null,
  });

  revalidatePath("/cohort");
  revalidatePath(`/cohort/${removed.periodKey}`);
  revalidatePath("/");
  revalidatePath("/admin/cohort");
}
