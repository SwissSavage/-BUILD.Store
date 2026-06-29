/**
 * External client feedback questionnaire (Phase 2.7 magic-link rail).
 *
 * Reached via /contracts/[id]/feedback?token=<token>. Sandbox keeps a
 * tiny in-file token map keyed by contract id. Production will issue
 * signed JWTs from the same service that powers /proposals/[token].
 *
 * The route is auth-free by design. Clients never had a $BUILD.Store
 * login. Submit fans out a `customer_feedback_received` notification
 * to every admin (handled in the server action).
 *
 * REPLACE WITH: signed token verification, single-use audit log entry,
 * Drizzle insert into `customer_feedback`, Postmark webhook to mark the
 * outbound questionnaire email "responded".
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { hasFeedbackForContext } from "@/lib/mock-data/customer-feedback";
import { submitCustomerFeedbackByLink } from "@/lib/customer-feedback-actions";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import {
  StarPicker,
  ProseField,
  YesNoToggle,
  NameEmailFields,
  ShortTextField,
  RadioChoice,
} from "@/components/feedback-fields";

// Sandbox magic-link tokens. Each token gates a single contract.
// In production: `customer_feedback_tokens` table, single-use, expires.
const FEEDBACK_TOKENS: Record<string, string> = {
  "tok_p_003_marisa": "p_003",
  "tok_p_004_devon": "p_004",
  "tok_p_006_janelle": "p_006",
};

// Friendly client labels. Keep in sync with the invoice / proposal pages.
const CLIENT_LABELS: Record<string, string> = {
  client_url_media: "URL Media",
  client_dcg: "Direct Connect Global",
  client_bk_greenroots: "Brooklyn GreenRoots",
  client_arborai: "ArborAI",
};

export default async function ContractFeedbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;

  if (!token || FEEDBACK_TOKENS[token] !== id) {
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <h1 className="font-display text-3xl font-semibold">
          This link isn&apos;t valid
        </h1>
        <p className="mt-3 text-sm text-ink-muted">
          The questionnaire link from your project wrap-up email may have
          expired or been mistyped. Reply to that email and we&apos;ll
          send a fresh one.
        </p>
        <Link
          href="/"
          className="mt-6 inline-block text-sm text-brand-magenta hover:underline"
        >
          ← $BUILD.Store home
        </Link>
      </div>
    );
  }

  const project = MOCK_PROJECTS.find((p) => p.id === id);
  if (!project) notFound();

  const clientLabel = CLIENT_LABELS[project.clientId] ?? project.clientId;
  const already = hasFeedbackForContext(project.id);

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="text-xs uppercase tracking-wider text-brand-magenta">
        $BUILD.Store · Project wrap-up
      </div>
      <h1 className="mt-2 font-display text-3xl font-semibold">
        How did {project.title} land?
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        For {clientLabel}. Your feedback helps the cooperative calibrate
        and helps the contributors who delivered for you. Quotes only get
        published with the contributor&apos;s name attached after our
        admin pulls a clean line.
      </p>

      {already ? (
        <Card className="mt-8 border-[#007048]/40">
          <CardEyebrow>Thanks. Already received</CardEyebrow>
          <p className="mt-2 text-sm text-ink-muted">
            We have your feedback for this engagement on file. If you need
            to add or correct anything, reply to the wrap-up email and
            an admin will sort it.
          </p>
        </Card>
      ) : (
        <Card className="mt-8 border-[#D828A0]/40">
          <CardEyebrow>Two minutes, eight questions</CardEyebrow>
          <CardTitle className="mt-1 text-xl">
            Tell us how it went
          </CardTitle>

          <form
            action={submitCustomerFeedbackByLink}
            className="mt-5 space-y-5"
          >
            <input type="hidden" name="contextId" value={project.id} />

            <NameEmailFields />

            <div className="grid gap-3 md:grid-cols-3">
              <StarPicker name="overallStars" label="Overall" autoFocus />
              <StarPicker name="metExpectations" label="Met expectations" />
              <StarPicker name="communication" label="Communication" />
            </div>

            <YesNoToggle
              name="wouldHireAgain"
              label="Would you re-engage?"
            />

            <ProseField
              name="prose"
              label="Tell us how it went (≥ 20 chars)"
              placeholder="What worked, what didn't, anything you'd want a future client to know about working with this team."
            />

            <ShortTextField
              name="contributorShoutout"
              label="Anyone on our side who stood out?"
              placeholder="Name a contributor or two whose work made the difference."
            />

            <RadioChoice
              name="attributionConsent"
              label="If we use your feedback externally, how should we attribute it?"
              options={[
                ["name_and_org", "Yes, attribute me by name and my organization"],
                ["org_only", "Yes, attribute by organization only"],
                ["anonymized", "Yes, but keep me anonymous (\"a client\")"],
                ["internal_only", "No, keep this internal only"],
              ]}
            />

            <RadioChoice
              name="googleReviewOptIn"
              label="Would you be willing to leave a public Google Review?"
              options={[
                ["yes_send_link", "Yes, send me the link"],
                ["ask_me_later", "Maybe, ask me again in a few weeks"],
                ["no", "No"],
              ]}
            />

            <p className="text-[11px] text-ink-faint">
              Submitting routes to the cooperative admin. Quotes are
              never published verbatim. An admin scrubs PII and only
              uses your feedback in the way you consented to above.
            </p>

            <button
              type="submit"
              className="rounded-full px-5 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: "#D828A0" }}
            >
              Submit feedback
            </button>
          </form>
        </Card>
      )}
    </div>
  );
}
