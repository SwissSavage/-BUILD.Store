/**
 * Peer review section (Phase 2.7 sandbox).
 *
 * Renders only when:
 *   - project.status === "completed"
 *   - currentUser is on project.assignedMemberIds
 *   - project.assignedMemberIds.length >= 2 (skip solo)
 *
 * For each teammate (≠ self) the section shows EITHER:
 *   - A "submitted ✓" stub (if currentUser has already reviewed them)
 *   - An inline form posting to `submitPeerReview`
 *
 * Anonymity posture: this surface is rendered to the REVIEWER only.
 * Reviewees see aggregate stars on /u/[handle], never reviewer identity.
 */
import { MOCK_USERS } from "@/lib/mock-data/users";
import {
  reviewsByUser,
  hasReviewed,
} from "@/lib/mock-data/peer-reviews";
import { submitPeerReview } from "@/lib/peer-review-actions";
import { publicName, type Project, type User } from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

export function PeerReviewSection({
  project,
  user,
}: {
  project: Project;
  user: User;
}) {
  if (project.status !== "completed") return null;
  if (!project.assignedMemberIds.includes(user.id)) return null;
  if (project.assignedMemberIds.length < 2) return null;

  const teammates = project.assignedMemberIds
    .filter((id) => id !== user.id)
    .map((id) => MOCK_USERS.find((u) => u.id === id))
    .filter((u): u is User => Boolean(u));

  const myReviews = reviewsByUser(user.id).filter(
    (r) => r.contextId === project.id,
  );

  return (
    <Card className="border-[#5070F0]/40">
      <CardEyebrow>Peer review</CardEyebrow>
      <CardTitle className="mt-2">
        Review your {teammates.length}{" "}
        {teammates.length === 1 ? "collaborator" : "collaborators"}
      </CardTitle>
      <p className="mt-2 text-sm text-ink-muted">
        Leave a short rating per teammate now that {project.title} is wrapped.
        Reviews stay anonymous to the reviewee — only admin sees attribution
        for calibration.
      </p>

      <div className="mt-5 space-y-4">
        {teammates.map((teammate) => {
          const already = hasReviewed(project.id, user.id, teammate.id);
          if (already) {
            const mine = myReviews.find((r) => r.revieweeId === teammate.id);
            return (
              <ReviewedStub
                key={teammate.id}
                teammate={teammate}
                stars={mine?.stars ?? 0}
              />
            );
          }
          return (
            <ReviewForm
              key={teammate.id}
              teammate={teammate}
              projectId={project.id}
            />
          );
        })}
      </div>
    </Card>
  );
}

function ReviewedStub({
  teammate,
  stars,
}: {
  teammate: User;
  stars: number;
}) {
  return (
    <div className="rounded-lg border border-[#007048]/40 bg-[#007048]/5 px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{publicName(teammate)}</span>
        <span className="text-xs uppercase tracking-wider text-[#007048]">
          Submitted · {stars}★
        </span>
      </div>
    </div>
  );
}

function ReviewForm({
  teammate,
  projectId,
}: {
  teammate: User;
  projectId: string;
}) {
  return (
    <form
      action={submitPeerReview}
      className="rounded-lg border border-[var(--surface-border)] p-4 space-y-3"
    >
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="revieweeId" value={teammate.id} />

      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{publicName(teammate)}</span>
        <span className="text-[10px] uppercase tracking-wider text-ink-faint">
          Anonymous to {publicName(teammate).split(" ")[0]}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <StarSelect
          name="stars"
          label="Overall"
          autoFocus
        />
        <StarSelect name="collaboration" label="Collaboration" />
        <StarSelect name="craft" label="Craft" />
        <StarSelect name="reliability" label="Reliability" />
      </div>

      <div>
        <label
          htmlFor={`prose-${teammate.id}`}
          className="block text-[11px] uppercase tracking-wider text-ink-muted"
        >
          What stood out? (≥ 20 chars)
        </label>
        <textarea
          id={`prose-${teammate.id}`}
          name="prose"
          required
          rows={3}
          minLength={20}
          placeholder="Be specific — admin will use this to calibrate, and the aggregate rolls up to their profile."
          className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
        />
      </div>

      <button
        type="submit"
        className="rounded-full px-4 py-1.5 text-xs font-medium text-white"
        style={{ backgroundColor: "#5070F0" }}
      >
        Submit review
      </button>
    </form>
  );
}

function StarSelect({
  name,
  label,
  autoFocus,
}: {
  name: string;
  label: string;
  autoFocus?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={`${name}-star`}
        className="block text-[11px] uppercase tracking-wider text-ink-muted"
      >
        {label}
      </label>
      <select
        id={`${name}-star`}
        name={name}
        required
        defaultValue=""
        autoFocus={autoFocus}
        className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-1.5 text-sm"
      >
        <option value="" disabled>
          Pick 1–5
        </option>
        <option value="5">★★★★★ Exceptional</option>
        <option value="4">★★★★ Strong</option>
        <option value="3">★★★ Solid</option>
        <option value="2">★★ Mixed</option>
        <option value="1">★ Did not work</option>
      </select>
    </div>
  );
}
