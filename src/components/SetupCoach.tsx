/**
 * The spotlight. Dims the app, cuts a hole around one real control,
 * and puts a card next to it.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY FOUR RECTANGLES AND NOT AN SVG MASK (2026-11-16)
 *
 * The dim is four absolutely-positioned panels framing the target:
 * above, below, left, right. An SVG mask or a giant box-shadow spread
 * is the usual trick and both are shorter, but both also put a
 * full-screen element over the page, which means the control being
 * pointed at cannot be clicked. The whole point is that the member
 * clicks the actual pencil. Four panels leave the middle genuinely
 * untouched.
 *
 * WHY IT MEASURES ON A TIMER AS WELL AS ON EVENTS
 *
 * The anchor can move for reasons no event reports: a font finishing
 * loading, an image above it decoding, a section expanding. Scroll
 * and resize listeners miss all three, and a spotlight ring sitting
 * an inch below the thing it is describing is worse than no
 * spotlight. A cheap rAF poll while the overlay is open is the honest
 * fix.
 *
 * WHY NOTHING HERE TOUCHES THE DATABASE
 *
 * Every value arrives as a prop and the only write is the dismiss
 * action. check-client-boundary rejects a "use client" module that
 * can transitively reach src/db/client.ts, type-only imports
 * included, so the step list is computed by the server component that
 * renders this one.
 *
 * ESCAPE HATCHES, DELIBERATELY PLURAL
 *
 * Escape dismisses, the backdrop does not. A tutorial that traps
 * someone who signed in to read one agreement has done more harm than
 * the blank tagline it was trying to fix. "Not now" is as prominent
 * as the primary action, and the dashboard callout brings it back.
 * ─────────────────────────────────────────────────────────────
 */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import type { SetupCoachStep } from "@/lib/setup-coach";

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** Breathing room around the highlighted element, in px. */
const PAD = 8;

