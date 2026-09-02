"use server";

/**
 * Server actions for the public-facing apply/bid flow.
 *
 * Two entry points that mirror the /jobs and /contracts split:
 *   - submitJobApplication(jobId, ...) — writes job_applications row
 *   - submitContractBid(contractId, ...) — writes project_applications row
 *     (contracts ARE projects with kind='contract', so this reuses the
 *     existing table and admin queue at /admin/projects/applications)
 *
 * Both require an authenticated user, both are idempotent on double-
 * submit (unique index blocks a second active row for the same
 * user/target pair), both fire an audit-log entry so admin sees the
 * intake without polling.
 */

import { revalidatePath } from "next/cache";
import { notify } from "@/lib/writers/notifications";
import { redirect } from "next/navigation";
import { randomBytes } from "crypto";
import { eq, and, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { jobApplications, jobs, projectApplications, projects } from "@/db/schema";
import { getCurrentUser, requireAdmin } from "@/lib/auth-stub";
import { getAdminUsers } from "@/lib/readers/users";
import { publicName } from "@/lib/types";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import { MOCK_NOTIFICATIONS } from "@/lib/mock-data/notifications";
import {
  computeRateBounds,
  validateRateAgainstBounds,
} from "@/lib/rate-bounds";

function newApplicationId(prefix: "app" | "bid"): string {
  return `${prefix}_${randomBytes(6).toString("hex")}`;
}

/**
 * Submit an application to a job posting. Called from the sign-in-gated
 * form on /jobs/[id]. Blocks duplicate pending/approved rows via the
 * unique index on (job_id, user_id) — a second submit while the first
 * is still open surfaces as a graceful "already applied" message
 * rather than an error page.
 */
export async function submitJobApplication(
  formData: FormData,
): Promise<ProposalResult> {
  return guarded("JOB_APPLICATION_FAILED", () =>
    submitJobApplicationInner(formData),
  );
}

async function submitJobApplicationInner(
  formData: FormData,
): Promise<ProposalResult> {
  const user = await getCurrentUser();
  if (!user) {
    // Should never happen — form is only rendered for signed-in users.
    // Belt-and-suspenders redirect keeps the action safe if someone
    // POSTs it directly.
    redirect("/signin");
  }

  const jobId = String(formData.get("jobId") ?? "").trim();
  const pitch = String(formData.get("pitch") ?? "").trim();
  const portfolioLink = String(formData.get("portfolioLink") ?? "").trim();
  const desiredCompensation = String(
    formData.get("desiredCompensation") ?? "",
  ).trim();

  if (!jobId) {
    return { ok: false, message: "Missing role reference. Reload the page and try again." };
  }
  if (pitch.length < 20) {
    return {
      ok: false,
      message:
        "Pitch is too short. Write at least a couple of sentences so this can be routed properly.",
    };
  }

  const id = newApplicationId("app");
  const now = new Date().toISOString();

  try {
    await db.insert(jobApplications).values({
      id,
      jobId,
      userId: user.id,
      pitch,
      portfolioLink: portfolioLink.length > 0 ? portfolioLink : null,
      desiredCompensation: desiredCompensation.length > 0 ? desiredCompensation : null,
      status: "pending",
      createdAt: now,
    });
  } catch (err) {
    // Unique-index collision = user already has an active application.
    // Message stays friendly rather than dumping the raw DB error.
    if (isUniqueViolation(err)) {
      return {
        ok: false,
        message:
          "You have already applied to this role. Your application is in the queue awaiting selection.",
      };
    }
    throw err;
  }

  await logAuditEvent({
    actorUserId: user.id,
    actorRoleSnapshot: snapshotActorRole(user),
    action: "user.applied",
    resourceKind: "user",
    resourceId: id,
    before: null,
    after: { jobId, pitch: pitch.slice(0, 80) },
    reason: `Job application ${id} for job ${jobId}`,
  });

  const [job] = await db
    .select({ title: jobs.title })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);

  await notifyAdminsOfProposal({
    title: `New application — ${job?.title ?? "job"}`,
    body: `${publicName(user)} applied. Review in the applications queue.`,
    href: "/admin/jobs/applications",
  });

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/admin/jobs/applications");
  revalidatePath("/notifications");
  return {
    ok: true,
    mode: "created",
    message: "Application submitted. You will hear back once the team is picked.",
  };
}

