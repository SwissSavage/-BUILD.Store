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
import { MOCK_USERS } from "@/lib/mock-data/users";
import { db } from "@/db/client";
import { users as usersTable } from "@/db/schema";
import type { User } from "@/lib/types";

const COOKIE_NAME = "bs_uid";
const REAL_COOKIE_NAME = "bs_uid_real";

/**
 * Load a user by id from the DB. Falls back to MOCK_USERS if the DB
 * row isn't present (covers the case where seed data wasn't loaded
 * into Postgres yet, or a mock-only user id from the sandbox
 * dropdown). Cast the DB row shape into the domain User interface.
 */
async function loadUserById(id: string): Promise<User | null> {
  try {
    const [row] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (row) {
      // The DB row shape maps 1:1 to the User interface per schema
      // design. Cast is safe as long as schema.ts and types.ts stay
      // aligned.
      return row as unknown as User;
    }
  } catch {
    // DB unreachable / not seeded — fall through to mock lookup.
  }
  return MOCK_USERS.find((u) => u.id === id) ?? null;
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

  // Sandbox impersonation / view-as cookie.
  const jar = await cookies();
  const uid = jar.get(COOKIE_NAME)?.value;
  if (!uid) return null;
  return loadUserById(uid);
}

/**
 * Server-component helper. If the current session is a "view-as"
 * preview launched by an admin, returns that admin user. Otherwise null.
 */
export async function getOriginalAdminUser(): Promise<User | null> {
  const jar = await cookies();
  const realUid = jar.get(REAL_COOKIE_NAME)?.value;
  if (!realUid) return null;
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
