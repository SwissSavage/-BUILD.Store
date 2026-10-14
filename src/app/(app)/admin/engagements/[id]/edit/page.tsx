/**
 * Edit a composed engagement.
 *
 * Reached from the engagement panel on the project page. Admin only:
 * the Builder's route to changing terms is declining them, not editing
 * them, and that asymmetry is deliberate. The admin writes the terms,
 * the Builder agrees or does not.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { clients, projects } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-stub";
import { CardEyebrow } from "@/components/Card";
import { EditEngagementForm } from "@/components/EditEngagementForm";

interface EngagementAttachment {
  name: string;
  mimeType: string;
  sizeBytes: number;
  base64: string;
}

export const dynamic = "force-dynamic";

export default async function EditEngagementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  if (!project || project.deletedAt) notFound();

  // Not a direct engagement, or already sent back. Neither is editable
  // here; a declined engagement is composed fresh rather than revived.
  if (!project.engagementState || project.engagementState === "declined") {
    redirect(`/projects/${id}`);
  }

  const [client] = project.clientRefId
    ? await db
        .select({ displayName: clients.displayName })
        .from(clients)
        .where(eq(clients.id, project.clientRefId))
        .limit(1)
    : [];

  const files = ((project.engagementAttachments ?? []) as EngagementAttachment[]).map(
    (f) => ({ name: f.name, sizeBytes: f.sizeBytes }),
  );

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <CardEyebrow>Admin · Engagement</CardEyebrow>
          <h1 className="mt-2 font-display text-3xl font-semibold">
            Edit terms
          </h1>
        </div>
        <Link
          href={`/projects/${id}`}
          className="text-xs text-brand-magentaText hover:underline"
        >
          ← Back to the engagement
        </Link>
      </div>

      <div className="mt-8">
        <EditEngagementForm
          projectId={project.id}
          title={project.title}
          scope={project.engagementScope ?? project.description}
          basis={(project.engagementBasis ?? "hourly") as "hourly" | "fixed"}
          clientRate={String(Number(project.engagementRate ?? 0))}
          ceilingHours={
            project.engagementCeilingHours
              ? String(Number(project.engagementCeilingHours))
              : null
          }
          state={project.engagementState as "awaiting_talent" | "accepted"}
          clientDisplayName={client?.displayName ?? project.clientId}
          existingFiles={files}
        />
      </div>
    </div>
  );
}
