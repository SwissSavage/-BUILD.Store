/**
 * /admin/rfps/[id]/dispatch — one-click quote-request dispatch to
 * matched talent (task #36).
 *
 * Kills the manual "scroll the Google form → copy-paste RFP into
 * emails" workflow. Admin picks a mix from the fair-shake matcher,
 * hits Dispatch, and each selected talent gets a notification with
 * the RFP link + a direct route to the bid form.
 *
 * The fair-shake mix (fairMixTalentForRfp) intentionally rotates
 * newer talent + shuffles by alphabet-fairness so the same heavy
 * hitters don't get every RFP — per Jamar's "not just top
 * performers, everyone gets a fair shake" call.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth-stub";
import { db } from "@/db/client";
import { projects } from "@/db/schema";
import { getAllProjects } from "@/lib/readers/projects";
import { safely } from "@/lib/readers";
import { getAllUsers } from "@/lib/readers/users";
import { fairMixTalentForRfp } from "@/lib/talent-match";
import {
  dispatchRfpQuoteRequests,
  inviteExternalTalentForRfp,
} from "@/lib/rfp-dispatch-actions";
import {
  INDUSTRY_LABELS,
  publicName,
  userPillars,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

const BUCKET_LABELS: Record<"top" | "rotation" | "alphabet", string> = {
  top: "Top match",
  rotation: "Fair rotation",
  alphabet: "Alphabet fair",
};

const BUCKET_COLORS: Record<"top" | "rotation" | "alphabet", string> = {
  top: "#007048",
  rotation: "#5070F0",
  alphabet: "#D828A0",
};

interface Params {
  id: string;
}

export const dynamic = "force-dynamic";

export default async function RfpDispatchPage({
  params,
}: {
  params: Promise<Params>;
}) {
  await requireAdmin();
  const { id } = await params;

  // Real project row (RFP flow shipped via Drizzle in task #15).
  const [rfp] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  if (
    !rfp ||
    rfp.kind !== "contract" ||
    !rfp.isRfp ||
    rfp.status !== "open" ||
    !rfp.rfpApprovedAt
  ) {
    notFound();
  }

  // Reader swap 2026-08-29: the fair-mix rotation biased against
  // newer talent using seed engagement counts, so dispatch picked
  // from the wrong pool entirely.
  const [{ projects: allProjects }, { users: roster }] = await Promise.all([
    safely(() => getAllProjects(), {
      projects: [],
      source: "postgres" as const,
    }),
    safely(() => getAllUsers(), { users: [], source: "postgres" as const }),
  ]);
  const userById = new Map(roster.map((u) => [u.id, u]));

  // Rough engagement count per member so the rotation bucket favors
  // talent who have not been placed recently.
  const engagementCounts = new Map<string, number>();
  for (const p of allProjects) {
    for (const uid of p.assignedMemberIds ?? []) {
      engagementCounts.set(uid, (engagementCounts.get(uid) ?? 0) + 1);
    }
  }

  const mix = fairMixTalentForRfp(
    {
      pillars: userPillars({
        primaryIndustry: rfp.industry,
        secondaryIndustries: [],
      } as never),
      keywordTags: rfp.skillsRequired ?? [],
    },
    {
      limit: 8,
      engagementCountByUserId: engagementCounts,
    },
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/admin/rfps"
        className="text-sm text-ink-muted hover:text-ink"
      >
        ← RFP queue
      </Link>

      <div className="mt-3">
        <CardEyebrow>Dispatch</CardEyebrow>
      </div>
      <h1 className="mt-2 font-display text-4xl font-semibold">
        {rfp.title}
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        {INDUSTRY_LABELS[rfp.industry]} · Skills: {" "}
        {(rfp.skillsRequired ?? []).join(", ") || "—"}
      </p>

      <div className="mt-4 flex gap-3 text-xs">
        <Link
          href={`/admin/rfps/${rfp.id}/bids`}
          className="rounded-full border border-brand-magenta/40 px-3 py-1 text-brand-magenta hover:bg-brand-magenta/10"
        >
          View bids received → compile client quote
        </Link>
      </div>

      <Card className="mt-6">
        <CardTitle>Suggested talent — fair-shake mix</CardTitle>
        <p className="mt-2 text-xs text-ink-muted">
          Top match ranks by skill overlap + MVP standing. Fair
          rotation surfaces newer / less-utilized talent. Alphabet
          fair biases away from initials that landed recent
          dispatches. Everyone starts pre-checked; uncheck to exclude.
        </p>

        {mix.length === 0 ? (
          <p className="mt-4 text-sm text-ink-faint">
            No talent matched the RFP's skill tags. Widen the tags on
            the RFP row or add the skill to more member profiles.
          </p>
        ) : (
          <form action={dispatchRfpQuoteRequests} className="mt-4 space-y-2">
            <input type="hidden" name="rfpId" value={rfp.id} />

            <ul className="space-y-2">
              {mix.map((m) => {
                const u = userById.get(m.user.id);
                if (!u) return null;
                return (
                  <li
                    key={u.id}
                    className="flex items-start gap-3 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-3 py-2"
                  >
                    <input
                      type="checkbox"
                      name="targetUserIds"
                      value={u.id}
                      defaultChecked
                      className="mt-1 h-4 w-4"
                    />
                    <div className="flex-1">
                      <div className="flex items-baseline gap-2">
                        <span className="font-medium">
                          {publicName(u)}
                        </span>
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-medium"
                          style={{
                            backgroundColor: `${BUCKET_COLORS[m.bucket]}22`,
                            color: BUCKET_COLORS[m.bucket],
                          }}
                        >
                          {BUCKET_LABELS[m.bucket]}
                        </span>
                      </div>
                      {u.discipline && (
                        <div className="text-[11px] text-ink-muted">
                          {u.discipline}
                        </div>
                      )}
                      <div className="mt-0.5 text-[10px] text-ink-faint">
                        Fit {(m.fitScore * 100).toFixed(0)}% · MVP ×
                        {m.mvpFactor.toFixed(2)}
                        {m.ovr !== null && ` (OVR ${m.ovr})`}
                        {" · "}
                        {engagementCounts.get(u.id) ?? 0} prior
                        engagement{(engagementCounts.get(u.id) ?? 0) === 1 ? "" : "s"}
                      </div>
                      {m.matchedTags.length > 0 && (
                        <div className="mt-1 text-[10px] text-ink-faint">
                          Matched: {m.matchedTags.slice(0, 5).join(", ")}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>

            <button
              type="submit"
              className="rounded-full bg-brand-magenta px-5 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Dispatch quote requests to selected
            </button>
            <p className="text-[11px] text-ink-faint">
              Each selected talent gets a notification with a direct
              link to the /contracts/{rfp.id} bid form. Debounced 24h
              per (talent, RFP) pair so accidental double-clicks
              don't double-ping.
            </p>
          </form>
        )}
      </Card>

      {/* Task #37 — recruit external talent into the bid pool. */}
      <Card className="mt-6">
        <CardTitle>Invite external talent</CardTitle>
        <p className="mt-1 text-xs text-ink-muted">
          Someone outside the roster who'd be perfect for this? Send
          them an invite. They'll join at the tier you pick and can
          submit a bid on /contracts once they've completed intake.
          The RFP context is attached to the invite note for follow-up
          grounding.
        </p>

        <form action={inviteExternalTalentForRfp} className="mt-4 space-y-3">
          <input type="hidden" name="rfpId" value={rfp.id} />

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-ink-muted">
                Email
              </span>
              <input
                name="targetEmail"
                type="email"
                required
                placeholder="name@example.com"
                className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-ink-muted">
                Name (optional)
              </span>
              <input
                name="targetName"
                placeholder="Their name for the invite letter"
                className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-ink-muted">
                Tier
              </span>
              <select
                name="targetTier"
                defaultValue="partner"
                className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                <option value="partner">Partner (default)</option>
                <option value="member">Member (proven contributor)</option>
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] uppercase tracking-wider text-ink-muted">
                Why (private note)
              </span>
              <input
                name="inviteReason"
                placeholder="e.g. Rob's referral, needed for X skill"
                className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </label>
          </div>

          <button
            type="submit"
            className="rounded-full border border-brand-magenta px-5 py-2 text-sm font-medium text-brand-magenta hover:bg-brand-magenta hover:text-white"
          >
            Generate invite for external talent
          </button>
          <p className="text-[11px] text-ink-faint">
            Grab the invite URL from{" "}
            <Link
              href="/admin/members/invite"
              className="text-brand-magenta hover:underline"
            >
              /admin/members/invite
            </Link>
            {" "}and send it however you normally reach them.
          </p>
        </form>
      </Card>
    </div>
  );
}
