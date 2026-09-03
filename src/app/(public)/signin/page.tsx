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
import { getCurrentUser } from "@/lib/auth-stub";

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

async function signInWithGoogle(formData: FormData) {
  "use server";
  const next = String(formData.get("next") ?? "/dashboard").trim() || "/dashboard";
  await signIn("google", { redirectTo: next });
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  // ─────────────────────────────────────────────────────────────
  // WHY (2026-09-02)
  //
  // This page never checked whether you were already signed in, so a
  // member with a live session who landed here was shown the sign-in
  // form again and asked to prove who they were for a second time.
  // Bayu: "took me to another sign-in page that don't detect that i'm
  // already signed in, i think that's the bigger problem."
  //
  // He is right that it is the bigger problem. A sign-in screen shown
  // to someone already signed in reads as "your session broke", which
  // is exactly the wrong thing to tell a member during onboarding.
  //
  // Send them where they were going instead. Internal paths only: a
  // `next` value is attacker-controllable through the query string, so
  // an absolute URL here would turn our own sign-in page into an open
  // redirect for phishing.
  // ─────────────────────────────────────────────────────────────
  const existing = await getCurrentUser();
  if (existing) {
    const target =
      next && next.startsWith("/") && !next.startsWith("//")
        ? next
        : "/dashboard";
    redirect(target);
  }

  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <h1 className="font-display text-4xl font-semibold">Sign in</h1>
      <p className="mt-3 text-ink-muted">
        Enter your email. We&apos;ll send you a magic link — no password
        required.
      </p>

      <form action={signInWithGoogle} className="mt-8">
        <input type="hidden" name="next" value={next ?? "/dashboard"} />
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-3 rounded-full border border-[var(--surface-border)] bg-white py-3 text-base font-medium text-[#3c4043] transition-colors hover:bg-gray-50"
        >
          <GoogleG />
          Sign in with Google
        </button>
      </form>

      <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-ink-faint">
        <span className="flex-1 border-t border-[var(--surface-border)]" />
        or
        <span className="flex-1 border-t border-[var(--surface-border)]" />
      </div>

      <form action={sendMagicLink} className="space-y-4">
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

/** Google's canonical multi-color "G" mark, inlined SVG so we don't
 *  need to load an external asset for a single button. */
function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.58 9 3.58z"
      />
    </svg>
  );
}
