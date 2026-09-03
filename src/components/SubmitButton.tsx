"use client";

/**
 * A submit button that says something is happening.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-02)
 *
 * Every server-action form in the app used a plain
 * <button type="submit">. Clicking it did the work and told you
 * nothing: no disabled state, no spinner, no change at all until the
 * page happened to re-render. On anything slower than instant, the
 * only rational response is to click again.
 *
 * Jamar: "there also needs to be some kind of clear confirmation that
 * something has happened when you click buttons, or people will
 * endlessly click buttons. Like I just resent some invites, but it's
 * not clear."
 *
 * On a resend that is not a cosmetic problem. Three clicks is three
 * emails to the same person, and to them it reads as the cooperative
 * spamming them on day one.
 *
 * useFormStatus reports the pending state of the enclosing form, so
 * this needs no wiring at the call site: swap the button and it works.
 * It must be a child of the <form>, not the component rendering it,
 * which is why this is its own component rather than a prop on a form
 * wrapper.
 * ─────────────────────────────────────────────────────────────
 */
import { useFormStatus } from "react-dom";

interface SubmitButtonProps {
  children: React.ReactNode;
  /** Shown while the action is in flight. Defaults to a verb-ish echo. */
  pendingLabel?: string;
  className?: string;
  /** Disable for reasons of your own, on top of the pending state. */
  disabled?: boolean;
  title?: string;
  name?: string;
  value?: string;
  /** Inline styles, for the surfaces that set brand colours directly. */
  style?: React.CSSProperties;
}

export function SubmitButton({
  children,
  pendingLabel,
  className = "",
  disabled = false,
  title,
  name,
  value,
  style,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name={name}
      value={value}
      title={title}
      disabled={pending || disabled}
      aria-busy={pending}
      style={style}
      className={`${className} disabled:cursor-not-allowed disabled:opacity-60`}
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          {/* CSS-only spinner. No animation library, and it is
              aria-hidden because aria-busy already announces the
              state to a screen reader. */}
          <span
            aria-hidden
            className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent"
          />
          {pendingLabel ?? "Working…"}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
