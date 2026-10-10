/**
 * The contract, on a page you can get to.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-09)
 *
 * Jamar: "where am I supposed to view the Contract? It's not clickable
 * from the Contracts tab? And I don't see where it's supposed to be in
 * the menu."
 *
 * He was right and it was worse than a missing link. The engagement
 * wrote nine columns of terms, references and state, and not one
 * surface rendered any of them. The composer could create a contract,
 * the Builder could accept it, and after that the only way to read what
 * had been agreed was to query the database. The record existed and
 * nobody could look at it, which is most of the way back to the text
 * message this was built to replace.
 *
 * WHO SEES WHICH NUMBER
 *
 * Admins see the chain: the client rate, the payout, the margin.
 * The assigned Builder sees their payout and nothing about what the
 * client pays, the same rule the review screen follows. Everyone else
 * on the page sees neither, because a contract's pricing is not
 * cooperative-wide reading.
 * ─────────────────────────────────────────────────────────────
 */
import Link from "next/link";
import { formatFileSize } from "@/lib/engagement-reference-limits";
import type { Project } from "@/lib/types";

const STATE_LABEL: Record<string, string> = {
  awaiting_talent: "Awaiting the Builder",
  accepted: "Accepted and running",
  declined: "Sent back",
};

const STATE_ACCENT: Record<string, string> = {
  awaiting_talent: "#D828A0",
  accepted: "#13A06A",
  declined: "#D828A0",
};

export function EngagementTermsPanel({
  project,
  clientDisplayName,
  viewer,
}: {
  project: Project;
  clientDisplayName: string;
  /** Decides which side of the rate the reader is shown. */
  viewer: "admin" | "talent" | "other";
}) {
  if (!project.engagementState) return null;

  const state = project.engagementState;
  const hourly = project.engagementBasis === "hourly";
  const clientRate = Number(project.engagementRate ?? 0);
  const ceiling = project.engagementCeilingHours;
  const files = project.engagementAttachments ?? [];
  const links = project.engagementLinks ?? [];

  const label = "text-[11px] uppercase tracking-wider text-ink-muted";

  return (
    <section className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className={label}>Engagement</p>
          <p className="mt-1 text-lg font-semibold">{clientDisplayName}</p>
        </div>
        <span
          className="rounded-full px-2.5 py-1 text-[11px]"
          style={{
            backgroundColor: `${STATE_ACCENT[state]}22`,
            color: STATE_ACCENT[state],
          }}
        >
          {STATE_LABEL[state]}
        </span>
      </div>

      {/* ── terms ──────────────────────────────────────────── */}
      <div className="mt-5 flex flex-wrap gap-x-10 gap-y-4">
        {viewer === "admin" && (
          <div>
            <p className="text-xl font-semibold">
              ${clientRate.toLocaleString()}
              {hourly && (
                <span className="text-sm font-normal text-ink-muted">/hr</span>
              )}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-faint">Client pays</p>
          </div>
        )}
        {(viewer === "admin" || viewer === "talent") && (
          <div>
            <p className="text-xl font-semibold">
              ${Number(project.talentBaseAmount ?? 0).toLocaleString()}
              {hourly && (
                <span className="text-sm font-normal text-ink-muted">/hr</span>
              )}
            </p>
            <p className="mt-0.5 text-[11px] text-ink-faint">
              {viewer === "talent" ? "Paid to you" : "Builder is paid"}
            </p>
          </div>
        )}
        {hourly && (
          <div>
            <p className="text-xl font-semibold">{ceiling ?? "No cap"}</p>
            <p className="mt-0.5 text-[11px] text-ink-faint">
              {ceiling
                ? "Hours not to exceed"
                : "No hours agreed. Bill what is used."}
            </p>
          </div>
        )}
      </div>

      {/* A blank ceiling on a running hourly engagement is the exact
          gap that caused two renegotiations with this client before.
          Said out loud rather than left as an absent field. */}
      {hourly && !ceiling && state === "accepted" && viewer === "admin" && (
        <p className="mt-4 rounded-lg border border-[#D828A0]/40 bg-[#D828A0]/5 px-3 py-2 text-xs text-ink">
          Running hourly with no cap of record. Whatever hours were agreed
          verbally are not written down anywhere.
        </p>
      )}

      {project.engagementScope && (
        <div className="mt-5">
          <p className={label}>Scope</p>
          <p className="mt-1 whitespace-pre-line text-sm text-ink-muted">
            {project.engagementScope}
          </p>
        </div>
      )}

      {/* ── references ─────────────────────────────────────── */}
      {(links.length > 0 || files.length > 0) && (
        <div className="mt-5">
          <p className={label}>Reference material</p>
          <ul className="mt-2 space-y-1.5">
            {links.map((l) => (
              <li key={l.url}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-sm text-brand-magentaText hover:underline"
                >
                  {l.label}
                </a>
              </li>
            ))}
            {files.map((f, i) => (
              <li key={`${f.name}:${i}`}>
                <a
                  href={`/api/engagements/${project.id}/attachments/${i}`}
                  className="text-sm text-brand-magentaText hover:underline"
                >
                  {f.name}
                </a>
                <span className="ml-2 text-[10px] text-ink-faint">
                  {formatFileSize(f.sizeBytes)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {state === "declined" && project.engagementDeclineReason && (
        <div className="mt-5">
          <p className={label}>Sent back because</p>
          <p className="mt-1 text-sm">{project.engagementDeclineReason}</p>
        </div>
      )}

      {viewer === "admin" && (
        <div className="mt-5 flex flex-wrap gap-4 border-t border-[var(--surface-border)] pt-4 text-[11px]">
          {project.hubspotDealId ? (
            <a
              href={`https://app.hubspot.com/contacts/record/0-3/${project.hubspotDealId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-magentaText hover:underline"
            >
              Open the HubSpot deal →
            </a>
          ) : (
            <Link
              href="/admin/contracts"
              className="text-brand-magentaText hover:underline"
            >
              No HubSpot deal linked. Create it →
            </Link>
          )}
          {state === "awaiting_talent" && (
            <Link
              href={`/projects/${project.id}/review`}
              className="text-ink-muted hover:text-brand-magentaText"
            >
              See what the Builder sees →
            </Link>
          )}
        </div>
      )}
    </section>
  );
}
