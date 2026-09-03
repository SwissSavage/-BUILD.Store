/**
 * /activity — cooperative-internal event timeline.
 *
 * Chronological narrative of what's landed across the cooperative:
 * recognitions selected, canonizations run, milestone completions,
 * EPK publications, bonus decisions, MVP compliance penalties, new
 * Members joining. Auth-gated to Members (and admins) — this is
 * cooperative-internal transparency, not a public feed.
 *
 * Sandbox reads from the mock stores. Production replaces with a
 * unified event log written transactionally alongside each domain
 * action (or a materialized view over the domain tables).
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { memberLabel } from "@/lib/member-label";
import { getAllUsers } from "@/lib/readers/users";
import { getAllProjects } from "@/lib/readers/projects";
import {
  canonizationReader,
  epkReader,
  milestoneReader,
  penaltyReader,
  recognitionReader,
  safely,
} from "@/lib/readers";
import { TIER_LABELS, publicName, type User } from "@/lib/types";
import {
  activeRecognitionUserIds,
  publicProfileEligible,
} from "@/lib/profile-visibility";
import {
  TradingCard,
  type TradingCardTier,
  deriveTradingCardTier,
} from "@/components/TradingCard";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

type ActivityKind =
  | "recognition"
  | "canonization"
  | "milestone_completed"
  | "epk_published"
  | "bonus_decision"
  | "mvp_penalty"
  | "new_member";

interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  /** Present on join events — the feed renders the person's card. */
  member?: User;
  memberTier?: TradingCardTier;
  timestamp: string;
  userId: string | null;
  title: string;
  body: string;
  href: string | null;
  accent: string;
}

const KIND_LABEL: Record<ActivityKind, string> = {
  recognition: "Recognition",
  canonization: "Canonization",
  milestone_completed: "Milestone completed",
  epk_published: "EPK published",
  bonus_decision: "Bonus decision",
  mvp_penalty: "Compliance penalty",
  new_member: "New Member",
};

/**
 * Build the activity feed from live rows.
 *
 * Reader swap 2026-08-29: this walked six MOCK_ arrays, so the feed
 * showed seed history and nothing a real member did.
 *
 * Loads every source in parallel up front rather than querying inside
 * the per-event loops, which would have been one round trip per row.
 */
