/**
 * Download the real invoice attached to this app's record of it.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-11-03)
 *
 * Same shape as the landing-submission and resume routes, deliberately,
 * because divergence between them would be a privacy bug rather than a
 * style difference:
 *
 *   - 404 rather than 403 for a non-admin, so the route does not
 *     confirm an invoice id exists to someone not allowed to see it.
 *   - Content-Disposition: attachment, so the PDF never renders inline.
 *   - no-store, so a financial document does not sit in a shared cache.
 *   - nosniff, so the bytes cannot be reinterpreted as something
 *     executable.
 *
 * The document is a client invoice: it carries the client's name, the
 * amount, and the terms. Depersonalization rules apply to what reaches
 * talent, and nothing here reaches talent.
 * ─────────────────────────────────────────────────────────────
 */
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { invoices } from "@/db/schema";
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
      name: invoices.sourceDocumentName,
      content: invoices.sourceDocumentBase64,
    })
    .from(invoices)
    .where(eq(invoices.id, id))
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