/**
 * Result of a proposal submission.
 *
 * RETURNED, NOT THROWN. Next.js strips server-action error messages in
 * production builds, so every `throw new Error("...")` in here reached
 * the contractor as "An error occurred in the Server Components render.
 * The specific message is omitted in production builds." Bayu hit that
 * resubmitting a proposal and had no way to know his first one had
 * actually saved.
 *
 * Expected outcomes are values. Only genuine faults throw.
 */
export type ProposalResult = {
  ok: boolean;
  message: string;
  mode?: "created" | "updated";
  /** Correlation id for a server-side fault. Matches the server log. */
  ref?: string;
};

/**
 * A `redirect()` in flight, not a failure.
 *
 * next/navigation implements redirect by throwing. A bare catch around
 * an action swallows it, and the user sits on a dead form instead of
 * being sent to sign in.
 */
function isRedirectError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const digest = (err as { digest?: unknown }).digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}

/**
 * Run the write half of a submission, converting an unexpected fault
 * into something the contractor can report.
 *
 * Next.js strips server-action error messages in production, so a
 * thrown exception reaches the browser as "An error occurred in the
 * Server Components render." That is unreadable to the person hitting
 * it AND useless to us: two contractors hit it and we could not tell
 * whether it was the same cause.
 *
 * So the real error gets logged server-side against a short reference,
 * and the reference goes to the contractor. They report six characters,
 * we grep the container logs, and the guessing stops.
 */
async function guarded(
  label: string,
  run: () => Promise<ProposalResult>,
): Promise<ProposalResult> {
  try {
    return await run();
  } catch (err) {
    if (isRedirectError(err)) throw err;
    const ref = randomBytes(3).toString("hex").toUpperCase();
    console.error(`${label} ref=${ref}`, err);
    return {
      ok: false,
      ref,
      message: `Something broke on our end and this was not saved. Nothing you did caused it. Send admin reference ${ref} and we can pull the exact cause from the logs.`,
    };
  }
}

/**
 * Submit or revise a proposal on a contract. Called from the
 * sign-in-gated form on /contracts/[id]. Reuses the
 * project_applications table since contracts are projects
 * (kind='contract'). Admin queue lives at /admin/projects/applications.
 *
 * A second submission while the first is still pending is an EDIT, not
 * an error. Someone revising their pitch is doing the thing the form is
 * for, and the old behaviour — refuse, and refuse illegibly — treated a
 * correction as a violation.
 */
export async function submitContractBid(
  formData: FormData,
): Promise<ProposalResult> {
  return guarded("PROPOSAL_SUBMIT_FAILED", () =>
    submitContractBidInner(formData),
  );
}

async function submitContractBidInner(
  formData: FormData,
): Promise<ProposalResult> {
  return guarded("PROPOSAL_SUBMIT_FAILED", () => contractBid(formData));
}

