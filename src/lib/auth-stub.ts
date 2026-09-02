/**
 * ============================================================
 * Auth resolution — bridges Auth.js (production) and the sandbox
 * impersonation cookie (view-as preview + prior sandbox behavior).
 *
 * Resolution order:
 *   1. Try the real Auth.js session (magic-link-authenticated users).
 *      If present, look the user up in Drizzle and return.
 *   2. Fall back to the `bs_uid` cookie (sandbox impersonation).
 *      Admins use this via the "View site as" dropdown to preview
 *      the site as another user. Also covers any residual sandbox
 *      seed sessions until we migrate everything to Auth.js.
 *
 * `getOriginalAdminUser` reads the `bs_uid_real` breadcrumb, which
 * only exists during a view-as session. Used to render the pink
 * "Return to your admin account" banner.
 *
 * Legacy filename kept so existing `import { requireAdmin } from
 * "@/lib/auth-stub"` call sites don't need churn — the internals
 * are no longer a stub, they hit real Postgres via Drizzle.
 * ============================================================
 */
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users as usersTable } from "@/db/schema";
import type { User } from "@/lib/types";

const COOKIE_NAME = "bs_uid";
const REAL_COOKIE_NAME = "bs_uid_real";

/**
 * Load a user by id. DATABASE ONLY.
 *
 * ─────────────────────────────────────────────────────────────
 * SECURITY FIX (2026-09-02)
 *
 * This used to fall back to MOCK_USERS when the row was missing OR
 * when the database threw. MOCK_USERS contains u_jamar with
 * isAdmin: true.
 *
 * Combined with the unsigned bs_uid cookie below and a middleware that
 * counted that cookie as a session, the chain was:
 *
 *   1. Set cookie bs_uid=u_jamar in any browser
 *   2. Middleware sees a "session" and allows /admin/*
 *   3. loadUserById finds no row, falls back to the fixture
 *   4. Fixture Jamar has isAdmin: true, so requireAdmin() passes
 *
 * Full administrative access from one cookie value, no credentials,
 * on production. The database being unreachable made it easier rather
 * than harder, since the catch swallowed the error and fell through.
 *
 * A missing row now returns null. An unreachable database now throws
 * rather than quietly answering with seed data, because "we cannot
 * verify who you are" must never resolve to "you are an admin".
 * ─────────────────────────────────────────────────────────────
 */
async function loadUserById(id: string): Promise<User | null> {
  const [row] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);
  // The DB row shape maps 1:1 to the User interface per schema design.
  return (row as unknown as User) ?? null;
}

/** Server-component helper. Auth.js session first, then sandbox cookie fallback. */
export async function getCurrentUser(): Promise<User | null> {
  // Try Auth.js session first. Dynamic import keeps this file free
  // of the heavy next-auth import chain at module-load time — only
  // pulled in when getCurrentUser is actually called on a request.
  try {
    const { auth } = await import("@/lib/auth");
    const session = await auth();
    const sessionUserId = (session?.user as { id?: string } | undefined)?.id;
    if (sessionUserId) {
      const user = await loadUserById(sessionUserId);
      if (user) return user;
    }
  } catch {
    // Auth.js not configured or errored — fall through to cookie.
  }

  // View-as, and ONLY view-as.
  //
  // The bs_uid cookie is unsigned and browser-settable, so it can no
  // longer establish identity on its own. It is now strictly a lens
  // applied on top of a real Auth.js session belonging to an admin:
  // no session means the cookie is ignored, and a non-admin session
  // means the cookie is ignored.
  //
  // Previously this branch ran whenever Auth.js returned nothing,
  // which is exactly the situation an attacker creates by simply not
  // signing in.
  const jar = await cookies();
  const uid = jar.get(COOKIE_NAME)?.value?.trim();
  if (!uid) return null;

  const viewer = await currentSessionUser();
  if (!viewer?.isAdmin) return null;

  return loadUserById(uid);
}

/**
 * The Auth.js session user, with no cookie fallback of any kind.
 * Used to decide whether view-as is permitted at all.
 */
async function currentSessionUser(): Promise<User | null> {
  try {
    const { auth } = await import("@/lib/auth");
    const session = await auth();
    const id = (session?.user as { id?: string } | undefined)?.id;
    if (!id) return null;
    return await loadUserById(id);
  } catch {
    return null;
  }
}

/**
 * Server-component helper. If the current session is a "view-as"
 * preview launched by an admin, returns that admin user. Otherwise null.
 */
export async function getOriginalAdminUser(): Promise<User | null> {
  const jar = await cookies();
  const realUid = jar.get(REAL_COOKIE_NAME)?.value?.trim();
  if (!realUid) return null;

  // Same rule as above: the cookie names who to show, it does not
  // prove who you are. The Auth.js session does that.
  const viewer = await currentSessionUser();
  if (!viewer?.isAdmin) return null;

  const user = await loadUserById(realUid);
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
