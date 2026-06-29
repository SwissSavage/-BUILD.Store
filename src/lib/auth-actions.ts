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
import { MOCK_USERS } from "@/lib/mock-data/users";

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
  if (!MOCK_USERS.some((u) => u.id === uid)) {
    throw new Error("Unknown user id");
  }
  const jar = await cookies();
  jar.set(SESSION_COOKIE, uid, sessionCookieOptions());
  // Signing in as a real user clears any stale view-as breadcrumb.
  jar.delete(REAL_SESSION_COOKIE);
  redirect("/dashboard");
}

export async function signOut() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete(REAL_SESSION_COOKIE);
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
