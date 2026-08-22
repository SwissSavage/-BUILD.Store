/**
 * /signin/verify — "check your email" landing after magic-link submit.
 *
 * Auth.js redirects here after successfully accepting the email at
 * /signin. The user should see this until they click the emailed
 * link, which takes them into a fresh session.
 */

export const metadata = {
  title: "Check your email — Future Modern",
};

export default function VerifyRequestPage() {
  return (
    <div className="mx-auto max-w-md px-6 py-20 text-center">
      <h1 className="font-display text-4xl font-semibold">Check your email</h1>
      <p className="mt-4 text-ink-muted">
        We sent a sign-in link to the email you provided. Click the link
        to complete sign-in. The link is single-use and expires in 24
        hours.
      </p>
      <p className="mt-8 text-xs text-ink-faint">
        Nothing arrived? Check spam, then try again from{" "}
        <a href="/signin" className="text-brand-magenta hover:underline">
          the sign-in page
        </a>
        .
      </p>
    </div>
  );
}
