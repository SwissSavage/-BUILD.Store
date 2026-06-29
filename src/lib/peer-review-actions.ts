/**
 * Peer review server action (Phase 2.7 sandbox).
 *
 * Submitter must be signed-in AND on the project's `assignedMemberIds`,
 * AND the project must be `status === "completed"`, AND the team must
 * have >1 contributor. One-person engagements skip this rail entirely.
 *
 * Anonymity posture (locked 2026-04-25): the review row stores
 * `reviewerId` for admin auditability, but every contributor-facing
 * surface that renders the review must hide that field. Only
 * `/admin/feedback` renders the attribution.
 *
 * REPLACE WITH: insert into `peer_reviews` Drizzle table inside a
 * transaction that also fires the `peer_review_requested` and
 * `testimonial_published` notifications via the same fanout pattern as
 * the order/project rails.
 */
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { MOCK_PEER_REVIEWS } from "@/lib/mock-data/peer-reviews";
import { MOCK_NOTIFICATIONS } from "@/lib/mock-data/notifications";
import type { Notification, PeerReview, ReviewContextKind } from "@/lib/types";

function pushNotification(
  partial: Omit<Notification, "id" | "createdAt" | "readAt">,
): void {
  const id = `ntf_pr_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  MOCK_NOTIFICATIONS.push({
    ...partial,
    id,
    createdAt: new Date().toISOString(),
    readAt: null,
  });
}

function clampStar(raw: FormDataEntryValue | null, field: string): number {
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1 || n > 5) {
    throw new Error(`${field} must be 1–5`);
  }
  return Math.round(n);
}

export async function submitPeerReview(formData: FormData) {
  const reviewer = await getCurrentUser();
  if (!reviewer) throw new Error("Sign in required");

  const projectId = String(formData.get("projectId") ?? "");
  const revieweeId = String(formData.get("revieweeId") ?? "");
  const project = MOCK_PROJECTS.find((p) => p.id === projectId);
  if (!project) throw new Error("Project not found");

  // Gate: only completed projects, only team members on the project,
  // only multi-person teams, never reviewing yourself.
  if (project.status !== "completed") {
    throw new Error("Peer review opens once the project is marked completed");
  }
  if (!project.assignedMemberIds.includes(reviewer.id)) {
    throw new Error("Only contributors on this project can leave reviews");
  }
  if (project.assignedMemberIds.length < 2) {
    throw new Error("Solo engagements skip peer review");
  }
  if (revieweeId === reviewer.id) {
    throw new Error("You can't review yourself");
  }
  if (!project.assignedMemberIds.includes(revieweeId)) {
    throw new Error("That person wasn't on the team for this project");
  }
  // No duplicate reviews — DB will enforce with a unique index in prod.
  const already = MOCK_PEER_REVIEWS.some(
    (r) =>
      r.contextId === projectId &&
      r.reviewerId === reviewer.id &&
      r.revieweeId === revieweeId,
  );
  if (already) {
    throw new Error("You've already reviewed this teammate on this project");
  }

  const stars = clampStar(formData.get("stars"), "Overall stars");
  const collaboration = clampStar(
    formData.get("collaboration"),
    "Collaboration",
  );
  const craft = clampStar(formData.get("craft"), "Craft");
  const reliability = clampStar(formData.get("reliability"), "Reliability");
  const prose = String(formData.get("prose") ?? "").trim();
  if (prose.length < 20) {
    throw new Error("Prose must be at least 20 characters — say something real");
  }

  const contextKind: ReviewContextKind =
    project.kind === "internal" ? "internal_project" : "contract";

  const review: PeerReview = {
    id: `pr_${Date.now().toString(36)}_${Math.random()
      .toString(36)
      .slice(2, 6)}`,
    contextKind,
    contextId: projectId,
    reviewerId: reviewer.id,
    revieweeId,
    stars,
    collaboration,
    craft,
    reliability,
    prose,
    createdAt: new Date().toISOString(),
  };
  MOCK_PEER_REVIEWS.push(review);

  // Notify reviewee — anonymous body (no reviewer identity leaks here).
  pushNotification({
    userId: revieweeId,
    kind: "peer_review_requested",
    title: `New peer review on ${project.title}`,
    body: `A teammate left a ${stars}-star review on your work. Open your profile to see it.`,
    href: `/profile`,
  });

  revalidatePath(`/projects/${projectId}`);
  revalidatePath(`/contracts/${projectId}`);
  revalidatePath(`/admin/feedback`);
}
