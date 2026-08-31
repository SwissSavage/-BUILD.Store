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
import { jobApplications, projectApplications, projects } from "@/db/schema";
import { getCurrentUser, requireAdmin } from "@/lib/auth-stub";
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
export async function submitJobApplication(formData: FormData): Promise<void> {
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

  if (!jobId) throw new Error("jobId is required");
  if (pitch.length < 20) {
    throw new Error(
      "Pitch is too short — write at least a couple sentences so admin can route it properly.",
    );
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
      throw new Error(
        "You've already applied to this role. Admin will reply soon.",
      );
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

  revalidatePath(`/jobs/${jobId}`);
  revalidatePath("/admin/jobs/applications");
}

/**
 * Submit a bid on a contract. Called from the sign-in-gated form on
 * /contracts/[id]. Reuses the project_applications table since
 * contracts are projects (kind='contract'). Admin queue lives at
 * /admin/projects/applications.
 */
export async function submitContractBid(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const contractId = String(formData.get("contractId") ?? "").trim();
  const pitch = String(formData.get("pitch") ?? "").trim();
  const proposedRole = String(formData.get("proposedRole") ?? "").trim();
  const hoursPerWeekRaw = String(formData.get("hoursPerWeek") ?? "").trim();
  const hourlyRateRaw = String(formData.get("hourlyRate") ?? "").trim();
  const portfolioLink = String(formData.get("portfolioLink") ?? "").trim();

  if (!contractId) throw new Error("contractId is required");
  if (pitch.length < 20) {
    throw new Error(
      "Pitch is too short — write at least a couple sentences so admin can route it properly.",
    );
  }

  // Global bid range validation (task #48). Talent sets their own
  // rates; this catches typos, missing decimals, and truly-out-of-band
  // inputs. Unusual-but-valid rates are handled through admin triage
  // on the pending queue, not through algorithmic tightening.
  const proposedRate = Number.parseFloat(hourlyRateRaw);
  const rateBounds = computeRateBounds(user);
  const rateError = validateRateAgainstBounds(proposedRate, rateBounds);
  if (rateError) throw new Error(rateError);

  // Verify the contract exists, is an approved-RFP open contract.
  // Cheap sanity — the form only renders for valid contracts, but
  // don't trust the FormData over the source of truth.
  const [contract] = await db
    .select({
      id: projects.id,
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
    throw new Error("Contract is not open for bidding.");
  }

  // Duplicate check — project_applications doesn't have a unique index
  // by default, so check explicitly. Race-safe enough for MVP; a
  // stricter guarantee lands with the index migration.
  const [existing] = await db
    .select({ id: projectApplications.id })
    .from(projectApplications)
    .where(
      and(
        eq(projectApplications.projectId, contractId),
        eq(projectApplications.userId, user.id),
        sql`${projectApplications.status} IN ('pending', 'approved')`,
      ),
    )
    .limit(1);
  if (existing) {
    throw new Error(
      "You've already bid on this contract. Admin will reply soon.",
    );
  }

  const id = newApplicationId("bid");
  const now = new Date().toISOString();
  const hoursPerWeek = Number.parseInt(hoursPerWeekRaw, 10) || 0;

  await db.insert(projectApplications).values({
    id,
    projectId: contractId,
    userId: user.id,
    proposedRole: proposedRole.length > 0 ? proposedRole : "Contractor",
    pitch,
    hoursPerWeek,
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

  revalidatePath(`/contracts/${contractId}`);
  revalidatePath("/admin/projects/applications");
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
