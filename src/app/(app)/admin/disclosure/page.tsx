/**
 * Admin: who is naming themselves in their own profile, and what to do
 * about it.
 *
 * The save-time guard stops new text. It does nothing about the bios
 * already in the database, and it cannot stop someone writing a brand
 * with no company suffix, "The RevOps Hitman", which no pattern can
 * tell from an ordinary phrase.
 *
 * So this is the manual half. It runs the same guard over every
 * member's bio and tagline as they currently stand and lists what it
 * finds, worst first.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY IT HAS BUTTONS NOW (2026-10-05)
 *
 * It used to be a list with two links off it. It told you where the
 * problem was and left you to go and do something about it somewhere
 * else, which meant nobody did. Worse, it never shrank: a bio you read
 * and judged acceptable came back on the list every single load, so
 * after one pass the page stopped being worth opening.
 *
 * Three things an admin can do, in the order to reach for them:
 * clear it, ask the member to rewrite it, or take the profile out of
 * discovery while it still says what it says. The member fixing their
 * own words is the first real move, not the last resort.
 *
 * Contact details do not wait for any of this. The daily sweep hides a
 * public profile carrying an email, phone, booking link or bare domain
 * and tells the member why, because that is the one case with no
 * judgement in it.
 * ─────────────────────────────────────────────────────────────
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-stub";
import { getAllUsers } from "@/lib/readers/users";
import { safely } from "@/lib/readers";
import { db } from "@/db/client";
import { profileDisclosureReviews } from "@/db/schema";
import { findSelfDisclosure } from "@/lib/self-disclosure-guard";
import { hashDisclosureText } from "@/lib/disclosure-review";
import {
  hideProfilePendingFix,
  markDisclosureReviewed,
  requestDisclosureFix,
} from "@/lib/disclosure-review-actions";
import { publicName } from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { Avatar } from "@/components/Avatar";

export const dynamic = "force-dynamic";

/**
 * The thirteen seed personas inserted into production on 2026-09-22
 * all carry example.com addresses. They flag constantly and can never
 * be fixed, so they are marked rather than hidden: filtering them out
 * would make a data problem invisible instead of solved.
 */
function isSeedFixture(email: string | null | undefined): boolean {
  return (email ?? "").toLowerCase().endsWith("@example.com");
}

