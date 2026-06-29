/**
 * Admin: artist EPK approval queue.
 *
 * Two stacks:
 *   1. Pending: artist EPKs in `submitted` status awaiting admin
 *      decision. Approve flips status to "published" and flips
 *      User.profileMode to "epk". Send-back captures a revision note.
 *   2. Published: already-live EPKs, with a quick deep link.
 *
 * Drafts and needs-revision rows are NOT in this queue; those live in
 * the artist's editor at /profile/epk until they re-submit.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-stub";
import {
  MOCK_ARTIST_EPKS,
  pendingEpkSubmissions,
} from "@/lib/mock-data/artist-epk";
import { MOCK_USERS } from "@/lib/mock-data/users";
import {
  approveEpk,
  requestEpkRevision,
} from "@/lib/artist-epk-actions";
import {
  publicName,
  type ArtistEpk,
  type User,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function userFor(epk: ArtistEpk): User | null {
  return MOCK_USERS.find((u) => u.id === epk.userId) ?? null;
}

export default async function AdminEpkQueuePage() {
  await requireAdmin();

  const pending = pendingEpkSubmissions();
  const published = MOCK_ARTIST_EPKS.filter(
    (e) => e.status === "published",
  ).sort((a, b) =>
    (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
  );

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <CardEyebrow>Beta operations</CardEyebrow>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            EPK approval queue
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Artists submit their Electronic Press Kits here. Approve to
            flip <code>profileMode</code> to <code>epk</code> and publish
            the kit on <code>/u/[handle]</code>. Send back with notes to
            ask for revisions.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-xs text-ink-muted underline hover:text-ink"
        >
          ← Admin home
        </Link>
      </div>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">
          Pending ({pending.length})
        </h2>
        <div className="mt-4 space-y-5">
          {pending.length === 0 ? (
            <Card>
              <p className="text-sm text-ink-muted">
                Inbox zero. No EPK submissions waiting on a decision.
              </p>
            </Card>
          ) : (
            pending.map((epk) => <PendingEpkRow key={epk.userId} epk={epk} />)
          )}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">
          Published ({published.length})
        </h2>
        <div className="mt-4 space-y-3">
          {published.length === 0 ? (
            <Card>
              <p className="text-sm text-ink-muted">
                No EPKs live yet.
              </p>
            </Card>
          ) : (
            published.map((epk) => (
              <PublishedEpkRow key={epk.userId} epk={epk} />
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function PendingEpkRow({ epk }: { epk: ArtistEpk }) {
  const user = userFor(epk);
  if (!user) return null;

  return (
    <Card className="border-[#5070F0]/40">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <CardEyebrow>{user.discipline ?? "Artist"}</CardEyebrow>
          <CardTitle className="mt-1 text-xl">
            {publicName(user)} (@{user.handle})
          </CardTitle>
          <p className="mt-1 text-xs text-ink-muted">
            Submitted {epk.submittedAt ? formatDate(epk.submittedAt) : "—"}
            {epk.publishedAt && (
              <span className="ml-2 text-ink-faint">
                · last published {formatDate(epk.publishedAt)}
              </span>
            )}
          </p>
        </div>
        <Link
          href={`/u/${user.handle}`}
          className="text-xs text-ink-muted underline hover:text-ink"
        >
          View public profile ↗
        </Link>
      </div>

      {epk.tagline && (
        <p className="mt-4 text-sm font-medium">{epk.tagline}</p>
      )}
      <p className="mt-2 text-sm text-ink-muted">{epk.bioShort}</p>
      {epk.bioLong && (
        <details className="mt-2 text-xs text-ink-muted">
          <summary className="cursor-pointer text-ink">Long bio</summary>
          <p className="mt-2 whitespace-pre-line">{epk.bioLong}</p>
        </details>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div>
          <span className="text-[10px] uppercase tracking-wider text-ink-faint">
            Featured work ({epk.featuredWork.length})
          </span>
          <ul className="mt-1 space-y-1 text-xs text-ink-muted">
            {epk.featuredWork.length === 0 ? (
              <li className="text-ink-faint">None.</li>
            ) : (
              epk.featuredWork.map((w) => (
                <li key={w.id}>
                  <strong className="text-ink">{w.title}</strong>{" "}
                  <span className="text-ink-faint">· {w.platform}</span>
                  {w.releaseDate && (
                    <span className="text-ink-faint"> · {w.releaseDate}</span>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
        <div>
          <span className="text-[10px] uppercase tracking-wider text-ink-faint">
            Press ({epk.press.length})
          </span>
          <ul className="mt-1 space-y-1 text-xs text-ink-muted">
            {epk.press.length === 0 ? (
              <li className="text-ink-faint">None.</li>
            ) : (
              epk.press.map((c) => (
                <li key={c.id}>
                  <strong className="text-ink">{c.outlet}</strong>
                  {c.date && (
                    <span className="text-ink-faint"> · {c.date}</span>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      {epk.trackRecord.length > 0 && (
        <div className="mt-4">
          <span className="text-[10px] uppercase tracking-wider text-ink-faint">
            Track record
          </span>
          <ul className="mt-1 list-disc pl-5 text-xs text-ink-muted">
            {epk.trackRecord.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </div>
      )}

      {epk.bookingNote && (
        <p className="mt-4 text-xs text-ink-muted">
          <span className="text-[10px] uppercase tracking-wider text-ink-faint">
            Booking note ·
          </span>{" "}
          {epk.bookingNote}
        </p>
      )}

      <div className="mt-6 flex flex-wrap items-start gap-3">
        <form action={approveEpk}>
          <input type="hidden" name="userId" value={epk.userId} />
          <button
            type="submit"
            className="rounded-full px-5 py-2 text-xs font-medium text-white"
            style={{ backgroundColor: "#007048" }}
          >
            Approve and publish
          </button>
        </form>

        <form
          action={requestEpkRevision}
          className="flex flex-1 flex-wrap items-end gap-2 min-w-[280px]"
        >
          <input type="hidden" name="userId" value={epk.userId} />
          <label className="flex flex-1 flex-col text-[11px] uppercase tracking-wider text-ink-faint">
            Revision note (≥ 10 chars)
            <input
              type="text"
              name="adminRevisionNote"
              required
              minLength={10}
              placeholder="What needs to change before this can land publicly?"
              className="mt-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-1.5 text-sm normal-case tracking-normal text-ink placeholder:text-ink-faint"
            />
          </label>
          <button
            type="submit"
            className="rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-xs hover:border-brand-magenta hover:text-brand-magenta"
          >
            Send back
          </button>
        </form>
      </div>
    </Card>
  );
}

function PublishedEpkRow({ epk }: { epk: ArtistEpk }) {
  const user = userFor(epk);
  if (!user) return null;
  return (
    <Card className="border-[#007048]/40">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <CardEyebrow>{user.discipline ?? "Artist"}</CardEyebrow>
          <CardTitle className="mt-1 text-lg">
            {publicName(user)} (@{user.handle})
          </CardTitle>
        </div>
        <span className="text-xs text-[#007048]">
          Published {formatDate(epk.publishedAt ?? epk.updatedAt)}
        </span>
      </div>
      <p className="mt-2 text-sm text-ink-muted">{epk.tagline}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={`/u/${user.handle}`}
          className="rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs hover:border-brand-magenta hover:text-brand-magenta"
        >
          View on profile ↗
        </Link>
      </div>
    </Card>
  );
}
