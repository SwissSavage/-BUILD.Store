import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { inboundSubmissions, landingSubmissionDocuments } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth-stub";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string; idx: string }> }) {
  const user = await getCurrentUser();
  if (!user?.isAdmin) return new Response("Not found", { status: 404 });
  const { id, idx } = await context.params;
  if (!/^landing_[0-9a-f-]+$/i.test(id) || !/^\d+$/.test(idx)) return new Response("Not found", { status: 404 });
  const [row] = await db.select({ attachments: inboundSubmissions.attachments }).from(inboundSubmissions).where(eq(inboundSubmissions.id, id));
  const attachment = (row?.attachments as Array<{ name: string; type: string }> | undefined)?.[Number(idx)];
  if (!attachment || attachment.type !== "application/pdf") return new Response("Not found", { status: 404 });
  const [document] = await db.select({ content: landingSubmissionDocuments.contentBase64 }).from(landingSubmissionDocuments).where(and(eq(landingSubmissionDocuments.submissionId, id), eq(landingSubmissionDocuments.documentIndex, Number(idx))));
  if (!document) return new Response("Not found", { status: 404 });
  const bytes = Buffer.from(document.content, "base64");
  return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${attachment.name.replace(/[^\w. -]/g, "_")}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
