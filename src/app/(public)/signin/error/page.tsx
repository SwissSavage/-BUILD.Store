/**
 * /signin/error — auth-flow error surface.
 *
 * Auth.js redirects here when sign-in fails (suspended account,
 * expired verification token, provider misconfiguration, etc.). The
 * `error` query param carries a machine-readable code we translate
 * into human copy.
 */
export const dynamic = "force-dynamic";

export const metadata = {
  title: "Sign-in issue — Future Modern",
};

const REASONS: Record<string, { title: string; body: string }> = {
  invalid_email: {
    title: "That doesn't look like an email address",
    body: "Try again from the sign-in page.",
  },
  Verification: {
    title: "That sign-in link has expired",
    body: "Magic links are single-use and time out after 24 hours. Request a new one from the sign-in page.",
  },
  AccessDenied: {
    title: "This account can't sign in",
    body: "Your account may be suspended, or you may not have completed your invite. Reach out to the person who introduced you to Future Modern.",
  },
  Configuration: {
    title: "Auth configuration error",
    body: "This is on us. If this keeps happening, mention it to the FM admin who invited you.",
  },
  default: {
    title: "Sign-in didn't work",
    body: "Something went wrong. Try requesting a fresh magic link from the sign-in page.",
  },
};

export default async function SignInErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string; error?: string }>;
}) {
  const { reason, error } = await searchParams;
  const key = reason ?? error ?? "default";
  const { title, body } = REASONS[key] ?? REASONS.default;

  return (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <p className="text-xs uppercase tracking-wider text-brand-magentaText">
        Sign-in issue
      </p>
      <h1 className="mt-2 font-display text-3xl font-semibold">{title}</h1>
      <p className="mt-4 text-ink-muted">{body}</p>
      <a
        href="/signin"
        className="mt-8 inline-block rounded-full border border-[var(--surface-border)] px-6 py-2 text-sm hover:border-brand-magenta"
      >
        Back to sign-in
      </a>
    </div>
  );
}
