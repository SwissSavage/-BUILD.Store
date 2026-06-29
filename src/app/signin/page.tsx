/**
 * Sandbox sign-in. Pick a mock user; get a session cookie.
 *
 * REPLACE WITH: real auth provider sign-in page (Clerk/Auth.js/etc.).
 */
import { signIn } from "@/lib/auth-actions";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { TIER_LABELS, publicName } from "@/lib/types";

export default function SignInPage() {
  return (
    <div className="mx-auto max-w-md px-6 py-20">
      <h1 className="font-display text-4xl font-semibold">Sign in</h1>
      <p className="mt-3 text-ink-muted">
        Sandbox only. Pick a user to preview the member experience.
      </p>

      <form action={signIn} className="mt-8 space-y-3">
        {MOCK_USERS.map((u) => (
          <label
            key={u.id}
            className="flex cursor-pointer items-center justify-between rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-4 transition-colors hover:border-brand-magenta"
          >
            <div>
              <div className="font-medium">{publicName(u)}</div>
              <div className="text-xs text-ink-muted">
                {TIER_LABELS[u.membershipTier]}
                {u.isAdmin && " · Admin"}
              </div>
            </div>
            <input
              type="radio"
              name="uid"
              value={u.id}
              defaultChecked={u.id === "u_jamar"}
              className="h-4 w-4 accent-brand-magenta"
            />
          </label>
        ))}
        <button
          type="submit"
          className="mt-6 w-full rounded-full bg-ink py-3 font-medium text-[var(--surface)] transition-colors hover:bg-brand-magenta hover:text-brand-white"
        >
          Continue
        </button>
      </form>

      <p className="mt-6 text-xs text-ink-faint">
        This is a stubbed sign-in. In production, a real auth provider (Clerk,
        Auth.js, or equivalent) replaces this page.
      </p>
    </div>
  );
}
