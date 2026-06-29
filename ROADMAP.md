# $BUILD.Store — Roadmap

Captures everything Jamar surfaced on 2026-04-21 after the sandbox came up,
organized by scope so we know which items fit the sandbox vs. which belong in
the production backend build. Nothing here is built yet unless noted.

Reading order: top → bottom. Items inside each phase are rough priority order.

---

## Phase 0 — Sandbox polish (today, ~hours)

These stay inside the mock-data sandbox. No real backend, no integrations.

| # | Item | Status |
|---|------|--------|
| 0.1 | Palette rebuilt from actual logo hex | **done** |
| 0.2 | Nav restructure: Jobs · Contracts · Projects | **done** |
| 0.3 | Lightmode gray-text legibility fix | **done** |
| 0.4 | Jobs data + page stub | **done** |
| 0.5 | Multi-pillar contributors (User gets primary + secondary) | **done** |
| 0.6 | Profile pictures on talent cards + editable in /profile | **done** |
| 0.7 | Portfolio surface on user profile page (public view) | **done** |
| 0.8 | Admin-layer portfolio editor — scrub personal branding | **done** |
| 0.9 | Quote sheet intake form — talent submits structured quote rows matching the URL Media template | **done** |
| 0.10 | Admin approval queue for incoming client RFPs *and* outgoing proposals — PII redaction, attribution lock-in | **done** |
| 0.11 | About Us section — purpose/vision/people-powered (rewritten 2026-04-25: drops the freelance-platform-as-client-source framing entirely; leads with Future Modern Brand Marketing strategy — purpose, vision, "Rare∞" tagline, "people-powered, exclusively"; the resumes speak for themselves) | **done** |
| 0.12 | Future Modern parent marketing site — "/about", "who we are, where we've been, where we're going", roadmap, updates, CTA | **done** (folded into 0.11 as the in-app `/about` surface; standalone parent site moves to Phase 3) |

**Size:** ~1–2 days of focused work if we stay in sandbox (mock data, no real emails).

---

## Phase 1 — Real backend foundation (weeks)

Swap out stubs for actual services. Once this lands, Phase 0 items stop being
"fake" and start persisting.

### 1.1 — Persistence + auth (pick-and-wire)
- Decide: Auth.js (open-source, self-host) vs. Clerk (managed, faster).
- Decide: Postgres host — Neon, Supabase, or Railway. Drizzle schema already sketched in the legacy `buildstore-backend-Replit-replit-agent`.
- Migrate mock-data shapes → Drizzle tables 1:1.

### 1.2 — RFP client-intake pipeline
Current ask: "standard quote output for RFPs routes to an email notification to clients, pulls them into the website where details can be viewed."

- Talent submits a structured quote on `/contracts/[id]/quote` (fields per service provider row in the URL Media doc: quote, timeline, work sample links with captions, strengths/weaknesses).
- Internal vetting queue (admin) — approve, edit, or reject before broadcast.
- On approve: transactional email to the client with a magic link into a read-only proposal view on $BUILD.Store. Client never sees contributor PII.
- Visual fidelity: the rendered proposal page mirrors the existing Google Doc table layout — graphics, hyperlinked work samples, images all preserved.

**Stack candidate:** Resend or Postmark for email, signed short-lived tokens for the magic link, Next.js route handler to render the proposal.

### 1.3 — HubSpot pipeline sync
- Two-way: contracts/jobs flow into HubSpot as deals; deal-stage changes in HubSpot reflect back on the contributor's dashboard.
- Transparency: contributors on a contract see the current stage (discovery → proposal sent → negotiation → closed-won/closed-lost) without seeing the client's PII.
- HubSpot has a native OAuth app + REST API. Webhook from HubSpot → our `/api/hooks/hubspot/stage`.

### 1.4 — PII redaction / circumvention prevention
- Admin view: original customer record + contributor-visible view, side by side.
- Admin toggles field redaction (email, phone, domain, sometimes company name on early-stage deals).
- Attribution ledger: immutable record of who introduced a client, who contributed to the proposal, who delivered — so compensation can be computed even after the fact.
- This is the bedrock for the neurodivergent-friendly fairness guarantee — nothing fair-pay requires the contributor to chase anyone.

### 1.5 — Payments: Mercury-routed default + AR/AP tracker (revised 2026-04-22)

