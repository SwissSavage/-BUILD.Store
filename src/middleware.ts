/**
 * Next.js middleware — session gate for authenticated app routes.
 *
 * Runs on every request that matches the `config.matcher` pattern
 * below. Redirects unauthenticated requests to /signin?next=<path>
 * so the target page reappears after sign-in.
 *
 * Runtime: intentionally edge-safe. We only check for the Auth.js
 * session cookie presence — no DB call, no NextAuth() invocation
 * (both of those would force Node runtime and slow middleware down).
 * Cookie presence is a soft gate; the real session validation happens
 * server-side via `auth()` in page components.
 *
 * Also gates the sandbox impersonation cookie (`bs_uid`), so admins
 * doing view-as previews stay in.
 */
import { NextResponse, type NextRequest } from "next/server";

// Auth.js v5 cookie names — production uses the __Secure- prefix on
// HTTPS deployments, development uses the bare name.
const SESSION_COOKIES = [
  "authjs.session-token",
  "__Secure-authjs.session-token",
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
];

export function middleware(req: NextRequest) {
  const jar = req.cookies;
  // Non-empty check — expired cookies can still have a truthy .has()
  // reading while the value has been cleared to "". Sign-out sets the
  // session-token to "" with an expiration in the past; browsers may
  // send that empty-value cookie on the very next request before
  // dropping it. Treat empty as "no session" so those requests
  // redirect to /signin instead of the app.
  const cookieValue = (name: string) => (jar.get(name)?.value ?? "").trim();
  // ─────────────────────────────────────────────────────────────
  // SECURITY FIX (2026-09-02)
  //
  // bs_uid used to count as a session here. It is unsigned and
  // browser-settable, so anyone could set it to a known user id and
  // this gate would wave them through to /admin/*. getCurrentUser then
  // resolved that id against MOCK_USERS, which contains an account
  // with isAdmin: true.
  //
  // One cookie, no credentials, full admin. Both halves are now
  // closed: the cookie no longer establishes identity in auth-stub,
  // and it no longer counts as a session here.
  //
  // It remains a view-as lens, which only applies on top of a real
  // Auth.js session belonging to an admin. Someone holding only this
  // cookie has no session and belongs at /signin.
  // ─────────────────────────────────────────────────────────────
  const hasSession = SESSION_COOKIES.some(
    (name) => cookieValue(name).length > 0,
  );

  if (hasSession) return NextResponse.next();

  // Not signed in. Redirect to /signin with a return path.
  const target = req.nextUrl.pathname + req.nextUrl.search;
  const signInUrl = new URL("/signin", req.url);
  signInUrl.searchParams.set("next", target);
  return NextResponse.redirect(signInUrl);
}

/**
 * Paths that require a session.
 *
 * ─────────────────────────────────────────────────────────────
 * THE MAGIC-LINK PATHS CAME OUT (2026-10-24)
 *
 * This list used to include /contracts/:id/feedback,
 * /contracts/:id/tracker, /quotes/:path* and /receipts/:path*. All four
 * are surfaces for clients, who have never had a $BUILD.Store login and
 * are not going to get one. The feedback page says exactly that in its
 * own first paragraph.
 *
 * So every client quote, tracker link, receipt and questionnaire ever
 * sent redirected the recipient to /signin. Confirmed on 2026-10-24 by
 * opening a real client quote link in a private window.
 *
 * It stayed invisible because the matcher matches a URL PATH, not a
 * route group, and nobody testing it was ever signed out. An admin
 * opening their own client's link sees it work, every time.
 *
 * The same path-versus-group confusion is why it was inconsistent in
 * both directions: (public)/quotes/[token] was gated, while
 * (app)/invoices/[token] — which is not in this list — was not. Two
 * surfaces with identical posture, opposite outcomes.
 *
 * WHY REMOVING THE GATE IS SAFE
 *
 * On all four, the token IS the credential and each page already
 * enforces it on its own:
 *
 *   /quotes/[token]          looked up on cooperative_quotes.client_token,
 *                            notFound otherwise. The ?draft=1 preview
 *                            additionally requires an admin.
 *   /receipts/[token]        looked up on cooperative_receipts.client_token.
 *   /contracts/:id/feedback  resolveFeedbackToken: exists, unspent,
 *                            unrevoked, unexpired, right contract.
 *   /contracts/:id/tracker   resolveTrackerToken, as of
 *                            drizzle/0039_project_tracker_tokens.sql.
 *
 * That last one is why this change could not land on its own. Until
 * 2026-10-24 the tracker gated on a map written into the page file
 * containing `demo: "*"`, which authorized every project id. Dropping
 * the session gate before replacing that map would have turned a leak
 * between signed-in members into a public one.
 *
 * /contracts and /contracts/[id] stay public: Google Jobs indexes them.
 * /contracts/new and /contracts/:id/quote stay gated, because those are
 * member surfaces, not client ones.
 * ─────────────────────────────────────────────────────────────
 */
export const config = {
  matcher: [
    "/admin/:path*",
    "/dashboard/:path*",
    "/profile/:path*",
    "/notifications/:path*",
    "/calendar/:path*",
    "/activity/:path*",
    "/team/:path*",
    "/wallet/:path*",
    "/projects/:path*",
    "/contracts/new",
    "/contracts/:id/quote",
    "/locker/:path*",
  ],
};
