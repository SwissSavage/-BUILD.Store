/**
 * Whitelist confirmation — consultation path only for now.
 */
import Link from "next/link";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

export default async function WhitelistThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ kind?: string }>;
}) {
  const { kind } = await searchParams;
  const isConsult = kind === "consultation";

  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <Card>
        <CardEyebrow>
          {isConsult ? "Scoping request received" : "Received"}
        </CardEyebrow>
        <CardTitle className="mt-2 text-3xl">
          {isConsult
            ? "A cooperator will be in touch in 3 business days"
            : "Thanks — we'll be in touch"}
        </CardTitle>
        <p className="mt-3 text-sm text-ink-muted">
          {isConsult
            ? "We triage new scoping requests every morning. Admin routes the briefing to the pillar(s) that fit, and you'll hear back from one of us to schedule the 30-minute call. No commitment — if it isn't a fit after the call, we part as friends."
            : "Check your inbox for next steps."}
        </p>
      </Card>
      <Link
        href="/whitelist"
        className="mt-6 inline-block text-sm text-brand-magenta hover:underline"
      >
        ← Back to whitelist
      </Link>
    </div>
  );
}
