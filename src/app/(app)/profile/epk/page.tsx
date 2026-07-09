/**
 * Artist EPK editor.
 *
 * Auth-gated. The artist edits their own EPK draft, manages featured
 * work + press lists, then explicitly submits for admin review. Saving
 * core fields keeps the row in draft / needs_revision; submission is a
 * separate explicit action.
 *
 * Visibility logic lives in `mock-data/artist-epk` and the lifecycle
 * actions in `lib/artist-epk-actions`. /u/[handle] reads the same data
 * to render publicly.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { epkForUser } from "@/lib/mock-data/artist-epk";
import {
  saveEpkCore,
  addFeaturedWork,
  removeFeaturedWork,
  addPressClip,
  removePressClip,
  addSocialHandle,
  removeSocialHandle,
  addWeb3Profile,
  removeWeb3Profile,
  addMetric,
  removeMetric,
  submitEpkForReview,
} from "@/lib/artist-epk-actions";
import {
  ARTIST_EPK_STATUS_LABELS,
  type ArtistEpk,
  type ArtistMetricSnapshot,
  type ArtistSocialHandle,
  type FeaturedWorkEntry,
  type PressClip,
  type Web3MarketplaceProfile,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

export default async function ProfileEpkPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?next=/profile/epk");

  const epk = epkForUser(user.id);

  // Tier-distinguished editor per the locked tier-access matrix:
  // Members get full self-managed EPK (all sections editable); Partner-
  // tier artists get a constrained shell — core fields editable, rich
  // sections (featured work, metrics, socials, web3, press) admin-curated
  // only. See `future-modern.md` tier-access matrix.
  const isMemberTier = user.membershipTier === "member";

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <CardEyebrow>Profile · Electronic Press Kit</CardEyebrow>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Your EPK
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Build the public-facing EPK. Save updates anytime; submit
            explicitly when you want admin review. Approved EPKs flip
            your <code>/u/{user.handle}</code> profile to EPK mode.
          </p>
        </div>
        <Link
          href={`/u/${user.handle}`}
          className="text-xs text-ink-muted underline hover:text-ink"
        >
          View public profile ↗
        </Link>
      </div>

      {!isMemberTier && <PartnerTierBanner />}

      <StatusCard epk={epk} userHandle={user.handle} />

      <CoreEditor epk={epk} />

      {isMemberTier ? (
        <>
          <FeaturedWorkSection entries={epk?.featuredWork ?? []} />
          <MetricsSection metrics={epk?.metrics ?? []} />
          <SocialHandlesSection handles={epk?.socialHandles ?? []} />
          <Web3ProfilesSection profiles={epk?.web3Profiles ?? []} />
          <PressSection clips={epk?.press ?? []} />
        </>
      ) : (
        <PartnerCuratedReadOnly epk={epk} />
      )}

      <SubmitSection epk={epk} />
    </div>
  );
}

function StatusCard({
  epk,
  userHandle,
}: {
  epk: ArtistEpk | null;
  userHandle: string;
}) {
  if (!epk) {
    return (
      <Card className="mt-8 border-[var(--surface-border)]">
        <CardEyebrow>No EPK yet</CardEyebrow>
        <p className="mt-2 text-sm text-ink-muted">
          Save the core fields below to start a draft. Nothing publishes
          until you explicitly submit and an admin approves.
        </p>
      </Card>
    );
  }

  const statusBorderClass: Record<typeof epk.status, string> = {
    draft: "border-[var(--surface-border)]",
    submitted: "border-[#5070F0]/60",
    published: "border-[#007048]/60",
    needs_revision: "border-[#D828A0]/60",
  } as Record<typeof epk.status, string>;

  return (
    <Card className={`mt-8 ${statusBorderClass[epk.status]}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <CardEyebrow>Status</CardEyebrow>
          <CardTitle className="mt-1 text-xl">
            {ARTIST_EPK_STATUS_LABELS[epk.status]}
          </CardTitle>
        </div>
        {epk.publishedAt && (
          <span className="text-xs text-ink-faint">
            Last published {new Date(epk.publishedAt).toLocaleDateString()}
          </span>
        )}
      </div>
      {epk.status === "needs_revision" && epk.adminRevisionNote && (
        <div
          className="mt-3 rounded-lg p-3 text-sm"
          style={{ backgroundColor: "rgba(216, 40, 160, 0.08)" }}
        >
          <span className="text-[11px] uppercase tracking-wider text-brand-magenta">
            Admin note
          </span>
          <p className="mt-1 text-ink">{epk.adminRevisionNote}</p>
        </div>
      )}
      {epk.status === "published" && (
        <p className="mt-2 text-xs text-ink-muted">
          Live at <code>/u/{userHandle}</code>. Editing here creates a
          new draft on top. Your existing live EPK stays up until the
          next approval.
        </p>
      )}
    </Card>
  );
}

function CoreEditor({ epk }: { epk: ArtistEpk | null }) {
  const tagline = epk?.tagline ?? "";
  const heroImageUrl = epk?.heroImageUrl ?? "";
  const bioShort = epk?.bioShort ?? "";
  const bioLong = epk?.bioLong ?? "";
  const bookingNote = epk?.bookingNote ?? "";
  const trackRecord = (epk?.trackRecord ?? []).join("\n");

  return (
    <Card className="mt-8 border-[#5070F0]/40">
      <CardEyebrow>Core fields</CardEyebrow>
      <CardTitle className="mt-1 text-xl">
        Hero, bios, track record, booking
      </CardTitle>

      <form action={saveEpkCore} className="mt-5 space-y-4">
        <Field
          name="tagline"
          label="Tagline (one line under your name)"
          defaultValue={tagline}
          placeholder="Rapper · Producer · Future Modern Head of Creative Strategy"
        />
        <Field
          name="heroImageUrl"
          label="Hero image URL"
          defaultValue={heroImageUrl}
          placeholder="https://… (press photo or cover art, 16:9 ideal)"
        />
        <TextareaField
          name="bioShort"
          label="Short bio (≥ 20 chars, EPK card)"
          defaultValue={bioShort}
          rows={4}
          minLength={20}
          required
        />
        <TextareaField
          name="bioLong"
          label="Long bio (optional, deeper read)"
          defaultValue={bioLong}
          rows={6}
        />
        <TextareaField
          name="trackRecord"
          label="Track record (one bullet per line)"
          defaultValue={trackRecord}
          rows={5}
          placeholder={
            "HEEMS DRAKE OBAMA covered by The Needle Drop\nComplex 25 Best Rappers Under 25"
          }
        />
        <Field
          name="bookingNote"
          label="Booking note (shown above the booking CTA)"
          defaultValue={bookingNote}
          placeholder="Booking via Future Modern only. No direct DMs."
        />

        <button
          type="submit"
          className="rounded-full px-5 py-2 text-sm font-medium text-white"
          style={{ backgroundColor: "#5070F0" }}
        >
          Save core fields
        </button>
      </form>
    </Card>
  );
}

function FeaturedWorkSection({ entries }: { entries: FeaturedWorkEntry[] }) {
  return (
    <Card className="mt-6 border-[#D828A0]/40">
      <CardEyebrow>Featured work</CardEyebrow>
      <CardTitle className="mt-1 text-xl">
        Music, video, NFT releases
      </CardTitle>
      <p className="mt-2 text-xs text-ink-muted">
        Paste embed URLs from Audius, Catalog, Zora, YouTube, Bandcamp,
        Glass, Spotify, SoundCloud, or Vimeo. Platform is detected
        automatically from the URL.
      </p>

      {entries.length > 0 && (
        <ul className="mt-4 space-y-3">
          {entries.map((e) => (
            <li
              key={e.id}
              className="rounded-lg border border-[var(--surface-border)] p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <strong className="text-sm">{e.title}</strong>
                <span className="text-[10px] uppercase tracking-wider text-ink-faint">
                  {e.platform}
                  {e.releaseDate && ` · ${e.releaseDate}`}
                </span>
              </div>
              {e.context && (
                <p className="mt-1 text-xs text-ink-muted">{e.context}</p>
              )}
              <p className="mt-1 truncate text-[11px] text-ink-faint">
                {e.embedUrl || "(no embed URL)"}
              </p>
              {e.contractAddress && (
                <p className="mt-0.5 text-[11px] text-ink-faint">
                  Contract: <code>{e.contractAddress}</code>
                </p>
              )}
              <form action={removeFeaturedWork} className="mt-2">
                <input type="hidden" name="id" value={e.id} />
                <button
                  type="submit"
                  className="text-[11px] text-brand-magenta underline hover:opacity-80"
                >
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={addFeaturedWork} className="mt-5 space-y-3">
        <Field name="title" label="Title" required />
        <Field
          name="embedUrl"
          label="Embed URL"
          required
          placeholder="https://open.spotify.com/artist/..."
        />
        <Field
          name="releaseDate"
          label="Release date (optional, YYYY-MM-DD)"
          placeholder="2022-12-16"
        />
        <Field
          name="contractAddress"
          label="On-chain contract address (optional)"
          placeholder="0x..."
        />
        <TextareaField
          name="context"
          label="Context line (optional)"
          rows={2}
          placeholder="Diss track at former label head."
        />
        <button
          type="submit"
          className="rounded-full px-4 py-1.5 text-xs font-medium text-white"
          style={{ backgroundColor: "#D828A0" }}
        >
          Add featured work
        </button>
      </form>
    </Card>
  );
}

function PressSection({ clips }: { clips: PressClip[] }) {
  return (
    <Card className="mt-6 border-[#007048]/40">
      <CardEyebrow>Press</CardEyebrow>
      <CardTitle className="mt-1 text-xl">
        Pull quotes from press coverage
      </CardTitle>

      {clips.length > 0 && (
        <ul className="mt-4 space-y-3">
          {clips.map((c) => (
            <li
              key={c.id}
              className="rounded-lg border border-[var(--surface-border)] p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <strong className="text-sm">{c.outlet}</strong>
                {c.date && (
                  <span className="text-[10px] uppercase tracking-wider text-ink-faint">
                    {c.date}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm italic">&ldquo;{c.quote}&rdquo;</p>
              {c.url && (
                <p className="mt-1 truncate text-[11px] text-ink-faint">
                  {c.url}
                </p>
              )}
              <form action={removePressClip} className="mt-2">
                <input type="hidden" name="id" value={c.id} />
                <button
                  type="submit"
                  className="text-[11px] text-brand-magenta underline hover:opacity-80"
                >
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={addPressClip} className="mt-5 space-y-3">
        <Field name="outlet" label="Outlet" required placeholder="Complex" />
        <TextareaField
          name="quote"
          label="Quote"
          rows={3}
          required
          placeholder="25 Best Rappers Under 25."
        />
        <Field
          name="url"
          label="Source URL (optional)"
          placeholder="https://..."
        />
        <Field
          name="date"
          label="Date (optional, YYYY-MM-DD)"
          placeholder="2012-06-01"
        />
        <button
          type="submit"
          className="rounded-full px-4 py-1.5 text-xs font-medium text-white"
          style={{ backgroundColor: "#007048" }}
        >
          Add press clip
        </button>
      </form>
    </Card>
  );
}

const SOCIAL_PLATFORM_OPTIONS: ArtistSocialHandle["platform"][] = [
  "instagram",
  "twitter",
  "tiktok",
  "youtube",
  "twitch",
  "discord",
  "audius",
  "spotify",
  "soundcloud",
  "apple_music",
  "bandcamp",
  "linktree",
  "personal_site",
  "other",
];

const WEB3_PLATFORM_OPTIONS: Web3MarketplaceProfile["platform"][] = [
  "opensea",
  "zora",
  "catalog",
  "sound_xyz",
  "foundation",
  "rarible",
  "manifold",
  "objkt",
  "other",
];

const METRIC_PLATFORM_OPTIONS: ArtistMetricSnapshot["platform"][] = [
  "spotify",
  "audius",
  "apple_music",
  "soundcloud",
  "bandcamp",
  "youtube",
  "tiktok",
  "instagram",
  "twitter",
  "twitch",
  "discord",
  "opensea",
  "zora",
  "catalog",
  "sound_xyz",
  "foundation",
  "rarible",
  "other",
];

function MetricsSection({ metrics }: { metrics: ArtistMetricSnapshot[] }) {
  return (
    <Card className="mt-6 border-[#5070F0]/40">
      <CardEyebrow>By the numbers</CardEyebrow>
      <CardTitle className="mt-1 text-xl">
        Onesheet-style platform metrics
      </CardTitle>
      <p className="mt-2 text-xs text-ink-muted">
        Snapshot of follower counts, monthly listeners, marketplace
        volume, view counts. Production swap pulls these from a daily
        refresh job; for now, capture screenshots and log them here.
      </p>

      {metrics.length > 0 && (
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {metrics.map((m, i) => (
            <li
              key={i}
              className="rounded-lg border border-[var(--surface-border)] p-3"
            >
              <div className="text-[10px] uppercase tracking-wider text-ink-faint">
                {m.platform}
              </div>
              <div className="mt-1 text-xs text-ink-muted">{m.metric}</div>
              <div className="mt-1 font-display text-lg font-semibold">
                {m.value}
              </div>
              <div className="mt-1 text-[10px] text-ink-faint">
                Captured {new Date(m.capturedAt).toLocaleDateString()}
              </div>
              <form action={removeMetric} className="mt-2">
                <input type="hidden" name="index" value={i} />
                <button
                  type="submit"
                  className="text-[11px] text-brand-magenta underline hover:opacity-80"
                >
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={addMetric} className="mt-5 space-y-3">
        <SelectField name="platform" label="Platform" options={METRIC_PLATFORM_OPTIONS} />
        <Field name="metric" label="Metric label" required placeholder="Monthly listeners" />
        <Field name="value" label="Value (display string)" required placeholder="42.5k" />
        <button
          type="submit"
          className="rounded-full px-4 py-1.5 text-xs font-medium text-white"
          style={{ backgroundColor: "#5070F0" }}
        >
          Add metric
        </button>
      </form>
    </Card>
  );
}

function SocialHandlesSection({ handles }: { handles: ArtistSocialHandle[] }) {
  return (
    <Card className="mt-6 border-[#D828A0]/40">
      <CardEyebrow>Socials + DSPs</CardEyebrow>
      <CardTitle className="mt-1 text-xl">
        Where to find you
      </CardTitle>
      <p className="mt-2 text-xs text-ink-muted">
        Instagram, Twitter, TikTok, Spotify, Audius, Apple Music,
        SoundCloud, Bandcamp, Twitch, Discord, Linktree, personal site.
      </p>

      {handles.length > 0 && (
        <ul className="mt-4 space-y-2">
          {handles.map((h, i) => (
            <li
              key={i}
              className="rounded-lg border border-[var(--surface-border)] p-3 text-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <strong>{h.platform}</strong>
                {h.handle && (
                  <span className="text-xs text-ink-muted">{h.handle}</span>
                )}
              </div>
              <p className="mt-1 truncate text-[11px] text-ink-faint">{h.url}</p>
              <form action={removeSocialHandle} className="mt-2">
                <input type="hidden" name="index" value={i} />
                <button
                  type="submit"
                  className="text-[11px] text-brand-magenta underline hover:opacity-80"
                >
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={addSocialHandle} className="mt-5 space-y-3">
        <SelectField name="platform" label="Platform" options={SOCIAL_PLATFORM_OPTIONS} />
        <Field name="url" label="URL" required placeholder="https://twitter.com/handle" />
        <Field name="handle" label="Handle (optional)" placeholder="handle" />
        <button
          type="submit"
          className="rounded-full px-4 py-1.5 text-xs font-medium text-white"
          style={{ backgroundColor: "#D828A0" }}
        >
          Add social
        </button>
      </form>
    </Card>
  );
}

function Web3ProfilesSection({ profiles }: { profiles: Web3MarketplaceProfile[] }) {
  return (
    <Card className="mt-6 border-[#007048]/40">
      <CardEyebrow>Web3 marketplaces</CardEyebrow>
      <CardTitle className="mt-1 text-xl">
        Storefronts and collections
      </CardTitle>
      <p className="mt-2 text-xs text-ink-muted">
        OpenSea, Zora, Catalog, Sound.xyz, Foundation, Rarible, Manifold,
        objkt. Audius lives in the socials block since it doubles as a
        DSP.
      </p>

      {profiles.length > 0 && (
        <ul className="mt-4 space-y-2">
          {profiles.map((w, i) => (
            <li
              key={i}
              className="rounded-lg border border-[var(--surface-border)] p-3 text-sm"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <strong>{w.platform}</strong>
                {w.handle && (
                  <span className="text-xs text-ink-muted">{w.handle}</span>
                )}
              </div>
              <p className="mt-1 truncate text-[11px] text-ink-faint">{w.url}</p>
              {w.contractAddress && (
                <p className="mt-0.5 text-[11px] text-ink-faint">
                  Contract: <code>{w.contractAddress}</code>
                </p>
              )}
              {w.context && (
                <p className="mt-1 text-xs text-ink-muted">{w.context}</p>
              )}
              <form action={removeWeb3Profile} className="mt-2">
                <input type="hidden" name="index" value={i} />
                <button
                  type="submit"
                  className="text-[11px] text-brand-magenta underline hover:opacity-80"
                >
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={addWeb3Profile} className="mt-5 space-y-3">
        <SelectField name="platform" label="Marketplace" options={WEB3_PLATFORM_OPTIONS} />
        <Field name="url" label="Storefront URL" required placeholder="https://zora.co/..." />
        <Field name="handle" label="Handle (optional)" placeholder="handle" />
        <Field name="contractAddress" label="Contract address (optional)" placeholder="0x..." />
        <TextareaField
          name="context"
          label="Context (optional)"
          rows={2}
          placeholder="STILL HIGH FM-curated drop."
        />
        <button
          type="submit"
          className="rounded-full px-4 py-1.5 text-xs font-medium text-white"
          style={{ backgroundColor: "#007048" }}
        >
          Add marketplace
        </button>
      </form>
    </Card>
  );
}

function SelectField({
  name,
  label,
  options,
}: {
  name: string;
  label: string;
  options: readonly string[];
}) {
  return (
    <div>
      <label
        htmlFor={`epk-${name}`}
        className="block text-[11px] uppercase tracking-wider text-ink-muted"
      >
        {label}
      </label>
      <select
        id={`epk-${name}`}
        name={name}
        className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
      >
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function SubmitSection({ epk }: { epk: ArtistEpk | null }) {
  const ready = !!epk && epk.bioShort.trim().length >= 20;
  const alreadySubmitted = epk?.status === "submitted";

  return (
    <Card className="mt-6">
      <CardEyebrow>Submit for review</CardEyebrow>
      <CardTitle className="mt-1 text-xl">
        Send to admin for approval
      </CardTitle>
      <p className="mt-2 text-sm text-ink-muted">
        Submission is explicit. Saving above keeps the row in draft.
        Once you submit, an admin reviews and either publishes the EPK
        or sends it back with revision notes.
      </p>
      {!ready && (
        <p className="mt-3 text-xs text-brand-magenta">
          Short bio must be at least 20 characters before you can submit.
        </p>
      )}
      {alreadySubmitted && (
        <p className="mt-3 text-xs text-[#5070F0]">
          Currently submitted. Re-submitting refreshes the timestamp on
          the queue.
        </p>
      )}
      <form action={submitEpkForReview} className="mt-4">
        <button
          type="submit"
          disabled={!ready}
          className="rounded-full px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          style={{ backgroundColor: "#000000" }}
        >
          {alreadySubmitted ? "Re-submit for review" : "Submit for review"}
        </button>
      </form>
    </Card>
  );
}

function Field({
  name,
  label,
  defaultValue,
  placeholder,
  required,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={`epk-${name}`}
        className="block text-[11px] uppercase tracking-wider text-ink-muted"
      >
        {label}
      </label>
      <input
        id={`epk-${name}`}
        name={name}
        type="text"
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
        className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
      />
    </div>
  );
}

function TextareaField({
  name,
  label,
  defaultValue,
  placeholder,
  rows = 3,
  minLength,
  required,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  rows?: number;
  minLength?: number;
  required?: boolean;
}) {
  return (
    <div>
      <label
        htmlFor={`epk-${name}`}
        className="block text-[11px] uppercase tracking-wider text-ink-muted"
      >
        {label}
      </label>
      <textarea
        id={`epk-${name}`}
        name={name}
        rows={rows}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        minLength={minLength}
        required={required}
        className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Partner-tier limited-mode surfaces                                  */