> **Pivot:** the cooperative's margins don't justify absorbing Stripe's processing fees as the default rail. Money moves through Mercury (our bank); the platform tracks the AR/AP cycle so every party — admin, contributor, client — sees the same ledger. Stripe Connect stays in the codebase as an opt-in path for engagements where credit-card payment is the only option, with a transparent processor-fee markup baked into the invoice.

Why this shape:
- Stripe Connect transfers cost ~0.25% + $0.25/transfer; ACH Debit inbound runs 0.8% capped at $5 but still bites on small invoices; CC processing is 2.9% + $0.30. None of these survive contact with our 15% commission cleanly.
- Mercury already handles ACH and wires for both sides at no per-transaction cost. The only thing we lack today is a shared ledger so that contributors can see "invoice issued → received → my payout queued → my payout sent" without pinging an admin.
- A proper AR/AP layer also gives us forecasting and aging (DSO, outstanding receivables) which Stripe-as-default obscures.

Default flow (no CC):
1. Admin issues an invoice on the platform → status `issued`. Invoice carries Mercury ACH/wire instructions.
2. Client pays out-of-band (ACH/wire/check). Admin marks invoice `received` with the Mercury reference + date.
3. Settlement engine (Phase 1.6) splits the received revenue across pools.
4. Admin queues payouts; Mercury processes the underlying ACH; admin marks each split row `sent` with the Mercury transfer reference.

Opt-in CC flow (per invoice):
- Admin toggles "Accept credit card" on a specific invoice.
- The platform auto-adds a `Payment processing fee` line item that grosses up the invoice so the cooperative nets the original total. Calculator: `gross = (subtotal + 0.30) / (1 - 0.029)` in the US; `processingFee = gross - subtotal`. Same shape for any other processor we wire in later.
- Invoice routes through Stripe (Connect platform charges); the rest of the AR/AP flow is identical.
- The fee line is visible to the client, so the cause of the markup is not hidden.

What everyone sees:
- **Contract admins** — full AR/AP for every contract they're on.
- **Delivery contributors** — read-only AR/AP for contracts they're attributed to. Knowing whether the client has paid is what unblocks contributors planning their cashflow without them needing to ask.
- **Client (magic-link)** — their own outstanding balance + payment history when they open a magic-link invoice.

Stripe Connect role (revised):
- Moves from "default rail for everything" → "opt-in rail for CC-only invoices and the eventual Phase 2.1 marketplace checkout."
- Contributor onboarding stays a self-serve surface but gets repositioned: only required if they expect to be paid via the Stripe-routed CC path. ACH-via-Mercury contributors don't need it.

Security posture (unchanged where Stripe is in play):
- We never store raw bank credentials, account numbers, routing numbers, or card PANs.
- Stripe IDs (`acct_*`, `customer_*`) encrypted at rest with KMS-managed keys; webhook signatures verified; audit log on every read.
- 2FA + IP allowlist on the admin surface that touches payouts.
- Mercury reference numbers are not credentials — they're transaction IDs the bank surfaces — but we still treat them as sensitive operations data and gate them behind admin auth.

### 1.6 — Revenue split engine
Ask: 85% → talent / member / partner. 15% → Future Modern. Of the 15%, 20% auto-allocated; admins decide the remaining 80% (of the 15) case-by-case.

Implementation:
- `revenue_splits` table: `contract_id`, `recipient_id`, `share_pct`, `auto` (bool), `decided_by`, `decided_at`.
- On contract close: engine computes an 85% contributor pool and a 15% house pool.
- House pool auto-writes a single row for the 20%-of-15% reserve (default destination: Future Modern operations wallet).
- Admins use a drag-slider UI to allocate the remaining 80%-of-15% across house-side recipients (ops, R&D, a specific initiative, etc.).
- Engine validates shares sum to 100% of each pool before allowing payout.
- Payout executes via Stripe Connect transfers, one per recipient; failure isolation per recipient.

---

## Phase 2 — New product surfaces (weeks → month)

