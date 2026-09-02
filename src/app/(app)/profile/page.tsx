/**
 * /profile — your profile, presented.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS WAS SPLIT (2026-09-02)
 *
 * This route used to be a 1,200-line editing form. Landing on your own
 * profile meant landing in a settings screen: file inputs, dropdowns,
 * comma-separated skill fields, seven anchors scrolling one enormous
 * column.
 *
 * Jamar: "I hate this in page editing layout. Make it like a real
 * website where you can click a pencil on your profile, or have an
 * edit button to make changes, this is a whole lot of wasted space."
 * And: "The front page of the profile should be where information is
 * presented, not altered."
 *
 * So the form moved wholesale to /profile/edit and this became what a
 * member actually wants here: what they look like, what they have
 * done, and a way to send it to someone.
 *
 * Deliberately NOT a second copy of /u/[handle]. That page is the
 * public portfolio and is linked from here rather than duplicated,
 * because two renderings of the same profile drift apart and then
 * nobody knows which one clients see.
 *
 * Still to do: split /profile/edit into one route per section
 * (identity, work, paperwork, talent tags, portfolio, money, data)
 * so each is a focused page rather than an anchor into a wall. Moving
 * the form off this page first was the safer half.
 * ─────────────────────────────────────────────────────────────
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { getAgreementsForUser } from "@/lib/readers/agreements";
import { getApplicationsForUser } from "@/lib/readers/project-applications";
import { getPortfolioForUser, safely } from "@/lib/readers";
import { memberLabel } from "@/lib/member-label";
import { publicName } from "@/lib/types";
import { Avatar } from "@/components/Avatar";
import { ShareProfileBar } from "@/components/ShareProfileBar";
import { TierBadge } from "@/components/TierBadge";
import { Card, CardEyebrow } from "@/components/Card";

export const dynamic = "force-dynamic";

/** One area of the profile, summarised, with a way in. */
function AreaCard({
  eyebrow,
  title,
  detail,
  href,
}: {
  eyebrow: string;
  title: string;
  detail: string;
  href: string;
}) {
  return (
    <Card className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <CardEyebrow>{eyebrow}</CardEyebrow>
        <p className="mt-1 font-display text-lg font-semibold">{title}</p>
        <p className="mt-1 text-sm text-ink-muted">{detail}</p>
      </div>
      <Link
        href={href}
        aria-label={`Edit ${eyebrow.toLowerCase()}`}
        className="shrink-0 rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-sm hover:border-brand-magenta hover:text-brand-magenta"
      >
        Edit
      </Link>
    </Card>
  );
}

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const [myAgreements, myApplications, myPortfolio] = await Promise.all([
    safely(() => getAgreementsForUser(user.id), []),
    safely(() => getApplicationsForUser(user.id), []),
    safely(() => getPortfolioForUser(user.id), []),
  ]);

  const published = myPortfolio.filter((p) => p.publishedAt).length;
  const label = memberLabel(user);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Card>
        <div className="flex flex-wrap items-start gap-5">
          <Avatar user={user} size="xl" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-3xl font-semibold">
                {publicName(user)}
              </h1>
              <TierBadge tier={user.membershipTier} />
            </div>
            {label && <p className="mt-1 text-sm text-ink-muted">{label}</p>}
            {user.tagline && (
              <p className="mt-2 text-ink-muted">{user.tagline}</p>
            )}
          </div>
        </div>

        {user.handle && <ShareProfileBar handle={user.handle} />}
      </Card>

      <div className="mt-4 flex justify-end">
        <Link
          href="/profile/edit"
          className="rounded-full bg-brand-magenta px-5 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Edit profile
        </Link>
      </div>

      <div className="mt-6 space-y-4">
        <AreaCard
          eyebrow="Identity"
          title={
            user.displayName?.trim()
              ? `Shown as ${user.displayName.trim()}`
              : publicName(user)
          }
          detail={
            user.tagline
              ? "Name, display name, tagline and pillars."
              : "No tagline yet. It is the line clients read first."
          }
          href="/profile/edit#identity"
        />
        <AreaCard
          eyebrow="Work"
          title={
            myApplications.length === 1
              ? "1 proposal sent"
              : `${myApplications.length} proposals sent`
          }
          detail="Proposals, contracts and the work you are on."
          href="/profile/edit#work"
        />
        <AreaCard
          eyebrow="Paperwork"
          title={
            myAgreements.length === 1
              ? "1 signed agreement"
              : `${myAgreements.length} signed agreements`
          }
          detail="Agreements on file and what you have consented to."
          href="/profile/edit#paperwork"
        />
        <AreaCard
          eyebrow="Portfolio"
          title={
            published === 1 ? "1 published piece" : `${published} published`
          }
          detail="The work shown on your public profile."
          href="/profile/edit#portfolio"
        />
        <AreaCard
          eyebrow="Money"
          title="Payouts and wallet"
          detail="How you get paid and what has been paid."
          href="/profile/edit#money"
        />
        <AreaCard
          eyebrow="Data"
          title={
            user.dataParticipation ? "Opted in" : "Not opted in"
          }
          detail="Tier-2 data participation and your export rights."
          href="/profile/edit#data"
        />
      </div>
    </div>
  );
}
