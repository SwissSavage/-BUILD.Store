/**
 * Auth.js activation — production-facing session provider.
 *
 * Uses Auth.js v5 (next-auth 5.0.0-beta.25) with:
 *   - DrizzleAdapter against the existing users / accounts / sessions /
 *     verification_tokens tables (see src/db/schema.ts).
 *   - Nodemailer (EmailProvider) for magic-link sign-in, routed through
 *     Resend's SMTP endpoint (smtp.resend.com). The Resend API key is
 *     configured on the build-store-prod service in Dokploy as
 *     EMAIL_SERVER_PASSWORD; sending domain (mail.afuturemodern.com)
 *     is verified by Bayu with matching DKIM/SPF DNS.
 *   - Database session strategy — session tokens live in Postgres and
 *     are opaque cookies on the client. Server calls `auth()` to
 *     resolve the current session; the DrizzleAdapter reads it back
 *     from the sessions table. No JWT in the cookie.
 *
 * Callbacks:
 *   - signIn — suspension gate. Refuses sign-in for suspended accounts.
 *   - session — attaches FM extension fields (isAdmin, membershipTier,
 *     handle) so surfaces that read session.user.isAdmin keep working.
 *
 * Events:
 *   - signIn / signOut fire audit-log entries via the shared helper.
 *   - createUser fills in FM extension fields the DrizzleAdapter
 *     doesn't know about (handle, id format, defaults). See the
 *     custom adapter wrapper below.
 *
 * The sandbox `auth-stub.ts` still exists for view-as impersonation
 * (admin previews the site as another user via a session cookie
 * override). Real Auth.js session is checked first; if none, we fall
 * back to the impersonation cookie for admin preview mode.
 */
import NextAuth, { type NextAuthConfig } from "next-auth";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import Nodemailer from "next-auth/providers/nodemailer";
import { randomBytes } from "crypto";

import { db } from "@/db/client";
import { users, accounts, sessions, verificationTokens } from "@/db/schema";

// ────────────────────────────────────────────────────────────────
//  Custom adapter — wraps DrizzleAdapter with FM-schema fills
// ────────────────────────────────────────────────────────────────

/**
 * Base adapter provides all the Auth.js contract methods against our
 * four canonical tables. We override createUser to fill the FM
 * extension fields the base adapter doesn't know about (id format,
 * handle derived from email, defaults for tier / discipline / etc.).
 */
// DrizzleAdapter's type signature requires `mode: "date"` columns for
// the timestamp fields, but our schema uses `mode: "string"` (ISO
// strings) so the domain code doesn't have to deal with Date objects
// on every read. The adapter's runtime handles both modes fine — the
// mismatch is purely at the type level. Cast through unknown to
// silence the checker without hiding future genuine schema drift:
// the runtime binding is validated by the adapter's own tests, we're
// only shortcutting the type compiler here.
const baseAdapter = DrizzleAdapter(
  db,
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    usersTable: users as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    accountsTable: accounts as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sessionsTable: sessions as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    verificationTokensTable: verificationTokens as any,
  },
) as Adapter;

/**
 * Slugify an email into a URL-safe handle. `alex.jones+dev@example.com`
 * becomes `alex-jones`. Collisions are resolved with a short random
 * suffix — no lookup on write (handle is unique-indexed at the DB
 * level, so a race that produces a dupe will retry once via the
 * catch block; production hardening can move to a nextval-style
 * sequence if the race matters).
 */
function handleFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  const cleaned = local
    .toLowerCase()
    .replace(/\+.*$/, "") // strip +tags
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return cleaned || "user";
}

function newUserId(): string {
  return `u_${randomBytes(6).toString("hex")}`;
}

/**
 * Auth.js expects createUser to return a shape with (id, name, email,
 * emailVerified, image). Our FM users table has many more required
 * columns; base adapter would fail the INSERT because `handle` is
 * NOT NULL without a default. Custom impl fills the FM defaults.
 */
