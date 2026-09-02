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
 * Match the (app) route group — every authenticated surface lives
 * under one of these paths. Public marketing pages under (public)
 * and the invite/[code] ceremony are NOT matched here.
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
    // /contracts and /contracts/[id] are PUBLIC (SEO surface — Google
    // Jobs indexes them). Member-only contract sub-routes stay gated
    // individually rather than blanket-gating /contracts/:path*.
    "/contracts/new",
    "/contracts/:id/feedback",
    "/contracts/:id/quote",
    "/contracts/:id/tracker",
    "/quotes/:path*",
    "/locker/:path*",
    "/receipts/:path*",
  ],
};
