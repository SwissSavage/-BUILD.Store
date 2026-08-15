/**
 * Auth.js catch-all handler mount. Every Auth.js request routes
 * through this endpoint: sign-in initiation, magic-link callback,
 * sign-out, session ping, CSRF token, provider list, etc.
 *
 * runtime = "nodejs" is required — Auth.js's Nodemailer provider uses
 * `net`, `tls`, and `crypto` which are not available on the edge
 * runtime. If this ever flips to `"edge"` the sign-in flow breaks.
 */
import { handlers } from "@/lib/auth";

export const runtime = "nodejs";
export const { GET, POST } = handlers;