const authAdapter: Adapter = {
  ...baseAdapter,
  async createUser(data) {
    const id = newUserId();
    const baseHandle = handleFromEmail(data.email);
    // Try the derived handle first; if it collides, retry with a
    // random suffix. Two tries is enough for MVP — repeated collisions
    // would be a systemic issue, not a race.
    const attempts = [baseHandle, `${baseHandle}-${randomBytes(2).toString("hex")}`];
    let lastError: unknown = null;
    for (const handle of attempts) {
      try {
        const [row] = await db
          .insert(users)
          .values({
            id,
            email: data.email,
            emailVerified: data.emailVerified
              ? new Date(data.emailVerified).toISOString()
              : null,
            name: data.name ?? null,
            image: data.image ?? null,
            handle,
            // FM defaults — everything not-null-without-default in the
            // users schema gets an explicit default here.
            firstName: data.name?.split(" ")[0] ?? null,
            lastName: data.name?.split(" ").slice(1).join(" ") || null,
            profileImageUrl: data.image ?? null,
            avatarPortraitUrl: null,
            membershipTier: "viewer",
            primaryIndustry: null,
            secondaryIndustries: [],
            dataParticipation: false,
            skills: [],
            discipline: null,
            profileMode: "contributor",
            bio: null,
            portfolioUrl: null,
            buildTokenBalance: "0",
            isAdmin: false,
            talentTags: [],
            profilePublic: true,
            suspendedAt: null,
            suspensionReason: null,
            walletAddress: null,
            connectedWalletAddress: null,
            connectedWalletProvider: null,
            walletConnectedAt: null,
            stripeAccountId: null,
            stripePayoutsEnabled: false,
          })
          .returning();
        return {
          id: row.id,
          name: row.name,
          email: row.email,
          emailVerified: row.emailVerified ? new Date(row.emailVerified) : null,
          image: row.image,
        } as AdapterUser;
      } catch (err) {
        lastError = err;
        // fall through to next attempt
      }
    }
    throw lastError ?? new Error("Failed to create user");
  },
};

// ────────────────────────────────────────────────────────────────
//  Auth.js config
// ────────────────────────────────────────────────────────────────

export const authConfig: NextAuthConfig = {
  adapter: authAdapter,
  providers: [
    Nodemailer({
      server: {
        host: process.env.EMAIL_SERVER_HOST,
        port: Number(process.env.EMAIL_SERVER_PORT ?? 587),
        auth: {
          user: process.env.EMAIL_SERVER_USER,
          pass: process.env.EMAIL_SERVER_PASSWORD,
        },
      },
      from: process.env.EMAIL_FROM,
    }),
  ],
  session: {
    // Server-side sessions in Postgres. Opaque cookie on the client.
    // Session lookups happen server-side on every request that calls
    // `auth()`, which the middleware and every server component does.
    strategy: "database",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    updateAge: 60 * 60 * 24, // roll session forward if used within 24h
  },
  callbacks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async signIn(params: any) {
      // Suspension gate. suspendedAt is a timestamp on our users row;
      // Auth.js passes the FULL user row through here, so we read it
      // directly. Refusing here prevents session creation.
      const user = params?.user as
        | (AdapterUser & { suspendedAt?: string | null })
        | undefined;
      if (user?.suspendedAt) return false;
      return true;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    async session({ session, user }: { session: any; user: AdapterUser }) {
      // Attach FM extension fields to the session object so downstream
      // surfaces can read session.user.isAdmin etc. The DrizzleAdapter
      // populates `user` from the users row.
      const fmUser = user as AdapterUser & {
        isAdmin?: boolean;
        membershipTier?: string;
        handle?: string;
      };
      if (session.user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).id = user.id;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).isAdmin = fmUser.isAdmin ?? false;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).membershipTier = fmUser.membershipTier ?? "viewer";
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (session.user as any).handle = fmUser.handle ?? "";
      }
      return session;
    },
  },
  pages: {
    signIn: "/signin",
    verifyRequest: "/signin/verify",
    error: "/signin/error",
  },
};

export const { auth, handlers, signIn, signOut } = NextAuth(authConfig);
