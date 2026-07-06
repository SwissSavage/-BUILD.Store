/**
 * Admin: locker moderation queue.
 *
 * Sorts pending_review first, then everything else by updatedAt desc.
 * Each row exposes a status select + admin note → posts to
 * `moderateMediaAsset`. Admin notes are visible to the uploader (so
 * "audio levels need a +3 dB pass" reaches them on rejection).
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-stub";
import { MOCK_MEDIA_ASSETS } from "@/lib/mock-data/media-assets";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { moderateMediaAsset } from "@/lib/locker-actions";
import {
  INDUSTRY_LABELS,
  MEDIA_ASSET_KIND_LABELS,
  MEDIA_ASSET_STATUS_LABELS,
  TIER_LABELS,
  adminName,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

export default async function AdminLockerPage() {
  await requireAdmin();

  const STATUS_ORDER: Array<keyof typeof MEDIA_ASSET_STATUS_LABELS> = [
    "pending_review",
    "draft",
    "published",
    "rejected",
    "archived",
  ];

  const sorted = [...MOCK_MEDIA_ASSETS].sort((a, b) => {
    const ai = STATUS_ORDER.indexOf(a.status);
    const bi = STATUS_ORDER.indexOf(b.status);
    if (ai !== bi) return ai - bi;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const pendingCount = MOCK_MEDIA_ASSETS.filter(
    (a) => a.status === "pending_review",
  ).length;

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <CardEyebrow>Beta operations</CardEyebrow>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Locker moderation
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            {MOCK_MEDIA_ASSETS.length} total assets · {pendingCount} pending
            review · admin notes route back to the uploader.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-xs text-ink-muted underline hover:text-ink"
        >
          ← Admin home
        </Link>
      </div>

      <div className="mt-8 space-y-4">
        {sorted.map((asset) => {
          const uploader =
            MOCK_USERS.find((u) => u.id === asset.uploaderId) ?? null;
          return (
            <Card key={asset.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <CardEyebrow>
                    {INDUSTRY_LABELS[asset.industry]} ·{" "}
                    {MEDIA_ASSET_KIND_LABELS[asset.kind]} ·{" "}
                    {TIER_LABELS[asset.tierGate]}+
                  </CardEyebrow>
                  <CardTitle className="mt-1">{asset.title}</CardTitle>
                  <p className="mt-2 text-sm text-ink-muted line-clamp-3">
                    {asset.description}
                  </p>
                  <p className="mt-2 text-xs text-ink-muted">
                    {uploader ? adminName(uploader) : asset.uploaderId} ·{" "}
                    {asset.duration ?? "—"} ·{" "}
                    {new Date(asset.createdAt).toLocaleDateString()}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <a
                    href={asset.playbackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs underline"
                    style={{ color: "#D828A0" }}
                  >
                    Open source ↗
                  </a>
                  <span className="text-xs text-ink-muted">
                    {MEDIA_ASSET_STATUS_LABELS[asset.status]}
                  </span>
                </div>
              </div>

              <form
                action={moderateMediaAsset}
                className="mt-4 flex flex-wrap items-end gap-3"
              >
                <input type="hidden" name="id" value={asset.id} />
                <label className="flex flex-col text-[11px] uppercase tracking-wider text-ink-faint">
                  Status
                  <select
                    name="status"
                    defaultValue={asset.status}
                    className="mt-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-2 py-1 text-sm normal-case tracking-normal text-ink"
                  >
                    <option value="pending_review">Pending review</option>
                    <option value="published">Published</option>
                    <option value="rejected">Rejected</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
                <label className="flex flex-1 flex-col text-[11px] uppercase tracking-wider text-ink-faint">
                  Admin note (visible to uploader)
                  <input
                    type="text"
                    name="adminNote"
                    defaultValue={asset.adminNote ?? ""}
                    placeholder="What's the disposition? (Optional on publish, recommended on rejection.)"
                    className="mt-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-1 text-sm normal-case tracking-normal text-ink placeholder:text-ink-faint"
                  />
                </label>
                <button
                  type="submit"
                  className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-[var(--surface)] hover:bg-brand-magenta hover:text-brand-white"
                >
                  Save
                </button>
              </form>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