async function contractBid(formData: FormData): Promise<ProposalResult> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const contractId = String(formData.get("contractId") ?? "").trim();
  const pitch = String(formData.get("pitch") ?? "").trim();
  const proposedRole = String(formData.get("proposedRole") ?? "").trim();
  const hoursPerWeekRaw = String(formData.get("hoursPerWeek") ?? "").trim();
  const hourlyRateRaw = String(formData.get("hourlyRate") ?? "").trim();
  const portfolioLink = String(formData.get("portfolioLink") ?? "").trim();

  if (!contractId) {
    return { ok: false, message: "Missing contract reference. Reload the page and try again." };
  }
  if (pitch.length < 20) {
    return {
      ok: false,
      message:
        "Pitch is too short. Write at least a couple of sentences so this can be routed properly.",
    };
  }

  // Global bid range validation (task #48). Talent sets their own
  // rates; this catches typos, missing decimals, and truly-out-of-band
  // inputs. Unusual-but-valid rates are handled through admin triage
  // on the pending queue, not through algorithmic tightening.
  const proposedRate = Number.parseFloat(hourlyRateRaw);
  const rateBounds = computeRateBounds(user);
  const rateError = validateRateAgainstBounds(proposedRate, rateBounds);
  if (rateError) return { ok: false, message: rateError };

  // Verify the contract exists, is an approved-RFP open contract.
  // Cheap sanity — the form only renders for valid contracts, but
  // don't trust the FormData over the source of truth.
  const [contract] = await db
    .select({
      id: projects.id,
      title: projects.title,
      kind: projects.kind,
      status: projects.status,
      isRfp: projects.isRfp,
      rfpApprovedAt: projects.rfpApprovedAt,
    })
    .from(projects)
    .where(eq(projects.id, contractId))
    .limit(1);

  if (
    !contract ||
    contract.kind !== "contract" ||
    !contract.isRfp ||
    contract.status !== "open" ||
    !contract.rfpApprovedAt
  ) {
    return {
      ok: false,
      message: "This contract is no longer open for proposals.",
    };
  }

  // An existing proposal is an EDIT TARGET, not a collision.
  const [existing] = await db
    .select({ id: projectApplications.id, status: projectApplications.status })
    .from(projectApplications)
    .where(
      and(
        eq(projectApplications.projectId, contractId),
        eq(projectApplications.userId, user.id),
        sql`${projectApplications.status} IN ('pending', 'approved')`,
      ),
    )
    .limit(1);

  const hoursPerWeekParsed = Number.parseInt(hoursPerWeekRaw, 10) || 0;

  if (existing && existing.status === "approved") {
    // Already selected. Terms are locked at acceptance, so a silent
    // rewrite here would change an engagement that both sides agreed
    // to. Say what happened and route them to a human.
    return {
      ok: false,
      message:
        "You have already been selected for this contract, so the terms are locked. Message admin if something needs to change.",
    };
  }

  if (existing) {
    // Revise in place. Same row, so the admin queue shows one current
    // proposal per contractor rather than a pile of near-duplicates.
    await db
      .update(projectApplications)
      .set({
        proposedRole: proposedRole.length > 0 ? proposedRole : "Contractor",
        pitch,
        hoursPerWeek: hoursPerWeekParsed,
        hourlyRate: proposedRate.toFixed(2),
        portfolioLink: portfolioLink.length > 0 ? portfolioLink : null,
      })
      .where(eq(projectApplications.id, existing.id));

    await logAuditEvent({
      actorUserId: user.id,
      actorRoleSnapshot: snapshotActorRole(user),
      action: "user.applied",
      resourceKind: "user",
      resourceId: existing.id,
      before: null,
      after: { contractId, pitch: pitch.slice(0, 80), revised: true },
      reason: `Contract bid ${existing.id} revised on contract ${contractId}`,
    });

    await notifyAdminsOfProposal({
      title: `Proposal updated — ${contract.title}`,
      body: `${publicName(user)} revised their proposal. Review it in the proposals queue.`,
      href: "/admin/projects/applications",
    });

    revalidatePath(`/contracts/${contractId}`);
    revalidatePath("/admin/projects/applications");
    revalidatePath("/notifications");
    return {
      ok: true,
      mode: "updated",
      message: "Proposal updated. Your earlier version has been replaced.",
    };
  }

  const id = newApplicationId("bid");
  const now = new Date().toISOString();

  await db.insert(projectApplications).values({
    id,
    projectId: contractId,
    userId: user.id,
    proposedRole: proposedRole.length > 0 ? proposedRole : "Contractor",
    pitch,
    hoursPerWeek: hoursPerWeekParsed,
    hourlyRate: proposedRate.toFixed(2),
    portfolioLink: portfolioLink.length > 0 ? portfolioLink : null,
    status: "pending",
    createdAt: now,
  });

  await logAuditEvent({
    actorUserId: user.id,
    actorRoleSnapshot: snapshotActorRole(user),
    action: "user.applied",
    resourceKind: "user",
    resourceId: id,
    before: null,
    after: { contractId, pitch: pitch.slice(0, 80) },
    reason: `Contract bid ${id} on contract ${contractId}`,
  });

  await notifyAdminsOfProposal({
    title: `New proposal — ${contract.title}`,
    body: `${publicName(user)} submitted a proposal. Review it in the proposals queue.`,
    href: "/admin/projects/applications",
  });

  revalidatePath(`/contracts/${contractId}`);
  revalidatePath("/admin/projects/applications");
  revalidatePath("/notifications");
  return {
    ok: true,
    mode: "created",
    message: "Proposal submitted. You can revise it any time before selection.",
  };
}

