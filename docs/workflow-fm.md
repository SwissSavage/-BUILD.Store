# Future Modern gig workflow — on-platform, end to end

Ship target: every step Jamar and admins do today runs directly on
build.store. No parallel Google form. No email-transcribed bids. No
Notion. Talent onboards, bids, gets picked, and gets paid inside the
platform. Warm leads Jamar already knows still surface here so
prospects can see where FM is going — "insider knowledge, publicly."

Left = manual step today. Middle = project state on the platform.
Right = the screen or automation that owns it.

| # | Manual today                                                    | Project state                              | On build.store (owns it)                                                                                                            |
| - | --------------------------------------------------------------- | ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| 1 | Lead comes in, Jamar qualifies via call / DM                     | —                                          | Public `/rfp/new` intake (task #29) OR admin `/admin/rfps/new` — pipeline row created in either path                                 |
| 2 | Jamar drafts RFP with Claude in a Doc                           | `draft`                                    | `/admin/rfps/new` — AI-assisted draft, attachments parsed with regex + heuristic (task #29). No product lock-in on the parse layer. |
| 3 | Jamar validates + tightens scope                                 | `draft`                                    | `/admin/rfps/[id]` review screen                                                                                                    |
| 4 | Jamar approves                                                  | `open`, `isRfp=true`, published            | Approve → `/contracts/[id]` (public, JobPosting JSON-LD, indexable)                                                                 |
| 5 | Jamar scrolls Google talent form for skill matches               | `open`                                     | Skill-tag match ranks talent; **fair-rotation slot** guarantees newer / less-utilized talent mixed in with top performers (task #40) |
| 6 | Jamar copy-pastes RFP into quote-request emails                  | `open`                                     | `/admin/rfps/[id]/dispatch` — pre-checked mix (top + rotation), one-click sends templated emails to on-platform talent (task #40)   |
| 7 | Talent replies with quotes over email                            | `open`, bids arriving                      | Talent bids on-platform via `/contracts/[id]`. Email fallback removed — everyone signs in and bids in the app (task #44 onboarding). |
| 8 | Jamar compiles 3–5 quotes into a client-facing summary doc       | `open`, quotes compiled                    | `/projects/[id]/quotes` — 3–5 scrubbed **player cards** with avatar, alias, tagline, rate/hours, pitch excerpt (task #41)            |
| 9 | Jamar strategist-picks (Rob for RevOps, culture fit picks)       | `open`                                     | Same screen; "admin-recommended" badge auto-set when one candidate dominates rank+tier+skill                                        |
| 10 | Client picks talent, replies over email                          | `open` → `in_progress`                     | Magic-link `/quotes/[projectId]?token=…` (task #45) — no signup required; click a card and both agreements fire                    |
| 11 | Jamar sends LOI to talent + SOW to client                        | signing                                    | `/admin/projects/[id]/agreements` — one action fires **Talent Partner LOI** (task #12) to selected talent AND **Client SOW** to client via Documenso (task #46) |
| 12 | Delivery + weekly updates                                        | `in_progress`                              | Project tracker at `/projects/[id]` — admin+talent update milestones. Needs a walkthrough + iteration (task #47).                   |
| 13 | Wrap + informal client feedback + admin capture                  | `in_progress` → `completed`                | Exit audit: peer_reviews (stars + collaboration/craft/reliability + **professionalism**, task #28), client rating at `/contracts/[id]/feedback`, admin captures `pmEngagementRating` at `/admin/contracts/[id]/settle`, MVP compliance penalty if applicable |

## Ratings + compliance — reconciling the layers

The platform already has multiple rating instruments. Where the "0/1 binary compliance" from the MVP lives, and how professionalism fits:

- **Peer reviews** (`peer_reviews` table): stars, collaboration, craft, reliability, prose — softer, per-teammate, submitted on multi-person engagements. **This is where the professionalism sub-rating gets added** (task #28).
- **Client rating**: captured on `/contracts/[id]/feedback` post-delivery. Feeds bonus-gate.
- **Admin / PM rating** (`projects.pmEngagementRating`, integer 1–5): captured at `/admin/contracts/[id]/settle` by the account-owning admin. Fallback for bonus-gate composite when client rating is absent.
- **MVP compliance penalty** (`mvp_compliance_penalties` — the binary "did-they-or-didn't-they" layer you're remembering): admin-adjudicated event, -9 OVR for 90 days, stackable, rolls off. This is the *hard*, mechanical layer — separate from the *soft*, sentiment-based peer reviews. Applied at `/admin/compliance` when a covenant violation happens.

So professionalism ≠ compliance penalty. Professionalism goes on `peer_reviews` as a fifth sub-rating (peers grade each other's polish). The compliance penalty stays as the binary admin-adjudicated event for genuine covenant violations (missed deadlines with no notice, dropped comms, etc). They compose: repeated professionalism dings from peers become the paper trail that justifies an eventual admin-adjudicated compliance penalty if the pattern doesn't correct.

## Onboarding — two tracks

**Track A — Admin-invited (Jamar knows them):**
1. Admin at `/admin/invites/new` generates invite w/ role + tier
2. Countersign-first (task #26, done) → invite email fires (task #24, done)
3. Talent lands on care-package flow, signs T&C, completes profile

**Track B — External applicant (came in cold):**
1. Public `/apply` form: name, email, skill-tag selection, portfolio link, short pitch
2. Row lands in a new `talent_applications` table, admin sees at `/admin/talent/applications`
3. Admin reviews → Approve promotes to Track A invite / Reject with note
4. On approve, Track A invite flow fires — applicant becomes invitee, standard onboarding from there

**Google form roster** (existing talent already collected): one-time importer reads the CSV → creates `talent_applications` rows in `pending` state so admin can invite them onto the platform. Then the Google form retires. (Task #48)

## Client selection — no signup required

Client selects a bid via a **magic-link** URL: `/quotes/[projectId]?token=…`. Short-lived signed token, one-click card selection. On pick:
- Both Documenso envelopes fire (Talent Partner LOI + Client SOW)
- Client optionally creates a lightweight account for tracker read-access
- No forced signup, no friction

## Principles this workflow bakes in

- **On-platform end to end** — no parallel systems, no email transcription fallback. Every step above owns its own screen or automation.
- **Depersonalization until delivery** — clients never surface upstream on `/jobs`, `/contracts`, or `/projects/[id]/quotes`. Every gig reads as a Future Modern gig.
- **First-name / alias only** on talent-facing surfaces. Real name unlocks post-selection.
- **Fair-shake matcher** — auto-match returns a **mix**: top-ranked candidates + rotation-slot for less-utilized talent + alphabet-fair shuffle. Never just "top 5 by OVR" — everyone gets shots (task #40).
- **Client-safe PII scrub** on every field that reaches the client (task #39) — kills the client-poaching risk and keeps FM as contract of record.
- **Avatars → player cards** — profile editor uploads propagate to public profile, bid cards, admin queue, everywhere talent surfaces (task #38 + #41).
- **No product lock-in on critical paths.** Anthropic API is fine for RFP draft assist — Jamar uses Claude anyway. But the matcher, PII scrub, dispatch, and onboarding flows run on regex + heuristics + our own DB. If Anthropic goes down, the pipeline still moves.
