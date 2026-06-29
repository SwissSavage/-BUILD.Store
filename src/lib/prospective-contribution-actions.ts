/**
 * Prospective contribution server actions (Phase 2.8 sandbox).
 *
 *   - submitProspectiveContribution
 *       Public, no auth. Validates fields, writes a row to
 *       MOCK_PROSPECTIVE_CONTRIBUTIONS, fans a notification to every
 *       admin so the queue badge lights up, redirects the submitter to
 *       a thank-you page that doesn't reveal queue state.
 *
 *   - decideProspectiveContribution
 *       Admin-only. Moves a row through the
 *       new → contacted → converted/dismissed lifecycle. Writes the
 *       admin's id + an optional note for the queue. Does NOT auto-email
 *       the contributor — outreach happens manually so admin controls
 *       tone (this is a workers' coop, the door isn't an autoresponder).
 *
 * Submitters never sign in here. If a logged-in member ever lands on
 * this action by mistake, the page-level gate on /projects/[id] should
 * route them to the proper /projects/[id] member apply form instead —
 * we don't double-handle them in the action.
 */
"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { MOCK_PROSPECTIVE_CONTRIBUTIONS } from "@/lib/mock-data/prospective-contributions";
import { MOCK_NOTIFICATIONS } from "@/lib/mock-data/notifications";
import { MOCK_USERS } from "@/lib/mock-data/users";
import type {
  Notification,
  ProspectiveContribution,
  ProspectiveContributionStatus,
} from "@/lib/types";

function pushNotification(
  partial: Omit<Notification, "id" | "createdAt" | "readAt">,
): void {
  const id = `ntf_pc_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  MOCK_NOTIFICATIONS.push({
    ...partial,
    id,
    createdAt: new Date().toISOString(),
    readAt: null,
  });
}

function adminUserIds(): string[] {
  return MOCK_USERS.filter((u) => u.isAdmin).map((u) => u.id);
}

/** Cheap email shape check; production swap should use a proper validator. */
function looksLikeEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

export async function submitProspectiveContribution(formData: FormData) {
  const projectId = String(formData.get("projectId") ?? "");
  const contactName = String(formData.get("contactName") ?? "").trim();
  const contactEmail = String(formData.get("contactEmail") ?? "").trim();
  const proposedRole = String(formData.get("proposedRole") ?? "").trim();
  const pitch = String(formData.get("pitch") ?? "").trim();
  const hoursRaw = String(formData.get("hoursPerWeek") ?? "0");
  const portfolioRaw = String(formData.get("portfolioLink") ?? "").trim();

  const project = MOCK_PROJECTS.find((p) => p.id === projectId);
  if (!project) throw new Error("Project not found");
  if (project.kind !== "internal") {
    throw new Error("Outside contributions only apply to internal projects");
  }
  if (project.status !== "open" && project.status !== "in_progress") {
    throw new Error("This initiative isn't open to new contributors");
  }
  if (!contactName) throw new Error("Name is required");
  if (!looksLikeEmail(contactEmail)) {
    throw new Error("A valid email is required so we can reach you");
  }
  if (!proposedRole) throw new Error("Tell us the role you'd take");
  if (pitch.length < 40) {
    throw new Error("Pitch must be at least 40 characters");
  }

  const hoursPerWeek = Math.max(0, Math.min(60, Number(hoursRaw) || 0));
  const portfolioLink = portfolioRaw.length > 0 ? portfolioRaw : null;

  const id = `pc_${Date.now().toString(36)}`;
  const row: ProspectiveContribution = {
    id,
    projectId,
    contactName,
    contactEmail,
    proposedRole,
    pitch,
    hoursPerWeek,
    portfolioLink,
    status: "new",
    reviewedBy: null,
    reviewedAt: null,
    adminNote: null,
    createdAt: new Date().toISOString(),
  };
  MOCK_PROSPECTIVE_CONTRIBUTIONS.push(row);

  // Fan a heads-up to every admin so the queue light flips immediately.
  for (const adminId of adminUserIds()) {
    pushNotification({
      userId: adminId,
      kind: "prospective_contribution",
      title: `Outside offer — ${project.title}`,
      body: `${contactName} offered to help as "${proposedRole}". Triage in /admin/projects/contributions.`,
      href: "/admin/projects/contributions",
    });
  }

  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/admin/projects/contributions");
  revalidatePath("/notifications");
  redirect(`/projects/${projectId}/contribute/thanks`);
}

export async function decideProspectiveContribution(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required");
  if (!user.isAdmin) throw new Error("Admin access required");

  const id = String(formData.get("id") ?? "");
  const next = String(
    formData.get("status") ?? "",
  ) as ProspectiveContributionStatus;
  const adminNote = String(formData.get("adminNote") ?? "").trim();

  const row = MOCK_PROSPECTIVE_CONTRIBUTIONS.find((c) => c.id === id);
  if (!row) throw new Error("Row not found");

  const ALLOWED: ProspectiveContributionStatus[] = [
    "new",
    "contacted",
    "converted",
    "dismissed",
  ];
  if (!ALLOWED.includes(next)) throw new Error("Unknown status");

  row.status = next;
  row.reviewedBy = user.id;
  row.reviewedAt = new Date().toISOString();
  if (adminNote.length > 0) row.adminNote = adminNote;

  revalidatePath("/admin/projects/contributions");
  revalidatePath(`/projects/${row.projectId}`);
}
