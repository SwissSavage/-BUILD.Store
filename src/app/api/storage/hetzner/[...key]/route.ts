/**
 * /api/storage/hetzner/[...key] — proxy read for Hetzner-stored
 * files. Hetzner isn't a CDN, so we serve directly from the app
 * server. Admin-only for now — image-level policy (public avatars
 * etc.) lands with task #58's /media proxy, which will be public
 * for image kind and gated for the rest.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-stub";
import { readFile } from "@/lib/storage";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ key: string[] }> },
): Promise<Response> {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "admin required" }, { status: 403 });
  }
  const { key } = await ctx.params;
  const joined = key.map(decodeURIComponent).join("/");
  try {
    const buf = await readFile("hetzner", joined);
    // Convert Buffer to a fresh ArrayBuffer so the Response type
    // stays happy regardless of underlying pool sharing.
    const body = new Uint8Array(buf).buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.byteLength,
    );
    return new Response(body, {
      status: 200,
      headers: {
        // Content-Type defaults to octet-stream; callers who want a
        // richer MIME embed it in the key path or reference the
        // sidecar StoredFile.mimeType when serving.
        "Content-Type": "application/octet-stream",
        "Content-Length": String(buf.byteLength),
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "not found" },
      { status: 404 },
    );
  }
}
