/**
 * Inline feedback prompt — drop on any member surface to give beta
 * users a one-click way to flag a confusing thing or call out something
 * that's working. Submissions land in MOCK_FEEDBACK and surface in
 * /admin/feedback.
 *
 * Server component — uses native form submission to the
 * `submitFeedback` server action so it works without client JS.
 *
 * Three flavors:
 *   - default     → boxed card with full sentiment picker + textarea
 *   - inline      → compact one-line strip suitable for footers
 *   - walkthrough → renders inside a walkthrough step (no border, prompt
 *                   text comes from the step's `feedbackPrompt`)
 */
import { submitFeedback } from "@/lib/walkthrough-actions";
import { cn } from "@/lib/cn";
import { FEEDBACK_SENTIMENT_LABELS, type FeedbackSentiment } from "@/lib/types";

const SENTIMENTS: FeedbackSentiment[] = ["positive", "confused", "blocker"];

export function FeedbackPrompt({
  surface,
  surfaceLabel,
  prompt,
  walkthroughStepId,
  variant = "default",
  className,
}: {
  /** URL/route of the surface this prompt lives on. */
  surface: string;
  /** Friendly name (e.g. "Wallet"). */
  surfaceLabel: string;
  /** Question the user is responding to. */
  prompt: string;
  /** Set when the prompt comes from a walkthrough step. */
  walkthroughStepId?: string;
  variant?: "default" | "inline" | "walkthrough";
  className?: string;
}) {
  const isInline = variant === "inline";
  const isWalkthrough = variant === "walkthrough";

  return (
    <form
      action={submitFeedback}
      className={cn(
        !isInline && !isWalkthrough &&
          "rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-5",
        isWalkthrough &&
          "rounded-xl border border-dashed border-[var(--surface-border)] bg-[var(--surface-inset)]/40 p-4",
        isInline && "flex flex-wrap items-center gap-2",
        className,
      )}
    >
      <input type="hidden" name="surface" value={surface} />
      <input type="hidden" name="surfaceLabel" value={surfaceLabel} />
      {walkthroughStepId && (
        <input
          type="hidden"
          name="walkthroughStepId"
          value={walkthroughStepId}
        />
      )}

      {!isInline && (
        <>
          <p
            className={cn(
              "font-medium",
              isWalkthrough ? "text-sm" : "text-base",
            )}
          >
            {prompt}
          </p>
          <p className="mt-0.5 text-[11px] uppercase tracking-wider text-ink-faint">
            Beta feedback · goes to admin
          </p>
        </>
      )}

      <div
        className={cn(
          "mt-3 flex flex-wrap gap-2",
          isInline && "mt-0",
        )}
      >
        {SENTIMENTS.map((s) => (
          <label
            key={s}
            className="cursor-pointer rounded-full border border-[var(--surface-border)] px-3 py-1 text-xs transition-colors hover:bg-[var(--surface-inset)] has-[:checked]:border-brand-magenta has-[:checked]:text-brand-magenta"
          >
            <input
              type="radio"
              name="sentiment"
              value={s}
              required
              className="sr-only"
            />
            {FEEDBACK_SENTIMENT_LABELS[s]}
          </label>
        ))}
      </div>

      {isInline ? (
        <input
          type="text"
          name="note"
          required
          minLength={4}
          placeholder={prompt}
          className="min-w-[16rem] flex-1 rounded-full border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-1.5 text-sm placeholder:text-ink-faint focus:border-brand-magenta focus:outline-none"
        />
      ) : (
        <textarea
          name="note"
          required
          minLength={4}
          rows={isWalkthrough ? 2 : 3}
          placeholder="A sentence or two. The rougher the better."
          className="mt-3 w-full rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-3 text-sm placeholder:text-ink-faint focus:border-brand-magenta focus:outline-none"
        />
      )}

      <button
        type="submit"
        className={cn(
          "rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-[var(--surface)] transition-colors hover:bg-brand-magenta hover:text-brand-white",
          !isInline && "mt-3",
        )}
      >
        Send feedback
      </button>
    </form>
  );
}
