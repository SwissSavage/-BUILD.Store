# $BUILD.Store — unified sandbox

This is a clickable prototype of the unified $BUILD.Store platform. It is **not production**. Everything that talks to a database, an auth provider, or a blockchain is **stubbed**. The point of this build is to give Jamar (and the rest of Future Modern) a hands-on, dark-themed, branded version of the app to click through, critique, and hand to a developer once one is in the room.

## What it is

One Next.js 15 (App Router) codebase that contains:

- The **public marketing surface** — landing, signup, showcase
- The **member surface** — dashboard, profile, projects/RFPs, wallet, membership tiers
- The **admin surface** — member management, application review, project oversight, $BUILD distribution

All three surfaces live in one repo and one design system. No silos.

## What it is not

- It does **not** persist anything to disk. All state is in-memory; restart the dev server and it resets.
- It does **not** have real authentication. Sign-in is a "pick a user from a list" stub.
- It does **not** make any chain calls. The wallet shows a synthetic balance + ledger.
- It does **not** post to HubSpot. Signup logs the payload to the server console.

## Decisions baked in (locked 2026-04-20)

- **One codebase.** Next.js App Router for both public and member surfaces.
- **Vendor-agnostic.** Zero Replit code. Auth/DB/host all swappable.
- **Industry pillars:** STEM / Creative Media / Professional Services. (Legacy `Entertainment / Technology / Business` strings are not used.)
- **Brand palette codified** in `tailwind.config.ts` from `Future Modern/brand/palette.json`. No ad-hoc hex literals in JSX.
- **Dark only.** Light mode was retired 2026-04-27 — Future Modern trends black and the toggle wasn't earning its weight.
- **v1 = core functionality only.** E-commerce / events / POS / advanced governance are post-v1.
- **Code posture:** clean, conventional, handoff-ready. A new dev should be able to open this repo and revise without archaeology.

## Run it

```bash
cd "Future Modern/build-store-unified"
npm install
npm run dev
```

Then open http://localhost:3000 in a browser.

To explore the member surface, click **Sign in** in the top nav and pick a user. Pick **Jamar** to also see the admin surface.

## File map

```
build-store-unified/
├── src/
│   ├── app/                       ← Next.js App Router pages
│   │   ├── page.tsx               ← public landing
│   │   ├── layout.tsx             ← root layout, dark default, nav + footer
│   │   ├── globals.css            ← Tailwind + theme tokens
│   │   ├── signin/                ← stub sign-in (pick a user)
│   │   ├── (public)/signup/       ← signup form + thanks page
│   │   ├── dashboard/             ← member home
│   │   ├── profile/               ← edit profile
│   │   ├── projects/              ← browse RFPs
│   │   │   └── new/               ← submit RFP
│   │   ├── wallet/                ← balance + tx history
│   │   ├── showcase/              ← featured portfolio
│   │   ├── membership/            ← tier progression + apply
│   │   └── admin/                 ← admin home
│   │       ├── members/           ← member list, role/tier toggles
│   │       ├── applications/      ← review pending tier promotions
│   │       ├── projects/          ← all projects, status transitions
│   │       └── tokens/            ← $BUILD distribution console
│   ├── components/                ← reusable UI (Nav, Footer, Card, etc.)
│   └── lib/
│       ├── types.ts               ← canonical domain types (mirrors Drizzle schema)
│       ├── cn.ts                  ← Tailwind class merger
│       ├── auth-stub.ts           ← STUB — replace with real auth provider
│       ├── auth-actions.ts        ← stub server actions for sign-in/out
│       ├── wallet-stub.ts         ← STUB — replace with viem/wagmi + Safe SDK
│       ├── crm-stub.ts            ← STUB — replace with real HubSpot calls
│       └── mock-data/             ← schema-shaped seed JSON
│           ├── users.ts
│           ├── projects.ts
│           ├── portfolio.ts
│           ├── applications.ts
│           ├── tokens.ts
│           └── partners.ts
├── tailwind.config.ts             ← Future Modern palette + dark-mode strategy
├── tsconfig.json
├── next.config.mjs
├── package.json
└── README.md (you are here)
```

