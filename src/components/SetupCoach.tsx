/**
 * The spotlight. Dims the app, cuts a hole around one real control,
 * and puts a card next to it.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THERE IS NO STEP COUNTER (2026-11-16, second pass)
 *
 * The first version kept an `index` and walked it forward. Jamar:
 * "it stops once I click the button instead of guiding to the next
 * step", with a screenshot reading "3 of 5" on the first card he saw.
 * Both are the same mistake.
 *
 * The step list is recomputed on the server every render from what is
 * still missing on the profile. An index held against a list that
 * changes underneath it is stale the moment a field is saved: the
 * list gets shorter, index 0 now means a different step, and the
 * number on the card counts something the member cannot see.
 *
 * So there is no index. The coach always shows the FIRST outstanding
 * step. Filling a field removes that step server-side and the next
 * one appears by itself, which is what "guiding to the next step"
 * actually means. The only local state is the set of steps the member
 * waved past by hand, because nothing on the profile records a skip.
 *
 * WHY "fill" AND "orient" ARE DIFFERENT
 *
 * A fill step ends when the field is set, so it retires itself. An
 * orient step only points at something and will never be marked done
 * by anything, so pressing its button has to advance it here. Treating
 * both the same is why the first card went nowhere when pressed: it
 * was an orient step waiting for a completion that could not arrive.
 *
 * WHY THE EDITOR GETS ITS OWN CARD
 *
 * The section editors do not redirect back to /profile on save. They
 * revalidate and stay put. So after the member saves there is nothing
 * to navigate them onward, and the coach would have sat on the editor
 * showing "Take me there" about a page they were already on. While
 * the member is inside the editor for the current step, the card
 * shrinks to that step's workingLabel and a way back.
 *
 * WHY FOUR RECTANGLES AND NOT AN SVG MASK
 *
 * The dim is four absolutely-positioned panels framing the target.
 * A mask or a big box-shadow spread is shorter, but both put an
 * element over the page, so the control being pointed at cannot be
 * clicked. The whole point is that the member clicks the actual
 * pencil. Four panels leave the middle genuinely untouched.
 *
 * WHY IT MEASURES ON A TIMER AS WELL AS ON EVENTS
 *
 * The anchor moves for reasons no event reports: a font loading, an
 * image above it decoding, a section expanding. Scroll and resize
 * listeners miss all three, and a ring sitting an inch below the
 * thing it describes is worse than no ring.
 *
 * NOTHING HERE TOUCHES THE DATABASE. check-client-boundary rejects a
 * "use client" module that can reach src/db/client.ts, type-only
 * imports included, so the step list is computed by the server
 * component that renders this one.
 * ─────────────────────────────────────────────────────────────
 */
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  onDismiss,
}: {
  /** Outstanding, in order, recomputed server-side on every render. */
  steps: SetupCoachStep[];
  firstName: string | null;
  /** Server action. Records the dismissal so this stops appearing. */
  onDismiss: () => Promise<void>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [passed, setPassed] = useState<string[]>([]);
  const [rect, setRect] = useState<Rect | null>(null);
  const [open, setOpen] = useState(true);
  const [finished, setFinished] = useState(false);
  const frame = useRef<number | null>(null);

  // Steps still worth showing: not waved past by hand, and not
  // pointless on the page we are standing on.
  const queue = useMemo(
    () =>
      steps.filter(
        (s) =>
          !passed.includes(s.id) &&
          !(s.skipWhenOn ?? []).some((p) => pathname === p),
      ),
    [steps, passed, pathname],
  );

  const step = queue[0] ?? null;

  // How many steps this run started with, captured once from the
  // SERVER list rather than the filtered queue.
  //
  // Two traps here, both hit on the way to this version. Counting the
  // live list makes the total shrink as the member works, so progress
  // runs backwards. Counting the queue makes the total depend on
  // which page they happen to be standing on, because skipWhenOn
  // removes a card on /profile that exists on /dashboard, so the
  // number jumps when they navigate. The server list is stable and
  // route-independent.
  const total = useRef<number | null>(null);
  if (total.current === null && steps.length > 0) total.current = steps.length;
  const totalCount = total.current ?? steps.length;
  // Completed steps leave the server list. Skipped ones stay in it,
  // so they are counted separately.
  const position = Math.min(
    totalCount - steps.length + passed.length + 1,
    totalCount,
  );

  // Inside the editor for the current step. The member is doing the
  // work right now, so the card gets out of the way.
  const working = step ? pathname.startsWith(step.href) : false;
  const onRoute = step
    ? step.route === null || pathname === step.route
    : false;

  // ── Measure ────────────────────────────────────────────────
  const measure = useCallback(() => {
    if (!step || !onRoute || working) {
      setRect(null);
      return;
    }
    const el = document.querySelector<HTMLElement>(
      `[data-coach="${step.anchor}"]`,
    );
    if (!el) {
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
  }, [step, onRoute, working]);

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

  useEffect(() => {
    if (!open || !step || !onRoute || working) return;
    const el = document.querySelector<HTMLElement>(
      `[data-coach="${step.anchor}"]`,
    );
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [open, step, onRoute, working]);

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

  // Everything outstanding has been dealt with. Say so once rather
  // than vanishing, so the run has an ending.
  useEffect(() => {
    if (open && !finished && steps.length > 0 && queue.length === 0) {
      setFinished(true);
    }
  }, [open, finished, steps.length, queue.length]);

  if (!open) return null;

  const dim = "rgba(5, 5, 8, 0.72)";

  const card = (children: React.ReactNode, style: React.CSSProperties) => (
    <div
      className="pointer-events-auto rounded-2xl border p-5 shadow-2xl"
      style={{
        ...style,
        borderColor: "rgba(216, 40, 160, 0.45)",
        backgroundColor: "var(--surface-elevated, #121216)",
      }}
    >
      {children}
    </div>
  );

  const centered: React.CSSProperties = {
    position: "fixed",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: 420,
    maxWidth: "calc(100vw - 32px)",
  };

  const shell = (children: React.ReactNode) => (
    <div
      role="dialog"
      aria-modal="false"
      aria-label="Profile setup"
      className="pointer-events-none"
      style={{ position: "fixed", inset: 0, zIndex: 80 }}
    >
      {children}
    </div>
  );

  // ── Done ───────────────────────────────────────────────────
  if (!step) {
    if (!finished) return null;
    return shell(
      <>
        <div style={{ position: "fixed", inset: 0, background: dim }} />
        {card(
          <>
            <p className="text-[11px] uppercase tracking-wider text-brand-magentaText">
              Setting up
            </p>
            <h2 className="mt-2 font-display text-xl font-semibold">
              That is the whole setup.
            </h2>
            <p className="mt-2 text-sm text-ink-muted">
              Your profile is the page a client lands on, so it is worth
              coming back to as the work changes. The pencils are always
              there.
            </p>
            <div className="mt-5 flex items-center gap-2">
              <button
                type="button"
                onClick={dismiss}
                className="rounded-full px-4 py-2 text-sm font-medium text-white"
                style={{ backgroundColor: "#D828A0" }}
              >
                Done
              </button>
            </div>
          </>,
          centered,
        )}
      </>,
    );
  }

  const advance = () => setPassed((p) => [...p, step.id]);

  const header = (
    <div className="flex items-baseline justify-between gap-3">
      <p className="text-[11px] uppercase tracking-wider text-brand-magentaText">
        Setting up
        {firstName ? ` · ${firstName}` : ""}
      </p>
      <p className="text-[11px] text-ink-faint">
        Step {position} of {totalCount}
      </p>
    </div>
  );

  // ── In the editor for this step ────────────────────────────
  if (working) {
    return shell(
      card(
        <>
          {header}
          <h2 className="mt-2 font-display text-xl font-semibold">
            {step.title}
          </h2>
          <p className="mt-2 text-sm text-ink-muted">{step.workingLabel}</p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                // An orient step has nothing to save, so pressing on
                // retires it here. A fill step retires itself once the
                // field is set, so this only navigates back and lets
                // the server decide whether it is done.
                if (step.kind === "orient") advance();
                router.push("/profile");
              }}
              className="rounded-full px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: "#D828A0" }}
            >
              Done, next step
            </button>
            <button
              type="button"
              onClick={dismiss}
              className="ml-auto text-xs text-ink-faint underline-offset-2 hover:underline"
            >
              Not now
            </button>
          </div>
        </>,
        {
          position: "fixed",
          right: 24,
          bottom: 24,
          width: 380,
          maxWidth: "calc(100vw - 32px)",
        },
      ),
    );
  }

  // ── Pointing at something ──────────────────────────────────
  const CARD_H = 260;
  const below = rect ? rect.top + rect.height + 14 : 0;
  const roomBelow =
    rect && typeof window !== "undefined"
      ? window.innerHeight - below > CARD_H
      : true;

  const anchored: React.CSSProperties = rect
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
    : centered;

  return shell(
    <>
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

      {card(
        <>
          {header}
          <h2 className="mt-2 font-display text-xl font-semibold">
            {step.title}
          </h2>
          <p className="mt-2 text-sm text-ink-muted">{step.body}</p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                // Orient steps retire on press, because nothing else
                // will ever retire them. This is the bug Jamar hit:
                // the first card's button navigated to a page he was
                // already on, so the same card rendered again and the
                // tour looked frozen.
                if (step.kind === "orient") advance();
                router.push(onRoute ? step.href : (step.route ?? step.href));
              }}
              className="rounded-full px-4 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: "#D828A0" }}
            >
              {onRoute ? step.ctaLabel : "Take me there"}
            </button>

            <button
              type="button"
              onClick={advance}
              className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-sm transition-colors hover:border-brand-magenta"
            >
              Skip this one
            </button>

            <button
              type="button"
              onClick={dismiss}
              className="ml-auto text-xs text-ink-faint underline-offset-2 hover:underline"
            >
              Not now
            </button>
          </div>
        </>,
        anchored,
      )}
    </>,
  );
}
