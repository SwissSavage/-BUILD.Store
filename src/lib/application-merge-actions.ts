"use server";

/**
 * Admin-side: attach an application to an account that already exists.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS EXISTS SEPARATELY FROM THE AUTOMATIC PATH (2026-11-16)
 *
 * reconcileInboundForNewMember now carries an application onto the
 * account at invite acceptance, which fixes it going forward. It does
 * nothing for the people it already happened to. Their submissions
 * were closed months ago, so the reconcile sweep passes over them:
 * it only looks at rows still in new, in_triage or needs_info.
 *
 * Jamar: "we have folks that accepted invite that went through the
 * signup." Those are the rows this is for.
 *
 * WHY THE EMAIL MATCH IS A SUGGESTION AND NOT A TRIGGER
 *
 * The automatic path can match on email alone because it fires inside
 * a ceremony where the person has just proved control of that address
 * by opening a link sent to it. Nothing like that is true here. An
 * admin is looking at an old form submission, and shared and reused
 * addresses are real: a studio address, a couple, somebody using a
 * partner's email. Writing to the wrong person's profile is not
 * something you discover quickly.
 *
 * So findAccountForApplication proposes, and an admin names the user
 * id that gets written. Email equality is shown as evidence, not
 * acted on.
 * ─────────────────────────────────────────────────────────────
 */
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { inboundSubmissions, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-stub";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import { INBOUND_APPROVED } from "@/lib/inbound-triage";
import {
  describeMerge,
  mergePatch,
  planMerge,
  type MergePlan,
  type MergeCandidate,
  type MergeSourceApplication,
  type MergeTargetUser,
} from "@/lib/application-merge";

const USER_COLUMNS = {
  id: users.id,
  name: users.name,
  firstName: users.firstName,
  lastName: users.lastName,
  bio: users.bio,
  skills: users.skills,
  primaryIndustry: users.primaryIndustry,
  secondaryIndustries: users.secondaryIndustries,
};

const APP_COLUMNS = {
  id: inboundSubmissions.id,
  kind: inboundSubmissions.kind,
  submitter: inboundSubmissions.submitter,
  submitterEmail: inboundSubmissions.submitterEmail,
  keywordTags: inboundSubmissions.keywordTags,
  pillarTags: inboundSubmissions.pillarTags,
  body: inboundSubmissions.body,
};

/**
 * Accounts that might belong to this application. Read-only: it
 * proposes and never writes.
 */
export async function findAccountForApplication(
  submissionId: string,
): Promise<{ candidates: MergeCandidate[]; preview: MergePlan | null }> {
  const admin = await requireAdmin();
  void admin;

  const [app] = await db
    .select(APP_COLUMNS)
    .from(inboundSubmissions)
    .where(eq(inboundSubmissions.id, submissionId))
    .limit(1);
  if (!app?.submitterEmail) return { candidates: [], preview: null };

  const email = app.submitterEmail.trim().toLowerCase();
  const rows = await db
    .select({ ...USER_COLUMNS, handle: users.handle, email: users.email })
    .from(users)
    .where(sql`lower(trim(${users.email})) = ${email}`)
    .limit(5);

  const candidates: MergeCandidate[] = rows.map((u) => ({
    userId: u.id,
    handle: u.handle,
    email: u.email,
    label:
      [u.firstName, u.lastName].filter(Boolean).join(" ").trim() ||
      `@${u.handle}`,
    evidence: `Account email matches the address on the application (${u.email}).`,
  }));

  // Preview against the single obvious match, so the admin sees what
  // would change before agreeing to anything. More than one match
  // means no preview: picking for them is the mistake this avoids.
  const preview =
    rows.length === 1
      ? planMerge(
          app as MergeSourceApplication,
          rows[0] as MergeTargetUser,
        )
      : null;

  return { candidates, preview };
}

/**
 * Attach the application to the named account and carry across
 * whatever the member has not already filled in themselves.
 *
 * The user id comes from the admin, never from the email lookup. See
 * the header.
 */
export async function mergeApplicationIntoAccount(
  formData: FormData,
): Promise<void> {
  // Inlined rather than wrapped: check-server-action-auth matches the
  // auth call inside each exported function body, so a shared helper
  // reads to the guard as an ungated action.
  const admin = await requireAdmin();

  const submissionId = String(formData.get("submissionId") ?? "").trim();
  const userId = String(formData.get("userId") ?? "").trim();
  if (!submissionId || !userId) {
    throw new Error("Both an application and an account are required.");
  }

  const [app] = await db
    .select(APP_COLUMNS)
    .from(inboundSubmissions)
    .where(eq(inboundSubmissions.id, submissionId))
    .limit(1);
  if (!app) throw new Error("Application not found.");

  const [target] = await db
    .select(USER_COLUMNS)
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!target) throw new Error("Account not found.");

  const plan = planMerge(
    app as MergeSourceApplication,
    target as MergeTargetUser,
  );

  if (plan.changes.length > 0) {
    await db.update(users).set(mergePatch(plan)).where(eq(users.id, userId));
  }

  // Audit before the status flip, and record the plan rather than a
  // summary. This wrote to somebody else's profile on an admin's say
  // so, and "which fields changed, from what, to what" has to be
  // reconstructable from the log alone.
  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "inbound.merged_into_account",
    resourceKind: "user",
    resourceId: userId,
    before: Object.fromEntries(plan.changes.map((c) => [c.field, c.from])),
    after: Object.fromEntries(plan.changes.map((c) => [c.field, c.to])),
    reason: `Application ${submissionId}: ${describeMerge(plan)}${
      plan.skipped.length > 0
        ? ` Left alone: ${plan.skipped
            .map((s) => `${s.label} (${s.because})`)
            .join("; ")}.`
        : ""
    }`,
  });

  const now = new Date().toISOString();
  const [existing] = await db
    .select({ note: inboundSubmissions.triageNote })
    .from(inboundSubmissions)
    .where(eq(inboundSubmissions.id, submissionId))
    .limit(1);

  const note = [
    existing?.note?.trim(),
    `Linked to an existing account on ${now.slice(0, 10)}. ${describeMerge(plan)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  await db
    .update(inboundSubmissions)
    .set({
      status: INBOUND_APPROVED,
      linkedResourceId: userId,
      deepLinkHref: `/admin/members/${userId}`,
      triageNote: note,
      updatedAt: now,
    })
    .where(eq(inboundSubmissions.id, submissionId));

  revalidatePath("/admin/inbound");
  revalidatePath(`/admin/members/${userId}`);
}
