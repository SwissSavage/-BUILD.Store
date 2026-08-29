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
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { peerReviews } from "@/db/schema";
import { getProjectById } from "@/lib/readers/projects";

import { MOCK_NOTIFICATIONS } from "@/lib/mock-data/notifications";
import type { Notification, PeerReview, ReviewContextKind } from "@/lib/types";
import { notify } from "@/lib/writers/notifications";

async function pushNotification(
  partial: Omit<Notification, "id" | "createdAt" | "readAt">,
): Promise<void> {
  // Writer swap 2026-08-28: delegates to the shared Postgres writer.
  // Was an in-memory push, so these notifications never survived a
  // deploy and the bell icon was effectively decorative.
  await notify(partial);
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
  const project = await getProjectById(projectId);
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
  // One review per reviewer/reviewee/project. Checked here for a
  // clean error message; the unique index in migration 0014 is what
  // actually guarantees it under concurrency.
  const [already] = await db
    .select({ id: peerReviews.id })
    .from(peerReviews)
    .where(
      and(
        eq(peerReviews.contextId, projectId),
        eq(peerReviews.reviewerId, reviewer.id),
        eq(peerReviews.revieweeId, revieweeId),
      ),
    )
    .limit(1);
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
  const professionalism = clampStar(
    formData.get("professionalism"),
    "Professionalism",
  );
  const communication = clampStar(
    formData.get("communication"),
    "Communication",
  );
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
    professionalism,
    communication,
    prose,
    createdAt: new Date().toISOString(),
  };
  // Writer swap 2026-08-28: was an in-memory push, so peer reviews
  // never reached the MVP score aggregation that depends on them.
  await db.insert(peerReviews).values({
    id: review.id,
    contextKind: review.contextKind,
    contextId: review.contextId,
    reviewerId: review.reviewerId,
    revieweeId: review.revieweeId,
    stars: review.stars,
    collaboration: review.collaboration,
    craft: review.craft,
    reliability: review.reliability,
    professionalism: review.professionalism,
    communication: review.communication,
    prose: review.prose,
    createdAt: review.createdAt,
  });

  // Notify reviewee — anonymous body (no reviewer identity leaks here).
  await pushNotification({
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
