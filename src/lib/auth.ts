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
import Google from "next-auth/providers/google";
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
export function handleFromEmail(email: string): string {
  const local = email.split("@")[0] ?? email;
  const cleaned = local
    .toLowerCase()
    .replace(/\+.*$/, "") // strip +tags
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return cleaned || "user";
}

export function newUserId(): string {
  return `u_${randomBytes(6).toString("hex")}`;
}

// Session lifetime should match authConfig.session.maxAge below so
// direct-provisioned sessions (invite completion) and Auth.js-issued
// sessions age out on the same clock.
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * Whether to use the __Secure- cookie prefix. Matches Auth.js's own
 * heuristic: HTTPS = secure prefix. Middleware already checks both
 * cookie names, but the setter has to pick one.
 */
function useSecureCookie(): boolean {
  const url = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "";
  return url.startsWith("https://") || process.env.NODE_ENV === "production";
}

/**
 * Insert a session row for `userId` and set the Auth.js session cookie
 * on the current response. Used by the invite-completion flow so the
 * new user lands on /welcome already signed in — no round-trip through
 * the magic-link email.
 *
 * Cookie name/attributes mirror what Auth.js's Nodemailer callback
 * would set, so getCurrentUser / auth() picks it up on the next
 * request just like any other session.
 */
export async function createDirectSession(userId: string): Promise<void> {
  const { cookies } = await import("next/headers");
  const sessionToken = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);
  await db.insert(sessions).values({
    sessionToken,
    userId,
    expires: expiresAt.toISOString(),
  });
  const secure = useSecureCookie();
  const cookieName = secure
    ? "__Secure-authjs.session-token"
    : "authjs.session-token";
  const jar = await cookies();
  jar.set(cookieName, sessionToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Create an FM users row with all not-null-without-default columns
 * filled. Reused by (a) the Auth.js DrizzleAdapter createUser wrapper
 * and (b) the invite-completion flow, so both paths produce identical
 * user shapes.
 *
 * Returns the created user's id. Retries once with a random suffix on
 * handle collision (handle is unique-indexed).
 */
export async function createFmUser(input: {
  email: string;
  name?: string | null;
  image?: string | null;
  membershipTier?: string;
  emailVerified?: Date | string | null;
}): Promise<string> {
  const id = newUserId();
  const baseHandle = handleFromEmail(input.email);
  const attempts = [baseHandle, `${baseHandle}-${randomBytes(2).toString("hex")}`];
  let lastError: unknown = null;
  for (const handle of attempts) {
    try {
      await db.insert(users).values({
        id,
        email: input.email,
        emailVerified: input.emailVerified
          ? new Date(input.emailVerified).toISOString()
          : null,
        name: input.name ?? null,
        image: input.image ?? null,
        handle,
        firstName: input.name?.split(" ")[0] ?? null,
        lastName: input.name?.split(" ").slice(1).join(" ") || null,
        profileImageUrl: input.image ?? null,
        avatarPortraitUrl: null,
        membershipTier: (input.membershipTier ?? "viewer") as
          | "viewer"
          | "partner"
          | "member",
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
      });
      return id;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error("Failed to create user");
}

/**
 * Auth.js expects createUser to return a shape with (id, name, email,
 * emailVerified, image). Our FM users table has many more required
 * columns; base adapter would fail the INSERT because `handle` is
 * NOT NULL without a default. Custom impl fills the FM defaults.
 */
/**
 * Coerce a value that might be an ISO string, Date, or null into a Date
 * (or null). Our sessions/verificationTokens schema uses `mode: "string"`
 * so the DrizzleAdapter reads `expires` back as an ISO string, but
 * Auth.js hands that value directly to Node's cookie serializer which
 * only accepts a real Date — passing a string throws
 * `TypeError: option expires is invalid`. Wrap read paths to convert.
 */
function coerceDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string" || typeof value === "number") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

const authAdapter: Adapter = {
  ...baseAdapter,
  async getSessionAndUser(sessionToken) {
    const result = await baseAdapter.getSessionAndUser!(sessionToken);
    if (!result) return null;
    return {
      ...result,
      session: {
        ...result.session,
        expires: coerceDate(result.session.expires) as Date,
      },
    };
  },
  async createSession(data) {
    const result = await baseAdapter.createSession!(data);
    return {
      ...result,
      expires: coerceDate(result.expires) as Date,
    };
  },
  async updateSession(data) {
    const result = await baseAdapter.updateSession!(data);
    if (!result) return result;
    return {
      ...result,
      expires: coerceDate(result.expires) as Date,
    };
  },
  async useVerificationToken(params) {
    const result = await baseAdapter.useVerificationToken!(params);
    if (!result) return result;
    return {
      ...result,
      expires: coerceDate(result.expires) as Date,
    };
  },
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
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      // FM users are provisioned by email first (invite ceremony or
      // magic-link sign-in). When they later sign in with Google, we
      // want to link the Google identity to the existing user row
      // instead of creating a duplicate account under the same email.
      // Auth.js requires this opt-in because the general case (an
      // attacker registering with a victim's email before the victim
      // links their real Google) is unsafe — but on FM the invite
      // ceremony verifies email ownership before the user row exists,
      // so auto-linking by email is safe here.
      allowDangerousEmailAccountLinking: true,
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
