/**
 * Sign-in page — email magic-link entry.
 *
 * Real Auth.js flow: user enters email, we call `signIn("nodemailer",
 * { email, redirectTo })`, Auth.js writes a verification token, hands
 * off to Nodemailer to send the magic link via Resend SMTP, then
 * 302s the user to /signin/verify. When they click the email link
 * they land back on the callback URL which resolves the token, creates
 * the session, and redirects to `redirectTo`.
 *
 * Suspension refusal happens in the signIn callback in `auth.ts`; a
 * suspended account gets bounced back to /signin/error.
 *
 * A sandbox-mode banner reminds admins the mock-user picker is gone.
 */
import { signIn } from "@/lib/auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign in — Future Modern",
};

async function sendMagicLink(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = String(formData.get("next") ?? "/dashboard").trim() || "/dashboard";
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    redirect(`/signin/error?reason=invalid_email`);
  }
  await signIn("nodemailer", {
    email,
    redirectTo: next,
  });
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <h1 className="font-display text-4xl font-semibold">Sign in</h1>
      <p className="mt-3 text-ink-muted">
        Enter your email. We&apos;ll send you a magic link — no password
        required.
      </p>

      <form action={sendMagicLink} className="mt-8 space-y-4">
        <input type="hidden" name="next" value={next ?? "/dashboard"} />
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-ink-muted">
            Email
          </span>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-3 text-base"
          />
        </label>
        <button
          type="submit"
          className="w-full rounded-full bg-brand-magenta py-3 text-base font-medium text-brand-white transition-colors hover:bg-brand-magenta/90"
        >
          Send magic link
        </button>
      </form>

      <p className="mt-8 text-xs text-ink-faint">
        Only invited members and partners can sign in. If you don&apos;t
        have an account yet, reach out to the person who introduced you
        to Future Modern.
      </p>
    </div>
  );
}
