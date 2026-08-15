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
const IMPERSONATION_COOKIE = "bs_uid";

export function middleware(req: NextRequest) {
  const jar = req.cookies;
  const hasSession =
    SESSION_COOKIES.some((name) => jar.has(name)) ||
    jar.has(IMPERSONATION_COOKIE);

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
    "/contracts/:path*",
    "/quotes/:path*",
    "/locker/:path*",
    "/receipts/:path*",
  ],
};