async function collectEvents(): Promise<ActivityEvent[]> {
  const events: ActivityEvent[] = [];

  const [
    { users: roster },
    { projects: allProjects },
    recognitions,
    canonizations,
    epks,
    milestones,
    penalties,
    recognizedIds,
  ] = await Promise.all([
    safely(() => getAllUsers(), { users: [], source: "postgres" as const }),
    safely(() => getAllProjects(), {
      projects: [],
      source: "postgres" as const,
    }),
    safely(() => recognitionReader.all(), []),
    safely(() => canonizationReader.all(), []),
    safely(() => epkReader.all(), []),
    safely(() => milestoneReader.all(), []),
    safely(() => penaltyReader.all(), []),
    safely(() => activeRecognitionUserIds(), new Set<string>()),
  ]);

  // Recognitions.
  for (const r of recognitions) {
    const target = roster.find((u) => u.id === r.userId);
    if (!target) continue;
    events.push({
      id: `evt_rec_${r.id}`,
      kind: "recognition",
      timestamp: r.selectedAt,
      userId: r.userId,
      title:
        r.periodKind === "year"
          ? `Constellation of ${r.periodLabel}: ${publicName(target)}`
          : `Future Modernist of ${r.periodLabel}: ${publicName(target)}`,
      body: r.narrative.slice(0, 220) + (r.narrative.length > 220 ? "…" : ""),
      href: `/u/${target.handle}`,
      accent: "#D828A0",
    });
  }

  // Canonizations.
  for (const c of canonizations) {
    const target = roster.find((u) => u.id === c.userId);
    if (!target) continue;
    events.push({
      id: `evt_canon_${c.id}`,
      kind: "canonization",
      timestamp: c.frozenAt,
      userId: c.userId,
      title: `${c.year} canon frozen — ${publicName(target)} (${c.tier})`,
      body:
        c.caption ??
        `Year-end standing locked into a permanent canon card. Production mint cycle attaches the ERC-721 + ERC-6551 TBA.`,
      href: `/u/${target.handle}`,
      accent: "#D4AF37",
    });
  }

  // Milestone completions.
  for (const m of milestones) {
    if (m.status !== "completed" || !m.completedAt) continue;
    const owner = roster.find((u) => u.id === m.ownerUserId);
    const project = allProjects.find((p) => p.id === m.projectId);
    events.push({
      id: `evt_ms_${m.id}`,
      kind: "milestone_completed",
      timestamp: m.completedAt,
      userId: m.ownerUserId,
      title: `Milestone completed: ${m.title}`,
      body: `${project ? `${project.title} — ` : ""}${owner ? `${publicName(owner)} shipped step ${m.sequence / 10}.` : ""}`,
      href: project ? `/projects/${project.id}` : null,
      accent: "#007048",
    });
  }

  // EPK publications.
  for (const epk of epks) {
    if (epk.status !== "published" || !epk.publishedAt) continue;
    const target = roster.find((u) => u.id === epk.userId);
    if (!target) continue;
    events.push({
      id: `evt_epk_${epk.userId}`,
      kind: "epk_published",
      timestamp: epk.publishedAt,
      userId: epk.userId,
      title: `EPK published: ${publicName(target)}`,
      body:
        epk.tagline ??
        "Electronic Press Kit is live on their public profile.",
      href: `/u/${target.handle}`,
      accent: "#5070F0",
    });
  }

  // Bonus decisions.
  for (const p of allProjects) {
    if (!p.bonusDecidedAt) continue;
    if (p.bonusDecision !== "released" && p.bonusDecision !== "reclaimed") {
      continue;
    }
    events.push({
      id: `evt_bonus_${p.id}`,
      kind: "bonus_decision",
      timestamp: p.bonusDecidedAt,
      userId: null,
      title:
        p.bonusDecision === "released"
          ? `Bonus released: ${p.title}`
          : `Bonus reclaimed: ${p.title}`,
      body:
        p.bonusDecision === "released"
          ? `$${Number(p.talentBonusAmount ?? 0).toLocaleString()} bonus released to talent (gate cleared).`
          : `$${Number(p.talentBonusAmount ?? 0).toLocaleString()} bonus reclaimed to engagement recovery pool (gate did not clear).`,
      href: `/admin/contracts/${p.id}/settle`,
      accent: p.bonusDecision === "released" ? "#007048" : "#D828A0",
    });
  }

  // Compliance penalties.
  for (const pen of penalties) {
    const target = roster.find((u) => u.id === pen.userId);
    if (!target) continue;
    events.push({
      id: `evt_pen_${pen.id}`,
      kind: "mvp_penalty",
      timestamp: pen.appliedAt,
      userId: pen.userId,
      title: `MVP compliance penalty: ${publicName(target)}`,
      body: `${pen.ovrImpact} OVR for 90 days. Reason: ${pen.reason.slice(0, 200)}${pen.reason.length > 200 ? "…" : ""}`,
      href: `/admin/mvp/${pen.userId}`,
      accent: "#D828A0",
    });
  }

  // Joins.
  //
  // This filtered on membershipTier === "member" and nothing else, so
  // it showed no joins at all in practice: a cold magic-link signup
  // lands as `viewer` (auth.ts createUser), and only completing an
  // invite grants member or partner. Partners were excluded outright
  // even after being admitted.
  //
  // Now both admitted tiers appear, run through the discovery gate in
  // profile-visibility.ts — the matrix locked in future-modern.md.
  // Members always; Partners only inside an active recognition
  // window; anyone opted out of `profilePublic`, never. That gate is
  // what keeps this feed from becoming a directory someone can work
  // through to reach talent directly.
  for (const u of roster) {
    if (u.membershipTier === "viewer") continue;
    if (!publicProfileEligible(u, recognizedIds)) continue;
    events.push({
      id: `evt_new_${u.id}`,
      kind: "new_member",
      timestamp: u.createdAt,
      userId: u.id,
      title: `${publicName(u)} joined as ${TIER_LABELS[u.membershipTier]}`,
      body: memberLabel(u)
        ? `${memberLabel(u)}. See profile for portfolio + standing.`
        : "Member joined the cooperative.",
      href: `/u/${u.handle}`,
      accent: "#5070F0",
      member: u,
      memberTier: deriveTradingCardTier({
        ovr: null,
        isProvisional: true,
        isInChampionsCourt: false,
        membershipTier: u.membershipTier,
      }),
    });
  }

  return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

function groupByDay(events: ActivityEvent[]): Record<string, ActivityEvent[]> {
  const groups: Record<string, ActivityEvent[]> = {};
  for (const e of events) {
    const day = new Date(e.timestamp).toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    groups[day] = groups[day] ?? [];
    groups[day].push(e);
  }
  return groups;
}

export default async function ActivityPage() {
  const viewer = await getCurrentUser();
  if (!viewer) redirect("/signin?next=/activity");
  if (viewer.membershipTier !== "member" && !viewer.isAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <h1 className="font-display text-3xl font-semibold">
          Members-only surface
        </h1>
        <p className="mt-3 text-sm text-ink-muted">
          The cooperative activity feed is Member-tier. See{" "}
          <Link href="/portfolio" className="text-brand-magentaText hover:underline">
            /showcase
          </Link>{" "}
          for public work.
        </p>
      </div>
    );
  }

  const events = await collectEvents();
  const groups = groupByDay(events);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-display text-4xl font-semibold">
        Cooperative activity
      </h1>
      <p className="mt-2 max-w-2xl text-ink-muted">
        What&apos;s landed across the cooperative — recognitions,
        canonizations, milestone completions, EPK publications, bonus
        decisions, compliance penalties, new Members. Reverse-
        chronological, cooperative-internal.
      </p>

      {/* Sandbox illustration banner — same integrity posture as
          /admin/mvp/canonization. Prior-to-launch seeds demonstrate
          the surfaces; cooperative canon starts at zero at beta. */}
      <div
        className="mt-6 rounded-2xl border px-5 py-4"
        style={{
          borderColor: "rgba(80, 112, 240, 0.35)",
          backgroundColor: "rgba(80, 112, 240, 0.06)",
        }}
      >
        <p
          className="text-[11px] uppercase tracking-wider"
          style={{ color: "var(--fm-blue-text)" }}
        >
          Sandbox illustration
        </p>
        <p className="mt-1 text-sm text-ink">
          Events below are illustrative — they render because pre-launch
          mock data is seeded so surfaces have something to display. At
          beta, cooperative canon starts at zero; only actions actually
          taken by Members and admins post-launch land on this feed.
        </p>
      </div>

      {events.length === 0 ? (
        <Card className="mt-8">
          <p className="text-sm text-ink-muted">
            Nothing has landed yet in the cooperative timeline. Once
            recognitions get selected, canon runs, milestones complete,
            or contracts settle, they&apos;ll surface here.
          </p>
        </Card>
      ) : (
        Object.entries(groups).map(([day, dayEvents]) => (
          <section key={day} className="mt-10">
            <h2 className="font-display text-lg font-semibold text-brand-magentaText">
              {day}
            </h2>
            <ol className="mt-3 space-y-3">
              {dayEvents.map((e) => (
                <li key={e.id}>
                  <Card>
                    <div className="flex gap-4">
                      {/* Join events lead with the person's card — the
                          card is the profile, so this is the way in.
                          Only rendered for people the discovery gate
                          already cleared. */}
                      {e.member && e.memberTier && (
                        <TradingCard
                          user={e.member}
                          tier={e.memberTier}
                          href={e.href ?? undefined}
                          className="hidden w-[110px] shrink-0 sm:block"
                          aspectRatio="3/4"
                        >
                          <div className="flex h-full flex-col justify-end">
                            {memberLabel(e.member) && (
                              <p className="text-[8px] uppercase tracking-wider text-white/60">
                                {memberLabel(e.member)}
                              </p>
                            )}
                          </div>
                        </TradingCard>
                      )}
                      <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <CardEyebrow>{KIND_LABEL[e.kind]}</CardEyebrow>
                      <span className="text-[11px] text-ink-faint">
                        {new Date(e.timestamp).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <CardTitle className="mt-1 text-lg">
                      <span
                        className="mr-2 inline-block h-2 w-2 rounded-full align-middle"
                        style={{ backgroundColor: e.accent }}
                        aria-hidden
                      />
                      {e.title}
                    </CardTitle>
                    <p className="mt-2 text-sm text-ink-muted">{e.body}</p>
                    {e.href && (
                      <Link
                        href={e.href}
                        className="mt-2 inline-block text-xs text-brand-magentaText hover:underline"
                      >
                        Open →
                      </Link>
                    )}
                      </div>
                    </div>
                  </Card>
                </li>
              ))}
            </ol>
          </section>
        ))
      )}
    </div>
  );
}
