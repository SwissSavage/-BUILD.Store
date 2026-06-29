/**
 * Signup: $BUILD a team.
 *
 * For clients who need a cross-pillar squad assembled for a defined
 * engagement (brand + build + GTM, retrofit + financing + community,
 * etc.). Supports multi-pillar selection and JD / role-spec uploads
 * so the cooperative can match against real role docs, not just a
 * scope blurb. Posts to the shared `handleSignup` action with a
 * hidden `intent=build_a_team` input.
 */
import { handleSignup } from "../_actions";
import { INTENT_COPY } from "../_copy";
import {
  ContactFields,
  JdUploadField,
  PillarMultiSelect,
  SignupHeader,
  SubmitRow,
} from "../_shared";

export default function BuildTeamSignupPage() {
  const copy = INTENT_COPY.build_a_team;
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
        <input type="hidden" name="intent" value="build_a_team" />

        {/* Hide the single-pillar select; multi-pillar fieldset replaces it. */}
        <ContactFields showPillarSelect={false} />

        <PillarMultiSelect />

        <section className="space-y-3">
          <h2 className="text-xs uppercase tracking-wider text-brand-magenta">
            Team scope
          </h2>
          <p className="text-xs text-ink-muted">
            What does the team need to deliver? A few sentences is
            enough — we come back with a composition proposal.
          </p>
          <textarea
            name="teamScope"
            rows={6}
            required
            placeholder="Example: Need a 3-person squad to stand up a DTC apparel brand: brand system, Shopify build, fulfillment ops. 10-week runway to first drop."
            className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
          />
        </section>

        <JdUploadField
          label="Upload JDs / scope docs (optional)"
          helper="If you already have JDs or written briefs for the roles, drop them here. PDF, DOCX, DOC, TXT, MD up to 10MB each. Multiple files supported."
        />

        <SubmitRow />
      </form>
    </div>
  );
}