/*                                                                     */
/*  Locked tier-access matrix (`future-modern.md`):                    */
/*    Member: full self-managed EPK; all sections editable.            */
/*    Partner: core fields editable; rich sections (featured work,     */
/*             metrics, socials, web3, press) admin-curated only.      */
/*                                                                     */
/*  EPK availability is NOT gated on tier — Partner artists get EPKs   */
/*  because the format is essential to their artistry. The distinction */
/*  is depth of self-management, not existence.                        */
/* ------------------------------------------------------------------ */

function PartnerTierBanner() {
  return (
    <Card className="mt-6 border-[#5070F0]/40">
      <CardEyebrow>Partner-tier EPK</CardEyebrow>
      <CardTitle className="mt-1 text-lg">
        Minimal editor, admin-curated depth
      </CardTitle>
      <p className="mt-2 text-sm text-ink-muted">
        You have a Partner-tier signed LOI with the cooperative.
        Partner EPKs are admin-curated: you control the core narrative
        (tagline, bios, booking note), and admin handles the featured
        work, metrics, socials, web3 profiles, and press blocks on your
        behalf. This keeps the front-and-center artist surface clean
        and reduces the admin overhead on your end.
      </p>
      <p className="mt-2 text-xs text-ink-faint">
        Promotion to Member-tier unlocks the full self-managed editor.
        Promotion eligibility tracks via the MVP Score (75+ OVR
        sustained); see <code>future-modern.md</code> tier-access matrix
        for the structural framing.
      </p>
    </Card>
  );
}

