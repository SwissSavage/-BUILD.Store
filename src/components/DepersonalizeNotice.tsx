/**
 * Tell people to scrub client details BEFORE they submit.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-03)
 *
 * Jamar: "There also needs to be some kind of CTA or something to
 * depersonalize portfolios and attachments, because damn near every
 * one I've seen so far is getting deleted."
 *
 * The guidance existed in exactly one place before this: a
 * `placeholder` on the pitch textarea in BidOnContractForm, which
 * disappears the moment someone types a character. The portfolio
 * submit form said nothing at all, and the portfolio card on
 * /profile/edit/portfolio said "admins scrub PII before pieces
 * appear", which reads as a promise that somebody else will handle
 * it. So people uploaded decks with client logos on every slide and
 * admins deleted them, one at a time, all week.
 *
 * Two things had to be true for this to stop:
 *
 *   1. The rule has to be visible at the moment of upload, not in a
 *      placeholder and not on a policy page nobody opens.
 *   2. It has to say what to write INSTEAD. "Remove client names"
 *      reads as "delete the only part that made this impressive."
 *      The example does the real work here: the result stays, the
 *      name goes.
 *
 * Deliberately not a modal and not a blocking checkbox. A wall in
 * front of the upload button gets clicked through, and we would be
 * pretending we had solved it. This is a persistent panel, open by
 * default at the headline, with the checklist one click away.
 * ─────────────────────────────────────────────────────────────
 */
import { cn } from "@/lib/cn";

type Context = "portfolio" | "proposal";

const LEAD: Record<Context, string> = {
  portfolio:
    "Work samples that name a client get sent back. This is the most common reason a piece does not make it onto your profile.",
  proposal:
    "Attachments and pitches that name a client get sent back before the client ever sees them.",
};

export function DepersonalizeNotice({
  context = "portfolio",
  className,
}: {
  context?: Context;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-brand-magenta/40 bg-brand-magenta/5 p-4",
        className,
      )}
    >
      <p className="text-sm font-semibold text-brand-magentaText">
        Scrub client details before you submit
      </p>
      <p className="mt-1 text-sm text-ink-muted">{LEAD[context]}</p>

      <p className="mt-3 text-sm text-ink-muted">
        Keep the result. Lose the name.
      </p>
      <div className="mt-2 space-y-1 rounded-lg bg-[var(--surface)] p-3 text-xs">
        <p className="text-ink-faint">
          <span className="font-semibold uppercase tracking-wider">
            Sent back:
          </span>{" "}
          &ldquo;Rebuilt checkout for Acme Foods, cut cart abandonment
          22%.&rdquo;
        </p>
        <p className="text-ink-muted">
          <span className="font-semibold uppercase tracking-wider text-brand-magentaText">
            Works:
          </span>{" "}
          &ldquo;Rebuilt checkout for a regional grocery chain, cut cart
          abandonment 22%.&rdquo;
        </p>
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-ink-muted hover:text-brand-magentaText">
          What counts as a client detail
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted">
          <li>
            Client and brand names, including in the filename and inside the
            document, not only in the description you type here.
          </li>
          <li>
            Logos, letterheads and watermarks on slides, mockups and
            screenshots.
          </li>
          <li>
            Names, emails and phone numbers for anyone at the client, and for
            you.
          </li>
          <li>
            Live links to client sites, portals, staging environments or
            shared drives.
          </li>
          <li>
            Figures the client would not publish themselves: budgets,
            headcount, roadmaps, contract terms.
          </li>
        </ul>
        <p className="mt-3 text-sm text-ink-muted">
          Percentages, timelines, your role, the craft and the outcome all
          stay. Those are what win the next engagement.
        </p>
        <p className="mt-3 text-sm text-ink-faint">
          Future Modern places the work and holds the client relationship. A
          portfolio that names clients is also a list of people to approach
          around the cooperative, which is why this one is firm.
        </p>
      </details>
    </div>
  );
}
