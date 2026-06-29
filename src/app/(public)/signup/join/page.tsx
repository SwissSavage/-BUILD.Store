/**
 * Signup: Join as talent.
 *
 * Intake for contributors who want to work through the cooperative.
 * Takes a portfolio/resume URL + a short summary. Approved talent
 * gets routed to RFPs, JDs, and direct client contracts. Posts to
 * the shared `handleSignup` action with a hidden
 * `intent=join_as_talent` input.
 *
 * Sandbox accepts a URL only; production swaps this for a real upload
 * (resume PDF + up to 5 portfolio files → S3 / UploadThing).
 */
import Link from "next/link";
import { handleSignup } from "../_actions";
import { INTENT_COPY } from "../_copy";
import { ContactFields, SignupHeader, SubmitRow } from "../_shared";

export default function JoinAsTalentSignupPage() {
  const copy = INTENT_COPY.join_as_talent;
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <SignupHeader
        eyebrow={copy.label}
        headline={copy.headline}
        blurb={copy.blurb}
      />

      <form action={handleSignup} className="mt-10 space-y-6">
        <input type="hidden" name="intent" value="join_as_talent" />

        <ContactFields />

        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-wider text-brand-magenta">
            Resume / portfolio
          </h2>
          <p className="text-xs text-ink-muted">
            Paste a link to your resume, portfolio, LinkedIn, GitHub,
            or wherever your best work lives. A short summary helps
            too — tell us what you want to work on through the
            cooperative.
          </p>
          <input
            type="url"
            name="talentPortfolioUrl"
            required
            placeholder="https://yourportfolio.com or LinkedIn URL"
            className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
          />
          <textarea
            name="talentSummary"
            rows={5}
            placeholder="What do you want to contribute? What are you best at? Any domains or types of work you want more of?"
            className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
          />
          <p className="text-xs text-ink-faint">
            Sandbox accepts a URL. In production this becomes a real
            upload (resume PDF + up to 5 portfolio files).
          </p>
        </section>

        <section className="space-y-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-5">
          <div>
            <h2 className="text-xs uppercase tracking-wider text-brand-magenta">
              Consent
            </h2>
            <p className="mt-1 text-xs text-ink-muted">
              Two distinct things, one form. The first is required to use
              the platform. The second is optional and separately
              checkable.
            </p>
          </div>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="termsAccepted"
              required
              className="mt-1 h-4 w-4"
            />
            <span>
              <span className="font-medium">
                I agree to the cooperative&rsquo;s Terms.
              </span>{" "}
              <span className="text-ink-muted">
                Authorizes Future Modern to record engagement data for
                internal cooperative operations: pricing tools, matching,
                calibration, and required tax / accounting / audit use.
                Required to use the platform.
              </span>
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="dataParticipation"
              className="mt-1 h-4 w-4"
            />
            <span>
              <span className="font-medium">
                Opt in to labor-value data participation (optional).
              </span>{" "}
              <span className="text-ink-muted">
                Lets the cooperative include your engagement data in the
                anonymized aggregates we publish as labor-value research and
                use as inputs to collective-bargaining tooling for unions,
                worker centers, and labor-research orgs. Worker-side aligned
                by covenant; raw price points never leave; anonymized only;
                opt out anytime from your profile. Read the{" "}
                <Link
                  href="/data-use-policy"
                  className="text-brand-magenta hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Data Use Policy
                </Link>{" "}
                first.
              </span>
            </span>
          </label>
        </section>

        <SubmitRow />
      </form>
    </div>
  );
}
