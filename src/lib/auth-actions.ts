"use server";

/**
 * Server actions for the auth stub. Split from auth-stub.ts because
 * Next.js requires "use server" files to export only async functions.
 *
 * REPLACE WITH: real auth provider sign-in / sign-out / sign-up.
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { REAL_SESSION_COOKIE, SESSION_COOKIE } from "@/lib/auth-stub";
import { signOut as authJsSignOut } from "@/lib/auth";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";

const SESSION_MAX_AGE = 60 * 60 * 24 * 7;

function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    // Intentionally short lifespan for the sandbox.
    maxAge: SESSION_MAX_AGE,
  };
}

export async function signIn(formData: FormData) {
  const uid = String(formData.get("uid") ?? "");
  const user = MOCK_USERS.find((u) => u.id === uid);
  if (!user) {
    // Log the failed attempt without leaking the (nonexistent) uid.
    await logAuditEvent({
      actorUserId: null,
      actorRoleSnapshot: "system",
      action: "user.failed_signin",
      resourceKind: "user",
      resourceId: uid.slice(0, 40) || "<empty>",
      before: null,
      after: null,
      reason: "Unknown user id supplied",
    });
    throw new Error("Unknown user id");
  }
  const jar = await cookies();
  jar.set(SESSION_COOKIE, uid, sessionCookieOptions());
  // Signing in as a real user clears any stale view-as breadcrumb.
  jar.delete(REAL_SESSION_COOKIE);

  await logAuditEvent({
    actorUserId: user.id,
    actorRoleSnapshot: snapshotActorRole(user),
    action: "user.signed_in",
    resourceKind: "user",
    resourceId: user.id,
  });

  redirect("/dashboard");
}

export async function signOut() {
  const jar = await cookies();
  const uid = jar.get(SESSION_COOKIE)?.value;
  const user = uid ? MOCK_USERS.find((u) => u.id === uid) : null;

  // Clear the sandbox cookies (bs_uid + bs_uid_real) — these are
  // ours and Auth.js doesn't touch them.
  jar.delete(SESSION_COOKIE);
  jar.delete(REAL_SESSION_COOKIE);

  // Root-cause fix (diagnosed 2026-08-27): session strategy is
  // "database" in auth.ts. Cookie-only clears are meaningless —
  // deleting the browser cookie doesn't invalidate the row in the
  // Postgres `sessions` table, so the next request re-establishes
  // the session from that row. Auth.js's own signOut() deletes
  // both the DB row AND the cookie atomically.
  //
  // We pass redirect: false so Auth.js doesn't throw its own
  // NEXT_REDIRECT (which conflicted with our outer redirect in the
  // failed earlier hotfix). We then do our own redirect + audit-log
  // in one clean flow.
  //
  // Cookie-sweep constants + comment history intentionally removed:
  // they can't fix a database-session bug. Kept the audit-log +
  // sandbox-cookie-clear which are still correct.
  try {
    await authJsSignOut({ redirect: false });
  } catch (err) {
    // Don't let a signOut() failure trap the user in a signed-in
    // state. Log and continue to the redirect so at minimum the
    // sandbox cookies are gone and the user lands on public.
    // eslint-disable-next-line no-console
    console.error("[auth] authJsSignOut failed", err);
  }

  if (user) {
    await logAuditEvent({
      actorUserId: user.id,
      actorRoleSnapshot: snapshotActorRole(user),
      action: "user.signed_out",
      resourceKind: "user",
      resourceId: user.id,
    });
  }

  redirect("/");
}

/**
 * Admin-only: preview the site as another user (or signed-out viewer).
 * Stores the admin's real id in `bs_uid_real` so the "Return to your
 * admin account" affordance can flip back. If the caller isn't admin,
 * the action no-ops to avoid privilege escalation by hand-crafted POST.
 */
export async function viewAsUser(formData: FormData) {
  const target = String(formData.get("target") ?? "");
  const jar = await cookies();
  const currentUid = jar.get(SESSION_COOKIE)?.value;
  const realUid = jar.get(REAL_SESSION_COOKIE)?.value;

  // The admin we're acting on behalf of is whichever id was admin first:
  // either the breadcrumb (already in a view-as session) or the current
  // session if we're starting a view-as fresh.
  const adminUid = realUid ?? currentUid ?? "";
  const admin = MOCK_USERS.find((u) => u.id === adminUid);
  if (!admin || !admin.isAdmin) {
    // No-op: only admins can use this.
    redirect("/");
  }

  // Set / clear the breadcrumb on the first hop only.
  if (!realUid) {
    jar.set(REAL_SESSION_COOKIE, adminUid, sessionCookieOptions());
  }

  if (target === "viewer") {
    // Preview as signed-out: drop the active session cookie but keep the
    // breadcrumb so the "Return to your admin account" banner still
    // shows on public pages.
    jar.delete(SESSION_COOKIE);
  } else {
    if (!MOCK_USERS.some((u) => u.id === target)) {
      throw new Error("Unknown view-as target");
    }
    jar.set(SESSION_COOKIE, target, sessionCookieOptions());
  }

  revalidatePath("/", "layout");
  redirect("/");
}

/**
 * Restore the admin's real session after a view-as preview. Reads the
 * admin id from `bs_uid_real`, writes it back to `bs_uid`, and clears
 * the breadcrumb.
 */
export async function returnToOriginalUser() {
  const jar = await cookies();
  const realUid = jar.get(REAL_SESSION_COOKIE)?.value;
  if (realUid && MOCK_USERS.some((u) => u.id === realUid)) {
    jar.set(SESSION_COOKIE, realUid, sessionCookieOptions());
  }
  jar.delete(REAL_SESSION_COOKIE);
  revalidatePath("/", "layout");
  redirect("/admin");
}