### 2.1 — Store / marketplace
- Vetted contributors list physical goods, SaaS, energy products, creative services, clothing. **(sandbox done)**
- Category subdomains: `goods.build.store`, `saas.build.store`, `energy.build.store`, `creative.build.store`, `clothing.build.store`. Sandbox uses query params (`?category=`); production uses subdomain middleware that rewrites to the same page with a forced category filter. **(sandbox done as query-param filter)**
- Each subdomain is a filtered view over the same `products` table, tagged by category. **(sandbox done over MOCK_PRODUCTS)**
- Stripe for checkout; Stripe Connect routes the take rate back to the split engine. **(production still pending; sandbox uses a no-payment "place order" form)**
- Vetting workflow: admin approves a contributor for marketplace access before they can list. **(done — `/profile/seller` application + `/admin/marketplace` review queue)**
- **Orders + fulfillment (sandbox done 2026-04-25):** seller-side state machine (placed → paid → fulfilling → shipped → delivered + cancelled/refunded), buyer-side `/orders` history, shared `/orders/[id]` with role-aware controls (buyer read-only; seller advances status + saves tracking; admin can force-distribute splits). Guest checkout supported (buyerId null) so unauthenticated buyers land on the order detail post-purchase.
- **Marketplace split (sandbox locked):** 85% seller / 12% cooperative ops / 1.5% Treasury / 1.5% Liquidity Pool. Distinct from the legacy 85/15 contract split — the marketplace's 15% cut is itself sub-allocated (12 + 1.5 + 1.5) so each transaction seeds the cooperative reserves automatically. Production swap-in: Stripe Connect application fee handles the 15%; a settlement job writes the sub-allocation into the same revenue_splits table the contract engine already uses.

### 2.2 — Content locker (embedded, no click-off)
Ask: artists connect YouTube / streaming content, but viewers can't click off to the source platform.

- Use YouTube IFrame API / Vimeo Player with `disablekb`, `modestbranding`, no clickable branding, hide related videos.
- For platforms without a non-click-through embed option, mirror the metadata + poster and hot-link the stream, but wrap in an overlay that captures all click events.
- Legal caveat: YouTube's TOS permits embedding but doesn't allow hiding its branding entirely. Double-check with a lawyer before launch; alternative is a Mux-hosted re-upload where the artist grants rights.

### 2.7 — Feedback rail: peer reviews + customer testimonials (sandbox added 2026-04-26)

**Two distinct rails feeding one admin queue.** Members rate teammates after multi-person engagements; clients and buyers rate the cooperative's delivery after their work wraps. Admin gates promotion of any external quote to a public-to-members testimonial so we can scrub PII and pick a clean line.

