/**
 * Beta walkthrough — guided tour scoped to the signed-in user's tier
 * and pillar set. Renders steps in order with a checkmark on completed
 * ones, an inline feedback prompt on the active step, and a "Take me
 * there" CTA that deep-links to the surface being introduced.
 *
 * Resume behavior: the first incomplete step is auto-expanded; earlier
 * (completed) steps render as collapsed checkmark rows. Once every step
 * is done we surface a "you're done — leave us anything else" prompt.
 *
 * Server component. State lives in MOCK_WALKTHROUGH_PROGRESS via the
 * `completeWalkthroughStep` server action.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import {
  completedStepIds,
  stepsForAdmin,
  stepsForUser,
} from "@/lib/mock-data/walkthroughs";
import { completeWalkthroughStep } from "@/lib/walkthrough-actions";
import { FeedbackPrompt } from "@/components/FeedbackPrompt";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { TierBadge } from "@/components/TierBadge";
import { INDUSTRY_LABELS, userPillars, type Industry } from "@/lib/types";

export default async function WalkthroughPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  // Viewers can't walkthrough — they need to apply first. Nudge to /signup.
  if (user.membershipTier === "viewer") redirect("/signup");

  const pillars: Industry[] = userPillars(user);
  // Tier walkthrough is keyed off membershipTier (prospect/partner/member).
  // Viewer is already redirected above so the cast is safe.
  const tierForWalkthrough = user.membershipTier as Exclude<
    typeof user.membershipTier,
    "viewer"
  >;
  const steps = stepsForUser(tierForWalkthrough, pillars);
  const completed = completedStepIds(user.id);
  const total = steps.length;
  const doneCount = steps.filter((s) => completed.has(s.id)).length;
  const allDone = doneCount === total && total > 0;
  const firstIncomplete = steps.find((s) => !completed.has(s.id));

  // Admin tour — orthogonal to tier; surfaces under the main walkthrough
  // for any user with isAdmin. Carries its own first-incomplete cursor
  // so completing the tier walkthrough doesn't block admin steps.
  const adminSteps = user.isAdmin ? stepsForAdmin() : [];
  const adminTotal = adminSteps.length;
  const adminDoneCount = adminSteps.filter((s) => completed.has(s.id)).length;
  const adminFirstIncomplete = adminSteps.find((s) => !completed.has(s.id));
  const adminAllDone = adminTotal > 0 && adminDoneCount === adminTotal;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <CardEyebrow>Beta walkthrough</CardEyebrow>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
            Hey {user.firstName ?? "there"} — let&apos;s show you around.
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            A guided pass through every surface that matters for your tier.
            Drop honest feedback at each step — that&apos;s what this beta is
            for.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <TierBadge tier={user.membershipTier} />
          {pillars.length > 0 && (
            <span className="text-xs text-ink-muted">
              {pillars.map((p) => INDUSTRY_LABELS[p]).join(" · ")}
            </span>
          )}
        </div>
      </div>

      <ProgressBar done={doneCount} total={total} />

      <div className="mt-8 space-y-4">
        {steps.map((step) => {
          const isDone = completed.has(step.id);
          const isActive = !isDone && step.id === firstIncomplete?.id;
          return (
            <StepCard
              key={step.id}
              step={step}
              isDone={isDone}
              isActive={isActive}
            />
          );
        })}
      </div>

      {allDone && (
        <Card className="mt-8 border-brand-magenta/40">
          <CardEyebrow>Done</CardEyebrow>
          <CardTitle>You hit every surface. Now the real ask:</CardTitle>
          <p className="mt-2 text-sm text-ink-muted">
            What&apos;s the one thing that, if we fixed it, would make you
            actually use $BUILD.Store every week? Be brutal.
          </p>
          <div className="mt-4">
            <FeedbackPrompt
              surface="/walkthrough"
              surfaceLabel="Walkthrough — final"
              prompt="One thing we should fix before broader launch:"
            />
          </div>
        </Card>
      )}

      {steps.length === 0 && (
        <Card className="mt-8">
          <CardTitle>No walkthrough steps for your tier yet.</CardTitle>
          <p className="mt-2 text-sm text-ink-muted">
            We haven&apos;t scripted a tour for this tier/pillar combination.
            Head straight to your{" "}
            <Link href="/dashboard" className="underline">
              dashboard
            </Link>{" "}
            and ping us if anything looks off.
          </p>
        </Card>
      )}

      {adminSteps.length > 0 && (
        <section className="mt-16 border-t border-[var(--surface-border)] pt-10">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <CardEyebrow>Admin tour</CardEyebrow>
              <h2 className="mt-1 font-display text-2xl font-semibold tracking-tight">
                Operator surfaces — separate from the tier walkthrough.
              </h2>
              <p className="mt-2 max-w-2xl text-sm text-ink-muted">
                You&apos;re an admin, so this section walks you through every
                queue you&apos;re responsible for. Tier and admin steps share
                the same progress log, but render in their own sections so
                you can pause one and finish the other.
              </p>
            </div>
            <span className="text-xs text-ink-muted">
              {adminDoneCount} of {adminTotal} admin steps
            </span>
          </div>

          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-inset)]">
            <div
              className="h-full bg-brand-magenta transition-all"
              style={{
                width: `${
                  adminTotal === 0
                    ? 0
                    : Math.round((adminDoneCount / adminTotal) * 100)
                }%`,
              }}
            />
          </div>

          <div className="mt-8 space-y-4">
            {adminSteps.map((step) => {
              const isDone = completed.has(step.id);
              const isActive =
                !isDone && step.id === adminFirstIncomplete?.id;
              return (
                <StepCard
                  key={step.id}
                  step={step}
                  isDone={isDone}
                  isActive={isActive}
                />
              );
            })}
          </div>

          {adminAllDone && (
            <Card className="mt-8 border-brand-magenta/40">
              <CardEyebrow>Admin tour done</CardEyebrow>
              <CardTitle>You&apos;ve seen every operator surface.</CardTitle>
              <p className="mt-2 text-sm text-ink-muted">
                Anything missing from the admin console at this stage —
                queue, filter, sort, audit log, anything — is worth
                naming before the production swap. Drop it here.
              </p>
              <div className="mt-4">
                <FeedbackPrompt
                  surface="/walkthrough"
                  surfaceLabel="Walkthrough — admin final"
                  prompt="One admin queue or surface that needs work before broader use:"
                />
              </div>
            </Card>
          )}
        </section>
      )}
    </div>
  );
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between text-xs text-ink-muted">
        <span>
          {done} of {total} steps
        </span>
        <span>{pct}%</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--surface-inset)]">
        <div
          className="h-full bg-brand-magenta transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StepCard({
  step,
  isDone,
  isActive,
}: {
  step: ReturnType<typeof stepsForUser>[number];
  isDone: boolean;
  isActive: boolean;
}) {
  // Completed steps collapse to a one-line summary.
  if (isDone) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)]/60 px-4 py-3 text-sm">
        <CheckmarkPill />
        <div className="flex-1">
          <span className="font-medium text-ink-muted line-through">
            {step.title}
          </span>
        </div>
        <Link
          href={step.surface}
          className="text-xs text-ink-muted underline hover:text-ink"
        >
          Revisit
        </Link>
      </div>
    );
  }

  return (
    <Card
      className={
        isActive
          ? "border-brand-magenta/60 ring-1 ring-brand-magenta/30"
          : "opacity-70"
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <CardEyebrow>Step {step.order}</CardEyebrow>
          <CardTitle className="mt-1">{step.title}</CardTitle>
        </div>
        {isActive && (
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-white"
            style={{ backgroundColor: "#D828A0" }}
          >
            Active
          </span>
        )}
      </div>

      <p className="mt-3 text-sm text-ink-muted">{step.blurb}</p>

      {step.whatToTry.length > 0 && (
        <>
          <p className="mt-4 text-[11px] uppercase tracking-wider text-ink-faint">
            Try
          </p>
          <ul className="mt-1 space-y-1 text-sm">
            {step.whatToTry.map((tip, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-brand-magenta">›</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Link
          href={step.surface}
          className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-[var(--surface)] transition-colors hover:bg-brand-magenta hover:text-brand-white"
        >
          {step.surfaceLabel} →
        </Link>
        {/* Mark complete is its own form so it can be triggered without
            also requiring the user to fill out the feedback prompt. */}
        <form action={completeWalkthroughStep}>
          <input type="hidden" name="stepId" value={step.id} />
          <button
            type="submit"
            className="rounded-full border border-[var(--surface-border)] px-3 py-2 text-xs hover:bg-[var(--surface-inset)]"
          >
            I tried it — mark complete
          </button>
        </form>
      </div>

      {step.feedbackPrompt && isActive && (
        <div className="mt-5">
          <FeedbackPrompt
            surface={step.surface}
            surfaceLabel={`${step.surfaceLabel.replace(/^Open\s+/, "")} (walkthrough)`}
            prompt={step.feedbackPrompt}
            walkthroughStepId={step.id}
            variant="walkthrough"
          />
        </div>
      )}
    </Card>
  );
}

function CheckmarkPill() {
  return (
    <span
      aria-hidden="true"
      className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold text-brand-white"
      style={{ backgroundColor: "#007048" }}
    >
      ✓
    </span>
  );
}
