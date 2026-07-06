/**
 * /admin/walkthrough — Jamar's personal step-by-step guided tour.
 *
 * Structure: each tier has a "View as ..." button that flips the
 * session via viewAsUser action, then a numbered sequence of prompts
 * ("Now click here — does X happen?") that walk Jamar through every
 * surface at that tier while telling him what to look for. Return to
 * admin at any point via the persistent return affordance the
 * auth-stub layout renders when a view-as session is active.
 *
 * Distinct from a QA checklist: this prompts action + observation, not
 * verification-by-eyeball. Follow the steps top-to-bottom to hit every
 * surface once as every tier.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-stub";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { viewAsUser } from "@/lib/auth-actions";
import { publicName } from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

interface Step {
  action: string;
  observe: string;
  href?: string;
}

interface TourSection {
  id: string;
  eyebrow: string;
  title: string;
  intro: string;
  viewAsTarget: string; // "viewer" or a user id
  viewAsLabel: string;
  steps: Step[];
}

const SECTIONS_TOC = [
  { id: "landing-copy", label: "Landing / copy audit (Bayu)" },
  { id: "viewer", label: "Tour as Viewer" },
  { id: "prospect", label: "Tour as Prospect" },
  { id: "partner", label: "Tour as Partner" },
  { id: "member", label: "Tour as Member" },
  { id: "admin", label: "Tour as Admin (your own session)" },
  { id: "stress-tests", label: "Cross-cutting stress tests" },
];

export default async function WalkthroughPage() {
  await requireAdmin();

  // Pick sandbox users for each tier at render time so the buttons
  // route to something that exists. Falls back to first-of-tier if
  // named picks aren't in the store.
  const findFirst = (
    predicate: (u: (typeof MOCK_USERS)[number]) => boolean,
  ) => MOCK_USERS.find(predicate);

  const prospectUser =
    findFirst((u) => u.membershipTier === "prospect" && !u.isAdmin) ??
    null;
  const partnerUser =
    findFirst(
      (u) => u.membershipTier === "partner" && !u.isAdmin && u.firstName === "Rob",
    ) ??
    findFirst((u) => u.membershipTier === "partner" && !u.isAdmin) ??
    null;
  const memberUser =
    findFirst(
      (u) => u.membershipTier === "member" && !u.isAdmin && u.firstName === "Sahtyre",
    ) ??
    findFirst((u) => u.membershipTier === "member" && !u.isAdmin) ??
    null;

  const SECTIONS: TourSection[] = [
    {
      id: "viewer",
      eyebrow: "Step 1",
      title: "Tour as Viewer (unauthenticated)",
      intro:
        "You're a stranger who just landed on the site. No account, no context. Everything you see here is what a first-time procurement contact or a curious visitor sees before they know anything about the cooperative.",
      viewAsTarget: "viewer",
      viewAsLabel: "Preview as signed-out Viewer",
      steps: [
        {
          action: "Visit the homepage.",
          observe:
            "Does the copy land the 'cooperative operating system' thesis in 5 seconds? Does the roster preview render Members with TradingCards at the tiers they should be at? Does the hero read distinctive or generic?",
          href: "/",
        },
        {
          action: "Click through to /about.",
          observe:
            "The Venture Labor OS constellation should be visible mid-page. Hover a couple of nodes — do the explainers fire correctly? Do the edges highlight cleanly?",
          href: "/about",
        },
        {
          action: "Open /showcase.",
          observe:
            "Only discovery-eligible Members + recognized Partners should render. Verify Chibu (profilePublic=false) is NOT here. Verify the pillar filter reorders the grid.",
          href: "/showcase",
        },
        {
          action: "Click any Member's card.",
          observe:
            "You land on /u/[handle]. Verify the TradingCard hero renders. Verify booking form only appears if their EPK is published. Verify no admin-only signal leaks (no reason text on any penalty count, no full name if the tier is public-anonymous).",
        },
        {
          action: "Visit /whitelist.",
          observe:
            "Constellation renders above the 'three paths in' section. Copy should reflect access-is-not-for-sale posture. Three tiers visible; consultation offer visible.",
          href: "/whitelist",
        },
        {
          action: "Visit /trust.",
          observe:
            "Procurement-facing security summary. Six pillars visible. Attestation posture card at top. Cross-links to /policies + /profile/data-rights + /admin/compliance callouts.",
          href: "/trust",
        },
        {
          action: "Visit /governance.",
          observe:
            "Constellation at top. Nine explainer sections. Each cross-links to a formal policy or admin surface. Version + last-reviewed at bottom.",
          href: "/governance",
        },
        {
          action: "Try to hit /admin.",
          observe:
            "Should redirect to /signin or return an access-required page. Same for /profile, /notifications, /calendar, /activity, /team, /wallet. If any of these render for Viewer, that's a bug.",
          href: "/admin",
        },
      ],
    },

    {
      id: "prospect",
      eyebrow: "Step 2",
      title: "Tour as Prospect",
      intro: prospectUser
        ? `You're ${publicName(prospectUser)}, a Prospect-tier user. Signed up but not yet Partner or Member. Walk their surfaces — what unlocks vs. what's still gated.`
        : "You're a Prospect-tier user. Sandbox doesn't have one seeded — sign up as a fresh user or promote a Viewer to Prospect first.",
      viewAsTarget: prospectUser?.id ?? "",
      viewAsLabel: prospectUser
        ? `View as ${publicName(prospectUser)} (Prospect)`
        : "No Prospect seeded — skip or seed one",
      steps: [
        {
          action: "Go to /profile.",
          observe:
            "Own profile visible. Tier-2 Data Participation toggle should be present. Data rights card links to /profile/data-rights.",
          href: "/profile",
        },
        {
          action: "Try /team.",
          observe:
            "Member-only gate. You should see a copy explanation, not the directory. If the grid renders, that's a visibility-matrix bug.",
          href: "/team",
        },
        {
          action: "Try /calendar.",
          observe:
            "Member-only gate. Should not see shared availability.",
          href: "/calendar",
        },
        {
          action: "Try /activity.",
          observe:
            "Member-only gate. Should not see the cooperative event timeline.",
          href: "/activity",
        },
        {
          action: "Open /notifications.",
          observe:
            "Inbox surface. Should render but likely empty for a fresh Prospect. Mark-all-read button hides when unread count is 0.",
          href: "/notifications",
        },
        {
          action: "Visit /profile/data-rights.",
          observe:
            "Export + erasure forms visible. Submit an export request — verify audit entry fires in /admin/audit-log (return to admin first to check).",
          href: "/profile/data-rights",
        },
      ],
    },

    {
      id: "partner",
      eyebrow: "Step 3",
      title: "Tour as Partner",
      intro: partnerUser
        ? `You're ${publicName(partnerUser)}, a Partner-tier counterparty. Structurally present, discovery-hidden by default. Walk the limited-mode surfaces.`
        : "You're a Partner-tier user. No Partner seeded in sandbox.",
      viewAsTarget: partnerUser?.id ?? "",
      viewAsLabel: partnerUser
        ? `View as ${publicName(partnerUser)} (Partner)`
        : "No Partner seeded",
      steps: [
        {
          action: "Go to /profile.",
          observe:
            "Partner-mode profile. profilePublic toggle should be present. If they have an EPK, it should be partner-limited-mode (reduced scope).",
          href: "/profile",
        },
        {
          action: "Check /u/[your handle].",
          observe: partnerUser
            ? `Visit /u/${partnerUser.handle}. Your public profile as a Partner. If profilePublic=false, verify robots:noindex meta. If you hold a recognition, the discovery unlock should apply.`
            : "N/A — no Partner seeded.",
          href: partnerUser ? `/u/${partnerUser.handle}` : undefined,
        },
        {
          action: "Try /team.",
          observe: "Member-only. Should show the gate copy, not the directory.",
          href: "/team",
        },
        {
          action: "Try DMing a Member from /u/[member].",
          observe:
            "Per tier-access matrix, Partner → Member DM is not initiated by Partner. If the compose surface renders and accepts the send, that's a matrix bug.",
        },
        {
          action: "Visit /profile/data-rights.",
          observe:
            "Same self-service export + erasure as Prospect + Member. Verify accessible.",
          href: "/profile/data-rights",
        },
      ],
    },

    {
      id: "member",
      eyebrow: "Step 4",
      title: "Tour as Member",
      intro: memberUser
        ? `You're ${publicName(memberUser)}, a Member. Full cooperative-internal access. Walk every surface a Member sees.`
        : "You're a Member. No Member seeded — pick one from the members list.",
      viewAsTarget: memberUser?.id ?? "",
      viewAsLabel: memberUser
        ? `View as ${publicName(memberUser)} (Member)`
        : "No Member seeded",
      steps: [
        {
          action: "Go to /profile.",
          observe:
            "Own MvpCard renders with full OVR + band. Provisional Members see the ProvisionalCard variant instead — verify. Data rights card visible. Canonization card if applicable.",
          href: "/profile",
        },
        {
          action: "Open /profile/canon.",
          observe:
            "Personal canon view — in-progress current year projection + past cards + phygital request stub + recognition history.",
          href: "/profile/canon",
        },
        {
          action: "Open /profile/calendar.",
          observe:
            "Personal calendar — availability manager, blocks list, peer meeting form, minutes capture form (notes / recording / transcript_upload).",
          href: "/profile/calendar",
        },
        {
          action: "Visit /team.",
          observe:
            "Member directory renders. Pillar filter reorders. TradingCard grid at their rarity tier.",
          href: "/team",
        },
        {
          action: "Visit /calendar.",
          observe:
            "Shared cooperative calendar. Availability windows per Member. Upcoming meetings list.",
          href: "/calendar",
        },
        {
          action: "Visit /activity.",
          observe:
            "Cooperative event timeline. Sandbox-illustration banner at top. Reverse-chron. Verify recognition/canonization/milestone/EPK/bonus events render.",
          href: "/activity",
        },
        {
          action: "Open /notifications.",
          observe:
            "Full inbox. Verify past notifications appear with correct KIND_ACCENT colors per NotificationKind.",
          href: "/notifications",
        },
        {
          action: "Visit /u/[your handle].",
          observe: memberUser
            ? `Visit /u/${memberUser.handle}. TradingCard hero at your rarity tier. Recognition banner if held. Canonization row for prior years. Booking form if EPK published.`
            : "N/A",
          href: memberUser ? `/u/${memberUser.handle}` : undefined,
        },
        {
          action: "Try DMing another Member.",
          observe:
            "Member↔Member is fully unlocked. Compose form renders. Send lands in their /notifications.",
        },
        {
          action: "Visit /profile/data-rights.",
          observe: "Same export + erasure as other tiers.",
          href: "/profile/data-rights",
        },
      ],
    },

    {
      id: "admin",
      eyebrow: "Step 5",
      title: "Tour as Admin (your own session — return first)",
      intro:
        "Return to your admin session. This is the ops console you own daily. Walk every admin surface and observe that the action interfaces work + write audit entries.",
      viewAsTarget: "",
      viewAsLabel: "Already in admin session (return if needed)",
      steps: [
        {
          action: "Visit /admin.",
          observe:
            "Landing tiles with quick counts. Verify Inbound / MVP / Members / Applications / RFP intake / Quotes / Portfolios / Contracts / Tokens / Marketplace / Whitelist / Team / Feedback / Testimonials / Compliance / Audit log / Access review / Walkthrough all present.",
          href: "/admin",
        },
        {
          action: "Open /admin/inbound.",
          observe:
            "Unified triage queue. RFPs, chats, signups, quotes, partner apps, booking requests all rendered. Booking-request rows should have the approve/decline card block.",
          href: "/admin/inbound",
        },
        {
          action: "Open /admin/members.",
          observe:
            "List with view switcher (all / by pillar / by tier / admins / sellers / prospect). Quick-links at top: Invite new member, Access review, User audit log.",
          href: "/admin/members",
        },
        {
          action: "Click 'Manage →' on any member row.",
          observe:
            "Drill-down at /admin/members/[id]. Signal summary (MVP OVR + projects + BUILD balance + recognition), access controls (tier + visibility + admin flag + suspension), audit trail scoped to this user.",
        },
        {
          action: "Visit /admin/members/invite.",
          observe:
            "Form to generate invite. Recent invites list with status chips (Live / Consumed / Revoked / Expired). Live invites show copy-me redemption URL.",
          href: "/admin/members/invite",
        },
        {
          action: "Visit /admin/access-review.",
          observe:
            "Cadence status at top (Overdue vs Within cadence based on last-review-date). Admin list. Prior reviews + prior revocations rendered.",
          href: "/admin/access-review",
        },
        {
          action: "Visit /admin/mvp/canonization.",
          observe:
            "Sandbox illustration banner. Per-card caption edit form. Run canonization form.",
          href: "/admin/mvp/canonization",
        },
        {
          action: "Visit /admin/mvp/recognition.",
          observe:
            "Selection form with grouped optgroups (Members / Partners). Co-brand policy reminder card for Partners.",
          href: "/admin/mvp/recognition",
        },
        {
          action: "Visit /admin/compliance.",
          observe:
            "26 SOC 2 + ISO 27001 controls. Every satisfied/partial row has clickable evidence href. Attestation posture card at bottom.",
          href: "/admin/compliance",
        },
        {
          action: "Visit /admin/audit-log.",
          observe:
            "Reverse-chron viewer. Filter dropdowns (actor / action / resource). All the actions you took during this walkthrough should be visible here. Verify before/after JSON renders correctly.",
          href: "/admin/audit-log",
        },
      ],
    },
  ];

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <CardEyebrow>Admin</CardEyebrow>
      <h1 className="mt-2 font-display text-4xl font-semibold">
        Your walkthrough
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">
        Flip into each tier via View-as, follow the numbered prompts,
        note what breaks. Return to admin via the persistent &ldquo;Return
        to your admin account&rdquo; affordance in the nav.
      </p>

      {/* TOC */}
      <nav className="mt-6 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-4">
        <p className="text-[11px] uppercase tracking-wider text-ink-muted">
          Tour sections
        </p>
        <ol className="mt-2 space-y-1 text-sm">
          {SECTIONS_TOC.map((s, idx) => (
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

      {/* Landing / copy audit */}
      <section id="landing-copy" className="mt-12 scroll-mt-8">
        <h2 className="font-display text-2xl font-semibold">
          Landing / copy audit (Bayu&apos;s pass)
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          Copy carries the design at this stage. If the thesis lands in
          words, the visual pass has something to serve.
        </p>
        <div className="mt-4 space-y-2">
          {[
            {
              label: "Thesis integrity",
              body: `Does the landing copy carry "evolve past scarcity" / Venture Labor / cooperative-owned infrastructure — or does it collapse into "modern creator platform"?`,
            },
            {
              label: "Distinctive vocabulary",
              body: `"Cooperative," "Venture Labor," "Champion's Court," "canonization," "Constellation" — locked FM vocabulary present, or has AI drafting flattened it?`,
            },
            {
              label: "First-name-first",
              body: "Any names in copy or CTAs — first name only. Full names surface admin-side only.",
            },
            {
              label: "Cooperative vs. platform framing",
              body: `Reads as "cooperative you're joining" not "platform you're using." Check pronouns and verbs.`,
            },
            {
              label: "Not-a-marketplace framing",
              body: "Copy should not read as Upwork / Contra / Braintrust adjacencies. Inverse-marketplace posture (RFPs to talent) is the differentiator.",
            },
            {
              label: "Bayu's icon set",
              body: "Icons distinctive vs. generic Feather / Lucide default. Cool unique elements should carry the identity.",
            },
            {
              label: "Trust hand-off",
              body: "Landing should link to /trust for procurement-oriented visitors. Cooperative + compliance stance is a wedge, not a footnote.",
            },
          ].map((item, i) => (
            <div
              key={i}
              className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-4 py-3"
            >
              <div className="text-sm font-medium text-ink">{item.label}</div>
              <p className="mt-1 text-xs text-ink-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Tour sections */}
      {SECTIONS.map((section) => (
        <TourSection key={section.id} section={section} />
      ))}

      {/* Cross-cutting stress tests */}
      <section id="stress-tests" className="mt-16 scroll-mt-8">
        <h2 className="font-display text-2xl font-semibold">
          Cross-cutting stress tests
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          After the tier tours, walk these end-to-end paths. Each is a
          numbered sequence — no tier flip needed unless noted.
        </p>

        <StressTest
          num={1}
          title="Visibility matrix — Partner hidden by default"
          steps={[
            "View-as a Partner. Toggle their profilePublic to false.",
            "Return to admin, then preview as signed-out Viewer.",
            "/showcase should NOT list the Partner.",
            "Direct URL /u/[handle] still resolves; 'View page source' shows robots:noindex meta.",
            "Return to admin. Grant Future Modernist recognition to that Partner.",
            "Preview as Viewer again — Partner should now appear on /showcase.",
            "Audit: user.profile_public_toggled + recognition.selected.",
          ]}
        />

        <StressTest
          num={2}
          title="Compliance penalty ladder"
          steps={[
            "As admin, apply a compliance penalty to a Member (10-char+ reason).",
            "Their MvpCard OVR should drop by 9.",
            "Visit /u/[handle] — peer view shows penalty count only, no reason text.",
            "Stack two more penalties inside 90 days. Member should shift band toward Probation.",
            "Verify /admin/audit-log shows 3× mvp.compliance_penalty_applied with each reason preserved.",
          ]}
        />

        <StressTest
          num={3}
          title="Suspension"
          steps={[
            "As admin, suspend a non-admin Member (10-char+ reason).",
            "/admin/members/[id] shows the suspended banner + reactivation form.",
            "Reactivate with an optional note.",
            "Audit: user.suspended + user.reactivated with before/after snapshots.",
          ]}
        />

        <StressTest
          num={4}
          title="Data rights"
          steps={[
            "View-as a Member. Visit /profile/data-rights.",
            "Submit export request. Return to admin, check /admin/audit-log filtered by data.subject_export_requested.",
            "Submit erasure request. Confirmation gate should block if 'ERASE MY ACCOUNT' isn't typed exactly.",
            "Verify /notifications shows admin-pool notification.",
          ]}
        />

        <StressTest
          num={5}
          title="Bonus release settle"
          steps={[
            "As admin, visit /admin/contracts/p_004/settle.",
            "Set PM engagement rating.",
            "Execute bonus decision — verify release-vs-reclaim math.",
            "Verify /admin/audit-log shows contract.bonus_released (or _reclaimed) with the gate explanation captured in reason.",
          ]}
        />

        <StressTest
          num={6}
          title="EPK booking flow (three-step)"
          steps={[
            "Preview as Viewer. Visit /u/[member with published EPK].",
            "Submit a booking request with a real brief.",
            "Return to admin. /admin/inbound shows the booking_request row.",
            "Approve — audit fires booking.request_approved.",
            "View-as the artist. /profile/calendar shows the pending meeting. Confirm it.",
            "Audit fires booking.confirmed. Notifications fire at every transition.",
          ]}
        />

        <StressTest
          num={7}
          title="Quarterly access review"
          steps={[
            "Visit /admin/access-review.",
            "Cadence status renders (Overdue if no prior review).",
            "Revoke a non-self admin flag with 10-char+ reason.",
            "Record review completion with a summary.",
            "Cadence flips to Within cadence.",
            "Audit: user.admin_flag_changed + config.access_reviewed.",
          ]}
        />

        <StressTest
          num={8}
          title="Compliance dashboard evidence traversal"
          steps={[
            "Visit /admin/compliance.",
            "Click every control's evidence href — all should land on a real surface.",
            "Verify CC5.2 → auth-stub / access control area, CC5.3 → /admin/access-review, CC7.2 + A.12.4 → /admin/audit-log, CC1.1 → /policies/covenant, P1.1 → /policies/privacy, P5.1 → /profile/data-rights, A.15.1 → /policies/subprocessors.",
          ]}
        />
      </section>

      <div className="mt-12 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-4">
        <p className="text-[11px] uppercase tracking-wider text-ink-muted">
          Cadence
        </p>
        <p className="mt-2 text-sm text-ink-muted">
          Full walkthrough before each beta batch. Spot pass weekly.
          Copy audit whenever landing copy changes. Capture the surface
          path + expected audit filter for anything that misroutes.
        </p>
      </div>
    </div>
  );
}

function TourSection({ section }: { section: TourSection }) {
  return (
    <section id={section.id} className="mt-14 scroll-mt-8">
      <Card>
        <CardEyebrow>{section.eyebrow}</CardEyebrow>
        <CardTitle className="mt-2 text-2xl">{section.title}</CardTitle>
        <p className="mt-3 text-sm text-ink-muted">{section.intro}</p>

        {section.viewAsTarget && (
          <form action={viewAsUser} className="mt-4">
            <input type="hidden" name="target" value={section.viewAsTarget} />
            <button
              type="submit"
              className="rounded-full bg-brand-magenta px-5 py-2 text-sm text-white hover:opacity-90"
            >
              {section.viewAsLabel} →
            </button>
            <p className="mt-2 text-[11px] text-ink-faint">
              Session flips to this tier. Use the &ldquo;Return to your
              admin account&rdquo; affordance to come back before the
              next section.
            </p>
          </form>
        )}
      </Card>

      <ol className="mt-4 space-y-2">
        {section.steps.map((step, i) => (
          <li
            key={i}
            className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-4 py-3"
          >
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-brand-magenta/40 text-[11px] font-medium text-brand-magenta">
                {i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-ink">
                  {step.action}
                  {step.href && (
                    <Link
                      href={step.href}
                      className="ml-2 text-xs text-brand-magenta hover:underline"
                    >
                      Open {step.href} →
                    </Link>
                  )}
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  <span className="font-medium text-ink-muted">Look for: </span>
                  {step.observe}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
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
