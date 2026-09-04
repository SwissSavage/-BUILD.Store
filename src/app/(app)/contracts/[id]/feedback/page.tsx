/**
 * External client feedback questionnaire (Phase 2.7 magic-link rail).
 *
 * Reached via /contracts/[id]/feedback?token=<token>.
 *
 * The route is auth-free by design. Clients never had a $BUILD.Store
 * login. Submit fans out a `customer_feedback_received` notification
 * to every admin (handled in the server action).
 *
 * ─────────────────────────────────────────────────────────────
 * TOKEN RAIL (2026-09-04)
 *
 * This page used to gate on a three-entry map written into the file,
 * pointing at seed contracts p_003, p_004 and p_006. Nothing anywhere
 * added to it, so no real client could be sent a working link and none
 * ever was. The page looked finished and could not be used.
 *
 * Tokens now come from `customer_feedback_tokens`, minted by an admin
 * on /admin/contracts/[id]/settle. resolveFeedbackToken is the single
 * definition of a valid link and the submit action calls the same one,
 * so the page and the write cannot disagree about what it accepts.
 *
 * The rejection is rendered with its reason. An expired link and a
 * mistyped one are different problems for the client and they should
 * not read the same.
 * ─────────────────────────────────────────────────────────────
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectById } from "@/lib/readers/projects";
import { customerFeedbackReader, eq, safely } from "@/lib/readers";
import { customerFeedback as customerFeedbackTable } from "@/db/schema";
import { submitCustomerFeedbackByLink } from "@/lib/customer-feedback-actions";
import { resolveFeedbackToken } from "@/lib/feedback-link-tokens";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import {
  StarPicker,
  ProseField,
  YesNoToggle,
  NameEmailFields,
  ShortTextField,
  RadioChoice,
} from "@/components/feedback-fields";

// Friendly client labels. Keep in sync with the invoice / proposal pages.
const CLIENT_LABELS: Record<string, string> = {
  client_url_media: "URL Media",
  client_bk_greenroots: "Brooklyn GreenRoots",
  client_arborai: "ArborAI",
};

export const dynamic = "force-dynamic";

export default async function ContractFeedbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;

  // safely() so an unreachable database refuses the link rather than
  // throwing a blank error page at a client. A gate that cannot check
  // has to say no.
  const resolution = await safely(() => resolveFeedbackToken(token, id), {
    ok: false,
    reason: "unknown" as const,
    tokenId: null,
    contextId: null,
  });

  if (!resolution.ok) {
    const headline =
      resolution.reason === "already_used"
        ? "This link has already been used"
        : resolution.reason === "expired"
          ? "This link has expired"
          : "This link isn't valid";
    const detail =
      resolution.reason === "already_used"
        ? "We have your answers for this engagement. If you need to add or correct something, reply to the wrap-up email and an admin will sort it."
        : resolution.reason === "expired"
          ? "Questionnaire links stay open for a limited window. Reply to your wrap-up email and we'll send a fresh one."
          : "The questionnaire link from your project wrap-up email may have been mistyped or superseded by a newer one. Reply to that email and we'll send another.";
    return (
      <div className="mx-auto max-w-xl px-6 py-16">
        <h1 className="font-display text-3xl font-semibold">{headline}</h1>
        <p className="mt-3 text-sm text-ink-muted">{detail}</p>
        <Link
          href="/"
          className="mt-6 inline-block text-sm text-brand-magentaText hover:underline"
        >
          ← $BUILD.Store home
        </Link>
      </div>
    );
  }

  const project = await getProjectById(id);
  if (!project) notFound();

  const clientLabel = CLIENT_LABELS[project.clientId] ?? project.clientId;
  // Reader swap 2026-09-03. This is the magic-link page a CLIENT
  // lands on to rate an engagement, and "have they already left
  // feedback" was answered from the fixture. A client who had just
  // submitted could be asked again, and one who never had could be
  // told their feedback was received.
  const existingFeedback = await safely(
    () =>
      customerFeedbackReader.where(
        eq(customerFeedbackTable.contextId, project.id),
      ),
    [],
  );
  const already = existingFeedback.length > 0;

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="text-xs uppercase tracking-wider text-brand-magentaText">
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
            {/*
              The token rides along so the submit can spend it. Without
              this the link stays live after use and the same client, or
              anyone they forwarded the mail to, can answer again.
            */}
            <input type="hidden" name="token" value={token ?? ""} />

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
              className="fm-btn-primary rounded-full px-5 py-2 text-sm font-medium"
            >
              Submit feedback
            </button>
          </form>
        </Card>
      )}
    </div>
  );
}
