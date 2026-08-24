/**
 * Task #29 — serve an RFP attachment back to the requester.
 *
 * Base64 attachments live inline on projects.rfp_attachments; this
 * route decodes one by index and streams it as a download. Admin-only
 * because RFP briefs are pre-scrub and may contain PII the admin
 * hasn't redacted yet (task #39 scrubber is applied to description
 * text, not to attached PDFs).
 *
 * When R2 storage lands (#58), this route migrates to a signed URL
 * redirect and the base64 column drains.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth-stub";
import { db } from "@/db/client";
import { projects } from "@/db/schema";

interface RfpAttachment {
  name: string;
  mimeType: string;
  sizeBytes: number;
  base64: string;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; idx: string }> },
): Promise<Response> {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "admin required" }, { status: 403 });
  }

  const { id, idx } = await ctx.params;
  const index = Number.parseInt(idx, 10);
  if (!Number.isFinite(index) || index < 0) {
    return NextResponse.json({ error: "invalid index" }, { status: 400 });
  }

  const [row] = await db
    .select({ attachments: projects.rfpAttachments })
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const attachments = (row.attachments ?? []) as RfpAttachment[];
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
