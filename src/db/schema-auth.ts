/**
 * ============================================================
 * PRODUCTION-TARGET SCAFFOLDING — Auth.js Drizzle schema stubs.
 *
 * NOT COMPILED IN THE SANDBOX. Drizzle isn't wired up yet — the
 * sandbox runs on in-memory MOCK_* stores. This file exists so that
 * when the production migration lands, the four Auth.js-required
 * tables are already documented and ready to translate into a real
 * Drizzle schema.
 *
 * The four tables are Auth.js's canonical shape:
 *   - users              — application user record
 *   - accounts           — external identity provider links
 *   - sessions           — active session cookies
 *   - verification_tokens — magic-link + email-verification tokens
 *
 * COOPERATIVE-DOMAIN FIELDS on `users`:
 * The cooperative extends Auth.js's minimum user schema with the
 * domain fields already documented in src/lib/types.ts User type.
 * Migration path: the mock-data User shape becomes the users table
 * with a rename of `id: string` → `id: uuid`, `email: string` →
 * `email: text UNIQUE NOT NULL`, everything else 1:1.
 * ============================================================
 */

// ── SWAP block — actual Drizzle definitions ──────────────────────────
// Uncomment when activating in production. Requires:
//   npm install drizzle-orm
//   npm install --save-dev drizzle-kit
//
// import {
//   boolean,
//   integer,
//   pgTable,
//   primaryKey,
//   text,
//   timestamp,
// } from "drizzle-orm/pg-core";
// import type { AdapterAccount } from "@auth/core/adapters";
//
// export const users = pgTable("users", {
//   id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
//
//   // Auth.js canonical fields
//   name: text("name"),
//   email: text("email").notNull().unique(),
//   emailVerified: timestamp("emailVerified", { mode: "date" }),
//   image: text("image"),
//
//   // Cooperative-domain extension (mirrors src/lib/types.ts User)
//   handle: text("handle").notNull().unique(),
//   firstName: text("firstName"),
//   lastName: text("lastName"),
//   profileImageUrl: text("profileImageUrl"),
//   membershipTier: text("membershipTier", {
//     enum: ["viewer", "prospect", "partner", "member"],
//   }).notNull().default("viewer"),
//   isAdmin: boolean("isAdmin").notNull().default(false),
//   profilePublic: boolean("profilePublic").notNull().default(true),
//   suspendedAt: timestamp("suspendedAt", { mode: "date" }),
//   suspensionReason: text("suspensionReason"),
//   discipline: text("discipline"),
//   bio: text("bio"),
//   primaryIndustry: text("primaryIndustry", {
//     enum: ["stem", "creative-media", "professional-services"],
//   }),
//   walletAddress: text("walletAddress"),
//   connectedWalletAddress: text("connectedWalletAddress"),
//   connectedWalletProvider: text("connectedWalletProvider"),
//   walletConnectedAt: timestamp("walletConnectedAt", { mode: "date" }),
//   stripeAccountId: text("stripeAccountId"),
//   buildTokenBalance: text("buildTokenBalance").notNull().default("0"),
//   dataParticipation: boolean("dataParticipation").notNull().default(false),
//   avatarPortraitUrl: text("avatarPortraitUrl"),
//   createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
//   updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
// });
//
// export const accounts = pgTable(
//   "accounts",
//   {
//     userId: text("userId")
//       .notNull()
//       .references(() => users.id, { onDelete: "cascade" }),
//     type: text("type").$type<AdapterAccount["type"]>().notNull(),
//     provider: text("provider").notNull(),
//     providerAccountId: text("providerAccountId").notNull(),
//     refresh_token: text("refresh_token"),
//     access_token: text("access_token"),
//     expires_at: integer("expires_at"),
//     token_type: text("token_type"),
//     scope: text("scope"),
//     id_token: text("id_token"),
//     session_state: text("session_state"),
//   },
//   (t) => ({
//     pk: primaryKey({ columns: [t.provider, t.providerAccountId] }),
//   }),
// );
//
// export const sessions = pgTable("sessions", {
//   sessionToken: text("sessionToken").primaryKey(),
//   userId: text("userId")
//     .notNull()
//     .references(() => users.id, { onDelete: "cascade" }),
//   expires: timestamp("expires", { mode: "date" }).notNull(),
// });
//
// export const verificationTokens = pgTable(
//   "verificationTokens",
//   {
//     identifier: text("identifier").notNull(),
//     token: text("token").notNull(),
//     expires: timestamp("expires", { mode: "date" }).notNull(),
//   },
//   (t) => ({
//     pk: primaryKey({ columns: [t.identifier, t.token] }),
//   }),
// );

// ── SANDBOX-COMPAT EXPORT ────────────────────────────────────────────
// Empty export so this file compiles cleanly in the sandbox (which
// doesn't install drizzle-orm). Real definitions above land at
// production activation.
export const _authSchemaTarget = "See production-swap-checklist §2.";
