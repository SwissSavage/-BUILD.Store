# Beta readiness audit — 2026-08-27

Four days to September 1 kickoff. This is what a full pass through the codebase surfaces. Findings ranked ship-critical / important / nice-to-have. Fixes shipped in this batch marked ✅; deferred with reason otherwise.

## Ship-critical (blocks or embarrasses beta)

### ✅ Sign-out was never actually invalidating the session
Root cause: `src/lib/auth.ts` line 379 configures `session.strategy = "database"`. Every "fix" that touched only the browser cookie left the Postgres `sessions` row alive and the next request re-established the session from that row. Fixed by importing Auth.js's own `signOut` from `@/lib/auth` and calling it with `redirect: false` inside our server action, then doing our own redirect. Committed in the sign-out root-cause fix.

### ✅ Middleware treated expired cookies as valid sessions
`req.cookies.has(name)` returns true even when the cookie value is `""` — which is what our sign-out sets. Users could stay in the app-shell for the transition window between sign-out and next request. Fixed to check non-empty value.

### ⚠ Beta site invite email
Not verified this session — need Jamar or Bayu to confirm `EMAIL_SERVER_*` env vars still route through Resend correctly. If magic-link mail fails, no beta user can sign in for the first time.

## Important (fix before whitelist wave, ok to ship without)

### ✅ No indexes on high-read tables
Schema had 3 indexes across ~50 tables. Added 6 targeted indexes in `drizzle/0012_hot_read_indexes.sql`:
- `notifications (user_id, created_at DESC)` — bell dot on every page render
- `audit_log_entries (actor_user_id, created_at DESC)` + `(resource_kind, resource_id)` — admin audit log filters
- `project_applications (project_id, status)` — RFP bid queues
- `peer_reviews (reviewee_id)` — MVP score aggregation
- `invite_links (created_at DESC)` — admin invite queue
- `cooperative_quotes (project_id)` — client magic-link lookups

### Google Drive keyfile leaked to chat scrollback (from storage integration troubleshooting)
Base64-encoded keyfile was pasted into chat multiple times during the Dokploy env var debugging. Anyone with access to this chat transcript can decode it and sign as the fm-storage-writer service account. **Rotation is mandatory before beta.** Bayu owns the storage handoff per `deliverables/launch-prep/storage-handoff-bayu.md`; rotation is on that list.

### Dockerfile ENV/ARG for secrets
CI build warnings: `SecretsUsedInArgOrEnv: Do not use ARG or ENV instructions for sensitive data` (AUTH_SECRET, EMAIL_SERVER_PASSWORD, DOCUMENSO_API_KEY, DOCUMENSO_WEBHOOK_SECRET, GOOGLE_CLIENT_SECRET). These land in image layers on GHCR. If GHCR image is public, secrets can be extracted by pulling and inspecting layers. Verify GHCR privacy setting, and long-term move secrets to runtime-only env (never `--build-arg` for secrets).

### Documenso env var propagation issue (Drive keyfile)
Root cause not diagnosed but observed: Dokploy silently truncates or drops long env var values. `GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_B64` never landed in the container even after multiple paste+Deploy attempts. Bayu inherits this per the storage handoff.

### Beta URL correctness
Confirm `AUTH_URL=https://build.afuturemodern.com` matches actual domain. If build.afuturemodern.com serves the app but AUTH_URL is set to something else, magic-link callbacks break.

## Scalability / hygiene (nice-to-have)

### 59 grep hits for `MOCK_USERS.find` in admin surfaces
Currently O(n) per lookup. n=13 in seed, will bite at ~1000+. Not urgent for 15-person beta. Deferred; when the reader-swap pass replaces MOCK_ imports with Drizzle queries, these get compound-indexed lookups for free.

### 715 files still reference `MOCK_`
Sandbox era artifact. Tolgay's reader-swap pass (see production-swap-checklist §2) is the long-form fix.

