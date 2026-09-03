/**
 * Public member profile at /u/[handle].
 *
 * Strictly first-name + avatar + bio + pillars + published portfolio items.
 * Never renders lastName, email, wallet address, or internal id on this
 * surface — circumvention prevention is the whole point.
 *
 * Redacted portfolio fields are resolved via `publicPortfolioView()` so admin
 * overrides (scrubbed titles, hidden projectUrls) take effect automatically.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { memberLabel } from "@/lib/member-label";
import { getAllUsers, getUserByHandle } from "@/lib/readers/users";
import {
  aggregateRating,
  epkForUser,
  getPortfolioForUser,
  mvpScoreReader,
  safely,
  testimonialsForUser,
} from "@/lib/readers";
import { championsCourtMembers } from "@/lib/mvp-score";
import {
  getRecognitionsForUser,
  getCanonizationsForUser,
  splitActiveRecognitions,
} from "@/lib/readers/recognitions";
import { createEpkBookingRequest } from "@/lib/epk-booking-actions";
import { profileShouldIndex } from "@/lib/profile-visibility";
import {
  INDUSTRY_LABELS,
  canSendDirectMessage,
  TIER_LABELS,
  publicName,
  publicNameDisambiguated,
  publicPortfolioView,
  userPillars,
  type ArtistEpk,
  type FeaturedWorkEntry,
  type PressClip,
} from "@/lib/types";
import type { Metadata } from "next";
import { sendDirectMessage } from "@/lib/dm-actions";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { Avatar } from "@/components/Avatar";
import { TierBadge } from "@/components/TierBadge";
import { OnChainBadge } from "@/components/OnChainBadge";
import { MvpCard } from "@/components/MvpCard";
import {
  CARD_TIER_LABEL,
  TradingCard,
  deriveTradingCardTier,
} from "@/components/TradingCard";
import { TradingCard3D } from "@/components/TradingCard3D";
import { ProfileShareButton } from "@/components/ProfileShareButton";

/** Canonical site URL for JSON-LD graph references. */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://buildstore.example";

/**
 * Direct-link to `/u/[handle]` always renders, but search engines only
 * index profiles eligible for public discovery (Members + currently-
 * recognized Partners). Partner-tier profiles without active recognition
 * stay reachable by direct link (Partners distribute the URL themselves
 * for client demos) but stay out of search results. See
 * `lib/profile-visibility.ts` for the matrix.
 */
/**
 * Profiles change as members edit them and as recognition windows
 * open. Static rendering would serve a stale card indefinitely.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ handle: string }>;
}): Promise<Metadata> {
  const { handle } = await params;
  const user = await getUserByHandle(handle);
  if (!user) return { robots: { index: false, follow: false } };
  if (!profileShouldIndex(user)) {
    return {
      title: `${publicName(user)} · Future Modern`,
      robots: { index: false, follow: false },
    };
  }
  return { title: `${publicName(user)} · Future Modern` };
}

/**
 * A pencil, the way every social profile does it.
 *
 * Only rendered when `owner` is set, which only /profile does. Jamar,
 * after four attempts at a separate editing page: "make editing the
 * way it works on any other social media, make a small pencil or icon
 * they can click to change or edit their profile or sections." And:
 * "The profile page is not a place to edit the profile. The profile
 * page needs to BE the profile."
 *
 * So the profile renders as itself and the pencils sit on it. They
 * link to the section editors that already exist rather than opening
 * anything inline, because an inline form on this page is how it
 * turned back into a settings screen the last four times.
 */
function EditPencil({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      aria-label={label}
      title={label}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[var(--surface-border)] text-sm text-ink-faint transition-colors hover:border-brand-magenta hover:text-brand-magentaText"
    >
      <span aria-hidden>✎</span>
    </Link>
  );
}