- **Peer review (member↔member):** opens automatically on the project / contract detail page when `status === "completed"` AND the viewer is on `assignedMemberIds` AND the team has ≥ 2 contributors. Solo engagements skip the rail entirely (per Jamar's ask 2026-04-26). Five-star rubric: overall, collaboration, craft, reliability, plus prose ≥ 20 chars. Each row is independent — one form per teammate the viewer hasn't reviewed yet, "submitted ✓" stub for ones already done.
- **Anonymity posture (locked 2026-04-25):** review row stores `reviewerId` for admin auditability, but every contributor-facing surface hides it. Aggregate roll-up on `/u/[handle]` is members-only; the public web never sees these scores. `/admin/feedback` is the only place attribution renders, used for calibration when a reviewer skews high or low across many engagements.
- **Customer feedback — contract rail:** external clients hit `/contracts/[id]/feedback?token=<token>` after the contract is marked completed. Auth-free magic-link (clients never had a $BUILD.Store login). Sandbox keeps a tiny token map in-file; production issues signed JWTs from the same service that powers `/proposals/[token]`.
- **Customer feedback — marketplace rail:** buyer questionnaire renders on `/orders/[id]` once `status === "delivered"`. Auth-gated to the buyer; copies name + email off the user record so the buyer doesn't re-enter what we already have.
- **Both submit paths fan out a `customer_feedback_received` notification to every admin, landing the row in `/admin/testimonials`.** Admin reads the full prose, pulls a single quote (pre-filled with the original; admin trims), picks ONE contributor or seller to attach it to, hits Publish. That fires `testimonial_published` to the contributor with a link to their profile. Re-publish overwrites; unpublish flips back to private without deleting the underlying row.
- **Profile surface:** `/u/[handle]` renders aggregate peer rating + sub-dimensions + published testimonials, but ONLY when the viewer is signed in. Anonymous web traffic sees portfolio + bio only. This keeps the cooperative's accountability signals inside the membership wall.
- **Production swap:** `peer_reviews` and `customer_feedback` Drizzle tables. Peer-review unique index on (contextKind, contextId, reviewerId, revieweeId). Customer-feedback writes routed through the same notification fan-out writer that powers Phase 2.4. Admin promotion is a single transaction (set publishedAt + publishedQuote + publishedForUserId, fire notification).

### 2.6 — Direct messaging posture (locked 2026-04-25)

**Posture: admin → member only, never the inverse, never peer↔peer.** The cooperative is a DAO and we want signal density to stay high — open backchanneling invariably becomes a circumvention vector (split-skipping side deals, off-platform coordination that the attribution ledger can't see). The deferral is intentional, not a backlog item.

- `sendAdminDm` (server action, `src/lib/admin-dm-actions.ts`) is the only path. It is gated on `requireAdmin()` AND `recipient.membershipTier === "member"` — partner and prospect tiers cannot receive DMs through the app at all. They use the application/decision rails (seller-app, project-application, whitelist-decision) which already fan out to admin.
- DMs land in the recipient's `/notifications` inbox as an `admin_dm` kind — no separate thread surface. The intent is "official message from the cooperative", not "let's chat."
- Compose UI lives in `/admin/members` (`<DmCompose />`). Non-member rows render a disabled note pointing the admin back to the application/decision rails.
- **Member↔member messaging is deferred indefinitely.** Even with 1:1 friction it would create the same circumvention pressure as group chat, and we have higher-leverage primitives (project applications, attribution ledger comments, governance proposals) for the legitimate use cases.
- **Production swap:** add a `direct_messages` Drizzle table only if we add a reply lane back to admin. Keep the gate. If we ever introduce member↔member, it should require an opt-in per pair plus attribution-ledger logging so the cooperative can audit.

### 2.5 — Apply-to-project workflow (sandbox added 2026-04-25)
- Members open an internal cooperative project at `/projects/[id]` and pitch themselves via an inline form: proposed role, free-text pitch, hours/week, optional reference link. External `kind="contract"` projects keep using the QuoteSheet rail; this lane is internal-only.
- Apply fans out a `project_application` notification to every admin so the queue light flips immediately. Approve at `/admin/projects/applications` runs in a single transaction: status flips to "approved", `Project.assignedMemberIds` is appended, and a `project_application_decision` notification fires to the applicant. Decline fires the same notification kind with a softer "not this round" body.
- Member can withdraw a still-pending row from the project page; admin queue then re-renders without it.
- Dashboard exposes a "Your project applications" section with each pending/approved row + status chip so members can see their requests without re-finding the project page.
- **Production swap:** `project_applications` Drizzle table. Approve action runs in a DB transaction with the projects-table update. Notification fan-out reuses the same writer that powers Phase 2.4.

### 2.4 — Notifications inbox (sandbox added 2026-04-25)
- `/notifications` lists every event routed to the current user — order transitions, RFP status changes, payouts, admin DMs, whitelist decisions, seller-application updates, project-application requests + decisions. Each row is a form whose submit both marks-read and redirects to the underlying surface, so deep-linking works without manual ack.
- Nav exposes an "Inbox" link with an unread-count badge for any signed-in user.
- Two server actions: `markNotificationRead(id, next)` and `markAllNotificationsRead()`. Both gate on `getCurrentUser()` so a member can never ack someone else's inbox.
- **Production swap:** a `notifications` Drizzle table written by the same server actions that mutate orders/contracts/etc. — fan out to every recipient (buyer, seller, admin, attribution party) at the moment of the underlying event. Read API filtered by the current user.

### 2.3 — Pre-launch whitelist + feedback survey

**Posture (revised 2026-04-23): "Not for sale."** Whitelist access is exclusively earned — invitation, application + vetting, or contribution. No purchase path grants access. Reference vibe: Raya, or Reddit without the superficial nonsense — earned exclusivity, signal over noise. The page exposes three earned paths plus an *optional* donation section that explicitly does not grant access (donations route 60/20/20 to ops/Liquidity Pool/Treasury, never to an individual contributor pool).

- Whitelist signup (email + Future Modern relationship context + pillar). **(sandbox done)**
- Invite email sends a magic link to a guided walkthrough. **(sandbox walkthrough done at `/walkthrough`)**
- After each surface, a contextual prompt: "What's broken? What's missing? What do you want?" **(sandbox done — feedback capture wired)**
- Surveys feed a lightweight CMS we read from in `/admin/feedback` so product decisions stay grounded in actual member voice. **(sandbox done)**
- Also capture content / profile submissions during the walkthrough so members start contributing before the public launch.
- **Consultation lane (sandbox done):** external clients can book a paid scoping call without joining the whitelist. Separate split engine (`previewWhitelistSplit`); never confused with the donation path.
- **Donation lane (sandbox done):** Supporter $50 / Advocate $500 / Underwriter $5000 tiers. Routes through `previewDonationSplit` (60% ops / 20% LP / 20% Treasury). Every donation purchase has `referrerId: null` baked in so the legacy referrer-credit path can never fire. Confirmation page reinforces "this does not grant access."

---

## Production migration — consolidated swap plan (added 2026-04-26)

The sandbox is functionally complete. Every sandbox file marks its production target via inline `REPLACE WITH:` comments, and several phase sections above carry a "Production swap" callout. This section consolidates them into a single ordered migration plan so we know what ships first, what blocks what, and what stays on stubs through which milestone.

**Ordering principle.** Migrate primitives bottom-up: identity → persistence → write paths → integrations. Don't swap a UI surface to production before its underlying table exists. Don't add an integration before its server action is on a real DB. Each wave below is independently shippable once the previous wave is in.

### Wave 0 — Foundation (unblocks everything)

| Component | Sandbox | Production target |
|---|---|---|
| Auth provider | `lib/auth-stub.ts`, `lib/auth-actions.ts`, `app/signin/page.tsx` | Auth.js + Drizzle adapter, magic-link + Google OAuth, session cookie scoped to `.afuturemodern.com` |
| Database | All `lib/mock-data/*.ts` | Neon Postgres + Drizzle migrations |
| Email transport | `lib/email-stub.ts` | Resend or Postmark, templates colocated with action handlers |

Once Wave 0 lands, every later wave can ship its DB-backed equivalent independently.

### Wave 1 — Identity + accounts

| Component | Sandbox | Production |
|---|---|---|
| Users + tiers | `mock-data/users.ts` | `users` table |
| Membership applications | `mock-data/applications.ts` | `membership_applications` table |
| Partners | `mock-data/partners.ts` | `partners` table |
| Seller applications | `mock-data/seller-applications.ts` | `seller_applications` table |
| Portfolio | `mock-data/portfolio.ts`, `app/profile/portfolio/...` | `portfolio_items` table |

### Wave 2 — Work surfaces (no payments yet)

| Component | Sandbox | Production |
|---|---|---|
| Projects (RFP intake + internal) | `mock-data/projects.ts`, `app/contracts/new/...` | `projects` table; admin RFP queue persists to the same row |
| Project applications | `mock-data/project-applications.ts`, `lib/project-application-actions.ts` | `project_applications` Drizzle table; approve runs in transaction with the projects-table update |
| Quote sheets | `mock-data/quotes.ts`, `app/contracts/[id]/quote/...` | `quote_sheets` table; magic-link tokens via signed JWT |
| Client proposals | `mock-data/proposals.ts`, `app/proposals/[token]/...` | `client_proposals` table; tokens are signed short-lived JWTs |
| Jobs | `mock-data/jobs.ts` | `jobs` table |

### Wave 3 — Payments rail (Mercury default + Stripe opt-in)

| Component | Sandbox | Production |
|---|---|---|
| Invoices | `mock-data/invoices.ts`, `app/invoices/[token]/...` | `invoices` + `invoice_line_items`; magic-link via signed JWT |
| AR/AP tracker | `app/admin/contracts/...` | Mercury reference fields on invoice rows; admin marks `received` / `sent` |
| Payouts | `lib/payouts-stub.ts`, `app/profile/payouts/...` | Stripe Connect Express (opt-in for CC payouts only) |
| Stripe onboarding | `app/profile/payouts/onboard/...` | Replace mock confirm page with redirect to Stripe accountLinks URL |
| Processor fees | `lib/payments-fees.ts` | Read live rate from connected Stripe account |

### Wave 4 — Marketplace + orders

| Component | Sandbox | Production |
|---|---|---|
| Products | `mock-data/products.ts`, `app/store/...` | `products` table; subdomain middleware rewrites to filtered store page |
| Orders + fulfillment | `mock-data/orders.ts`, `lib/order-actions.ts`, `lib/order-splits.ts` | `orders` + `order_items`; Stripe Connect application fee = the 15% house cut; settlement job writes the 12 / 1.5 / 1.5 sub-allocation into `revenue_splits` |
| Checkout | `app/store/[id]/page.tsx` | Stripe Connect Checkout sessions |

### Wave 5 — Token + attribution + split engine

| Component | Sandbox | Production |
|---|---|---|
| Token transactions | `mock-data/tokens.ts` | `token_transactions` + on-chain mirror via subgraph indexer |
| Wallet | `lib/wallet-stub.ts` | Read live ERC-6551 token-bound account balance |
| Attribution ledger | `mock-data/attribution.ts` | `attribution_entries` (append-only, never edited) |
| Revenue splits | `mock-data/splits.ts` | `revenue_splits` table; engine validates pool shares sum to 100% before payout |

### Wave 6 — Communications + feedback

| Component | Sandbox | Production |
|---|---|---|
| Notifications inbox | `mock-data/notifications.ts` | `notifications` table fan-out written by the same server actions that mutate orders / contracts / etc. |
| Admin DMs | `lib/admin-dm-actions.ts` | `direct_messages` table only if a reply lane is added; otherwise stay action-driven (Phase 2.6 posture) |
| Walkthrough | `mock-data/walkthroughs.ts`, `lib/walkthrough-actions.ts` | `walkthrough_steps` (admin-editable content) + `walkthrough_progress` (per-user log) |
| Feedback inbox | `mock-data/feedback.ts` | `feedback_entries` table |
| Peer reviews | `mock-data/peer-reviews.ts`, `lib/peer-review-actions.ts` | `peer_reviews` table; unique index on (contextKind, contextId, reviewerId, revieweeId) |
| Customer testimonials | `mock-data/customer-feedback.ts`, `lib/customer-feedback-actions.ts`, `app/contracts/[id]/feedback/...` | `customer_feedback` table; magic-link via signed JWT with single-use audit log entry; admin promotion is a single transaction (set publishedAt + publishedQuote + publishedForUserId, fire `testimonial_published` notification) |

### Wave 7 — External integrations

| Component | Sandbox | Production |
|---|---|---|
| HubSpot deal-stage sync | `lib/crm-stub.ts` | OAuth app + REST API; webhook to `/api/hooks/hubspot/stage` |
| Mux content locker | `mock-data/media-assets.ts` | `media_assets` table + Mux upload pipeline; signed playback URLs gated by tier |
| Whitelist invites + donations | `mock-data/whitelist.ts`, `lib/whitelist-splits.ts`, `app/whitelist/...` | `whitelist_tiers`, `whitelist_purchases`; batched magic-link sends via Resend / Postmark; real Stripe Checkout for the donation lane |

### What can stay on stubs through Beta

The beta tests live wiring on the most fragile rails. These can stay stubbed through the beta and graduate to real swaps before the 1,000-invite wave:

- HubSpot sync (Wave 7). Admin can mirror stages by hand for 5 contracts during beta.
- Mux locker (Wave 7). Beta artists can drop demo files into a placeholder bucket; the player surface stays sandbox.
- CC opt-in path (Wave 3). Beta is ACH-via-Mercury only; the credit-card lane can wait.

### What absolutely cannot stay on stubs for Beta

These are the rails that have to be live before any beta user touches the platform on real money:

- Auth + DB + email (Wave 0).
- Users + portfolios (Wave 1).
- Projects + RFP intake + quote sheets + client proposals (Wave 2).
- Invoices + AR/AP + Mercury references + payouts (Wave 3, except CC opt-in).
- Marketplace orders end-to-end if any beta user is selling or buying (Wave 4).
- Attribution ledger + revenue splits (Wave 5) — the bedrock of the fairness guarantee.
- Notifications + walkthrough + feedback inbox (Wave 6) — these are the calibration loop, the beta is unobservable without them.

### Notes on the migration itself

- **Schema lives next to the mock-data file it replaces.** When we wire `users` to Drizzle, the schema goes in `lib/db/schema/users.ts` and `mock-data/users.ts` becomes a thin re-export of fixtures used in tests. Same shape, different source.
- **Server actions stay the same shape.** Every sandbox server action (`applyToProject`, `decideProjectApplication`, `submitPeerReview`, `publishTestimonial`, `markNotificationRead`, etc.) is already structured around mutation + revalidation + notification fan-out. Production swap replaces the in-memory mutation with a Drizzle write inside a transaction. Surface code does not change.
- **Notifications fan-out is the spine.** Every Wave 6 surface depends on the notifications writer. Build that early in Wave 6 and let the rest of the wave land on top of it.
- **Magic-link tokens converge on one signer.** `/proposals/[token]`, `/invoices/[token]`, `/contracts/[id]/feedback?token=...` all use the same JWT signer / verifier in production. One module, three callers.

---

## Phase 3 — Future Modern parent domain

Ask: make $BUILD.Store a component of the larger Future Modern domain.

Architecture options (pick one):
- **Option A — monorepo, one Next.js app, subpath routing.** `afuturemodern.com` serves the Future Modern marketing site at `/`, $BUILD.Store at `/store`. Simplest to ship; single deploy.
- **Option B — separate apps, shared auth domain.** `afuturemodern.com` (marketing CMS — Payload or Sanity) + `build.store` (the app we just built). Shared Clerk or Auth.js session on `*.futuremodern` domain. More flex for the marketing site to hire a pure designer.
- **Option C — Vercel multi-zone.** Single host, multiple Next.js apps proxied together. Best of both but adds infra complexity.

Recommend Option B for the long run, Option A if we're shipping this quarter.

Content for the parent site:
- Who we are — origin story, the cooperative principle, the three pillars framing.
- Where we've been — project wall, case studies (Direct Connect Global, URL Media, past deliveries).
- Where we're going — roadmap (this file, minus the internals), ecosystem vision.
- What makes us special — Afrofuturist POV, fair attribution, tokenized co-ownership.
- Updates / current events — blog or `/signals` feed. Markdown files committed to repo is fine for v1.
- CTA — "Request to join the network" → applications/whitelist flow.

---

## Decisions locked in (2026-04-21)

Jamar's direction: "don't worry about speed, do what you think is best." Picks below
optimize for long-term flexibility, ownership, and member experience — not time-to-MVP.

1. **Auth + DB stack → Auth.js + Neon + Drizzle.** Self-hosted auth means no per-MAU pricing (Clerk gets expensive fast past a few thousand members), full control over the user schema we need for multi-pillar contributors / portfolios / admin redaction, and no vendor lock-in on the primary identity surface. Neon gives us serverless Postgres with branching (great for preview environments and migrations). Drizzle is the typed ORM that pairs cleanly with Next.js server components.
2. **Payment rail → Mercury-routed default, Stripe Connect Express opt-in (revised 2026-04-22).** Mercury handles ACH + wires for both sides at no per-transaction cost; the platform runs the AR/AP ledger on top so every party sees the money's state. Stripe Connect Express stays in the codebase for (a) invoices where the client can only pay by credit card — the platform auto-adds a processor-fee line item that grosses up the total so the cooperative nets whole — and (b) the Phase 2.1 marketplace checkout where Stripe is the obvious fit. Contributor Stripe onboarding becomes optional, only needed for contributors receiving CC-routed payouts; Express still handles 1099s + KYC when it is used.
3. **Parent domain architecture → Option B (separate apps, shared auth on `*.afuturemodern` domain).** `afuturemodern.com` runs on a headless CMS so a pure designer (or a no-code-savvy Future Modern member) can iterate the marketing site without touching product code. `build.store` stays its own Next.js app. Auth.js sessions are scoped to the parent domain so a signed-in member moves between the two without re-auth. Cleaner separation than a monorepo subpath, more conventional than Vercel multi-zone.

   **CMS choice — open question (added 2026-04-22).** The original direction was Payload (block-based editor, self-host). Jamar surfaced a follow-up ask: can the CMS support drag-and-drop placement of images and sections? Block-based CMSes are no-code but not free-canvas. Two visual-canvas options — **Plasmic** and **Builder.io** — register our React components and let non-technical editors drag-and-drop them onto a page. Either preserves design-system enforcement while opening true no-code editing. Decision deferred while devs willing to help are sourced; revisit before scaffolding the parent marketing repo.
4. **Content locker → Mux-hosted re-uploads.** Artists grant us distribution rights explicitly; we host the video; the player is fully ours. Solves the "no click-off" requirement properly instead of relying on fragile DOM overlays that violate YouTube's TOS. More expensive per view (Mux bills on encoding + delivery) but we actually own the experience and there's zero legal ambiguity. Ingest pipeline: artist uploads source file → Mux encodes → metadata lands in our `media_assets` table.
5. **Pre-launch whitelist size → 1,000 invites.** Big enough to matter, small enough that the walkthrough tooling has to be self-serve — we can't personally shepherd a thousand people. Implications below.

### What 1,000 invites changes in Phase 2.3

- **Invite infrastructure:** batched send via Resend or Postmark with per-invite magic-link tokens, throttling, and bounce handling. Not a manual paste job.
- **Onboarding:** self-serve guided tour with progress tracked per member. No "book a call with Jamar" dependencies.
- **Feedback capture:** structured surveys (Likert + short free text) keyed to each surface so we can slice by pillar, tier, and feature. Open-ended only would be un-analyzable at this scale.
- **Analytics:** minimum viable — invite sent → invite opened → walkthrough started → walkthrough completed → first contribution. PostHog self-hosted or Plausible is fine.
- **Support:** canned FAQ surface inside the app plus a single support inbox. No live chat for v1.
- **Moderation:** the admin approval queue (Phase 0.10) has to be real *before* invites go out. A thousand members submitting portfolios and quote sheets without vetting is unworkable.

### Downstream effects on earlier phases

- Phase 1.1 stack notes: replace "Auth.js vs. Clerk" indecision with the concrete setup — Auth.js email-magic-link + Google OAuth providers, Drizzle adapter, Neon pooled connection, session cookie scoped to `.afuturemodern.com` so the build.store app and the parent marketing site share auth.
- Phase 1.5 banking (revised 2026-04-22): Mercury is the default rail; the platform runs an AR/AP ledger so every party can see invoice → received → payout queued → payout sent. Stripe Connect Express is opt-in for CC-only invoices and the marketplace; the existing "Connect payouts" surface stays available but is no longer the default contributor onboarding step.
- Phase 2.1 store: checkout uses a single Stripe Connect platform account with application fees = the 15% house cut; Stripe routes the 85% to the contributor's Express account automatically per transaction.
- Phase 2.2 content locker: drop the YouTube / Vimeo IFrame approach from the roadmap entirely. Mux only.
- Phase 3 marketing site: scaffold as a Payload CMS app in a sibling repo folder (`afuturemodern-marketing/`) once Phase 0 is closed out.

---

## Brand voice (locked in 2026-04-25)

Anchored in the *Future Modern Brand Marketing Strategy* doc. Non-negotiable across every public surface:

- **Purpose:** the radical curation network unifying art and technology to distribute equity.
- **Vision:** redistribute human and financial capital from concentrated powers to dynamic grassroots communities. Construct a world where community integrates with life, art, appreciation, and passion.
- **Values:** Provenance · Discernment · Equity. Plus truth/inquiry, tried-and-true × cutting-edge, and community-as-OS.
- **Personality:** Driven and Debonair. Fiery, in-the-know, well-found confidence. Diligence, grit, daring.
- **Voice:** strong + aggressive (self-assured, dynamic) blended with absurd + weird (creative, perceptive, abstract, surreal, transformative).
- **Tagline:** Rare∞.
- **Positioning (internal):** for savvy seekers and independent creators who share a deep value for cultural contribution.
- **Spine:** "We're not trying to be special. We are special. We don't care if anyone sees it."
- **People-powered, exclusively.** No clients have come from freelance platforms. Anything visible there is a testament to who we are, not a credential.
- **The Future Modernist (added 2026-04-25):** a creator at heart — artist, engineer, builder. Renaissance practitioners, comfortable across pillars. We have specialists, but the people who shape the cooperative move freely between art, engineering, and policy. We're bringing back the apprenticeship-to-mastery arc the modern career path quietly killed. Origin story is the three pillars in order: politics drove the connections, art created the foundation, technology grew the brand.

Anything that contradicts this voice — anywhere on the platform — gets rewritten.

---

## Remaining open questions

None that block building. Ask Jamar when relevant:
- Which three to five members get beta access *before* the 1,000-invite wave?
- Default $BUILD token issuance on first login (0? nominal welcome grant?).
- Who on the Future Modern side has admin access at launch (currently only Jamar)?
- Physical address for Stripe Connect platform onboarding (Future Modern LLC or equivalent entity).

---

*Last updated: 2026-04-25 by Claude (Cowork session with Jamar).*
