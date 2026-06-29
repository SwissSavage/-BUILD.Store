/**
 * Content locker — long-form video + audio uploaded by members, gated
 * by tier. The locker is the second value-prop a beta member feels
 * after the showcase: members get exclusive access to deeper process
 * recordings + member-only drops.
 *
 * Sandbox player: we render the playbackUrl as a link plus a stub
 * placeholder. A real impl swaps for a Mux player.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_MEDIA_ASSETS } from "@/lib/mock-data/media-assets";
import { MOCK_USERS } from "@/lib/mock-data/users";
import {
  INDUSTRY_LABELS,
  MEDIA_ASSET_KIND_LABELS,
  TIER_LABELS,
  canViewMediaAsset,
  publicName,
  type Industry,
  type MediaAsset,
  type MembershipTier,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { Avatar } from "@/components/Avatar";
import { FeedbackPrompt } from "@/components/FeedbackPrompt";

type SearchParams = { pillar?: string; kind?: string };

export default async function LockerPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const params = await searchParams;
  const pillarFilter = (
    ["stem", "creative-media", "professional-services"] as Industry[]
  ).find((p) => p === params.pillar);
  const kindFilter = (["video", "audio"] as MediaAsset["kind"][]).find(
    (k) => k === params.kind,
  );

  const visible = MOCK_MEDIA_ASSETS.filter((a) => a.status === "published")
    .filter((a) => canViewMediaAsset(user.membershipTier, a.tierGate))
    .filter((a) => !pillarFilter || a.industry === pillarFilter)
    .filter((a) => !kindFilter || a.kind === kindFilter)
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

  const myDrafts = MOCK_MEDIA_ASSETS.filter(
    (a) => a.uploaderId === user.id && a.status !== "archived",
  ).sort(
    (a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
  );

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <CardEyebrow>Content locker</CardEyebrow>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Long-form drops from members.
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            Process recordings, founder notes, technical deep-dives, and
            audio. Tier-gated — member drops stay member-only. Pasted-URL
            placeholder in sandbox; Mux pipeline lands with the backend.
          </p>
        </div>
        <Link
          href="/locker/upload"
          className="self-start rounded-full px-4 py-2 text-xs font-medium text-white"
          style={{ backgroundColor: "#D828A0" }}
        >
          Upload to the locker
        </Link>
      </div>

      <FilterBar params={params} />

      {visible.length === 0 ? (
        <Card className="mt-8">
          <CardTitle>Nothing matches those filters yet.</CardTitle>
          <p className="mt-2 text-sm text-ink-muted">
            {user.membershipTier === "prospect"
              ? "Most drops are partner+ during beta. Apply for membership to unlock."
              : "Check back — new uploads land daily during beta."}
          </p>
        </Card>
      ) : (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {visible.map((asset) => (
            <AssetCard key={asset.id} asset={asset} />
          ))}
        </div>
      )}

      {myDrafts.length > 0 && (
        <section className="mt-14">
          <h2 className="font-display text-2xl font-semibold">
            Your locker uploads
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            What you&apos;ve submitted — drafts, in-review, published, or
            rejected.
          </p>
          <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--surface-border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--surface-inset)] text-xs uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="p-4 text-left">Title</th>
                  <th className="p-4 text-left">Kind</th>
                  <th className="p-4 text-left">Status</th>
                  <th className="p-4 text-left">Updated</th>
                </tr>
              </thead>
              <tbody>
                {myDrafts.map((a) => (
                  <tr
                    key={a.id}
                    className="border-t border-[var(--surface-border)]"
                  >
                    <td className="p-4">
                      <div className="font-medium">{a.title}</div>
                      {a.adminNote && (
                        <div className="mt-1 text-xs text-ink-muted">
                          Admin: {a.adminNote}
                        </div>
                      )}
                    </td>
                    <td className="p-4 text-ink-muted">
                      {MEDIA_ASSET_KIND_LABELS[a.kind]}
                    </td>
                    <td className="p-4">
                      <StatusChip status={a.status} />
                    </td>
                    <td className="p-4 text-ink-muted">
                      {new Date(a.updatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="mt-14">
        <FeedbackPrompt
          surface="/locker"
          surfaceLabel="Content locker"
          prompt="Is the locker pulling its weight? What's missing?"
        />
      </section>
    </div>
  );
}

function FilterBar({ params }: { params: SearchParams }) {
  // `scope` disambiguates the React key when two groups both expose
  // an "All" pill with the same `{}` query (Pillar All vs Kind All
  // would collide otherwise).
  const pill = (
    scope: string,
    label: string,
    query: Record<string, string>,
  ) => {
    const isActive = Object.entries(query).every(
      ([k, v]) => (params as Record<string, string | undefined>)[k] === v,
    );
    const href =
      "/locker" +
      (Object.keys(query).length === 0
        ? ""
        : "?" + new URLSearchParams(query).toString());
    return (
      <Link
        key={scope + ":" + label + JSON.stringify(query)}
        href={href}
        className={`rounded-full border px-3 py-1 text-xs transition-colors ${
          isActive
            ? "border-brand-magenta bg-brand-magenta text-brand-white"
            : "border-[var(--surface-border)] text-ink-muted hover:bg-[var(--surface-inset)]"
        }`}
      >
        {label}
      </Link>
    );
  };
  // Showcase deep-link respects the currently-selected pillar so the
  // "see work samples" jump lands on the matching slice. With no pillar
  // selected, links to the unfiltered showcase.
  const showcaseHref = params.pillar
    ? `/showcase?pillar=${params.pillar}`
    : "/showcase";
  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      <span className="mr-2 text-[11px] uppercase tracking-wider text-ink-faint">
        Pillar
      </span>
      {pill("pillar", "All", {})}
      {pill("pillar", "STEM", { pillar: "stem" })}
      {pill("pillar", "Creative Media", { pillar: "creative-media" })}
      {pill("pillar", "Professional Services", { pillar: "professional-services" })}
      <Link
        href={showcaseHref}
        className="ml-1 text-xs text-ink-faint hover:text-ink"
      >
        See work samples →
      </Link>
      <span className="ml-4 mr-2 text-[11px] uppercase tracking-wider text-ink-faint">
        Kind
      </span>
      {pill("kind", "All", {})}
      {pill("kind", "Video", { kind: "video" })}
      {pill("kind", "Audio", { kind: "audio" })}
    </div>
  );
}

function AssetCard({ asset }: { asset: MediaAsset }) {
  const uploader = MOCK_USERS.find((u) => u.id === asset.uploaderId) ?? null;
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <CardEyebrow>
            {INDUSTRY_LABELS[asset.industry]} ·{" "}
            {MEDIA_ASSET_KIND_LABELS[asset.kind]}
          </CardEyebrow>
          <CardTitle className="mt-1">{asset.title}</CardTitle>
        </div>
        <TierGateBadge gate={asset.tierGate} />
      </div>

      {/* Player stub — sandbox renders a placeholder; production will
          mount the Mux player keyed off `playbackUrl` (which becomes a
          Mux playback ID in the real schema). */}
      <div
        className="mt-4 flex aspect-video items-center justify-center rounded-xl border text-xs text-ink-faint"
        style={{
          borderColor: "rgba(216, 40, 160, 0.25)",
          backgroundColor: "rgba(80, 112, 240, 0.06)",
        }}
      >
        {asset.kind === "video"
          ? "Video player mounts here"
          : "Audio player mounts here"}
        {asset.duration && (
          <span className="ml-2 text-ink-muted">· {asset.duration}</span>
        )}
      </div>

      <p className="mt-4 text-sm text-ink-muted line-clamp-3">
        {asset.description}
      </p>

      <div className="mt-4 flex items-center justify-between">
        {uploader ? (
          <Link
            href={`/u/${uploader.handle}`}
            className="flex items-center gap-2 text-xs text-ink-muted hover:text-ink"
          >
            <Avatar user={uploader} size="sm" />
            {publicName(uploader)}
          </Link>
        ) : (
          <span className="text-xs text-ink-faint">Unknown uploader</span>
        )}
        <a
          href={asset.playbackUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs underline"
          style={{ color: "#D828A0" }}
        >
          Open source ↗
        </a>
      </div>
    </Card>
  );
}

function TierGateBadge({ gate }: { gate: MembershipTier }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
      style={{
        backgroundColor: "rgba(216, 40, 160, 0.12)",
        color: "#D828A0",
      }}
    >
      {TIER_LABELS[gate]}+
    </span>
  );
}

function StatusChip({ status }: { status: MediaAsset["status"] }) {
  const colors: Record<
    MediaAsset["status"],
    { bg: string; fg: string; label: string }
  > = {
    draft: { bg: "var(--surface-inset)", fg: "var(--ink-muted)", label: "Draft" },
    pending_review: {
      bg: "rgba(80, 112, 240, 0.15)",
      fg: "#5070F0",
      label: "Pending review",
    },
    published: {
      bg: "rgba(0, 112, 72, 0.15)",
      fg: "#007048",
      label: "Published",
    },
    rejected: {
      bg: "rgba(216, 40, 160, 0.15)",
      fg: "#D828A0",
      label: "Rejected",
    },
    archived: {
      bg: "var(--surface-inset)",
      fg: "var(--ink-faint)",
      label: "Archived",
    },
  };
  const c = colors[status];
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {c.label}
    </span>
  );
}
