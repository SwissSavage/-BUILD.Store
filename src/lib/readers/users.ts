/**
 * Live user readers — Postgres first, seed array as cold-start fallback.
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
 * The MOCK_USERS fallback only fires when Postgres is unreachable, so
 * a cold DB degrades to the seed view instead of throwing a 500 on
 * every page. Callers can check `readSource` when they want to warn.
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
import { MOCK_USERS } from "@/lib/mock-data/users";
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
  } catch {
    return { users: MOCK_USERS, source: "seed-fallback" };
  }
}

/** One user by id. Falls back to the seed array on DB failure. */
export async function getUserById(id: string): Promise<User | null> {
  try {
    const [row] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);
    if (row) return row as unknown as User;
    // Not in Postgres — could be a seed-only id referenced by mock
    // relational data that hasn't been swapped yet.
    return MOCK_USERS.find((u) => u.id === id) ?? null;
  } catch {
    return MOCK_USERS.find((u) => u.id === id) ?? null;
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
    if (row) return row as unknown as User;
    return (
      MOCK_USERS.find((u) => u.handle?.toLowerCase() === normalized) ?? null
    );
  } catch {
    return (
      MOCK_USERS.find((u) => u.handle?.toLowerCase() === normalized) ?? null
    );
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
