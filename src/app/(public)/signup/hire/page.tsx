/**
 * Signup: Hire talent — post a JD.
 *
 * Narrow intake for clients with a specific role or opportunity. One
 * JD-brief textarea does the heavy lifting; the rest is contact +
 * pillar. Posts to the shared `handleSignup` server action with a
 * hidden `intent=hire_talent` input.
 */
import { handleSignup } from "../_actions";
import { INTENT_COPY } from "../_copy";
import {
  ContactFields,
  JdUploadField,
  SignupHeader,
  SubmitRow,
} from "../_shared";

export default function HireTalentSignupPage() {
  const copy = INTENT_COPY.hire_talent;
  return (
    <div className="mx-auto max-w-2xl px-6 py-16">
      <SignupHeader
        eyebrow={copy.label}
        headline={copy.headline}
        blurb={copy.blurb}
      />

      <form
        action={handleSignup}
        className="mt-10 space-y-6"
        encType="multipart/form-data"
      >
        <input type="hidden" name="intent" value="hire_talent" />

        <ContactFields />

        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-wider text-brand-magenta">
            JD / opportunity brief
          </h2>
          <p className="text-xs text-ink-muted">
            The more concrete, the faster we can route. Include role
            title, scope, seniority expectation, timeline, and budget or
            rate band if you have one.
          </p>
          <textarea
            name="opportunityBrief"
            rows={6}
            required
            placeholder="Example: Senior brand designer, 6-week engagement, rebranding a Series A legaltech company. Budget $40-60k. Start in 3 weeks."
            className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
          />
        </section>

        <JdUploadField />

        <SubmitRow />
      </form>
    </div>
  );
}
