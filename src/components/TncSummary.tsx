/**
 * Terms of Service — canonical summary paragraphs (task #67).
 *
 * Single source of truth for the 6-paragraph plain-language summary
 * that renders in two places:
 *   1. The invite acceptance ceremony (/invite/[code]/code —
 *      TermsAcceptCheckbox.tsx) — where the invitee must scroll
 *      through and accept before signup completes.
 *   2. The public Cooperative Covenant page (/policies/covenant) —
 *      as an "at a glance" summary block at the top, above the full
 *      canonical policy text.
 *
 * Both surfaces render THIS component. Edit here and both stay in
 * sync. Prior state had two hardcoded copies that could drift.
 *
 * `variant` controls the visual treatment:
 *   - "invite" — dark serif on gold-bordered card (matches the
 *     invite ceremony's parchment-style acceptance box).
 *   - "policy" — muted body text matching the /policies theme so it
 *     reads as a lightweight intro to the full covenant that
 *     follows.
 */

interface TncSummaryProps {
  variant?: "invite" | "policy";
}

const PARAGRAPHS: string[] = [
  "By accepting, you agree to participate in the Future Modern cooperative as a member or partner in good faith. You agree to the tier you were invited under, its associated responsibilities, and the Future Modernist's Code above.",
  "Your account is provisioned to your email address. You are responsible for keeping that address secure. Signing in uses magic links delivered to that address; possession of the address is treated as authorization.",
  "Contributions you make through the cooperative — projects, referrals, governance activity, review — are subject to the reciprocity floor described in the Code. Membership review may follow prolonged inactivity.",
  "You may leave at any time. Future Modern may pause or end membership when the relationship stops being reciprocal, as described in the Sovereignty principle.",
  "Personal data you provide is used to operate your account and match you to relevant opportunities. It is not sold. Data participation (the labor-value dataset) is a separate, optional opt-in below.",
];

export function TncSummary({ variant = "policy" }: TncSummaryProps) {
  if (variant === "invite") {
    // Inline styles match the parchment card of the invite ceremony —
    // dark background, warm serif, gold accents. Kept inline so the
    // component works without importing the invite flow's stylesheet.
    return (
      <>
        <p style={{ margin: "0 0 10px", fontWeight: 600, color: "#f5d16b" }}>
          Future Modern — Terms of Service (summary)
        </p>
        {PARAGRAPHS.map((text, i) => (
          <p key={i} style={{ margin: "0 0 8px" }}>
            {text}
          </p>
        ))}
        <p style={{ margin: "0 0 8px" }}>
          Full Terms, Privacy Policy, and Data Use Policy live at{" "}
          <a
            href="/policies"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#f5d16b", textDecoration: "underline" }}
          >
            /policies
          </a>
          . The summary here highlights the parts most likely to
          matter — read the full text if any of it is unclear before
          accepting.
        </p>
        <p style={{ margin: "0", fontStyle: "italic", opacity: 0.7 }}>
          — End of summary —
        </p>
      </>
    );
  }

  // Policy-page variant: renders as an "at a glance" intro block
  // sitting above the full canonical Cooperative Covenant text on
  // /policies/covenant.
  return (
    <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-6 py-5">
      <p className="text-xs uppercase tracking-wider text-brand-magenta">
        At a glance
      </p>
      <p className="mt-2 text-sm font-medium">
        Terms of Service — plain-language summary
      </p>
      <div className="mt-3 space-y-3 text-sm text-ink-muted">
        {PARAGRAPHS.map((text, i) => (
          <p key={i}>{text}</p>
        ))}
      </div>
      <p className="mt-4 text-xs text-ink-faint">
        This is the same summary shown during the invite acceptance
        ceremony. The full canonical policy follows below.
      </p>
    </div>
  );
}
