/**
 * Admin: who is naming themselves in their own profile.
 *
 * The save-time guard stops new text. It does nothing about the bios
 * already in the database, and it cannot stop someone writing a brand
 * with no company suffix, "The RevOps Hitman", which no pattern can
 * tell from an ordinary phrase.
 *
 * So this is the manual half. It runs the same guard over every
 * member's bio and tagline as they currently stand and lists what it
 * finds, worst first. Nothing is changed or hidden: the member's
 * public profile still shows exactly what they wrote until somebody
 * decides otherwise.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-stub";
import { getAllUsers } from "@/lib/readers/users";
import { safely } from "@/lib/readers";
import { findSelfDisclosure } from "@/lib/self-disclosure-guard";
import { publicName } from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { Avatar } from "@/components/Avatar";

export const dynamic = "force-dynamic";

export default async function AdminDisclosurePage() {
  await requireAdmin();

  const { users: roster } = await safely(() => getAllUsers(), {
    users: [],
    source: "postgres" as const,
  });

  const flagged = roster
    .map((u) => ({
      user: u,
      bio: findSelfDisclosure(u.bio, u),
      tagline: findSelfDisclosure(u.tagline, u),
    }))
    .map((r) => ({ ...r, count: r.bio.length + r.tagline.length }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  const withText = roster.filter((u) => u.bio?.trim() || u.tagline?.trim());

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <CardEyebrow>Admin · Circumvention review</CardEyebrow>
      <h1 className="mt-2 font-display text-4xl font-semibold">
        Self-disclosure in profiles
      </h1>
      <p className="mt-3 max-w-prose text-sm text-ink-muted">
        Bios and taglines checked against the same rule the profile
        editor enforces on save. {flagged.length} of {withText.length}{" "}
        members who have written anything are flagged. Nothing here has
        been changed or hidden; this is a list to work through.
      </p>
      <p className="mt-2 max-w-prose text-xs text-ink-faint">
        A bare brand with no company suffix will not appear here. Neither
        will a surname on its own, or a company someone merely worked
        for. Those are judgement calls and the rule leaves them to you.
      </p>

      {flagged.length === 0 ? (
        <Card className="mt-8">
          <CardTitle className="text-lg">Nothing flagged</CardTitle>
          <p className="mt-2 text-sm text-ink-muted">
            No member&apos;s bio or tagline names them in full, names a
            firm they say is theirs, or carries a direct way to reach
            them.
          </p>
        </Card>
      ) : (
        <div className="mt-8 space-y-4">
          {flagged.map(({ user, bio, tagline }) => (
            <Card key={user.id}>
              <div className="flex flex-wrap items-center gap-3">
                <Avatar user={user} size="sm" />
                <div className="min-w-0 flex-1">
                  <CardTitle className="text-lg">
                    {publicName(user)}
                  </CardTitle>
                  <p className="text-xs text-ink-faint">
                    @{user.handle} · {user.membershipTier}
                  </p>
                </div>
                <Link
                  href={`/admin/members/${user.id}`}
                  className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-xs hover:border-brand-magenta"
                >
                  Member
                </Link>
                <Link
                  href={`/u/${user.handle}`}
                  className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-xs hover:border-brand-magenta"
                >
                  Public profile
                </Link>
              </div>

              {tagline.length > 0 && (
                <div className="mt-4">
                  <p className="text-[11px] uppercase tracking-wider text-brand-magentaText">
                    Tagline
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink">
                    {user.tagline}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {tagline.map((f) => (
                      <li key={f.code} className="text-xs text-ink-muted">
                        {f.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {bio.length > 0 && (
                <div className="mt-4">
                  <p className="text-[11px] uppercase tracking-wider text-brand-magentaText">
                    Bio
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-ink">
                    {user.bio}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {bio.map((f) => (
                      <li key={f.code} className="text-xs text-ink-muted">
                        {f.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
