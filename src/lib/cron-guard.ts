/**
 * A sweep is not something a browser gets to run.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-07)
 *
 * runMilestoneSweep, runWeeklyProjectRollup, purgeExpiredProjects and
 * runDisclosureSweep all live in files carrying a module-level
 * "use server". That makes each of them a public POST endpoint with a
 * content-hashed id, exactly like any other server action.
 *
 * /api/cron/sweep-milestones checks CRON_SECRET before calling them.
 * The functions themselves checked nothing, so the route's guard
 * protected the route and not the work behind it. Anyone holding an
 * action id could:
 *
 *   - delete every project past the retention window, with its
 *     applications and milestones (purgeExpiredProjects)
 *   - take member profiles out of public discovery (runDisclosureSweep)
 *   - fire every pending milestone ping and weekly digest, repeatedly,
 *     at whatever rate they liked
 *
 * Same shape as the admin actions fixed on 2026-10-05: the page was
 * gated, the action behind it was not. This is the src/lib half of that
 * surface, which check-server-action-auth.mjs does not walk.
 *
 * WHY A PARAMETER RATHER THAN A SESSION
 *
 * There is no session. Cron is a machine with a shared secret, and the
 * secret cannot be guessed from a browser, so passing it in is a real
 * credential rather than a formality. Moving the sweeps into non-
 * "use server" modules would be structurally cleaner and is the right
 * follow-up; this is the small change that closes the hole tonight
 * without moving four files.
 * ─────────────────────────────────────────────────────────────
 */
import { timingSafeEqual } from "crypto";

export class CronAuthError extends Error {
  constructor() {
    // Deliberately uninformative. A caller who guessed wrong learns
    // nothing about whether the secret is set, long, or close.
    super("Not authorised.");
    this.name = "CronAuthError";
  }
}

/**
 * Throws unless the caller supplied the configured cron secret.
 *
 * Refuses when CRON_SECRET is unset rather than waving the call
 * through, because an unset secret in production is the same hole with
 * extra steps, and in development it is better to notice.
 */
export function assertCronCaller(supplied: string | undefined | null): void {
  const expected = process.env.CRON_SECRET;
  if (!expected) throw new CronAuthError();
  if (!supplied) throw new CronAuthError();

  // Constant-time, and length-safe: Buffer.compare on different lengths
  // throws rather than returning false, so compare lengths first.
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length) throw new CronAuthError();
  if (!timingSafeEqual(a, b)) throw new CronAuthError();
}
