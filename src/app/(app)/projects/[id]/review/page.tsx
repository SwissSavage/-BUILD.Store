/**
 * Where the email lands.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-08)
 *
 * An engagement composed through the direct motion sits in
 * awaiting_talent until the assigned Builder accepts the terms. This
 * is the screen the review email points at.
 *
 * Gated on being the assigned Builder, not on holding the link. A link
 * in an email forwards, and this page is the one place in the app where
 * a single click commits somebody's hours.
 *
 * The decision itself is gated again inside the server action, because
 * a server action is a public POST endpoint whose id is a content hash:
 * the gate here protects the page and nothing behind it. That confusion
 * was the dominant bug class in this codebase and it is not repeated.
 * ─────────────────────────────────────────────────────────────
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { clients, projects } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth-stub";
import { EngagementReviewCard } from "@/components/EngagementReviewCard";

interface EngagementAttachment {
  name: string;
  mimeType: string;
  sizeBytes: number;
  base64: string;
}

export default async function EngagementReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/signin?next=/projects/${id}/review`);

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  if (!project || project.deletedAt) notFound();

  const assigned = (project.assignedMemberIds ?? []) as string[];
  const admins = (project.adminUserIds ?? []) as string[];
  const isTalent = assigned.includes(user.id);
  const isAdmin = user.isAdmin || admins.includes(user.id);
  if (!isTalent && !isAdmin) notFound();

  // Not a direct engagement. Nothing here to review.
  if (!project.engagementState) redirect(`/projects/${id}`);

  const [client] = project.clientRefId
    ? await db
        .select({ displayName: clients.displayName })
        .from(clients)
        .where(eq(clients.id, project.clientRefId))
        .limit(1)
    : [];
  const clientDisplayName = client?.displayName ?? project.clientId;

  const files = ((project.engagementAttachments ?? []) as EngagementAttachment[]).map(
    (f) => ({ name: f.name, sizeBytes: f.sizeBytes }),
  );
  const links = (project.engagementLinks ?? []) as { label: string; url: string }[];

  // Already decided. Show what happened rather than the buttons.
  if (project.engagementState !== "awaiting_talent") {
    const accepted = project.engagementState === "accepted";
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <div
          className={`rounded-2xl border p-6 ${
            accepted
              ? "border-[var(--surface-border)] bg-[var(--surface)]"
              : "border-red-500/50 bg-red-500/5"
          }`}
        >
          <p className="text-[11px] uppercase tracking-wider text-ink-muted">
            {clientDisplayName}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{project.title}</h1>
          <p className="mt-4 text-sm text-ink-muted">
            {accepted
              ? "Terms accepted. This engagement is running."
              : "These terms were sent back."}
          </p>
          {!accepted && project.engagementDeclineReason && (
            <p className="mt-2 rounded-lg bg-[var(--surface-raised)] px-3 py-2 text-sm">
              {project.engagementDeclineReason}
            </p>
          )}
          <Link
            href={`/projects/${id}`}
            className="mt-5 inline-block text-[11px] text-brand-magentaText hover:underline"
          >
            Open the engagement
          </Link>
        </div>
      </main>
    );
  }

  // An admin looking at the Builder's screen sees it, and cannot act on
  // it: accepting on their behalf is the hot start this flow removed.
  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      {!isTalent && isAdmin && (
        <div className="mb-5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-raised)] px-4 py-3 text-xs text-ink-muted">
          This is the Builder&rsquo;s review screen, waiting on them. You cannot
          accept it for them.
        </div>
      )}
      {isTalent ? (
        <EngagementReviewCard
          projectId={project.id}
          title={project.title}
          clientDisplayName={clientDisplayName}
          scope={project.engagementScope ?? project.description}
          basis={(project.engagementBasis ?? "hourly") as "hourly" | "fixed"}
          payout={project.talentBaseAmount ?? "0"}
          ceilingHours={project.engagementCeilingHours}
          links={links}
          files={files}
          sentAt={project.engagementSentAt}
        />
      ) : (
        <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface)] p-6">
          <p className="text-[11px] uppercase tracking-wider text-ink-muted">
            {clientDisplayName}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">{project.title}</h1>
          <p className="mt-3 whitespace-pre-line text-sm text-ink-muted">
            {project.engagementScope ?? project.description}
          </p>
          <p className="mt-4 text-sm">
            Builder is paid ${project.talentBaseAmount ?? "0"}
            {project.engagementBasis === "hourly" ? "/hr" : ""}
            {project.engagementCeilingHours
              ? `, not to exceed ${project.engagementCeilingHours} hours`
              : ", no hours cap set"}
            .
          </p>
          {(links.length > 0 || files.length > 0) && (
            <ul className="mt-4 space-y-1.5">
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
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </main>
  );
}
