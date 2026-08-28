/**
 * /api/payments/health — probe every outbound payout rail.
 *
 * Admin-only. Mirrors /api/storage/health: one row per rail with the
 * env vars each needs and whether they're present, so ops can see at
 * a glance which rails can actually move money.
 *
 * `not_configured` is an expected state, not a failure — assisted
 * rails need no credentials, and FM may deliberately leave a rail
 * dark. Overall status only degrades on rails that are supposed to be
 * live and aren't.
 */
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth-stub";
import { paymentsHealth, railIsAutomated } from "@/lib/payments";

export async function GET(): Promise<Response> {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "admin required" }, { status: 403 });
  }

  const rails = await paymentsHealth();

  // An assisted rail sitting at "ok" with no credentials is correct.
  // Only automated rails that can't dispatch drag the overall status.
  const automated = rails.filter((r) => railIsAutomated(r.rail));
  const anyAutomatedLive = automated.some((r) => r.status === "ok");
  const overall = anyAutomatedLive
    ? "ok"
    : automated.some((r) => r.status === "degraded")
      ? "degraded"
      : "unhealthy";

  return NextResponse.json(
    {
      overall,
      note: anyAutomatedLive
        ? undefined
        : "No automated rail can currently dispatch. Every payout will route to the admin queue for manual send.",
      rails,
      checkedAt: new Date().toISOString(),
    },
    {
      headers: { "Cache-Control": "private, max-age=0, must-revalidate" },
    },
  );
}
