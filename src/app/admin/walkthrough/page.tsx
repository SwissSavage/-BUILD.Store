/**
 * /admin/walkthrough — manual QA audit guide by tier + stress-tests.
 *
 * Purpose: give Jamar a live-check surface for stress-testing every
 * consequential tier / band / compliance-state combination while
 * knowing what to look for. Written as a self-contained reference —
 * anchor-linked table of contents at top, section per level, cross-
 * cutting stress-tests at the bottom, copy audit checklist for
 * Bayu's design pass.
 *
 * Not a scheduled task and doesn't write anything — pure audit
 * reference. Rich cross-links to the actual admin surfaces so each
 * check is one click away.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-stub";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

const SECTIONS = [
  { id: "landing-copy", label: "Landing / copy audit (Bayu)" },
  { id: "viewer", label: "Viewer walkthrough" },
  { id: "prospect", label: "Prospect walkthrough" },
  { id: "partner", label: "Partner walkthrough" },
  { id: "member", label: "Member walkthrough" },
  { id: "admin", label: "Admin walkthrough" },
  { id: "stress-tests", label: "Cross-cutting stress tests" },
];

export default async function WalkthroughPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <CardEyebrow>Admin</CardEyebrow>
      <h1 className="mt-2 font-display text-4xl font-semibold">
        Audit &amp; stress-test walkthrough
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">
        Manual QA guide organized by tier + a stress-test section for
        the compliance mechanics. Use this to audit Bayu&apos;s design
        pass and to walk through every consequential tier / band /
        compliance state before beta launch.
      </p>

      {/* Table of contents */}
      <nav className="mt-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-4">
        <p className="text-[11px] uppercase tracking-wider text-ink-muted">
          Sections
        </p>
        <ol className="mt-2 space-y-1 text-sm">
          {SECTIONS.map((s, idx) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="text-brand-magenta hover:underline"
              >
                {idx + 1}. {s.label}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* Landing copy audit */}
      <Section id="landing-copy" title="Landing / copy audit (Bayu's pass)">
        <p className="text-sm text-ink-muted">
          Copy carries the design at this stage. If the copy is right,
          the visual work has something to serve. If it&apos;s generic,
          the design converges to generic. What to look for:
        </p>
        <Checklist
          items={[
            {
              label: "Thesis integrity",
              body: `Does the landing copy carry "evolve past scarcity" / Venture Labor / cooperative-owned infrastructure as its actual thesis, or does it collapse into "modern creator platform"? The first is FM's moat; the second is fungible.`,
            },
            {
              label: "Distinctive vocabulary",
              body: `Does the copy use "cooperative," "Venture Labor," "Champion's Court," "canonization," "Constellation," and other locked FM vocabulary — or has AI drafting flattened it to "community," "members," "achievements," etc?`,
            },
            {
              label: "First-name-first",
              body: `Any names in copy or CTAs — first name only. Full names surface admin-side only. Verify no last names leaked into marketing copy.`,
            },
            {
              label: "Cooperative vs. platform framing",
              body: `Copy should read as "cooperative you're joining" not "platform you're using." Subtle but load-bearing — check pronouns ("we / our") and verbs ("build with us / cooperate on" vs. "sign up / list your services").`,
            },
            {
              label: "Compensation transparency",
              body: `Base + performance-ceiling structure should be surfaceable without needing to click into help — check if the 85/12/3 revenue model + client-rating-4+ gate is legible.`,
            },
            {
              label: "Whitelist framing",
              body: `Whitelist tiers land as membership access, not "buy a subscription." Access is not for sale per locked posture — the copy should reflect that even when the surface does have paid tiers.`,
            },
            {
              label: "Not-a-marketplace framing",
              body: `Copy should not read as Upwork / Contra / Braintrust adjacencies. Inverse-marketplace (RFPs go to talent) is the differentiator — check that language reflects it.`,
            },
            {
              label: "Trust hand-off",
              body: `Landing should link to /trust for procurement-oriented visitors. Cooperative + compliance stance is a wedge, not a footnote.`,
            },
            {
              label: "Bayu's icon set",
              body: `Icons should be distinctive (Jamar flagged Bayu's have cool unique elements). Check that they don't collapse to Feather / Lucide default set — verify visual identity holds.`,
            },
          ]}
        />
      </Section>

      {/* Viewer walkthrough */}
      <Section id="viewer" title="Viewer walkthrough (unauthenticated)">
        <p className="text-sm text-ink-muted">
          Sign out (or use view-as viewer from the admin dropdown).
          Everything below should be reachable without any auth gate.
        </p>
        <Subhead title="Should be visible" />
        <Checklist
          items={[
            { label: "/ home", body: "Roster preview, three pillars, CTA to signup." },
            { label: "/about", body: "Cooperative framing, phase context." },
            { label: "/showcase", body: "Discovery-eligible Members + recognized Partners. Verify profilePublic filter working." },
            { label: "/partners", body: "Public partner directory." },
            { label: "/store", body: "Marketplace browse; approved sellers only." },
            { label: "/contracts", body: "Open RFPs list. Should also link to /trust for procurement-conscious visitors." },
            { label: "/jobs", body: "Jobs board if populated." },
            { label: "/trust", body: "Procurement-facing security + privacy summary." },
            { label: "/policies + subroutes", body: "Privacy, covenant, subprocessors — all public." },
            { label: "/whitelist", body: "Whitelist tiers copy renders." },
            { label: "/signup + /signup/join + /signup/hire + /signup/build", body: "Three intent-based signup forms." },
            { label: "/u/[handle]", body: "Public profile if profilePublic=true. Should show robots:noindex meta when false — check via 'View page source'." },
          ]}
        />
        <Subhead title="Should be gated (redirect to /signin)" />
        <Checklist
          items={[
            { label: "/profile*", body: "302 to /signin?next=/profile" },
            { label: "/admin*", body: "302 or 403" },
            { label: "/notifications", body: "302 to /signin" },
            { label: "/calendar", body: "302 to /signin?next=/calendar" },
            { label: "/activity", body: "302 to /signin?next=/activity" },
            { label: "/team", body: "302 to /signin?next=/team" },
            { label: "/wallet", body: "302 to /signin" },
            { label: "/profile/data-rights", body: "302 to /signin" },
          ]}
        />
        <Subhead title="Audit-log entries that should NOT fire from Viewer" />
        <p className="mt-2 text-xs text-ink-muted">
          No writes from a Viewer session should touch the audit log
          except failed_signin. Check{" "}
          <Link href="/admin/audit-log?action=user.failed_signin" className="text-brand-magenta hover:underline">
            /admin/audit-log filtered by failed_signin
          </Link>{" "}
          after attempting an invalid credential.
        </p>
      </Section>

      {/* Prospect */}
      <Section id="prospect" title="Prospect walkthrough (signed up, low-friction tier)">
        <p className="text-sm text-ink-muted">
          Use view-as on a Prospect-tier mock user. Discovery routes
          same as viewer plus own profile.
        </p>
        <Subhead title="Should be visible" />
        <Checklist
          items={[
            { label: "/profile", body: "Own profile with Tier-2 consent toggle (Data Participation)." },
            { label: "/profile/data-rights", body: "Export + erasure request forms." },
            { label: "/notifications", body: "Inbox surface with any pending notifications." },
            { label: "/application", body: "Application flow to convert to Partner." },
          ]}
        />
        <Subhead title="Should be gated (Member-only)" />
        <Checklist
          items={[
            { label: "/team", body: "Member-tier gated with copy explaining." },
            { label: "/calendar", body: "Member-tier gated." },
            { label: "/activity", body: "Member-tier gated." },
            { label: "DM to Member", body: "Not allowed per tier-access matrix (Members-to-Members is unlocked; others cannot initiate to Member unless admin routes)." },
          ]}
        />
        <Subhead title="Audit entries expected" />
        <Checklist
          items={[
            {
              label: "user.signed_in on session start",
              body: "Filter /admin/audit-log by this user; verify entry appears with correct actor role snapshot 'prospect'.",
            },
            {
              label: "consent.data_participation_opted_in if Tier-2 toggle flipped on",
              body: "(reserved verb — not yet on list; consent flow currently writes to its own audit table per legal.md)",
            },
          ]}
        />
      </Section>

      {/* Partner */}
      <Section id="partner" title="Partner walkthrough">
        <p className="text-sm text-ink-muted">
          Partners are structurally present but discovery-hidden by
          default per the visibility matrix. Recognition (Future
          Modernist of the month) unlocks a discovery window.
        </p>
        <Subhead title="Should be visible" />
        <Checklist
          items={[
            { label: "Partner-limited EPK mode", body: "Reduced-scope EPK — check that Partner sees the limited-mode surface, not the full Member EPK." },
            { label: "/profile with visibility toggle", body: "profilePublic toggle should be present + labeled clearly." },
            { label: "Recognition unlocks discovery", body: "If the Partner holds an active Future Modernist recognition, they should appear on /showcase and homepage roster; if not, they should NOT." },
          ]}
        />
        <Subhead title="Verify the visibility matrix — this is load-bearing" />
        <Checklist
          items={[
            { label: "Toggle profilePublic=false on a Partner", body: "Verify they disappear from /showcase, /team (already Member-only), homepage roster, and any search index. /u/[handle] direct URL still resolves." },
            { label: "Grant recognition to a Partner", body: "Verify they appear on /showcase (recognition unlocks discovery window) even if profilePublic was false — check the exact rule in publicProfileEligible." },
            { label: "Revoke recognition", body: "Verify discovery window closes. Partner returns to hidden state (assuming profilePublic=false)." },
          ]}
        />
        <Subhead title="Co-brand policy" />
        <p className="text-xs text-ink-muted mt-2">
          Partners can receive recognition + be featured but should not
          co-brand with FM at the same weight as Members. Check{" "}
          <Link href="/admin/mvp/recognition" className="text-brand-magenta hover:underline">
            /admin/mvp/recognition
          </Link>{" "}
          shows the co-brand policy reminder card when a Partner is
          selected.
        </p>
      </Section>

      {/* Member */}
      <Section id="member" title="Member walkthrough (full unlock)">
        <p className="text-sm text-ink-muted">
          Members get the full cooperative-internal surface set +
          co-brand rights + MVP score visibility + canonization.
        </p>
        <Subhead title="Should be visible" />
        <Checklist
          items={[
            { label: "/team", body: "Member directory with TradingCard grid, tier-sorted. Check pillar filter." },
            { label: "/calendar", body: "Shared cooperative calendar. Availability, blocks, meetings across Members." },
            { label: "/activity", body: "Cooperative event timeline. Sandbox-illustration banner should render at top." },
            { label: "/profile with MVP card", body: "Full MvpCard rendering with OVR + band + sub-ratings. Provisional Members see ProvisionalCard variant instead." },
            { label: "/profile/canon", body: "Personal canon view with in-progress current year + past cards + phygital request stub + recognition history." },
            { label: "/profile/calendar", body: "Personal calendar with availability manager + peer booking + minutes capture." },
            { label: "/notifications", body: "Full inbox with all notification kinds routed correctly." },
            { label: "/u/[handle] trading card hero", body: "TradingCard tier derived from deriveTradingCardTier. Verify Champion's Circle golden-holo when applicable." },
            { label: "/dashboard", body: "Member dashboard with signal aggregation." },
            { label: "DM to any tier", body: "Member-to-anyone messaging unlocked (Member↔Member fully unlocked, other tiers per matrix)." },
          ]}
        />
        <Subhead title="MVP band-specific rendering" />
        <Checklist
          items={[
            { label: "Provisional Member", body: "ProvisionalCard renders instead of MvpCard. No OVR surfaced." },
            { label: "Probation band (below 65)", body: "Gray-dominant TradingCard background. MVP card BAND_ACCENT matches." },
            { label: "Good Standing (65-74)", body: "Green-dominant." },
            { label: "Promotion Eligible (75-89)", body: "Blue-dominant." },
            { label: "Future Modernist (raised threshold)", body: "Magenta-dominant." },
            { label: "Champion (top 10% AND OVR ≥ 90)", body: "Gold-holographic + Champion's Circle badge. Verify fm-holo-sheen animation renders." },
          ]}
        />
      </Section>

      {/* Admin */}
      <Section id="admin" title="Admin walkthrough">
        <p className="text-sm text-ink-muted">
          Admin gets the ops console + compliance controls + user
          management + audit visibility. Every action logs.
        </p>
        <Subhead title="Console surfaces" />
        <Checklist
          items={[
            { label: "/admin", body: "Landing with quick-count tiles across every ops area." },
            { label: "/admin/inbound", body: "Unified triage queue — RFPs, chats, signups, quotes, partner apps, booking requests." },
            { label: "/admin/members", body: "List with view switcher, per-row tier + admin actions, drill-down link." },
            { label: "/admin/members/[id]", body: "Full per-user drill-down with access controls + audit trail scoped." },
            { label: "/admin/members/invite", body: "Invite generator with 14-day default lifetime, revoke-with-reason." },
            { label: "/admin/access-review", body: "Quarterly walk-through with cadence status (overdue > 90 days)." },
            { label: "/admin/mvp", body: "MVP scoreboard." },
            { label: "/admin/mvp/[userId]", body: "Per-Member MVP detail + penalty apply/rescind." },
            { label: "/admin/mvp/recognition", body: "Recognition selection with grouped optgroups + co-brand policy card." },
            { label: "/admin/mvp/canonization", body: "Annual canonization run with sandbox illustration banner + per-card captions." },
            { label: "/admin/contracts/[id]/settle", body: "Bonus release settle UI with gate math + release/reclaim." },
            { label: "/admin/team-meetings", body: "Grouped minutes log by routing." },
            { label: "/admin/audit-log", body: "Reverse-chron viewer with actor/action/resource filters." },
            { label: "/admin/compliance", body: "26 SOC 2 + ISO 27001 controls with status + evidence hrefs." },
          ]}
        />
        <Subhead title="Every action fires an audit entry" />
        <p className="mt-2 text-xs text-ink-muted">
          After any mutation, check{" "}
          <Link href="/admin/audit-log" className="text-brand-magenta hover:underline">
            /admin/audit-log
          </Link>{" "}
          for the corresponding verb. If a mutation you took didn&apos;t
          produce an audit entry, that&apos;s a bug — file it against
          the action file.
        </p>
      </Section>

      {/* Stress tests */}
      <Section id="stress-tests" title="Cross-cutting stress tests">
        <p className="text-sm text-ink-muted">
          End-to-end paths for the compliance mechanics + visibility +
          edge cases. Walk each one and verify the audit trail closes
          the loop.
        </p>

        <StressTest
          num={1}
          title="Visibility matrix — Partner hidden by default"
          steps={[
            "As admin, view-as a Partner-tier user.",
            "Toggle their profilePublic to false.",
            "As Viewer (signed out), visit /showcase — Partner should not appear.",
            "Try /u/[handle] direct URL — should still resolve but 'View page source' should show robots:noindex meta.",
            "As admin, grant them a Future Modernist recognition.",
            "As Viewer, visit /showcase again — Partner should now appear (recognition unlocks discovery).",
            "Verify audit trail: user.profile_public_toggled + recognition.selected.",
          ]}
        />

        <StressTest
          num={2}
          title="Compliance penalty ladder"
          steps={[
            "As admin, apply a compliance penalty to a Member with 10-char+ reason.",
            "Verify -9 OVR shift on their MvpCard.",
            "Verify penalty count (not reason) shows on peer view at /u/[handle].",
            "Wait 90 days sandbox-clock (or move computedAt forward) — verify penalty ages out.",
            "Stack 3 penalties inside 90 days — verify Member drops from Good Standing to Probation band.",
            "Audit entries: mvp.compliance_penalty_applied × 3, with actor + reason + expiresAt in each.",
          ]}
        />

        <StressTest
          num={3}
          title="Provisional promotion + demotion"
          steps={[
            "View-as a new provisional Member.",
            "Verify /profile renders ProvisionalCard (no OVR shown).",
            "As admin, promote from provisional at /admin/mvp/[userId].",
            "Verify MvpCard now renders with computed OVR + band.",
            "Demote back to provisional. Verify ProvisionalCard returns.",
            "Audit: mvp.provisional_promoted + mvp.provisional_demoted.",
          ]}
        />

        <StressTest
          num={4}
          title="Suspension mechanic"
          steps={[
            "As admin, suspend a non-admin Member with 10-char+ reason.",
            "Verify /u/[handle] hides their profile (production; sandbox check the state field).",
            "Verify a suspended-account banner on /admin/members/[id].",
            "Reactivate with an optional note.",
            "Audit: user.suspended + user.reactivated with before/after snapshots.",
          ]}
        />

        <StressTest
          num={5}
          title="Data rights export + erasure"
          steps={[
            "As a Member, visit /profile/data-rights.",
            "Submit an export request — verify admin notification + audit entry data.subject_export_requested.",
            "Submit an erasure request — verify the 'ERASE MY ACCOUNT' confirmation gate blocks empty confirmation.",
            "Verify audit data.subject_erasure_requested with 30-day hardDeleteAt in after snapshot.",
            "Verify admin pool receives notification via /notifications.",
          ]}
        />

        <StressTest
          num={6}
          title="Bonus release settlement — release path"
          steps={[
            "As admin, visit /admin/contracts/p_004/settle.",
            "Confirm base amount + bonus amount + gate rule visible.",
            "Set PM engagement rating.",
            "Execute bonus decision. Verify releaseIn gate math (client rating 4+ → release; below → reclaim to recovery pool).",
            "Verify the resulting wallet transaction on talent's history reflects compStage correctly.",
            "Audit: contract.bonus_released or contract.bonus_reclaimed with explanation captured in reason.",
          ]}
        />

        <StressTest
          num={7}
          title="EPK booking flow (three-step)"
          steps={[
            "As Viewer (signed out), visit /u/[handle] of a Member with a published EPK.",
            "Submit a booking request with a real brief.",
            "Sign in as admin, verify /admin/inbound shows a booking_request row.",
            "Approve — verify artist receives a notification in /notifications.",
            "View-as artist, visit /profile/calendar, confirm the meeting.",
            "Verify all four notifications fire (received, approved, artist-confirm, admin booking_confirmed).",
            "Audit: booking.request_created (system-actor), booking.request_approved, booking.confirmed.",
          ]}
        />

        <StressTest
          num={8}
          title="Recognition selection"
          steps={[
            "Visit /admin/mvp/recognition.",
            "Verify grouped optgroups (Members / Partners) render.",
            "Select a Partner — verify co-brand policy reminder card renders on selection.",
            "Select a Member — no reminder needed.",
            "Enter narrative + submit.",
            "Verify recognition banner renders on /u/[handle] for the selected user.",
            "Verify Partner recipient now appears on /showcase (discovery unlock).",
            "Audit: recognition.selected with narrative in reason.",
          ]}
        />

        <StressTest
          num={9}
          title="Annual canonization run"
          steps={[
            "Visit /admin/mvp/canonization.",
            "Verify sandbox illustration banner at top ('cooperative canon starts at zero at beta').",
            "Run canonizeYear for 2025 (sandbox seed year).",
            "Verify per-Member canonization rows created, tier locked to year-end rarity.",
            "Verify TradingCard renders per row on /profile/canon.",
            "Verify audit canonization.frozen fired per row with tier + ovr captured.",
            "Add a caption to one canonization — verify canonization.caption_updated audit.",
          ]}
        />

        <StressTest
          num={10}
          title="Quarterly access review cadence"
          steps={[
            "Visit /admin/access-review.",
            "Verify cadence status renders (Overdue vs. Within cadence based on last review).",
            "Walk through the admin list, revoke a non-self admin with 10-char+ reason.",
            "Verify user.admin_flag_changed audit with before/after.",
            "Record review completion with a summary.",
            "Verify config.access_reviewed audit with roster snapshot in after.",
            "Verify cadence status flips to Within cadence.",
          ]}
        />

        <StressTest
          num={11}
          title="Invite issuance + revocation"
          steps={[
            "Visit /admin/members/invite.",
            "Generate an invite for a target email + tier.",
            "Verify redemption URL displays for copy (sandbox).",
            "Verify audit user.invited with expiresAt + targetTier in after.",
            "Revoke the invite with a reason.",
            "Verify status flips to Revoked + audit user.invite_revoked.",
            "Verify a consumed invite cannot be revoked (guard in action).",
          ]}
        />

        <StressTest
          num={12}
          title="Compliance dashboard evidence traversal"
          steps={[
            "Visit /admin/compliance.",
            "Click through each control href — verify each lands on a real surface (not 404).",
            "Verify SOC 2 CC5.2 hrefs to something in the auth-stub area (or membership management).",
            "Verify CC5.3 hrefs to /admin/access-review.",
            "Verify CC7.2 + A.12.4 href to /admin/audit-log.",
            "Verify CC1.1 hrefs to /policies/covenant.",
            "Verify P1.1 hrefs to /policies/privacy.",
            "Verify P5.1 hrefs to /profile/data-rights.",
            "Verify A.15.1 hrefs to /policies/subprocessors.",
          ]}
        />
      </Section>

      {/* Wrap */}
      <div className="mt-12 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-4">
        <p className="text-[11px] uppercase tracking-wider text-ink-muted">
          How to use this
        </p>
        <p className="mt-2 text-sm text-ink-muted">
          Walk each section top-to-bottom, click every link, run every
          stress test. Anything that renders wrong, misroutes, doesn&apos;t
          fire an audit entry, or drifts from the expected behavior is
          a bug — capture it with the surface path and the audit-log
          filter that should have caught it. Ideal cadence: full pass
          before each beta invite batch, spot pass weekly.
        </p>
      </div>
    </div>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-12 scroll-mt-8">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Subhead({ title }: { title: string }) {
  return (
    <h3 className="mt-6 text-xs uppercase tracking-wider text-brand-magenta">
      {title}
    </h3>
  );
}

function Checklist({
  items,
}: {
  items: { label: string; body: string }[];
}) {
  return (
    <ul className="mt-3 space-y-2">
      {items.map((item, i) => (
        <li
          key={i}
          className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-4 py-3"
        >
          <div className="flex items-start gap-2">
            <input
              type="checkbox"
              className="mt-1 accent-brand-magenta"
              aria-label={`Verified: ${item.label}`}
            />
            <div>
              <div className="text-sm font-medium text-ink">
                {item.label}
              </div>
              <p className="mt-0.5 text-xs text-ink-muted">{item.body}</p>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function StressTest({
  num,
  title,
  steps,
}: {
  num: number;
  title: string;
  steps: string[];
}) {
  return (
    <Card className="mt-4">
      <CardEyebrow>Stress test {num}</CardEyebrow>
      <CardTitle className="mt-1 text-lg">{title}</CardTitle>
      <ol className="mt-3 list-decimal space-y-1.5 pl-5 text-sm text-ink-muted">
        {steps.map((step, i) => (
          <li key={i}>{step}</li>
        ))}
      </ol>
    </Card>
  );
}
