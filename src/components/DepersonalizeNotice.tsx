/**
 * What gets a submission sent back, said before it is written.
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
 * WHY BOTH CONTEXTS NOW SAY THE SAME THING (2026-10-13)
 *
 * The portfolio half kept the old scrub-the-client-name rule for five
 * days after the bid half was corrected. Jamar, on the portfolio
 * guidance: "Naming a client is not an issue, we don't care about that.
 * We don't want them naming their own companies."
 *
 * So the distinction drawn below between the two surfaces was wrong:
 * the exposure is identical on both, and it was never the client's name.
 * Both contexts now carry the same rule and the Context type is kept
 * only because callers pass it.
 *
 * WHAT THE TWO CONTEXTS USED TO SAY (2026-10-08)
 *
 * The bid form was given the portfolio's rule and it was the wrong
 * rule. Jamar: "This is also not accurate for the RFP flow. We don't
 * care if they name a client. We prefer it actually. The issue is
 * trying to plug themselves for services in ways that create
 * circumvention."
 *
 * A bid is a pitch to a client FM already holds, and past client names
 * are the credibility that wins it. The exposure on a bid is not the
 * names in the track record, it is the Builder routing the next deal
 * around the cooperative: their own contact details, their own studio,
 * their own booking link, their own rate card. A notice that says
 * "scrub client names" on this screen costs the bid its evidence and
 * leaves the actual risk unmentioned.
 *
 * The portfolio rule is unchanged: a public profile is a different
 * surface, with no deal in front of it and no admin between the reader
 * and the Builder.
 *
 * Deliberately not a modal and not a blocking checkbox. A wall in
 * front of the submit button gets clicked through, and we would be
 * pretending we had solved it. This is a persistent panel, open by
 * default at the headline, with the checklist one click away.
 * ─────────────────────────────────────────────────────────────
 */
import { cn } from "@/lib/cn";

type Context = "portfolio" | "proposal";

export function DepersonalizeNotice({
  context = "portfolio",
  className,
}: {
  context?: Context;
  className?: string;
}) {
  const wrapper = cn(
    "rounded-xl border border-brand-magenta/40 bg-brand-magenta/5 p-4",
    className,
  );

  if (context === "proposal") {
    return (
      <div className={wrapper}>
        <p className="text-sm font-semibold text-brand-magentaText">
          Pitch the work, not your shop
        </p>
        <p className="mt-1 text-sm text-ink-muted">
          Name the clients you have done this for. That is the evidence and it
          is what wins the bid. What gets a bid sent back is routing the client
          to you instead of through Future Modern.
        </p>

        <div className="mt-3 space-y-1 rounded-lg bg-[var(--surface)] p-3 text-xs">
          <p className="text-ink-faint">
            <span className="font-semibold uppercase tracking-wider">
              Sent back:
            </span>{" "}
            &ldquo;Rebuilt checkout for Acme Foods, cut cart abandonment 22%.
            Happy to jump on a call, I&rsquo;m at me@mystudio.com.&rdquo;
          </p>
          <p className="text-ink-muted">
            <span className="font-semibold uppercase tracking-wider text-brand-magentaText">
              Works:
            </span>{" "}
            &ldquo;Rebuilt checkout for Acme Foods, cut cart abandonment
            22%.&rdquo;
          </p>
        </div>

        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-ink-muted hover:text-brand-magentaText">
            What gets a bid sent back
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted">
            <li>
              Your email, phone, calendar link, DMs or any other way to reach
              you directly.
            </li>
            <li>
              Your agency, studio or company name presented as the party doing
              the work.
            </li>
            <li>
              Links to your own site, booking page, rate card or shop, including
              in attachments and in the filename.
            </li>
            <li>
              Terms offered outside this bid: retainers, discounts for going
              direct, work you would do on the side.
            </li>
            <li>
              Live links into a past client&rsquo;s portal, staging environment
              or shared drive, and figures that client would not publish
              themselves.
            </li>
          </ul>
          <p className="mt-3 text-sm text-ink-muted">
            Client names, logos in your samples, percentages, timelines, your
            role and the outcome all stay. Lead with them.
          </p>
          <p className="mt-3 text-sm text-ink-faint">
            Future Modern holds the client relationship and carries the contract,
            the collection risk and the guarantee. A bid that hands the client a
            way around that is taking the upside off the people who took the
            risk, which is why this one is firm.
          </p>
        </details>
      </div>
    );
  }

  return (
    <div className={wrapper}>
      <p className="text-sm font-semibold text-brand-magentaText">
        Name your clients. Leave out your own shop.
      </p>
      <p className="mt-1 text-sm text-ink-muted">
        Past clients are the evidence that wins work, so use them. What gets a
        piece sent back is presenting yourself as a company, or giving a reader
        a way to reach you directly.
      </p>

      <div className="mt-3 space-y-1 rounded-lg bg-[var(--surface)] p-3 text-xs">
        <p className="text-ink-faint">
          <span className="font-semibold uppercase tracking-wider">
            Sent back:
          </span>{" "}
          &ldquo;Rebuilt checkout for Acme Foods. My studio takes retainers,
          reach me at me@mystudio.com.&rdquo;
        </p>
        <p className="text-ink-muted">
          <span className="font-semibold uppercase tracking-wider text-brand-magentaText">
            Works:
          </span>{" "}
          &ldquo;Rebuilt checkout for Acme Foods, cut cart abandonment
          22%.&rdquo;
        </p>
      </div>

      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-ink-muted hover:text-brand-magentaText">
          What gets a piece sent back
        </summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-muted">
          <li>
            Your own company, agency or studio name, presented as the party
            doing the work.
          </li>
          <li>
            Your email, phone, calendar link, DMs or any other direct line to
            you, including inside a file and in its filename.
          </li>
          <li>
            Links to your own site that sell rather than show. A case study or
            project page is fine when it carries no services pitch, no rates
            and no contact details. A booking page, rate card, shop or contact
            page is not.
          </li>
          <li>
            Offers of work outside the cooperative: retainers, discounts for
            going direct, anything you would do on the side.
          </li>
          <li>
            Live links into a client&rsquo;s portal, staging environment or
            shared drive, and figures that client would not publish themselves.
          </li>
        </ul>
        <p className="mt-3 text-sm text-ink-muted">
          Client names, logos in your samples, percentages, timelines, your role
          and the outcome all stay. Lead with them.
        </p>
        <p className="mt-3 text-sm text-ink-faint">
          Future Modern holds the client relationship and carries the contract,
          the collection risk and the guarantee. A profile that hands a reader a
          way around that is taking the upside off the people who took the risk,
          which is why this one is firm.
        </p>
      </details>
    </div>
  );
}