## How to take this to production (the hand-off)

A future developer should make the following swaps. Each lives behind a clear stub boundary:

### 1. Auth (currently `lib/auth-stub.ts` + `lib/auth-actions.ts`)

Pick one:

- **Clerk** — most batteries-included; drop-in components; least code.
- **Auth.js (NextAuth)** — open-source; lives in the repo; most vendor-agnostic.
- **WorkOS** — enterprise SSO/SCIM; only if Fortune-500 client SSO is on the v1 critical path.

Replace `getCurrentUser()` and `requireAdmin()` with the chosen provider's session reader. The rest of the app calls these two functions and nothing else, so the swap is local.

### 2. Database (currently `lib/mock-data/*.ts`)

The Drizzle schema in `Future Modern/buildstore-backend-Replit-replit-agent/shared/schema.ts` is the canonical model. The mock data files in this sandbox are shaped to match it. Steps to migrate:

1. Stand up Postgres (Neon recommended; Supabase or self-hosted also fine).
2. Copy the Drizzle schema in.
3. Replace each `MOCK_*` import with a Drizzle query against the corresponding table.
4. Replace the in-memory `.push()` / mutation calls with `INSERT` / `UPDATE`.

### 3. Wallet (currently `lib/wallet-stub.ts`)

- **Read side:** swap `getBalance()` and `getTransactions()` for a viem/wagmi reader against the existing ERC-6551 token-bound accounts.
- **Write side:** swap `distributeBuild()` for a Safe SDK `proposeTransaction()` call. The function signature stays the same so the admin UI doesn't change.
- **Multisig migration:** the existing token-bound account scheme needs migration to a multisig arrangement; this is its own discrete piece of work.

### 4. CRM (currently `lib/crm-stub.ts`)

The legacy frontend at `Future Modern/build-store-frontend/src/app/api/crm/util.ts` already has the production HubSpot POST shape. Lift that over and set `HUBSPOT_ACCESS_TOKEN` in the deployment environment.

## Hand-off checklist

When a developer takes over, they should be able to:

- [ ] Run the app locally and click through every screen.
- [ ] Find every stub by grepping for `STUB` or `REPLACE WITH` in `src/lib/`.
- [ ] Map every page in the app to the corresponding Drizzle table without ambiguity.
- [ ] Pick an auth provider and replace `auth-stub.ts` / `auth-actions.ts` without touching any page.
- [ ] Pick a Postgres host and replace the mock data layer one table at a time.
- [ ] Wire the wallet stubs to chain reads and a multisig writer.
- [ ] Wire the CRM stub to HubSpot.

## v1 scope

Per Jamar 2026-04-20, v1 includes:

- Marketing + signup + member profile
- Project / RFP flow (browse + submit)
- Wallet + token tracking (read for members; admin-manual distribution)
- Admin surface (members, applications, projects, tokens)
- Full ERC-6551 + multisig wiring (real wallet integration is post-sandbox)

Post-v1 backlog (do **not** bleed into v1):

- E-commerce
- Events
- POS integration
- Advanced governance flows beyond admin approval
- Secondary token for community contributions
- Domino's-tracker style client portal

## Brand notes

- Future Modern palette only. No copper/electric blue, no maroon/gold (those are different things).
- No em-dashes in product copy. (This README is internal; em-dashes are fine here, hyphens used for compatibility.)
- Open-ended closes, not hard asks.
- No explicit "$BUILD" name-drop on first marketing touch.

## Provenance

This sandbox replaces two earlier codebases that are now **raw material, not production targets**:

- `Future Modern/build-store-frontend/` — the public Vercel marketing site (visual reference for this sandbox).
- `Future Modern/buildstore-backend-Replit-replit-agent/` — the stalled Replit member app written by Brian Okoro / theKidConnect (schema + API reference for this sandbox).

Going forward, all $BUILD.Store work happens here.
