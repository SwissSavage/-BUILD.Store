/**
 * Serve a portfolio document attached to a proposal.
 *
 * Mirrors /api/rfps/[id]/attachments/[idx]: base64 lives inline on
 * project_applications.attachments, decoded here and streamed as a
 * download. Migrates to an R2 signed-URL redirect with #58.
 *
 * ACCESS: admin, or the contractor who attached it. Nobody else, ever.
 * These are portfolio documents someone shared to win a specific piece
 * of work — a client browsing proposals must not be able to pull
 * someone's case-study deck and route around the cooperative, which is
 * the same rule the profile-visibility matrix enforces everywhere else.
 */
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth-stub";
import { db } from "@/db/client";
import { projectApplications } from "@/db/schema";

interface ProposalAttachment {
  name: string;
  mimeType: string;
  sizeBytes: number;
  base64: string;
}

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string; idx: string }> },
): Promise<Response> {
  const viewer = await getCurrentUser();
  if (!viewer) {
    return NextResponse.json({ error: "sign in required" }, { status: 401 });
  }

  const { id, idx } = await ctx.params;
  const index = Number.parseInt(idx, 10);
  if (!Number.isFinite(index) || index < 0) {
    return NextResponse.json({ error: "invalid index" }, { status: 400 });
  }

  const [row] = await db
    .select({
      attachments: projectApplications.attachments,
      userId: projectApplications.userId,
    })
    .from(projectApplications)
    .where(eq(projectApplications.id, id))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Owner or admin. Deliberately checked after the row loads so the
  // answer does not leak whether a given proposal id exists.
  if (!viewer.isAdmin && row.userId !== viewer.id) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const attachments = (row.attachments ?? []) as ProposalAttachment[];
  const att = attachments[index];
  if (!att) {
    return NextResponse.json({ error: "attachment not found" }, { status: 404 });
  }

  const buf = Buffer.from(att.base64, "base64");
  const body = new Uint8Array(buf);

  return new Response(body, {
    headers: {
      "Content-Type": att.mimeType || "application/octet-stream",
      // `attachment` rather than `inline`: an uploaded document is
      // untrusted content, and rendering it in-origin would let a
      // crafted SVG or HTML file run script against the session.
      "Content-Disposition": `attachment; filename="${att.name.replace(/"/g, "")}"`,
      "Content-Length": String(buf.byteLength),
      "Cache-Control": "private, no-store",
    },
  });
}