/**
 * Tell every admin a proposal came in.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-01)
 *
 * Both submit paths wrote the row and stopped. Only the DECISION
 * notified anyone, and it notified the applicant — so a contractor
 * could submit a proposal and nobody on the FM side learned about it
 * until someone happened to open the triage queue. Jamar: "still not
 * getting notifications when proposals are submitted."
 *
 * Best-effort by design. A notification that fails must not roll back
 * a proposal that was already accepted — the contractor did their part
 * and the row is committed. Failure is logged for the operator instead
 * of thrown at the applicant.
 * ─────────────────────────────────────────────────────────────
 */
async function notifyAdminsOfProposal(input: {
  title: string;
  body: string;
  href: string;
}): Promise<void> {
  try {
    const { users } = await getAdminUsers();
    await Promise.all(
      users.map((admin) =>
        notify({
          userId: admin.id,
          kind: "project_application",
          title: input.title,
          body: input.body,
          href: input.href,
        }),
      ),
    );
  } catch (err) {
    console.error("PROPOSAL_NOTIFY_FAILED", input.href, err);
  }
}

/**
 * Postgres unique-violation error class. `pg` surfaces the code as
 * `23505`; the underlying error shape isn't in the typings we import,
 * so we duck-type carefully.
 */
function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: unknown }).code;
  return code === "23505";
}

/**
 * Admin review of a job application (task #42). Approving or rejecting
 * flips status + stamps reviewer + note, then fires a notification to
 * the applicant. Withdrawing is a separate path the applicant owns —
 * this action is admin-only.
 *
 * Idempotent-ish: re-reviewing an already-decided row updates the
 * decision + timestamp + note. Rare use case but harmless.
 */
export async function reviewJobApplication(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const id = String(formData.get("id") ?? "").trim();
  const decisionRaw = String(formData.get("decision") ?? "").trim();
  const note = String(formData.get("adminNote") ?? "").trim();
  if (!id) throw new Error("id is required");
  if (decisionRaw !== "approved" && decisionRaw !== "rejected") {
    throw new Error("decision must be approved or rejected");
  }
  const decision = decisionRaw as "approved" | "rejected";
  const now = new Date().toISOString();

  const [existing] = await db
    .select({
      id: jobApplications.id,
      jobId: jobApplications.jobId,
      userId: jobApplications.userId,
      status: jobApplications.status,
    })
    .from(jobApplications)
    .where(eq(jobApplications.id, id))
    .limit(1);
  if (!existing) throw new Error("Application not found");

  await db
    .update(jobApplications)
    .set({
      status: decision,
      reviewedBy: admin.id,
      reviewedAt: now,
      adminNote: note.length > 0 ? note : null,
    })
    .where(eq(jobApplications.id, id));

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: decision === "approved" ? "user.applied" : "user.applied",
    resourceKind: "user",
    resourceId: id,
    before: { status: existing.status },
    after: { status: decision, note: note.length > 0 ? note : null },
    reason: `Job application ${id} ${decision} by admin.`,
  });

  // Applicant-facing ping. Notification kind reused from the peer
  // review / status change family since we don't have a dedicated
  // job_application_decision kind yet — the title + body carry the
  // context. Follow-up: introduce a distinct NotificationKind.
  await notify({
    userId: existing.userId,
    kind: "project_application_decision",
    title:
      decision === "approved"
        ? "Your job application was accepted"
        : "Update on your job application",
    body:
      decision === "approved"
        ? "Admin routed you to the client for next steps. Watch your inbox for follow-up."
        : note.length > 0
          ? `Not this round. Note from admin: ${note}`
          : "Not this round. Admin didn't leave a note — feel free to apply to other open roles.",
    href: `/jobs/${existing.jobId}`,
  });

  revalidatePath("/admin/jobs/applications");
}