export function SetupCoach({
  steps,
  firstName,
  doneCount,
  totalCount,
  onDismiss,
}: {
  steps: SetupCoachStep[];
  firstName: string | null;
  doneCount: number;
  totalCount: number;
  /** Server action. Records the dismissal so this stops appearing. */
  onDismiss: () => Promise<void>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const [open, setOpen] = useState(true);
  const frame = useRef<number | null>(null);

  const step = steps[index] ?? null;
  // A null route means the anchor is in the chrome and present on
  // every page, so we are always "there".
  const onRoute = step ? step.route === null || pathname === step.route : false;

  // ── Measure ────────────────────────────────────────────────
  const measure = useCallback(() => {
    if (!step || !onRoute) {
      setRect(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(
      `[data-coach="${step.anchor}"]`,
    );
    if (!el) {
      // Anchor missing. Degrade to the centered card rather than
      // highlighting whatever happens to be at 0,0.
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect((prev) => {
      const next = {
        top: r.top - PAD,
        left: r.left - PAD,
        width: r.width + PAD * 2,
        height: r.height + PAD * 2,
      };
      // Avoid a setState per frame when nothing has actually moved.
      if (
        prev &&
        Math.abs(prev.top - next.top) < 0.5 &&
        Math.abs(prev.left - next.left) < 0.5 &&
        Math.abs(prev.width - next.width) < 0.5 &&
        Math.abs(prev.height - next.height) < 0.5
      ) {
        return prev;
      }
      return next;
    });
  }, [step, onRoute]);

  useEffect(() => {
    if (!open) return;
    const tick = () => {
      measure();
      frame.current = window.requestAnimationFrame(tick);
    };
    frame.current = window.requestAnimationFrame(tick);
    return () => {
      if (frame.current !== null) window.cancelAnimationFrame(frame.current);
    };
  }, [open, measure]);

  // Bring the anchor into view when the step changes, so the
  // spotlight is never pointing off-screen.
  useEffect(() => {
    if (!open || !step || !onRoute) return;
    const el = document.querySelector<HTMLElement>(
      `[data-coach="${step.anchor}"]`,
    );
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [open, step, onRoute]);

  const dismiss = useCallback(() => {
    setOpen(false);
    void onDismiss();
  }, [onDismiss]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  if (!open || !step) return null;

  const isLast = index === steps.length - 1;
  const dim = "rgba(5, 5, 8, 0.72)";

  // ── Card placement ─────────────────────────────────────────
  // Below the spotlight when there is room, above when there is not,
  // centered when there is no spotlight at all.
  const CARD_H = 260;
  const below = rect ? rect.top + rect.height + 14 : 0;
  const roomBelow =
    rect && typeof window !== "undefined"
      ? window.innerHeight - below > CARD_H
      : true;

  const cardStyle: React.CSSProperties = rect
    ? {
        position: "fixed",
        top: roomBelow ? below : undefined,
        bottom: roomBelow
          ? undefined
          : typeof window !== "undefined"
            ? window.innerHeight - rect.top + 14
            : undefined,
        left: Math.max(
          16,
          Math.min(
            rect.left,
            (typeof window !== "undefined" ? window.innerWidth : 1200) - 436,
          ),
        ),
        width: 420,
        maxWidth: "calc(100vw - 32px)",
      }
    : {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        width: 420,
        maxWidth: "calc(100vw - 32px)",
      };

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Profile setup"
      className="pointer-events-none"
      style={{ position: "fixed", inset: 0, zIndex: 80 }}
    >
      {/* The dim. Four panels, so the middle stays clickable. */}
      {rect ? (
        <>
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              height: Math.max(0, rect.top),
              background: dim,
            }}
          />
          <div
            style={{
              position: "fixed",
              top: rect.top + rect.height,
              left: 0,
              right: 0,
              bottom: 0,
              background: dim,
            }}
          />
          <div
            style={{
              position: "fixed",
              top: rect.top,
              left: 0,
              width: Math.max(0, rect.left),
              height: rect.height,
              background: dim,
            }}
          />
          <div
            style={{
              position: "fixed",
              top: rect.top,
              left: rect.left + rect.width,
              right: 0,
              height: rect.height,
              background: dim,
            }}
          />
          {/* The ring. pointer-events none so it never eats the click
              it is drawing attention to. */}
          <div
            style={{
              position: "fixed",
              top: rect.top,
              left: rect.left,
              width: rect.width,
              height: rect.height,
              border: "2px solid #D828A0",
              borderRadius: 14,
              boxShadow: "0 0 0 4px rgba(216,40,160,0.22)",
              pointerEvents: "none",
            }}
          />
        </>
      ) : (
        <div style={{ position: "fixed", inset: 0, background: dim }} />
      )}

      {/* The card. */}
      <div
        className="pointer-events-auto rounded-2xl border p-5 shadow-2xl"
        style={{
          ...cardStyle,
          borderColor: "rgba(216, 40, 160, 0.45)",
          backgroundColor: "var(--surface-elevated, #121216)",
        }}
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[11px] uppercase tracking-wider text-brand-magentaText">
            Setting up
            {firstName ? ` · ${firstName}` : ""}
          </p>
          <p className="text-[11px] text-ink-faint">
            {Math.min(doneCount + index + 1, totalCount)} of {totalCount}
          </p>
        </div>

        <h2 className="mt-2 font-display text-xl font-semibold">
          {step.title}
        </h2>
        <p className="mt-2 text-sm text-ink-muted">{step.body}</p>

        {!onRoute && (
          <p className="mt-3 text-xs text-ink-faint">
            This one lives on your profile.
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {onRoute ? (
            <button
              type="button"
              onClick={() => router.push(step.href)}
              className="rounded-full px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: "#D828A0" }}
            >
              {step.ctaLabel}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => step.route && router.push(step.route)}
              className="rounded-full px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: "#D828A0" }}
            >
              Take me there
            </button>
          )}

          {!isLast && (
            <button
              type="button"
              onClick={() => setIndex((i) => i + 1)}
              className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-sm transition-colors hover:border-brand-magenta"
            >
              Skip this one
            </button>
          )}

          <button
            type="button"
            onClick={dismiss}
            className="ml-auto text-xs text-ink-faint underline-offset-2 hover:underline"
          >
            Not now
          </button>
        </div>

        {index > 0 && (
          <button
            type="button"
            onClick={() => setIndex((i) => i - 1)}
            className="mt-3 text-xs text-ink-faint underline-offset-2 hover:underline"
          >
            ← Back
          </button>
        )}
      </div>
    </div>
  );
}