export default async function PublicProfilePage({
  params,
  owner = false,
}: {
  params: Promise<{ handle: string }>;
  /**
   * Renders the owner's pencils. Set only by /profile. The router
   * never supplies it, so the public route is untouched.
   */
  owner?: boolean;
}) {
  const { handle } = await params;
  // Reader swap 2026-08-28: was MOCK_USERS, so a real member's public
  // profile 404'd while seed profiles resolved fine.
  const user = await getUserByHandle(handle);
  if (!user) notFound();

  const pillars = userPillars(user);
  const portfolioRows = await safely(
    () => getPortfolioForUser(user.id),
    [],
  );
  const items = portfolioRows
    .map(publicPortfolioView)
    .filter((x): x is NonNullable<ReturnType<typeof publicPortfolioView>> => x !== null)
    .sort((a, b) => (a.featured === b.featured ? 0 : a.featured ? -1 : 1));

  // Members-only blocks: aggregate peer rating + published testimonials.
  // Locked posture (2026-04-25): only signed-in members see this section
  // — it's not part of the public-internet face of the cooperative.
  const viewer = await getCurrentUser();
  const isMember = !!viewer;
  const aggregate = isMember
    ? await safely(() => aggregateRating(user.id), null)
    : null;
  const testimonials = isMember
    ? await safely(() => testimonialsForUser(user.id), [])
    : [];

  // DM compose: only members and admins can send (canSendDirectMessage).
  // Self-DM is blocked by the action; we hide the affordance up front so
  // the form never appears on a viewer's own profile.
  const canDm =
    !!viewer && viewer.id !== user.id && canSendDirectMessage(viewer);

  // EPK rendering: only when the user is flipped to "epk" profileMode AND
  // a published EPK exists. Drafts and submissions never render publicly.
  const epk = await safely(() => epkForUser(user.id), null);
  const showEpk =
    user.profileMode === "epk" && epk !== null && epk.status === "published";

  // Trading-card tier — RPG rarity ladder derived from MVP standing.
  // Gray (probation) / green (good standing) / blue (promotion eligible) /
  // magenta (Future Modernist pool) / holographic gold (Champion's Court).
  // Partners without an MVP snapshot fall to "standard" — calm brand
  // gradient, falls outside the rarity ladder. Provisional members also
  // get "standard" so unproven track records aren't visually rewarded.
  const [myRecognitions, myCanonizations] = await Promise.all([
    safely(() => getRecognitionsForUser(user.id), []),
    safely(() => getCanonizationsForUser(user.id), []),
  ]);
  const [mvpSnapshot, allScores, { users: allUsers }] = await Promise.all([
    safely(() => mvpScoreReader.byId(user.id), null),
    safely(() => mvpScoreReader.all(), []),
    safely(() => getAllUsers(), { users: [], source: "postgres" as const }),
  ]);
  const courtIds = new Set(championsCourtMembers(allScores, allUsers));
  const cardTier = deriveTradingCardTier({
    ovr: mvpSnapshot ? mvpSnapshot.ovr : null,
    isProvisional: mvpSnapshot?.isProvisional ?? false,
    isInChampionsCourt: courtIds.has(user.id),
    membershipTier: user.membershipTier,
  });

  /**
   * Person JSON-LD — structured data for search engines. Renders SERP
   * knowledge-panel entries + rich results over time as the profile
   * accrues external mentions. First-name-only public posture is
   * preserved: `name` uses publicName() which respects the visibility
   * matrix, and no email or handle-adjacent private data goes into
   * the schema. Publisher / affiliation ties back to the FM
   * Organization node emitted at the root layout.
   */
  // Disambiguate first-name only when there are collisions in the
  // active cohort (task #31). "Sarah" if unique, "Sarah B." when
  // another Sarah exists. Full name never leaks into structured data
  // or display copy per public-privacy policy.
  const displayName = publicNameDisambiguated(user, allUsers);

  // knowsAbout composes pillar labels + declared skills so long-tail
  // skill searches (e.g. "Solidity contract auditor") can surface
  // this profile via schema.org.
  const knowsAbout = Array.from(
    new Set([
      ...pillars.map((p) => INDUSTRY_LABELS[p]),
      ...(user.skills ?? []),
    ]),
  );

  const personJsonLd = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: displayName,
    url: `${SITE_URL}/u/${user.handle}`,
    // Prefer tagline (short one-liner, purpose-built for the "at a
    // glance" surface) over bio (long-form). Falls through to bio if
    // tagline hasn't been set yet.
    ...(user.tagline || user.bio
      ? { description: user.tagline ?? user.bio }
      : {}),
    ...(user.discipline ? { jobTitle: user.discipline } : {}),
    ...(knowsAbout.length > 0 ? { knowsAbout } : {}),
    memberOf: {
      "@id": `${SITE_URL}#organization`,
    },
    ...(user.profileImageUrl ? { image: user.profileImageUrl } : {}),
  };

  // CreativeWork JSON-LD per published portfolio item (task #33) —
  // long-tail SEO for "case study of X" queries + AI answer-engine
  // attribution back to the creator.
  const portfolioJsonLd = items.map((item) => ({
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: item.title,
    // Portfolio items don't have their own public routes yet — anchor
    // to the profile with a fragment id so scrapers can still cite a
    // stable URL.
    url: `${SITE_URL}/u/${user.handle}#portfolio-${item.id}`,
    creator: {
      "@type": "Person",
      name: displayName,
      url: `${SITE_URL}/u/${user.handle}`,
    },
    ...(item.description ? { description: item.description } : {}),
    ...(item.imageUrl ? { image: item.imageUrl } : {}),
    ...(item.technologies && item.technologies.length > 0
      ? { keywords: item.technologies.join(", ") }
      : {}),
  }));

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(personJsonLd) }}
      />
      {portfolioJsonLd.map((cw, i) => (
        <script
          key={`cw-${i}`}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(cw) }}
        />
      ))}
      <header className="flex flex-col items-start gap-6 md:flex-row md:items-start">
        {/* The hero card was rendered with no children, so it was a
            blank rectangle while the canon cards below it carried year
            and OVR badges. Same component, same person, one of them
            finished. It shows standing now: tier band always, OVR only
            once a snapshot is published and out of provisional. */}
        <TradingCard3D
          user={user}
          tier={cardTier}
          className="w-full max-w-[280px] shrink-0"
        >
          <div className="flex h-full flex-col justify-between">
            <div className="flex items-start justify-between gap-2">
              {/* Membership tier — what they ARE. Distinct from the
                  standing band below, which is how they're currently
                  performing. */}
              <span className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] uppercase tracking-wider text-white">
                {TIER_LABELS[user.membershipTier]}
              </span>
              {mvpSnapshot && !mvpSnapshot.isProvisional && (
                <span className="rounded-full bg-black/40 px-2 py-0.5 font-mono text-[10px] text-white">
                  OVR {mvpSnapshot.ovr}
                </span>
              )}
            </div>
            <div>
              {memberLabel(user) && (
                <p className="text-[10px] uppercase tracking-wider text-white/60">
                  {memberLabel(user)}
                </p>
              )}
              <p className="mt-1 font-display text-lg font-semibold leading-tight text-white">
                {displayName}
              </p>
              <p className="mt-0.5 text-[10px] uppercase tracking-wider text-white/70">
                {CARD_TIER_LABEL[cardTier]}
              </p>
            </div>
          </div>
        </TradingCard3D>
        <div className="flex-1">
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-display text-4xl font-semibold md:text-5xl">
              {displayName}
            </h1>
            {owner && (
              <EditPencil
                href="/profile/edit/identity"
                label="Edit your name, photo and tagline"
              />
            )}
          </div>
          {user.tagline ? (
            <p className="mt-2 text-lg text-ink-muted">{user.tagline}</p>
          ) : (
            owner && (
              <p className="mt-2 text-lg italic text-ink-faint">
                No tagline yet. It is the line clients read first.
              </p>
            )
          )}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <TierBadge tier={user.membershipTier} />
            <OnChainBadge userId={user.id} size="sm" />
            {memberLabel(user) && (
              <span
                className="rounded-full px-2.5 py-0.5 text-xs"
                style={{
                  backgroundColor: "rgba(216, 40, 160, 0.12)",
                  color: "var(--fm-magenta-text)",
                }}
              >
                {memberLabel(user)}
              </span>
            )}
            {pillars.map((p, idx) => (
              <span
                key={p}
                className={`rounded-full px-2.5 py-0.5 text-xs ${
                  idx === 0
                    ? "bg-[var(--surface-inset)] text-ink"
                    : "border border-[var(--surface-border)] text-ink-muted"
                }`}
              >
                {INDUSTRY_LABELS[p]}
              </span>
            ))}
          </div>
          {user.bio && (
            <p className="mt-4 max-w-prose text-ink-muted">{user.bio}</p>
          )}
          {user.skills.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {user.skills.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-xs text-ink-muted"
                >
                  {s}
                </span>
              ))}
            </div>
          )}
          <div className="mt-5">
            <ProfileShareButton handle={user.handle} />
          </div>
          {canDm && (
            <details className="mt-5 max-w-md">
              <summary className="inline-block cursor-pointer rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-xs font-medium hover:border-brand-magenta hover:text-brand-magentaText">
                Send {publicName(user)} a message →
              </summary>
              <form
                action={sendDirectMessage}
                className="mt-3 space-y-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-3"
              >
                <input type="hidden" name="recipientId" value={user.id} />
                <input
                  name="subject"
                  type="text"
                  required
                  maxLength={80}
                  placeholder="Subject"
                  className="w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
                />
                <textarea
                  name="body"
                  required
                  rows={4}
                  placeholder={`Lands in ${publicName(user)}'s /notifications inbox.`}
                  className="w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1.5 text-sm"
                />
                <button
                  type="submit"
                  className="fm-btn-primary rounded-full px-4 py-1.5 text-xs font-medium"
                >
                  Send
                </button>
                <p className="text-[10px] text-ink-faint">
                  Members and admins can DM any user. No reply thread yet.
                  They&apos;ll respond from /notifications.
                </p>
              </form>
            </details>
          )}
        </div>
      </header>

      {(() => {
        // Future Modernist recognitions are public-surface — they show
        // on /u/[handle] for anonymous + signed-in viewers alike (the
        // recognition is meant to be celebrated externally). Unlike MVP
        // Score, which is cooperative-internal, recognitions are the
        // public flag that something noteworthy landed.
        const active = splitActiveRecognitions(myRecognitions);
        const past = active.past;
        if (!active.month && !active.year && past.length === 0) return null;
        return (
          <section className="mt-10">
            {active.year && (
              <div
                className="rounded-2xl border p-5"
                style={{
                  borderColor: "rgba(0, 112, 72, 0.5)",
                  background:
                    "linear-gradient(135deg, rgba(0,112,72,0.10), rgba(80,112,240,0.04))",
                }}
              >
                <div className="text-[10px] uppercase tracking-wider" style={{ color: "var(--fm-green-text)" }}>
                  ★ Constellation of {active.year.periodLabel}
                </div>
                <p className="mt-2 text-sm text-ink">{active.year.narrative}</p>
              </div>
            )}
            {active.month && (
              <div
                className={`rounded-2xl border p-5 ${active.year ? "mt-3" : ""}`}
                style={{
                  borderColor: "rgba(216, 40, 160, 0.5)",
                  background:
                    "linear-gradient(135deg, rgba(216,40,160,0.08), rgba(80,112,240,0.04))",
                }}
              >
                <div className="text-[10px] uppercase tracking-wider text-brand-magentaText">
                  ★ Future Modernist of {active.month.periodLabel}
                </div>
                <p className="mt-2 text-sm text-ink">{active.month.narrative}</p>
              </div>
            )}
            {past.length > 0 && (
              <div className="mt-3 text-[11px] text-ink-faint">
                Also recognized:{" "}
                {past
                  .slice(0, 6)
                  .map((r) =>
                    r.periodKind === "year"
                      ? `Constellation ${r.periodLabel}`
                      : r.periodLabel,
                  )
                  .join(" · ")}
                {past.length > 6 && ` · +${past.length - 6} more`}
              </div>
            )}
          </section>
        );
      })()}

      {(() => {
        // Cooperative canon — annual canonization cards across years.
        // Each card is the Member's standing at year-end, frozen and
        // (in production) minted as an ERC-721 with an ERC-6551 token-
        // bound account. The card's tier (gray / green / blue / magenta /
        // gold) reflects their year-end rarity band — climbing the
        // ladder year-over-year becomes a visible cooperative arc.
        const canon = myCanonizations;
        if (canon.length === 0) return null;
        return (
          <section className="mt-12">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-2xl font-semibold">
                Cooperative canon
              </h2>
              <span className="text-xs text-ink-faint">
                Annual standing · ERC-6551 token-bound (production swap)
              </span>
            </div>
            <p className="mt-1 text-sm text-ink-muted">
              Year-end cards minted as permanent on-chain artifacts.
              Each card is also a wallet. Holds {publicName(user)}&apos;s
              $BUILD allocation, recognitions, and cooperative artifacts
              from that year.
            </p>
            <div className="mt-5 grid gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {canon.map((c) => (
                <div key={c.id}>
                  <TradingCard
                    user={user}
                    tier={c.tier}
                    className="w-full"
                    aspectRatio="3/4"
                  >
                    <div className="flex h-full flex-col justify-between">
                      <div className="flex items-start justify-between text-white">
                        <span
                          className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                          aria-label={`Year ${c.year}`}
                        >
                          {c.year}
                        </span>
                        {c.ovr !== null && (
                          <span className="rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-mono">
                            OVR {c.ovr}
                          </span>
                        )}
                      </div>
                    </div>
                  </TradingCard>
                  {c.caption && (
                    <p className="mt-2 text-[11px] text-ink-muted">
                      {c.caption}
                    </p>
                  )}
                  {!c.tokenId && (
                    <p className="mt-1 text-[10px] text-ink-faint">
                      Sandbox snapshot · mint cycle pending
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        );
      })()}

      {showEpk && epk && <EpkShell epk={epk} userName={publicName(user)} />}

      {showEpk && epk && (
        <section className="mt-12">
          <Card className="border-[#5070F0]/40">
            <CardEyebrow>Booking</CardEyebrow>
            <CardTitle className="mt-1 text-2xl">
              Book {publicName(user)} through Future Modern
            </CardTitle>
            <p className="mt-2 text-sm text-ink-muted">
              {epk.bookingNote ??
                `Engagements run by Future Modern. ${publicName(user)} delivers under FM's agency. Submit the brief; our agent reviews and routes for confirmation.`}
            </p>
            <form
              action={createEpkBookingRequest}
              className="mt-5 grid gap-3 md:grid-cols-2"
            >
              <input type="hidden" name="artistId" value={user.id} />
              <label className="block">
                <span className="text-[11px] uppercase tracking-wider text-ink-muted">
                  Your name
                </span>
                <input
                  name="requesterName"
                  type="text"
                  required
                  className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-[11px] uppercase tracking-wider text-ink-muted">
                  Email
                </span>
                <input
                  name="requesterEmail"
                  type="email"
                  required
                  className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-[11px] uppercase tracking-wider text-ink-muted">
                  Company / org (optional)
                </span>
                <input
                  name="requesterCompany"
                  type="text"
                  className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-[11px] uppercase tracking-wider text-ink-muted">
                  Brief (≥ 30 chars: scope, timeline, budget if known)
                </span>
                <textarea
                  name="brief"
                  required
                  minLength={30}
                  rows={5}
                  placeholder="Example: We'd like to book a 60-minute scoping call about a feature placement for our brand campaign. Budget range $X. Looking at a Q3 timeline."
                  className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-[11px] uppercase tracking-wider text-ink-muted">
                  Proposed start
                </span>
                <input
                  name="startsAt"
                  type="datetime-local"
                  required
                  className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </label>
              <label className="block">
                <span className="text-[11px] uppercase tracking-wider text-ink-muted">
                  Proposed end
                </span>
                <input
                  name="endsAt"
                  type="datetime-local"
                  required
                  className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                />
              </label>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  className="rounded-full px-5 py-2 text-sm font-medium text-white"
                  style={{ backgroundColor: "#5070F0" }}
                >
                  Submit booking request
                </button>
                <p className="mt-2 text-[11px] text-ink-faint">
                  Request lands with FM&apos;s agent for review. Approved
                  briefs route to {publicName(user)} for confirmation.
                  You&apos;ll hear back via email at the address above.
                </p>
              </div>
            </form>
          </Card>
        </section>
      )}

      <section className="mt-14">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-2xl font-semibold">
            {showEpk ? "Cooperative portfolio" : "Portfolio"}
          </h2>
          {owner && (
            <EditPencil href="/profile/portfolio" label="Add or manage work" />
          )}
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          {items.length === 0
            ? `No published work from ${publicName(user)} yet.`
            : `${items.length} published ${items.length === 1 ? "piece" : "pieces"}.`}
        </p>

        {items.length > 0 && (
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <Card key={item.id}>
                <CardEyebrow>{INDUSTRY_LABELS[item.industry]}</CardEyebrow>
                <CardTitle className="mt-2">{item.title}</CardTitle>
                <p className="mt-3 text-sm text-ink-muted">
                  {item.description ?? ""}
                </p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {item.technologies.map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-xs text-ink-muted"
                    >
                      {t}
                    </span>
                  ))}
                </div>
                <div className="mt-5 flex items-center justify-between text-xs">
                  {item.featured ? (
                    <span
                      className="rounded-full px-2 py-0.5 font-medium"
                      style={{
                        backgroundColor: "rgba(80,112,240,0.15)",
                        color: "var(--fm-blue-text)",
                      }}
                    >
                      Featured
                    </span>
                  ) : (
                    <span />
                  )}
                  {item.projectUrl && (
                    <a
                      href={item.projectUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:underline"
                      style={{ color: "var(--fm-magenta-text)" }}
                    >
                      View →
                    </a>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>

      {(() => {
        // MVP Score visibility: viewer must be a signed-in Member or admin
        // (the existing isMember check covers both since signed-in === has
        // a cooperative role). Target must have a published snapshot —
        // Partner-tier members don't get one in the seed.
        if (!isMember || !viewer) return null;
        // Reuses mvpSnapshot and courtIds computed once above rather
        // than re-querying inside the render.
        if (!mvpSnapshot) return null;
        const isSelfOrAdmin =
          viewer.id === user.id || viewer.isAdmin === true;
        const mode = isSelfOrAdmin ? "self" : "peer";
        const isInCourt = courtIds.has(user.id);
        return (
          <section className="mt-14">
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="font-display text-2xl font-semibold">
                MVP Score
              </h2>
              <span className="text-xs text-ink-faint">
                {mode === "self"
                  ? "Full self-view"
                  : "Peer view · cooperative-internal"}
              </span>
            </div>
            <div className="mt-4">
              <MvpCard
                snapshot={mvpSnapshot}
                user={user}
                mode={mode}
                isInCourt={isInCourt}
              />
            </div>
          </section>
        );
      })()}

      {isMember && (
        <section className="mt-14">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-display text-2xl font-semibold">
              Reputation
            </h2>
            <span className="text-xs text-ink-faint">
              Members-only · ratings hidden from the public web
            </span>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <Card>
              <CardEyebrow>Peer rating</CardEyebrow>
              {aggregate ? (
                <>
                  <CardTitle className="mt-2 text-3xl">
                    {aggregate.mean.toFixed(1)}★
                  </CardTitle>
                  <p className="mt-1 text-xs text-ink-muted">
                    {aggregate.count}{" "}
                    {aggregate.count === 1 ? "review" : "reviews"} from
                    teammates on completed engagements
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-2 text-center text-xs md:grid-cols-4">
                    <Sub label="Collaboration" value={aggregate.collaboration} />
                    <Sub label="Craft" value={aggregate.craft} />
                    <Sub label="Reliability" value={aggregate.reliability} />
                    {aggregate.professionalism !== null && (
                      <Sub
                        label="Professionalism"
                        value={aggregate.professionalism}
                      />
                    )}
                  </div>
                  <p className="mt-4 text-[11px] text-ink-faint">
                    Reviewers stay anonymous to {publicName(user)}.
                    Only admin sees attribution for calibration.
                  </p>
                </>
              ) : (
                <p className="mt-3 text-sm text-ink-muted">
                  No peer reviews yet. Multi-person engagements collect a
                  short questionnaire from each teammate at wrap-up.
                </p>
              )}
            </Card>

            <Card>
              <CardEyebrow>Customer testimonials</CardEyebrow>
              {testimonials.length === 0 ? (
                <p className="mt-3 text-sm text-ink-muted">
                  No promoted customer quotes yet. Admin curates these
                  from the post-engagement questionnaire.
                </p>
              ) : (
                <ul className="mt-3 space-y-4 text-sm">
                  {testimonials.map((t) => (
                    <li
                      key={t.id}
                      className="border-l-2 border-[#D828A0] pl-3"
                    >
                      <p className="italic">&ldquo;{t.publishedQuote}&rdquo;</p>
                      <p className="mt-1 text-[11px] text-ink-faint">
                        {t.customerName} · {t.overallStars}★
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </section>
      )}

      <p className="mt-16 text-xs text-ink-faint">
        To engage with {publicName(user)} on a project, submit an RFP through
        the cooperative so we can match and route fairly.
      </p>
    </div>
  );
}

function Sub({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg bg-[var(--surface-inset)] py-2">
      <div className="text-[10px] uppercase tracking-wider text-ink-faint">
        {label}
      </div>
      <div className="mt-0.5 font-display text-base">{value.toFixed(1)}★</div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  EPK shell                                                          */
/* ------------------------------------------------------------------ */

function EpkShell({
  epk,
  userName,
}: {
  epk: ArtistEpk;
  userName: string;
}) {
  return (
    <section className="mt-12 space-y-10">
      {epk.heroImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={epk.heroImageUrl}
          alt={
            epk.tagline
              ? `${userName} press image. ${epk.tagline}`
              : `${userName} press image. Future Modern cooperative Member.`
          }
          className="w-full rounded-2xl object-cover"
          style={{ maxHeight: "60vh" }}
        />
      )}

      {epk.tagline && (
        <p className="font-display text-2xl text-ink">{epk.tagline}</p>
      )}

      <p className="max-w-prose text-base text-ink">{epk.bioShort}</p>

      {epk.bioLong && (
        <details className="max-w-prose">
          <summary className="cursor-pointer text-sm text-brand-magentaText hover:underline">
            Read the long bio
          </summary>
          <div className="mt-3 whitespace-pre-line text-sm text-ink-muted">
            {epk.bioLong}
          </div>
        </details>
      )}

      {epk.featuredWork.length > 0 && (
        <div>
          <h2 className="font-display text-2xl font-semibold">
            Featured work
          </h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {epk.featuredWork.map((w) => (
              <FeaturedWorkCard key={w.id} work={w} />
            ))}
          </div>
        </div>
      )}

      {epk.metrics.length > 0 && (
        <div>
          <h2 className="font-display text-2xl font-semibold">
            By the numbers
          </h2>
          <p className="mt-1 text-xs text-ink-faint">
            Onesheet-style snapshot. Production swap pulls these from a
            daily metrics refresh job.
          </p>
          <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {epk.metrics.map((m, i) => (
              <div
                key={i}
                className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] p-4"
              >
                <div className="text-[10px] uppercase tracking-wider text-ink-faint">
                  {PLATFORM_DISPLAY[m.platform] ?? m.platform}
                </div>
                <div className="mt-1 text-xs text-ink-muted">{m.metric}</div>
                <div className="mt-2 font-display text-2xl font-semibold text-ink">
                  {m.value}
                </div>
                <div className="mt-2 text-[10px] text-ink-faint">
                  As of {new Date(m.capturedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(epk.socialHandles.length > 0 || epk.web3Profiles.length > 0) && (
        <div>
          <h2 className="font-display text-2xl font-semibold">
            Where to find {userName}
          </h2>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            {epk.socialHandles.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wider text-ink-faint">
                  Socials + DSPs
                </div>
                <ul className="mt-3 space-y-2 text-sm">
                  {epk.socialHandles.map((h, i) => (
                    <li key={i}>
                      <a
                        href={h.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-brand-magentaText hover:underline"
                      >
                        {PLATFORM_DISPLAY[h.platform] ?? h.platform}
                        {h.handle ? ` · ${h.handle}` : ""}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {epk.web3Profiles.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wider text-ink-faint">
                  Web3 marketplaces
                </div>
                <ul className="mt-3 space-y-2 text-sm">
                  {epk.web3Profiles.map((w, i) => (
                    <li key={i}>
                      {w.url ? (
                        <a
                          href={w.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-magentaText hover:underline"
                        >
                          {PLATFORM_DISPLAY[w.platform] ?? w.platform}
                          {w.handle ? ` · ${w.handle}` : ""}
                        </a>
                      ) : (
                        <span className="text-ink-muted">
                          {PLATFORM_DISPLAY[w.platform] ?? w.platform}
                          {w.handle ? ` · ${w.handle}` : ""}
                        </span>
                      )}
                      {w.context && (
                        <span className="ml-1 text-xs text-ink-faint">
                          · {w.context}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {epk.press.length > 0 && (
        <div>
          <h2 className="font-display text-2xl font-semibold">Press</h2>
          <ul className="mt-4 space-y-4">
            {epk.press.map((c) => (
              <PressCard key={c.id} clip={c} />
            ))}
          </ul>
        </div>
      )}

      {epk.trackRecord.length > 0 && (
        <div>
          <h2 className="font-display text-2xl font-semibold">Track record</h2>
          <ul className="mt-4 space-y-2 text-sm text-ink">
            {epk.trackRecord.map((t, i) => (
              <li
                key={i}
                className="rounded-lg border-l-2 border-[#D828A0] bg-[var(--surface-inset)] px-4 py-2"
              >
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}

      <Card className="border-[#5070F0]/40">
        <CardEyebrow>Booking</CardEyebrow>
        <CardTitle className="mt-1 text-xl">
          Work with {userName}
        </CardTitle>
        {epk.bookingNote && (
          <p className="mt-2 text-sm text-ink-muted">{epk.bookingNote}</p>
        )}
        <p className="mt-3 text-xs text-ink-faint">
          To engage {userName} on a project, submit an RFP through the
          cooperative so we can match and route fairly.
        </p>
      </Card>
    </section>
  );
}

const PLATFORM_LABELS: Record<FeaturedWorkEntry["platform"], string> = {
  audius: "Audius",
  catalog: "Catalog",
  zora: "Zora",
  youtube: "YouTube",
  bandcamp: "Bandcamp",
  glass: "Glass",
  soundcloud: "SoundCloud",
  spotify: "Spotify",
  vimeo: "Vimeo",
  other: "Other",
};

/**
 * Display labels for every platform string used across metrics, social
 * handles, and web3 profiles. Superset of `PLATFORM_LABELS` above so the
 * Onesheet-style cards render readable headers without per-call switches.
 */
const PLATFORM_DISPLAY: Record<string, string> = {
  spotify: "Spotify",
  audius: "Audius",
  apple_music: "Apple Music",
  soundcloud: "SoundCloud",
  bandcamp: "Bandcamp",
  youtube: "YouTube",
  tiktok: "TikTok",
  instagram: "Instagram",
  twitter: "Twitter / X",
  twitch: "Twitch",
  discord: "Discord",
  opensea: "OpenSea",
  zora: "Zora",
  catalog: "Catalog",
  sound_xyz: "Sound.xyz",
  foundation: "Foundation",
  rarible: "Rarible",
  manifold: "Manifold",
  objkt: "objkt",
  linktree: "Linktree",
  personal_site: "Personal site",
  other: "Other",
};

function FeaturedWorkCard({ work }: { work: FeaturedWorkEntry }) {
  const hasLink = work.embedUrl.length > 0;
  return (
    <Card>
      <CardEyebrow>{PLATFORM_LABELS[work.platform]}</CardEyebrow>
      <CardTitle className="mt-2">{work.title}</CardTitle>
      {work.releaseDate && (
        <p className="mt-1 text-[11px] text-ink-faint">{work.releaseDate}</p>
      )}
      {work.context && (
        <p className="mt-3 text-sm text-ink-muted">{work.context}</p>
      )}
      {work.contractAddress && (
        <p className="mt-2 text-[11px] text-ink-faint">
          On-chain: <code>{work.contractAddress}</code>
        </p>
      )}
      {hasLink && (
        <a
          href={work.embedUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-block text-sm hover:underline"
          style={{ color: "var(--fm-magenta-text)" }}
        >
          Listen / view →
        </a>
      )}
    </Card>
  );
}

function PressCard({ clip }: { clip: PressClip }) {
  const body = (
    <>
      <p className="text-base italic">&ldquo;{clip.quote}&rdquo;</p>
      <p className="mt-2 text-xs text-ink-muted">
        <strong className="text-ink">{clip.outlet}</strong>
        {clip.date && (
          <span className="ml-2 text-ink-faint">{clip.date}</span>
        )}
      </p>
    </>
  );
  return (
    <li className="border-l-2 border-[#5070F0] bg-[var(--surface-inset)] px-4 py-3">
      {clip.url ? (
        <a
          href={clip.url}
          target="_blank"
          rel="noreferrer"
          className="block hover:opacity-80"
        >
          {body}
        </a>
      ) : (
        body
      )}
    </li>
  );
}
