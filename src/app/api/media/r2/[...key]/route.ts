/**
 * /api/media/r2/[...key] — public read proxy for R2-stored objects.
 *
 * Purpose: serve R2 objects through the FM domain instead of leaking
 * `<account>.r2.cloudflarestorage.com` URLs to end users. Once
 * `R2_PUBLIC_URL_BASE` is set (custom domain media.afuturemodern.com
 * → R2 bucket), callers should prefer `StoredFile.publicUrl` directly
 * and skip this proxy — same-origin CDN edge is cheaper than an app
 * server hop. This route stays as the fallback path for the pre-
 * custom-domain window (task #57 follow-up).
 *
 * Public read — images are for avatars, portfolios, product photos,
 * mood boards, etc. R2 keys are unguessable (random suffix from the
 * storage layer's generateKey), so listing isn't a concern; direct
 * access with the key is the intended flow.
 */
import { NextResponse } from "next/server";
import { readFile } from "@/lib/storage";

// Detect a mime from the key extension. Sharp-processed uploads are
// always .webp, so the common case is fast. Fall back to
// application/octet-stream for anything unexpected.
function mimeForKey(key: string): string {
  const dot = key.lastIndexOf(".");
  if (dot < 0) return "application/octet-stream";
  const ext = key.slice(dot + 1).toLowerCase();
  const map: Record<string, string> = {
    webp: "image/webp",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    avif: "image/avif",
    svg: "image/svg+xml",
  };
  return map[ext] ?? "application/octet-stream";
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ key: string[] }> },
): Promise<Response> {
  const { key } = await ctx.params;
  const joined = key.map(decodeURIComponent).join("/");
  if (!joined || joined.includes("..")) {
    return NextResponse.json({ error: "invalid key" }, { status: 400 });
  }

  try {
    const buf = await readFile("r2", joined);
    const body = new Uint8Array(buf).buffer.slice(
      buf.byteOffset,
      buf.byteOffset + buf.byteLength,
    );
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": mimeForKey(joined),
        "Content-Length": String(buf.byteLength),
        // Long cache — object keys are content-addressed-ish
        // (random suffix per upload), so a URL that resolves once
        // resolves forever. The browser + any downstream CDN can
        // hold on to it.
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
}
