/**
 * ============================================================
 * STUB — fake auth for the sandbox prototype.
 *
 * REPLACE WITH: a real auth provider (Clerk, Auth.js / NextAuth,
 * WorkOS, or custom OIDC). Decision deferred per Jamar 2026-04-20.
 *
 * Production responsibilities of this module:
 *   - sign-in / sign-up flow
 *   - session creation + verification
 *   - admin-flag check on the server
 *
 * Sandbox behavior:
 *   - Login picks a user id from MOCK_USERS via a cookie.
 *   - Cookie name: `bs_uid`.
 *   - Server components read it via `getCurrentUser()`.
 *   - Client components use the `useAuth()` hook.
 *
 * Anything that is hand-wavy ("trust me bro") in this file is the
 * place a real provider plugs in. There is no real cryptographic
 * verification. Do not deploy this to production.
 * ============================================================
 */
import { cookies } from "next/headers";
import { MOCK_USERS } from "@/lib/mock-data/users";
import type { User } from "@/lib/types";

const COOKIE_NAME = "bs_uid";
/**
 * Admin-only "view-as" support. When an admin uses the nav dropdown to
 * preview the site as another user (or as a signed-out viewer), we copy
 * their real id into `bs_uid_real` and overwrite `bs_uid` with the
 * preview target. The "Return to your admin account" affordance reads
 * `bs_uid_real` to flip back. This cookie has no production analog —
 * real auth would do this with an explicit impersonation feature.
 */
const REAL_COOKIE_NAME = "bs_uid_real";

/** Server-component helper. Reads the session cookie. */
export async function getCurrentUser(): Promise<User | null> {
  const jar = await cookies();
  const uid = jar.get(COOKIE_NAME)?.value;
  if (!uid) return null;
  return MOCK_USERS.find((u) => u.id === uid) ?? null;
}

/**
 * Server-component helper. If the current session is a "view-as" preview
 * launched by an admin, returns that admin user. Otherwise null.
 */
export async function getOriginalAdminUser(): Promise<User | null> {
  const jar = await cookies();
  const realUid = jar.get(REAL_COOKIE_NAME)?.value;
  if (!realUid) return null;
  const user = MOCK_USERS.find((u) => u.id === realUid) ?? null;
  // If the recorded "real" user is no longer admin, treat the breadcrumb
  // as stale and ignore it — defensive against MOCK_USERS edits.
  return user && user.isAdmin ? user : null;
}

/** Server-component helper. Throws if not admin. Use inside admin routes. */
export async function requireAdmin(): Promise<User> {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) {
    throw new Error("Admin access required");
  }
  return user;
}

/** Cookie-name exports so the auth-action server actions can set / clear them. */
export const SESSION_COOKIE = COOKIE_NAME;
export const REAL_SESSION_COOKIE = REAL_COOKIE_NAME;
