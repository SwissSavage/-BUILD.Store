"use client";

/**
 * TermsAcceptCheckbox — scrollable Terms of Service block with a
 * "must scroll to bottom" gate on the accept checkbox.
 *
 * Pattern per Bayu's feedback on the invite ceremony: bare checkboxes
 * that link out to /policies are too easy to click past. Embedding the
 * actual terms into the ceremony and requiring the user to scroll to
 * the end before the accept box unlocks makes the consent action
 * observable — the invitee has to at least have moved past every line
 * before the checkbox is available.
 *
 * State:
 *   scrolled   — flips true once the user has scrolled to (or past)
 *                the bottom of the terms box, with a small threshold
 *                so pixel-perfect precision isn't required.
 *   accepted   — bound to the checkbox itself; only settable once
 *                `scrolled` is true.
 *
 * The form submission carries `termsAccepted=on` if the box is checked,
 * matching the server action's existing FormData contract — no changes
 * needed on the completeInviteSignup side.
 */
import { useEffect, useRef, useState } from "react";
import { TncSummary } from "@/components/TncSummary";

const SCROLL_THRESHOLD_PX = 8;

export function TermsAcceptCheckbox() {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [accepted, setAccepted] = useState(false);

  // Poll scroll position on scroll events and on mount (in case the
  // content fits within the visible height, we consider it read
  // immediately — no artificial gate for short screens).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function check() {
      if (!el) return;
      const atBottom =
        el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_THRESHOLD_PX;
      // Content that fits without scrolling can never fire a scroll
      // event, so "already at the bottom" counts as read.
      if (atBottom) setScrolled(true);
    }

    check();
    el.addEventListener("scroll", check, { passive: true });

    // ─────────────────────────────────────────────────────────────
    // WHY THE OBSERVERS (2026-09-01)
    //
    // The mount-time measurement was the only fallback for content
    // that fits the box, and it ran before the serif webfont had
    // loaded. Once the font swapped, the text reflowed and the
    // measurement was stale — on a viewport where the terms very
    // nearly fit, the box could sit permanently disabled with no way
    // to proceed.
    //
    // A disabled checkbox is also skipped by `required` and omitted
    // from the submission entirely, so the form posted with no
    // termsAccepted and the server threw. That is how an invited
    // member ended up on a crash page instead of joining.
    //
    // Re-measure whenever the box or its contents change size.
    // ─────────────────────────────────────────────────────────────
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(check) : null;
    if (ro) {
      ro.observe(el);
      for (const child of Array.from(el.children)) ro.observe(child);
    }

    // Webfonts settle after mount and change the height again.
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    fonts?.ready?.then(check).catch(() => {});

    return () => {
      el.removeEventListener("scroll", check);
      ro?.disconnect();
    };
  }, []);

  return (
    <div style={{ marginBottom: "1.25rem" }}>
      <div
        ref={scrollRef}
        style={{
          // Take most of the viewport per Rob's beta pass — T&C is
          // the primary content on this page, shouldn't feel like
          // fine print in a corner. Capped at 720px so it stays
          // readable on very tall screens; min-height guarantees a
          // usable read window on short viewports too.
          maxHeight: "min(70vh, 720px)",
          minHeight: "320px",
          overflowY: "auto",
          padding: "20px 24px",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(212,167,82,0.35)",
          borderRadius: "6px",
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "17px",
          lineHeight: 1.6,
          color: "#e0ceac",
          marginBottom: "12px",
        }}
      >
        <TncSummary variant="invite" />
      </div>

      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          cursor: scrolled ? "pointer" : "not-allowed",
          opacity: scrolled ? 1 : 0.5,
        }}
      >
        <input
          type="checkbox"
          name="termsAccepted"
          required
          checked={accepted}
          // NEVER disabled. `disabled` removes a field from the
          // submission AND from constraint validation, so disabled +
          // required cancel each other out: the moment the gate locked,
          // the requirement stopped existing on the client and the form
          // posted without consent. That is the bug that put an invited
          // member on a crash page.
          //
          // Leaving it enabled means `required` is live, so the browser
          // itself refuses to submit an unticked box. The read-gate is
          // the onClick below — note that `readOnly` does nothing on a
          // checkbox, browsers ignore it; it and aria-disabled are here
          // for assistive tech only.
          //
          // If scripting fails, the gate goes with it but the
          // requirement stays. That is the right direction to fail:
          // toward someone being able to finish signing up, not toward
          // locking them out of it.
          readOnly={!scrolled}
          aria-disabled={!scrolled}
          onClick={(e) => {
            // Fires for pointer and for keyboard activation alike.
            if (!scrolled) e.preventDefault();
          }}
          onChange={(e) => setAccepted(e.target.checked)}
          style={{
            marginTop: "4px",
            accentColor: "#D828A0",
            width: "18px",
            height: "18px",
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: "16px", lineHeight: 1.6 }}>
          I have read the Terms of Service above and agree.{" "}
          <span style={{ opacity: 0.7 }}>Required.</span>
          {!scrolled && (
            <span
              style={{
                display: "block",
                marginTop: "4px",
                fontSize: "13px",
                fontStyle: "italic",
                color: "#d4a752",
              }}
            >
              Scroll to the end of the terms to enable.
            </span>
          )}
        </span>
      </label>
    </div>
  );
}
