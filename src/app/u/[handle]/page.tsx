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
import { notFound } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { MOCK_PORTFOLIO } from "@/lib/mock-data/portfolio";
import { aggregateRating } from "@/lib/mock-data/peer-reviews";
import { testimonialsForUser } from "@/lib/mock-data/customer-feedback";
import { epkForUser } from "@/lib/mock-data/artist-epk";
import {
  INDUSTRY_LABELS,
  canSendDirectMessage,
  publicName,
  publicPortfolioView,
  userPillars,
  type ArtistEpk,
  type FeaturedWorkEntry,
  type PressClip,
} from "@/lib/types";
import { sendDirectMessage } from "@/lib/dm-actions";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { Avatar } from "@/components/Avatar";
import { TierBadge } from "@/components/TierBadge";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const user = MOCK_USERS.find(
    (u) => u.handle.toLowerCase() === handle.toLowerCase(),
  );
  if (!user) notFound();

  const pillars = userPillars(user);
  const items = MOCK_PORTFOLIO
    .filter((p) => p.userId === user.id)
    .map(publicPortfolioView)
    .filter((x): x is NonNullable<ReturnType<typeof publicPortfolioView>> => x !== null)
    .sort((a, b) => (a.featured === b.featured ? 0 : a.featured ? -1 : 1));

  // Members-only blocks: aggregate peer rating + published testimonials.
  // Locked posture (2026-04-25): only signed-in members see this section
  // — it's not part of the public-internet face of the cooperative.
  const viewer = await getCurrentUser();
  const isMember = !!viewer;
  const aggregate = isMember ? aggregateRating(user.id) : null;
  const testimonials = isMember ? testimonialsForUser(user.id) : [];

  // DM compose: only members and admins can send (canSendDirectMessage).
  // Self-DM is blocked by the action; we hide the affordance up front so
  // the form never appears on a viewer's own profile.
  const canDm =
    !!viewer && viewer.id !== user.id && canSendDirectMessage(viewer);

  // EPK rendering: only when the user is flipped to "epk" profileMode AND
  // a published EPK exists. Drafts and submissions never render publicly.
  const epk = epkForUser(user.id);
  const showEpk =
    user.profileMode === "epk" && epk !== null && epk.status === "published";

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <header className="flex flex-col items-start gap-6 md:flex-row md:items-center">
        <Avatar user={user} size="xl" />
        <div>
          <h1 className="font-display text-4xl font-semibold md:text-5xl">
            {publicName(user)}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <TierBadge tier={user.membershipTier} />
            {user.discipline && (
              <span
                className="rounded-full px-2.5 py-0.5 text-xs"
                style={{
                  backgroundColor: "rgba(216, 40, 160, 0.12)",
                  color: "#D828A0",
                }}
              >
                {user.discipline}
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
          {canDm && (
            <details className="mt-5 max-w-md">
              <summary className="inline-block cursor-pointer rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-xs font-medium hover:border-brand-magenta hover:text-brand-magenta">
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
                  className="rounded-full px-4 py-1.5 text-xs font-medium text-white"
                  style={{ backgroundColor: "#D828A0" }}
                >
                  Send
                </button>
                <p className="text-[10px] text-ink-faint">
                  Members and admins can DM any user. No reply thread yet
                  — they&apos;ll respond from /notifications.
                </p>
              </form>
            </details>
          )}
        </div>
      </header>

      {showEpk && epk && <EpkShell epk={epk} userName={publicName(user)} />}

      <section className="mt-14">
        <h2 className="font-display text-2xl font-semibold">
          {showEpk ? "Cooperative portfolio" : "Portfolio"}
        </h2>
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
                        color: "#5070F0",
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
                      style={{ color: "#D828A0" }}
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
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
                    <Sub label="Collaboration" value={aggregate.collaboration} />
                    <Sub label="Craft" value={aggregate.craft} />
                    <Sub label="Reliability" value={aggregate.reliability} />
                  </div>
                  <p className="mt-4 text-[11px] text-ink-faint">
                    Reviewers stay anonymous to {publicName(user)} —
                    only admin sees attribution for calibration.
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
                        — {t.customerName} · {t.overallStars}★
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
          alt={`${userName} — press image`}
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
          <summary className="cursor-pointer text-sm text-brand-magenta hover:underline">
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
                        className="text-brand-magenta hover:underline"
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
                          className="text-brand-magenta hover:underline"
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
                          — {w.context}
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
          style={{ color: "#D828A0" }}
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
        — <strong className="text-ink">{clip.outlet}</strong>
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
