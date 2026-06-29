/**
 * Admin: talent-tag curation for one member.
 *
 * Surfaces the auto-scrubbed tag cloud + curator overrides. Tags drive
 * the semantic match scorer used in /admin/inbound, so curating here
 * directly improves who gets suggested for incoming opportunities.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth-stub";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { deriveTalentTagsFromUser, buildTalentTagSet } from "@/lib/talent-match";
import {
  adminAddTalentTag,
  adminRemoveTalentTag,
  adminRescanTalentTags,
} from "@/lib/talent-tag-actions";
import { INDUSTRY_LABELS, publicName } from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

export default async function AdminMemberTagsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const user = MOCK_USERS.find((u) => u.id === id);
  if (!user) notFound();

  const derived = deriveTalentTagsFromUser(user);
  const { pillars, tags } = buildTalentTagSet(user);
  const curated = user.talentTags ?? [];
  // Tags that would be added by a rescan but aren't in the curated list yet.
  const suggested = derived.filter((t) => !curated.includes(t));

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/admin/members" className="text-sm text-ink-muted hover:text-ink">
        ← Admin · Members
      </Link>
      <h1 className="mt-3 font-display text-4xl font-semibold">
        Talent tags · {publicName(user)}
      </h1>
      <p className="mt-2 max-w-2xl text-ink-muted">
        Tags feed the semantic match scorer. Rescan to refresh from this
        member&apos;s bio, skills, discipline, and portfolio URL. Add
        curator tags for anything the scrubber misses.
      </p>

      <Card className="mt-8 border-[#5070F0]/40">
        <CardEyebrow>Pillars</CardEyebrow>
        <div className="mt-2 flex flex-wrap gap-2">
          {pillars.length === 0 ? (
            <span className="text-xs text-ink-muted">No pillars set</span>
          ) : (
            pillars.map((p) => (
              <span
                key={p}
                className="rounded-full px-3 py-1 text-xs"
                style={{ backgroundColor: "rgba(80, 112, 240, 0.12)", color: "#5070F0" }}
              >
                {INDUSTRY_LABELS[p]}
              </span>
            ))
          )}
        </div>
      </Card>

      <Card className="mt-6 border-[#D828A0]/40">
        <CardEyebrow>Curated tags</CardEyebrow>
        <CardTitle className="mt-1 text-xl">
          {curated.length} tag{curated.length === 1 ? "" : "s"} on file
        </CardTitle>
        <div className="mt-3 flex flex-wrap gap-2">
          {curated.length === 0 ? (
            <span className="text-xs text-ink-muted">
              None yet. Rescan below or add manually.
            </span>
          ) : (
            curated.map((t) => (
              <form key={t} action={adminRemoveTalentTag}>
                <input type="hidden" name="userId" value={user.id} />
                <input type="hidden" name="tag" value={t} />
                <button
                  type="submit"
                  className="group rounded-full px-3 py-1 text-xs"
                  style={{
                    backgroundColor: "rgba(216, 40, 160, 0.10)",
                    color: "#D828A0",
                  }}
                  title="Click to remove"
                >
                  #{t}{" "}
                  <span className="opacity-0 transition-opacity group-hover:opacity-100">
                    ✕
                  </span>
                </button>
              </form>
            ))
          )}
        </div>

        <form action={adminAddTalentTag} className="mt-5 flex flex-wrap items-end gap-2">
          <input type="hidden" name="userId" value={user.id} />
          <label className="flex flex-col text-[11px] uppercase tracking-wider text-ink-muted">
            Add tag(s) — comma or space separated
            <input
              name="tag"
              placeholder="retrofit, policy, brand-system"
              className="mt-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-1.5 text-sm normal-case tracking-normal text-ink"
            />
          </label>
          <button
            type="submit"
            className="rounded-full px-4 py-1.5 text-xs font-medium text-white"
            style={{ backgroundColor: "#D828A0" }}
          >
            Append
          </button>
        </form>

        <form action={adminRescanTalentTags} className="mt-3">
          <input type="hidden" name="userId" value={user.id} />
          <button
            type="submit"
            className="rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-xs hover:border-brand-magenta hover:text-brand-magenta"
          >
            Rescan from bio + skills + portfolio
          </button>
        </form>
      </Card>

      <Card className="mt-6">
        <CardEyebrow>Suggested by scrubber</CardEyebrow>
        <CardTitle className="mt-1 text-xl">
          {suggested.length} tag{suggested.length === 1 ? "" : "s"} new this rescan
        </CardTitle>
        <p className="mt-2 text-xs text-ink-muted">
          These appear in the deterministic scrubber output but aren&apos;t in
          the curated set yet. Rescan above to add them all, or pick a
          subset by appending individual tags.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {suggested.length === 0 ? (
            <span className="text-xs text-ink-muted">Curated list is up to date.</span>
          ) : (
            suggested.map((t) => (
              <span
                key={t}
                className="rounded-full px-3 py-1 text-xs"
                style={{ backgroundColor: "rgba(0, 112, 72, 0.10)", color: "#007048" }}
              >
                #{t}
              </span>
            ))
          )}
        </div>
      </Card>

      <Card className="mt-6">
        <CardEyebrow>Full effective tag set</CardEyebrow>
        <p className="mt-2 text-xs text-ink-muted">
          Union of pillars + skills + curated tags + scrubber output. This is
          what the match scorer compares against inbound opportunities.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {Array.from(tags).map((t) => (
            <span
              key={t}
              className="rounded-full bg-[var(--surface-inset)] px-3 py-1 text-xs"
            >
              {t}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}
