/**
 * Serve an engagement reference file back to someone entitled to it.
 *
 * Base64 attachments live inline on projects.engagement_attachments;
 * this decodes one by index and streams it as a download. When R2
 * storage lands (#58) this becomes a signed-URL redirect and the
 * column drains.
 *
 * WHY THIS IS NOT ADMIN-ONLY
 *
 * The RFP equivalent is admin-only because briefs are pre-scrub and
 * may carry PII nobody has redacted. These are the opposite case: an
 * admin attached them specifically so the assigned Builder could read
 * them before accepting terms, and a review screen whose documents
 * 403 is a review screen that cannot be reviewed.
 *
 * So: admins, or the Builder assigned to this engagement. Nobody else,
 * and never on the strength of holding the URL.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth-stub";
import { db } from "@/db/client";
import { projects } from "@/db/schema";

interface EngagementAttachment {
  name: string;
  mimeType: string;
  sizeBytes: number;
  base64: string;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; idx: string }> },
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  const { id, idx } = await ctx.params;
  const index = Number.parseInt(idx, 10);
  if (!Number.isFinite(index) || index < 0) {
    return NextResponse.json({ error: "invalid index" }, { status: 400 });
  }

  const [row] = await db
    .select({
      attachments: projects.engagementAttachments,
      assignedMemberIds: projects.assignedMemberIds,
      adminUserIds: projects.adminUserIds,
    })
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const entitled =
    user.isAdmin ||
    (row.assignedMemberIds ?? []).includes(user.id) ||
    (row.adminUserIds ?? []).includes(user.id);
  if (!entitled) {
    return NextResponse.json({ error: "not yours" }, { status: 403 });
  }

  const attachments = (row.attachments ?? []) as EngagementAttachment[];
  const att = attachments[index];
  if (!att) {
    return NextResponse.json({ error: "attachment not found" }, { status: 404 });
  }

  const buf = Buffer.from(att.base64, "base64");
  // Explicit ArrayBuffer copy avoids the SharedArrayBuffer inference
  // that some Node versions surface here.
  const body = new Uint8Array(buf).buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength,
  );
  const safeName = att.name.replace(/[^\w.\- ]/g, "_") || "attachment";
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": att.mimeType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${safeName}"`,
      "Content-Length": String(buf.byteLength),
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}
