# Customer loyalty token — concept brief

**Status:** Draft. Ships as a concept, not a spec. Working name `$CRED`
(placeholder — Jamar renames).

**Position:** Distinct from `$BUILD`, which is the labor-economics token
(talent earns for contribution). `$CRED` is the *client-side* token —
earned by paying customers for repeat engagement, referral, and
cooperative-values alignment. Same on-chain rails; opposite side of the
transaction.

## Why this needs to exist separately

`$BUILD` mechanics are locked around Venture Labor: talent earns
proportional to shipped contribution, gated by the MVP score, redeemable
for real economic upside. Client-side incentives dilute that mechanic:
a client "earning $BUILD" pollutes the labor-economics signal and blurs
who the cooperative is for.

The cleaner move is a parallel token whose meaning stays clear —
`$BUILD` says "you built something with the cooperative," `$CRED` says
"you kept coming back to the cooperative." Both provenance-verifiable
on-chain; neither substitutes for the other; no reason a person can't
hold both if they play both roles.

## What loyalty is NOT here

Per Jamar's locked posture (see memory: "loyalty/discount programs are
off the table"): no discount ladders, no points-for-dollar-off, no
cash-back. Pricing variability comes from talent selection, not from
negotiated tier discounts. That rules out ~90% of what "loyalty
program" usually means.

What's left is the interesting half — **cultural capital, not perks**.
Clients participate in a story they want to tell.

## What clients earn

Every dollar spent through the cooperative accrues `$CRED` at a fixed
rate (proposed: 1 `$CRED` per USD of contract value, non-negotiable).
`$CRED` is non-transferable by default (soul-bound ERC-721 or
ERC-5192) so it can't be traded — the meaning is who did the work with
us, not who bought a claim.

Bonus multipliers land on top of the base earn:

- **Referral multiplier** (1.5×): dollars from a client the referring
  client introduced. Referrer's `$CRED` grows when their intro closes
  their first engagement.
- **Longevity multiplier** (1.25× at year 2, 1.5× at year 3+): stacks
  the recency-weighted signal so long-term relationships accrue faster
  than one-off transactions.
- **Cooperative-values alignment bonus** (variable, admin-attested):
  clients who publicly acknowledge the cooperative model, share
  Impact Invoices, or participate in Founding Client cohort get a
  named admin-attested bump. Rare, discretionary, audit-logged.

## What `$CRED` grants

Nothing that undercuts pricing. Only things that reinforce cultural
capital + cooperative provenance:

1. **Founding Client cohort status**. Public founders-page attribution
   permanent + named. Only unlocks with a threshold `$CRED` earn
   (proposed: first 25 clients to earn 1000+ `$CRED`).
2. **First-look calendar priority**. High-`$CRED` clients get first-
   look on Champion's Court / Constellation talent's booking calendar
   before it opens to whitelist inbounds.
3. **Private client peer group**. `$CRED` >= threshold unlocks a
   member-only-style Community chat room (task #64) scoped to
   client-side operators talking to each other about their cooperative
   engagements. Cross-pollinates leads without FM sitting in the
   middle of every conversation.
4. **Impact Invoice signature series**. High-`$CRED` clients get their
   Impact Invoices (the post-engagement receipt showing $BUILD
   distributed + talent standing lift) signed on-chain by the
   engagement's talent lead + admin — auditable proof for their own
   marketing.
5. **Annual canonization mention**. Top-`$CRED` client of the year
   gets named on that year's cooperative canonization NFT. Same rail
   as talent canonization (memory: annual ERC-721 + ERC-6551), one
   client slot per year.
6. **Advisory seat on Cooperative Covenant revisions**. `$CRED` above
   the "Founding Client" threshold buys a seat in the annual
   covenant-review pass. Advisory only, no vote — the cooperative
   stays talent-governed — but the client voice is heard structurally.

## Mechanics — how it lives on-chain

- Same infrastructure as `$BUILD` (Tolgay's ERC-6551 TBA cards, memory
  ref: "wrote the ERC-6551 contract"). Client's card-wallet is the
  same primitive; `$CRED` balance renders alongside `$BUILD` in the
  wallet UI.
- Non-transferable by default. Optional per-client opt-out to burn
  their own balance (privacy / offboarding); no transfer path.
- Distributed automatically at settlement time by extending the
  existing revenue-split engine. When an invoice is marked
  `split_distributed`, a `$CRED` credit event fires for the client of
  record. Zero new pipeline — piggybacks on the split engine already
  in place.
- Audit-logged same way `$BUILD` transactions are (memory ref:
  `voucher.issued` audit verb pattern). New audit verbs:
  `cred.earned`, `cred.multiplier_applied`, `cred.tier_unlocked`.

## Tier ladder (illustrative)

| Tier | Threshold | Unlocks |
|---|---|---|
| Curious | 0 | Public site access (base state) |
| Repeat | 250 `$CRED` | Impact Invoice signature series |
| Founding Client | 1000 `$CRED` | Public founders-page + first-look calendar + private client peer group |
| Cooperative Patron | 5000 `$CRED` | Advisory seat on covenant review + annual canonization eligibility |

Numbers are placeholders — actual thresholds calibrate against real
engagement volume once beta cohort revenue lands.

## Risks + open questions

- **Perceived vs. actual scarcity.** Cultural-capital-only design
  works if the perks feel earned. If Founding Client status starts
  showing up on 200 client sites, it dilutes. The cap-at-25 first-
  cohort framing is meant to protect this — needs enforced hard cap
  in the smart contract, not just admin discretion.
- **Referral gaming.** If referral multiplier is naive, clients
  self-refer (dummy company, real check). Mitigation: admin
  attestation on first close for every referral credit, same
  standard as Partner Referrals table (memory: `partner_referral`
  audit trail).
- **Interaction with 85/12/3 revenue split.** `$CRED` doesn't
  take from any pool — it's a distribution to the CLIENT alongside
  the existing splits. Confirm this doesn't require FM to reserve
  additional token supply outside the cooperative operations pool.
- **Regulatory shape.** Non-transferable soul-bound token minimizes
  securities-law surface area (nothing to trade, nothing to value on
  a market). Confirm with counsel before mint pipeline goes live.
- **Naming.** `$CRED` is a working placeholder. Candidates: `$COOP`
  (cooperative-owned framing), `$PATRON` (client-support framing),
  `$FOUNDER` (Founding Client framing). Jamar picks.

## What ships when

Not this cohort. `$CRED` is a Phase-2 concept — post-beta, after
`$BUILD` mechanics are proven in production. Sequencing:

1. **Sept 2026 beta:** `$BUILD` runs live for talent side; no client
   token yet. Impact Invoices ship as receipts without token
   distribution.
2. **Q4 2026 post-beta review:** revisit `$CRED` concept with real
   client-side engagement data. Decide token vs. off-chain-tier vs.
   drop.
3. **Q1 2027 pilot:** if greenlit, mint pipeline extension +
   settlement engine hook + first Founding Client cohort activation
   at the annual canonization event.

## Cross-references

- Memory: `merch-concepts.md` (Rare∞ tier ladder; loyalty token would
  share the color ladder if minted as visible artifact).
- Memory: `future-modern.md` (85/12/3 revenue split — `$CRED` doesn't
  disturb this).
- Memory: `build-vision.md` (`$BUILD` architecture — parallel-but-
  distinct is the design goal).
- Memory: `projects-active.md` Impact Invoice / talent roster
  dashboard notes 2026-04-26 (this doc extends those ideas into a
  token-mechanic).
- Session log 2026-08-26: this doc = Task #4 close.