export default async function AdminDisclosurePage() {
  await requireAdmin();

  const { users: roster } = await safely(() => getAllUsers(), {
    users: [],
    source: "postgres" as const,
  });

  // One query for every review on record. Keyed on the exact text that
  // was cleared, so a member editing their bio brings it straight back.
  const reviews = await safely(
    () => db.select().from(profileDisclosureReviews),
    [] as (typeof profileDisclosureReviews.$inferSelect)[],
  );
  const cleared = new Map(
    reviews.map((r) => [`${r.userId}:${r.field}`, r.textHash]),
  );
  const isCleared = (
    userId: string,
    field: "bio" | "tagline",
    text: string | null | undefined,
  ) => cleared.get(`${userId}:${field}`) === hashDisclosureText(text);

  const flagged = roster
    .map((u) => ({
      user: u,
      bio: isCleared(u.id, "bio", u.bio) ? [] : findSelfDisclosure(u.bio, u),
      tagline: isCleared(u.id, "tagline", u.tagline)
        ? []
        : findSelfDisclosure(u.tagline, u),
    }))
    .map((r) => ({ ...r, count: r.bio.length + r.tagline.length }))
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count);

  const withText = roster.filter((u) => u.bio?.trim() || u.tagline?.trim());
  const seedCount = flagged.filter((f) => isSeedFixture(f.user.email)).length;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <CardEyebrow>Admin · Circumvention review</CardEyebrow>
      <h1 className="mt-2 font-display text-4xl font-semibold">
        Self-disclosure in profiles
      </h1>
      <p className="mt-3 max-w-prose text-sm text-ink-muted">
        Bios and taglines checked against the same rule the profile
        editor enforces on save. {flagged.length} of {withText.length}{" "}
        members who have written anything are flagged, and{" "}
        {reviews.length} {reviews.length === 1 ? "entry has" : "entries have"}{" "}
        already been reviewed and cleared.
      </p>
      <p className="mt-2 max-w-prose text-xs text-ink-faint">
        A bare brand with no company suffix will not appear here. Neither
        will a surname on its own, or a company someone merely worked
        for. Those are judgement calls and the rule leaves them to you.
        Contact details do not wait for you: the daily sweep hides a
        public profile carrying an email, phone, booking link or bare
        domain, and tells the member why.
      </p>
      {seedCount > 0 && (
        <p className="mt-2 max-w-prose text-xs text-ink-faint">
          {seedCount} of the rows below{" "}
          {seedCount === 1 ? "is a" : "are"} seed fixture
          {seedCount === 1 ? "" : "s"} from the 2026-09-22 seed run, marked
          as such. Nothing you do here fixes those; removing them is a
          data cleanup, and four of the thirteen are real people.
        </p>
      )}

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
                    {!user.profilePublic && " · hidden from discovery"}
                  </p>
                </div>
                {isSeedFixture(user.email) && (
                  <span className="rounded-full border border-dashed border-[#D8931B]/60 px-3 py-1 text-[10px] uppercase tracking-wider text-[#B4740F]">
                    Seed fixture
                  </span>
                )}
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
                <FieldBlock
                  uid={user.id}
                  field="tagline"
                  label="Tagline"
                  text={user.tagline}
                  findings={tagline}
                />
              )}

              {bio.length > 0 && (
                <FieldBlock
                  uid={user.id}
                  field="bio"
                  label="Bio"
                  text={user.bio}
                  findings={bio}
                />
              )}

              {/* Member-level actions. Both act on the whole profile, so
                  they sit below the fields rather than inside one. */}
              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[var(--surface-border)] pt-4">
                <form action={requestDisclosureFix}>
                  <input type="hidden" name="uid" value={user.id} />
                  <button
                    type="submit"
                    className="fm-btn-primary rounded-full px-3 py-1.5 text-[11px] font-medium"
                    title="Sends the member every finding above, verbatim, with a link to their profile editor."
                  >
                    Ask them to fix it
                  </button>
                </form>
                {user.profilePublic && (
                  <form action={hideProfilePendingFix}>
                    <input type="hidden" name="uid" value={user.id} />
                    <button
                      type="submit"
                      className="rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-[11px] text-ink-muted hover:border-brand-magenta hover:text-brand-magentaText"
                      title="Takes the profile out of public discovery. Not a suspension: account, work and access are untouched."
                    >
                      Hide until fixed
                    </button>
                  </form>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * One flagged field, its findings, and the per-field clear.
 *
 * Clearing is per field rather than per member because the two are
 * independent judgements: a tagline can be fine while the bio is not.
 */
function FieldBlock({
  uid,
  field,
  label,
  text,
  findings,
}: {
  uid: string;
  field: "bio" | "tagline";
  label: string;
  text: string | null | undefined;
  findings: { code: string; message: string }[];
}) {
  return (
    <div className="mt-4">
      <p className="text-[11px] uppercase tracking-wider text-brand-magentaText">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{text}</p>
      <ul className="mt-2 space-y-1">
        {findings.map((f) => (
          <li key={f.code} className="text-xs text-ink-muted">
            {f.message}
          </li>
        ))}
      </ul>
      <form
        action={markDisclosureReviewed}
        className="mt-3 flex flex-wrap items-end gap-2"
      >
        <input type="hidden" name="uid" value={uid} />
        <input type="hidden" name="field" value={field} />
        <input
          type="text"
          name="note"
          placeholder="Why this is acceptable (optional)"
          className="min-w-0 flex-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-ink"
        />
        <button
          type="submit"
          className="rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-[11px] text-ink-muted hover:border-brand-magenta hover:text-brand-magentaText"
          title="Takes this field off the list until the member edits it. Recorded against the exact text you just read."
        >
          Reviewed, no action
        </button>
      </form>
    </div>
  );
}
