/**
 * /api/debug/session — diagnostic for the sign-out investigation.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS EXISTS
 *
 * Sign-out has survived four code fixes. Each one was a guess at the
 * mechanism because nobody had ground truth about what the SERVER
 * actually sees on a request after sign-out. This endpoint produces
 * that ground truth in one page load, so the fifth change can be
 * based on evidence instead of another theory.
 *
 * It answers four questions at once:
 *
 *   1. Which cookies is the browser actually sending? (names + whether
 *      the value is empty — never the value itself.)
 *   2. Does Auth.js resolve a session from them?
 *   3. Is there a live row in the Postgres `sessions` table?
 *   4. Is the container even running the code we think it is?
 *
 * Question 4 is first in practice. If the deployed build predates the
 * sign-out fix, questions 1-3 are noise and we've been debugging code
 * that was never running.
 * ─────────────────────────────────────────────────────────────
 *
 * SECURITY: admin-gated, and deliberately never returns cookie VALUES
 * or session tokens — only names, presence, and lengths. A leaked
 * session token in a debug response would be a worse bug than the one
 * we're chasing.
 *
 * REMOVE once sign-out is confirmed fixed. Tracked as task #68.
 */
import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { sessions, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-stub";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  let actingAdminId: string;
  try {
    const admin = await requireAdmin();
    actingAdminId = admin.id;
  } catch {
    return NextResponse.json({ error: "admin required" }, { status: 403 });
  }

  const jar = await cookies();
  const hdrs = await headers();

  // ── 1. What the browser sent ──────────────────────────────────
  // Names + emptiness only. Never values.
  const cookieReport = jar.getAll().map((c) => ({
    name: c.name,
    empty: (c.value ?? "").trim().length === 0,
    valueLength: (c.value ?? "").length,
  }));

  const sessionCookieNames = [
    "authjs.session-token",
    "__Secure-authjs.session-token",
    "next-auth.session-token",
    "__Secure-next-auth.session-token",
  ];
  const presentSessionCookies = cookieReport.filter((c) =>
    sessionCookieNames.includes(c.name),
  );

  // ── 2. Does Auth.js resolve a session? ────────────────────────
  let authJsSession: {
    resolved: boolean;
    userId: string | null;
    error: string | null;
  };
  try {
    const { auth } = await import("@/lib/auth");
    const session = await auth();
    authJsSession = {
      resolved: Boolean(session?.user),
      userId: (session?.user as { id?: string } | undefined)?.id ?? null,
      error: null,
    };
  } catch (err) {
    authJsSession = {
      resolved: false,
      userId: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // ── 3. Live rows in the sessions table ────────────────────────
  // The whole database-strategy thesis rests on this. If sign-out is
  // deleting the row correctly, this count drops. If it doesn't, the
  // row is what's re-establishing the session and the cookie work is
  // beside the point.
  let dbSessions: {
    countForActingAdmin: number | null;
    expiresAt: string[] | null;
    error: string | null;
  };
  try {
    const rows = await db
      .select({ expires: sessions.expires })
      .from(sessions)
      .where(eq(sessions.userId, actingAdminId));
    dbSessions = {
      countForActingAdmin: rows.length,
      expiresAt: rows.map((r) => String(r.expires)),
      error: null,
    };
  } catch (err) {
    dbSessions = {
      countForActingAdmin: null,
      expiresAt: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  // ── 4. Is this the build we think it is? ──────────────────────
  // BUILD_SHA is injected at image build time. If it's "unknown", the
  // Dockerfile hasn't been updated to pass it — see the companion
  // commit. If it's present but stale, the container never picked up
  // the newer image and that alone explains "nothing changed."
  const build = {
    sha: process.env.BUILD_SHA ?? "unknown",
    builtAt: process.env.BUILD_TIME ?? "unknown",
    nodeEnv: process.env.NODE_ENV ?? "unknown",
    authUrl: process.env.AUTH_URL ?? "(unset)",
    hostHeader: hdrs.get("host") ?? "(none)",
  };

  // ── Read the config the theory depends on ─────────────────────
  let sessionStrategy: string;
  try {
    const { authConfig } = await import("@/lib/auth");
    sessionStrategy = authConfig.session?.strategy ?? "(default: jwt)";
  } catch {
    sessionStrategy = "(could not read)";
  }

  return NextResponse.json(
    {
      readThisFirst:
        build.sha === "unknown"
          ? "BUILD_SHA is not set — cannot confirm which commit is running. That is the first thing to fix."
          : `Container is running commit ${build.sha}. Compare against your latest push before reading anything else.`,
      build,
      sessionStrategy,
      cookies: {
        all: cookieReport,
        authJsSessionCookies: presentSessionCookies,
        sandboxImpersonation: {
          bs_uid: cookieReport.find((c) => c.name === "bs_uid") ?? null,
          bs_uid_real:
            cookieReport.find((c) => c.name === "bs_uid_real") ?? null,
        },
      },
      authJsSession,
      dbSessions,
      interpretation: {
        ifDbSessionsNonZeroAfterSignOut:
          "The Postgres row survived sign-out. authJsSignOut() is not reaching deleteSession — check that the custom authAdapter in auth.ts passes deleteSession through to the base DrizzleAdapter.",
        ifCookiesEmptyButSessionResolves:
          "Session is being rebuilt from the DB row, not the cookie. Same conclusion as above.",
        ifBsUidPresent:
          "You are signed in through the SANDBOX cookie, not Auth.js. Sign-out must clear bs_uid — and if it is still here, the server action's cookie mutation is not reaching the browser at all.",
        ifBuildShaStale:
          "None of the above matters. The container is running old code. Force a service update in Dokploy.",
      },
      checkedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
