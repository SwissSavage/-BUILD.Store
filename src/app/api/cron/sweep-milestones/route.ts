/**
 * Daily sweep cron — milestones + weekly project rollup + agreement
 * renewals. Endpoint kept named "sweep-milestones" for backwards
 * compatibility with the Dokploy scheduled task already pointing at
 * it; the response includes results from all three sweeps.
 *
 * Runs on each call:
 *   - Milestone escalating pre-due pings (7d → 3d → 1d → day-of)
 *     + daily overdue admin escalation
 *   - Weekly project digest (only fires when today is Monday UTC)
 *   - Agreement renewal escalating pings (60d → 30d → 7d → day-of)
 *     + daily overdue admin escalation for lapsed renewals
 *   - MVP score recompute across every member
 *
 * Callers are external cron services (Vercel Cron, GitHub Actions
 * cron, Dokploy's scheduled tasks, etc.) that hit this URL once
 * per day.
 *
 * Auth is a shared-secret bearer header: `Authorization: Bearer
 * $CRON_SECRET`. Missing/mismatched = 401 with no body.
 * `CRON_SECRET` env var must be set in production; in dev the
 * route no-ops with a 403 unless the env var is set so a stray
 * request doesn't spam notifications.
 *
 * Response is a small JSON summary of how much fired — useful for
 * cron dashboards and for smoke-testing after deploy.
 */
import { NextResponse } from "next/server";
import {
  runMilestoneSweep,
  runWeeklyProjectRollup,
} from "@/lib/milestone-actions";
import { runAgreementRenewalSweep } from "@/lib/agreement-renewal-actions";
import { runFraudScan } from "@/lib/fraud-scan";
import { purgeExpiredProjects } from "@/lib/project-trash-actions";
import { recomputeAllMvpScores } from "@/lib/writers/mvp-score";

export const runtime = "nodejs";
// Never cache — every request runs the sweep freshly.
export const dynamic = "force-dynamic";

function unauthorized() {
  return new NextResponse(null, { status: 401 });
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      {
        ok: false,
        reason:
          "CRON_SECRET env var is not set. Refusing to run so an unauthed request can't spam notifications.",
      },
      { status: 403 },
    );
  }

  const auth = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret}`;
  // Constant-time comparison to avoid timing side-channels on the
  // header check. Small strings so the perf cost is negligible.
  if (
    auth.length !== expected.length ||
    !timingSafeEqual(auth, expected)
  ) {
    return unauthorized();
  }

  const sweep = await runMilestoneSweep();
  const rollup = await runWeeklyProjectRollup();
  // Task #55 — same daily cron also runs the agreement renewal
  // sweep. Escalating 60/30/7/day-of pings fire on the natural
  // pre-renewal cadence; bucket transitions re-fire even if a
  // less-urgent bucket already pinged.
  const renewals = await runAgreementRenewalSweep();
  // Task #56 — fraud-signal sweep runs weekly (Sundays UTC). The
  // function no-ops on non-Sunday even though we call it daily,
  // so the cron config stays a single daily job.
  const fraud = await runFraudScan();

  // Trash retention — clears projects past the restore window along
  // with their applications and milestones.
  const trash = await purgeExpiredProjects();
  // MVP recompute. Scores already update the moment a peer review
  // lands, so this exists for the time-dependent half of the formula:
  // compliance penalties expire on a 90-day clock, and without a
  // daily pass an expired penalty keeps depressing someone's OVR
  // until the next review happens to arrive. Also picks up any member
  // whose recompute failed mid-request.
  //
  // Wrapped because a scoring failure must not abort the sweeps above
  // it, which have already fired their notifications by this point.
  let mvp: { recomputed: number } | { error: string };
  try {
    mvp = await recomputeAllMvpScores();
  } catch (err) {
    mvp = { error: err instanceof Error ? err.message : String(err) };
    // eslint-disable-next-line no-console
    console.error("[cron] MVP recompute failed", err);
  }

  return NextResponse.json({
    ok: true,
    ranAt: new Date().toISOString(),
    milestoneSweep: sweep,
    weeklyRollup: rollup,
    agreementRenewals: renewals,
    fraudScan: fraud,
    trashPurge: trash,
    mvpRecompute: mvp,
  });
}

/**
 * Constant-time string comparison. Both strings must already be the
 * same length; caller checks that first.
 */
function timingSafeEqual(a: string, b: string): boolean {
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}
