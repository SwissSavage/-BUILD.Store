/**
 * /api/storage/health — probe the three storage backends.
 *
 * Admin-only. Returns per-driver status so ops can see which of the
 * three legs is degraded at a glance. Cheap to hit — each probe is
 * a HEAD-style call (HeadBucket for R2, files.get on root folder for
 * Drive, stat on the upload dir for Hetzner).
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-stub";
import { storageHealth } from "@/lib/storage";

export async function GET(): Promise<Response> {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "admin required" }, { status: 403 });
  }
  const results = await storageHealth();
  const worst = results.some((r) => r.status === "unhealthy")
    ? "unhealthy"
    : results.some((r) => r.status === "degraded")
      ? "degraded"
      : "ok";
  return NextResponse.json(
    { overall: worst, drivers: results, checkedAt: new Date().toISOString() },
    {
      headers: {
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    },
  );
}