function PartnerCuratedReadOnly({ epk }: { epk: ArtistEpk | null }) {
  const featuredCount = epk?.featuredWork.length ?? 0;
  const pressCount = epk?.press.length ?? 0;
  const socialCount = epk?.socialHandles.length ?? 0;
  const web3Count = epk?.web3Profiles.length ?? 0;
  const metricsCount = epk?.metrics.length ?? 0;

  return (
    <Card className="mt-6">
      <CardEyebrow>Admin-curated sections</CardEyebrow>
      <CardTitle className="mt-1 text-xl">
        Featured work, press, metrics, socials, web3
      </CardTitle>
      <p className="mt-2 text-sm text-ink-muted">
        These sections sit on your published EPK once admin curates them.
        Read-only for you here; if anything is missing or needs an
        update, ping admin and they&apos;ll handle the edit.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <CuratedStat label="Featured work" count={featuredCount} />
        <CuratedStat label="Press clips" count={pressCount} />
        <CuratedStat label="Metrics" count={metricsCount} />
        <CuratedStat label="Social handles" count={socialCount} />
        <CuratedStat label="Web3 profiles" count={web3Count} />
      </div>

      <p className="mt-4 text-[11px] text-ink-faint">
        Empty? Admin probably hasn&apos;t curated yet, or your engagement
        history doesn&apos;t yet have featured-work candidates. Both are
        normal early on.
      </p>
    </Card>
  );
}

function CuratedStat({ label, count }: { label: string; count: number }) {
  return (
    <div className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-3">
      <div className="text-[10px] uppercase tracking-wider text-ink-faint">
        {label}
      </div>
      <div className="mt-1 font-display text-xl font-semibold">{count}</div>
    </div>
  );
}
