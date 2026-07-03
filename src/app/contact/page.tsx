/**
 * /contact — sandbox contact route.
 *
 * Referenced from /trust and /policies/privacy as the "sandbox stub"
 * contact path. Production replaces with a real form that files to
 * the inbound triage queue with the appropriate `InboundSubmissionKind`
 * per topic (privacy request, security report, general question).
 */
import Link from "next/link";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <CardEyebrow>Contact</CardEyebrow>
      <h1 className="mt-2 font-display text-4xl font-semibold">
        Get in touch
      </h1>
      <p className="mt-3 text-sm text-ink-muted">
        Pick the path that fits.
      </p>

      <div className="mt-8 space-y-3">
        <Card>
          <CardEyebrow>Sales / new client</CardEyebrow>
          <CardTitle className="mt-2 text-lg">
            Talk to us before you scope the work
          </CardTitle>
          <p className="mt-2 text-sm text-ink-muted">
            Fifteen minutes on the phone gets you a sharper brief than
            two weeks of back-and-forth.
          </p>
          <a
            href="https://calendly.com/properpreparationism"
            target="_blank"
            rel="noreferrer"
            className="mt-3 inline-block text-sm text-brand-magenta hover:underline"
          >
            Schedule a call →
          </a>
        </Card>

        <Card>
          <CardEyebrow>Privacy / data rights</CardEyebrow>
          <CardTitle className="mt-2 text-lg">
            Ask about your data
          </CardTitle>
          <p className="mt-2 text-sm text-ink-muted">
            Members can self-serve export or erasure at{" "}
            <Link
              href="/profile/data-rights"
              className="text-brand-magenta hover:underline"
            >
              /profile/data-rights
            </Link>
            . For anything else,{" "}
            <code className="text-brand-magenta">privacy@buildstore</code>{" "}
            (production).
          </p>
        </Card>

        <Card>
          <CardEyebrow>Security</CardEyebrow>
          <CardTitle className="mt-2 text-lg">Report a vulnerability</CardTitle>
          <p className="mt-2 text-sm text-ink-muted">
            Responsible disclosure to{" "}
            <code className="text-brand-magenta">security@buildstore</code>{" "}
            (production). Public repo policy at{" "}
            <code>SECURITY.md</code> when it lands.
          </p>
        </Card>

        <Card>
          <CardEyebrow>Contributions</CardEyebrow>
          <CardTitle className="mt-2 text-lg">Contribute to the code</CardTitle>
          <p className="mt-2 text-sm text-ink-muted">
            Open an issue or pull request at{" "}
            <a
              href="https://github.com/SwissSavage/-BUILD.Store"
              target="_blank"
              rel="noreferrer"
              className="text-brand-magenta hover:underline"
            >
              github.com/SwissSavage/-BUILD.Store
            </a>
            . See <code>CONTRIBUTING.md</code>.
          </p>
        </Card>

        <Card>
          <CardEyebrow>Conduct</CardEyebrow>
          <CardTitle className="mt-2 text-lg">
            Report a code-of-conduct violation
          </CardTitle>
          <p className="mt-2 text-sm text-ink-muted">
            Email{" "}
            <code className="text-brand-magenta">conduct@buildstore</code>{" "}
            (production). Acknowledged within 3 business days.
          </p>
        </Card>
      </div>

      <p className="mt-10 text-xs text-ink-faint">
        Production activates the email addresses named above and points
        this form at the unified inbound triage queue.
      </p>
    </div>
  );
}
