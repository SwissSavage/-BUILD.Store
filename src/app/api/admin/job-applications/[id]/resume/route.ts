/**
 * Download the resume attached to a member's job application.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-11-03)
 *
 * Mirrors the landing-submission attachment route exactly, because
 * that one already got the hard parts right and divergence here would
 * be a privacy bug rather than a style difference:
 *
 *   - 404 rather than 403 for a non-admin, so the route does not
 *     confirm that an application id exists to someone not allowed to
 *     see it.
 *   - Content-Disposition: attachment, so a PDF never renders inline
 *     in the admin's tab.
 *   - no-store, so a resume does not sit in a shared cache.
 *   - nosniff, so the browser cannot be talked into treating the bytes
 *     as something executable.
 *
 * The bytes live on the application row itself. See the WHY in
 * drizzle/0042_application_resumes.sql for why they are not in object
 * storage.
 * ─────────────────────────────────────────────────────────────
 */
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { jobApplications } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth-stub";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return new Response("Not found", { status: 404 });

  const { id } = await context.params;
  if (!/^[\w-]{1,64}$/.test(id)) {
    return new Response("Not found", { status: 404 });
  }

  const [row] = await db
    .select({
      name: jobApplications.resumeName,
      content: jobApplications.resumeBase64,
    })
    .from(jobApplications)
    .where(eq(jobApplications.id, id))
    .limit(1);

  if (!row?.content || !row.name) {
    return new Response("Not found", { status: 404 });
  }

  const bytes = Buffer.from(row.content, "base64");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${row.name.replace(/[^\w. -]/g, "_")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