### Public routes cached vs dynamic mismatch
`case-studies/page.tsx` had `force-static` earlier which broke auth-aware Nav (fixed prior). Sweep other `(public)` pages for similar `dynamic = "force-static"` that could break signed-in UX. Not audited this session; adds up over time.

### File sizes
Top files: `types.ts` (4299 lines), `schema.ts` (1512), `about/page.tsx` (1233), `profile/page.tsx` (1189), `u/[handle]/page.tsx` (1037). Not bugs, but `types.ts` could split into `types/user.ts`, `types/quote.ts`, etc. for cleaner navigation. Deferred.

### 21 console.log calls
Most are legitimate structured logging in webhook handlers + auth. Not urgent to strip. If SOC 2 audit posture wants clean stderr, pipe through a real logger later.

### 15 `any` type usages
6 are `eslint-disable`d in `auth.ts` for Auth.js's loose types (necessary). Remaining 9 are in loosely-typed callbacks — cosmetic, not bugs. Deferred.

## SEO / AEO / GEO

### ✅ Coverage looks solid
- `robots.ts`, `sitemap.ts`, `public/llms.txt` all present.
- JSON-LD components: `PersonJsonLd`, `JobPostingJsonLd`, `DefinedTermSchema`, `Faq`.
- Applied on: articles, case-studies, `/u/[handle]`, root layout.
- Custom domain not required for indexability; sitemap URL absolute.

### Gaps worth closing pre-launch
- ~~Organization schema on the root layout~~ — already present in `src/app/layout.tsx` (`@graph` with Organization, wordmark ImageObject, turtle ImageObject). My initial draft was wrong; leaving corrected note here for provenance.
- Homepage OpenGraph image not verified.
- `case-studies/page.tsx` fix from earlier — verify no other `(public)` page has `force-static` blocking auth-aware Nav.

## SOC 2 posture

### ✅ Audit log completeness
`AuditLogAction` union has 60+ verbs covering user lifecycle, MVP scoring, canonization, receipts, quotes, RFP, contracts, bookings, data lifecycle, EPK, testimonials, agreements, signatures, vouchers, reserve pool, referrals, config, inbound triage, SOW dispatch. All server actions I sampled call `logAuditEvent`. Solid CC7.2 evidence.

### ✅ Access review page
`/admin/access-review` exists per file inventory.

### ✅ Role separation
`isAdmin` flag, `requireAdmin()` on every admin route surveyed. `getCurrentUser()` fallback for non-admin flows.

### Actions items pre-beta
- Rotate Drive keyfile (chat scrollback leak).
- Confirm `HUBSPOT_APP_CLIENT_SECRET` set — webhook fails closed without it (good), but users don't get CRM sync until it lands.
- Confirm `DOCUMENSO_WEBHOOK_SECRET` set — same reasoning for signature webhook.
- Backup verification for Postgres — `dokploy.afuturemodern.com`. Confirm nightly snapshot runs and one restore has been rehearsed. This is CC7.5.

## Deferred / blocked-on-others

- Task #7 OIDC federation (needs Documenso config on their side)
- Task #8 physical business card
- Task #62 design pass with Bayu
- Task #63 payments hub (needs Stripe/PayPal/etc. creds)
- Task #58 image pipeline follow-ups: `media.afuturemodern.com` custom domain wire-up
- Storage: Bayu owns Drive credential resolution + Hetzner directory create

## What ships in this audit batch commit

- `src/middleware.ts` — cookie non-empty check.
- `drizzle/0012_hot_read_indexes.sql` — 6 indexes on high-read tables. Auto-migration runner (task #65) picks them up on next deploy.
- `docs/beta-readiness-audit-2026-08-27.md` — this doc.

## Verification post-deploy

1. Sign out on prod. Confirm `__Secure-authjs.session-token` disappears in DevTools + `/profile` redirects to `/signin`. If still stuck, container hasn't picked up the DB-session sign-out fix yet.
2. Hit `/api/storage/health` — R2 should stay green, Drive still needs Bayu's cred fix, Hetzner still needs the directory.
3. Load `/admin/notifications` (or any page that reads unread notification count) — should be faster with the new index.
