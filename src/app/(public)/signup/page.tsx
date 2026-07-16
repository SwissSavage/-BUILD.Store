/**
 * Get started — chooser hub.
 *
 * Two intent clusters live on this page, deliberately separated:
 *
 *   Client doors (top)  — Hire talent, $BUILD a team
 *   Contributor door    — Join as talent
 *
 * The split mirrors the nav posture (loud magenta "$BUILD a team" CTA
 * for clients, quiet "Join as talent" text link for contributors).
 * Anyone arriving at /signup cold still sees all three doors so we
 * don't trap a contributor who clicked the wrong link, but we no
 * longer present them as a single 1×3 row that implies equivalence.
 *
 *   /signup/hire        → Hire talent (post a JD)
 *   /signup/build-team  → $BUILD a team
 *   /signup/join        → Join as talent
 */
import Link from "next/link";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { INTENT_COPY, type SignupIntent } from "./_copy";

const CLIENT_INTENTS: SignupIntent[] = ["hire_talent", "build_a_team"];
const CONTRIBUTOR_INTENT: SignupIntent = "join_as_talent";

export default function SignupChooserPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      <h1 className="font-display text-4xl font-semibold md:text-5xl">
        Get started
      </h1>
      <p className="mt-3 max-w-2xl text-ink-muted">
        Pick the door that fits. Each path asks for a short, specific
        brief so the right builders can pick it up. You can always
        come back and take another path.
      </p>

      <section className="mt-12">
        <p className="text-xs uppercase tracking-wider text-ink-muted">
          Bring us work
        </p>
        <div className="mt-3 grid gap-5 md:grid-cols-2">
          {CLIENT_INTENTS.map((key) => (
            <IntentCard key={key} intent={key} />
          ))}
        </div>
      </section>

      <div className="mt-14 border-t border-[var(--surface-border)]" />

      <section className="mt-10">
        <p className="text-xs uppercase tracking-wider text-ink-muted">
          Contribute work
        </p>
        <div className="mt-3 grid gap-5 md:grid-cols-[1fr_1fr]">
          <IntentCard intent={CONTRIBUTOR_INTENT} />
          <div className="hidden rounded-2xl border border-dashed border-[var(--surface-border)] p-6 text-sm text-ink-muted md:block">
            <p className="font-medium text-ink">
              Most contributors come in by referral.
            </p>
            <p className="mt-2">
              The cooperative is people-powered. Cold applications get
              read, but the strongest signal is still someone in the
              network vouching for you. If you have a contact, ask
              them to introduce you.
            </p>
          </div>
        </div>
      </section>

      <p className="mt-12 text-xs text-ink-faint">
        Not sure which client path fits? Start with &ldquo;$BUILD a
        team.&rdquo; It&apos;s the widest door and the cooperative
        can re-route you from there.
      </p>
    </div>
  );
}

function IntentCard({ intent }: { intent: SignupIntent }) {
  const copy = INTENT_COPY[intent];
  return (
    <Link href={copy.route} className="group block h-full">
      <Card className="flex h-full flex-col transition-colors group-hover:border-brand-magenta">
        <CardEyebrow>{copy.label}</CardEyebrow>
        <CardTitle className="mt-2">{copy.headline}</CardTitle>
        <p className="mt-3 flex-1 text-sm text-ink-muted">{copy.blurb}</p>
        <span className="mt-6 text-sm font-medium text-brand-magenta group-hover:underline">
          Start →
        </span>
      </Card>
    </Link>
  );
}
