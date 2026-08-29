/**
 * Live user readers — Postgres only.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS EXISTS (2026-08-28)
 *
 * Every surface in the app imported MOCK_USERS directly — a hardcoded
 * array of 13 seed profiles. Real members who signed up through the
 * Auth.js magic-link flow landed in the Postgres `users` table and
 * were then INVISIBLE everywhere: admin console, team page, profiles,
 * access review. Jamar caught it four days before beta after watching
 * several people complete signup and finding no trace of them.
 *
 * The seed rows were written into Postgres by src/db/seed.ts back in
 * July, so reading the live table returns BOTH the demo profiles
 * (which we want to keep for display) and every real signup. No
 * filtering needed — the database is already the union.
 *
 * There is deliberately NO seed fallback. Substituting fixtures when
 * the database is unreachable is precisely the behavior that hid every
 * real member for weeks. These throw instead; pages wrap in safely()
 * and render an honest empty state.
 * ─────────────────────────────────────────────────────────────
 *
 * IMPORTANT: pages using these readers must opt out of static
 * rendering, or Next.js will bake the result at build time and new
 * signups will never appear no matter how correct this file is.
 * Export `dynamic = "force-dynamic"` on any page that calls these.
 */
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users as usersTable } from "@/db/schema";
import type { User } from "@/lib/types";

export type ReadSource = "postgres" | "seed-fallback";

export interface UserRead {
  users: User[];
  source: ReadSource;
}

/**
 * Every user, newest first. This is the reader admin surfaces and
 * public people-listing pages should use.
 */
export async function getAllUsers(): Promise<UserRead> {
  try {
    const rows = await db
      .select()
      .from(usersTable)
      .orderBy(desc(usersTable.createdAt));

    // A reachable-but-empty table is still a legitimate answer (fresh
    // environment, seed never run). Don't silently swap in seed data —
    // that would hide a real misconfiguration behind fake members.
    return { users: rows as unknown as User[], source: "postgres" };
  } catch (err) {
    // No seed fallback. Substituting fixtures for real member data is
    // the exact failure this refactor exists to kill — a page that
    // can't reach Postgres should say so, not invent members.
    throw err;
  }
}

/** One user by id. Null when absent or unreachable. */
export async function getUserById(id: string): Promise<User | null> {
  try {
    const [row] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);
    return (row as unknown as User) ?? null;
  } catch {
    return null;
  }
}

/** One user by public handle. Powers /u/[handle]. */
export async function getUserByHandle(handle: string): Promise<User | null> {
  const normalized = handle.trim().toLowerCase();
  try {
    const [row] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.handle, normalized))
      .limit(1);
    return (row as unknown as User) ?? null;
  } catch {
    return null;
  }
}

/**
 * Users filtered to those who should appear on public surfaces.
 *
 * Public listing pages (team, showcase, cohort) shouldn't render
 * suspended accounts or anyone who hasn't finished enough of their
 * profile to look like a real person. Keeping that rule in one place
 * means a suspension takes effect everywhere at once.
 */
export async function getPublicUsers(): Promise<UserRead> {
  const { users, source } = await getAllUsers();
  return {
    users: users.filter((u) => {
      const suspended = (u as User & { suspendedAt?: string | null })
        .suspendedAt;
      if (suspended) return false;
      // Needs at least a display name to be worth rendering publicly.
      return Boolean(u.firstName || u.handle);
    }),
    source,
  };
}

/** Admins only. Powers /admin/access-review. */
export async function getAdminUsers(): Promise<UserRead> {
  const { users, source } = await getAllUsers();
  return { users: users.filter((u) => u.isAdmin), source };
}
