/**
 * ============================================================
 * PRODUCTION-TARGET SCAFFOLDING — Auth.js configuration shell.
 *
 * NOT ACTIVATED IN THE SANDBOX. The sandbox continues to use
 * `src/lib/auth-stub.ts` for session resolution. This file exists as
 * a production-swap-ready target — everything a production engineer
 * (Tolgay primary, Billy backup per Jamar 2026-07-01) needs to
 * activate Auth.js is here, commented with SWAP markers.
 *
 * Auth provider decision: Auth.js (formerly NextAuth) locked
 * 2026-07-01. Rationale in memory/future-modern.md; long-form pros +
 * cons + comparison in the same session's chat transcript.
 *
 * WHY THIS SHAPE:
 *   - Sandbox surfaces call `getCurrentUser()` and `requireAdmin()`.
 *     Auth.js swap replaces the internals; the interface is identical.
 *   - Drizzle adapter targets the four Auth.js tables (users, accounts,
 *     sessions, verification_tokens). Schema stubs live in
 *     src/db/schema-auth.ts (also production-target only).
 *   - Providers at launch: email magic link (primary), Google + Apple
 *     (social). Passkeys added post-launch when the base is stable.
 *   - MFA for admins: TOTP via authenticator app enrollment on first
 *     admin session, enforced on every subsequent admin sign-in.
 *
 * ACTIVATION CHECKLIST (production-swap-checklist §2 has the full
 * ordered list; abbreviated here for orientation):
 *   1. Install: npm install next-auth@beta @auth/drizzle-adapter
 *   2. Populate the four Auth.js tables via a Drizzle migration.
 *   3. Fill the SWAP-marked blocks below with actual providers +
 *      adapter binding.
 *   4. Add `middleware.ts` at src/ root guarding admin routes.
 *   5. Replace src/lib/auth-stub.ts exports with re-exports from
 *      this file's `auth()` helper.
 *   6. Delete the mock cookie shim.
 *
 * SIDE-EFFECT DESIGN:
 *   - Sign-in / sign-out fire audit-log entries via callbacks below
 *     (SWAP block 2). Sandbox already fires equivalent entries in
 *     auth-actions.ts; production keeps that shape by routing
 *     Auth.js events through the same logAuditEvent helper.
 *   - Suspension check runs in the session callback so a suspended
 *     account can't resume via a previously-cached session cookie.
 * ============================================================
 */

// ── SWAP block 1 — Auth.js imports (production only) ─────────────────
// Uncomment when activating in production:
//
// import NextAuth from "next-auth";
// import { DrizzleAdapter } from "@auth/drizzle-adapter";
// import EmailProvider from "next-auth/providers/email";
// import GoogleProvider from "next-auth/providers/google";
// import AppleProvider from "next-auth/providers/apple";
// import { db } from "@/db"; // production Drizzle client
// import { users, accounts, sessions, verificationTokens } from "@/db/schema-auth";

// ── SWAP block 2 — config object ─────────────────────────────────────
// Uncomment + fill env vars in production:
//
// export const authConfig = {
//   adapter: DrizzleAdapter(db, {
//     usersTable: users,
//     accountsTable: accounts,
//     sessionsTable: sessions,
//     verificationTokensTable: verificationTokens,
//   }),
//   providers: [
//     EmailProvider({
//       server: {
//         host: process.env.EMAIL_SERVER_HOST!,
//         port: Number(process.env.EMAIL_SERVER_PORT!),
//         auth: {
//           user: process.env.EMAIL_SERVER_USER!,
//           pass: process.env.EMAIL_SERVER_PASSWORD!,
//         },
//       },
//       from: process.env.EMAIL_FROM!,
//     }),
//     GoogleProvider({
//       clientId: process.env.GOOGLE_CLIENT_ID!,
//       clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
//     }),
//     AppleProvider({
//       clientId: process.env.APPLE_CLIENT_ID!,
//       clientSecret: process.env.APPLE_CLIENT_SECRET!,
//     }),
//   ],
//   session: {
//     strategy: "database" as const,
//     maxAge: 60 * 60 * 24 * 7, // 7 days
//     updateAge: 60 * 60 * 24, // extend if active
//   },
//   callbacks: {
//     async signIn({ user }) {
//       // Suspension gate — refuses sign-in for suspended accounts.
//       // Loads fresh from db so a suspension applied mid-session
//       // takes effect on next sign-in attempt.
//       if (user?.suspendedAt) return false;
//       return true;
//     },
//     async session({ session, user }) {
//       // Attach cooperative-domain fields to the session so surfaces
//       // that already read `session.user.isAdmin` etc. keep working.
//       session.user.id = user.id;
//       session.user.isAdmin = user.isAdmin;
//       session.user.membershipTier = user.membershipTier;
//       session.user.handle = user.handle;
//       return session;
//     },
//   },
//   events: {
//     async signIn({ user }) {
//       // Route through the shared audit-log helper — mirrors what
//       // sandbox auth-actions.ts does today.
//       const { logAuditEvent, snapshotActorRole } =
//         await import("@/lib/mock-data/audit-log");
//       logAuditEvent({
//         actorUserId: user.id,
//         actorRoleSnapshot: snapshotActorRole(user),
//         action: "user.signed_in",
//         resourceKind: "user",
//         resourceId: user.id,
//       });
//     },
//     async signOut({ session }) {
//       // Similar.
//     },
//   },
//   pages: {
//     signIn: "/signin",
//     signOut: "/signout",
//     error: "/signin/error",
//     verifyRequest: "/signin/verify",
//   },
// };
//
// export const { auth, handlers, signIn, signOut } = NextAuth(authConfig);

// ── SANDBOX RE-EXPORT ────────────────────────────────────────────────
// While in sandbox, re-export from auth-stub so any code that starts
// importing from @/lib/auth (instead of @/lib/auth-stub) keeps working.
// At production activation, delete this block and uncomment the SWAP
// blocks above.
export {
  getCurrentUser as auth,
  requireAdmin,
  getOriginalAdminUser,
  SESSION_COOKIE,
  REAL_SESSION_COOKIE,
} from "@/lib/auth-stub";
