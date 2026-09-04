/**
 * What one member's account is carrying, before anyone deletes it.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-04)
 *
 * Jamar had a second viewer account for himself and wanted it gone
 * rather than suspended, because a suspended row still sits in the
 * users table and still counts toward "13 onboarded". Fair. But there
 * was no delete path anywhere in the app, deliberately, and adding one
 * without a guard is how a real member's ledger disappears because an
 * admin clicked the wrong row.
 *
 * THE ACTUAL DANGER IS THE CASCADES, NOT THE DELETE
 *
 * Fourteen tables cascade off users.id. Postgres will happily take all
 * fourteen with the parent row and report success. Eight of those hold
 * things nobody should be able to erase by deleting an account:
 *
 *   agreements              signed paperwork
 *   payout_methods          banking detail, evidence money moved
 *   portfolio_items         their work
 *   mvp_scores              standing
 *   mvp_compliance_penalties   compliance history
 *   portfolio_fraud_signals    fraud history, worst of all to lose
 *   artist_epks             published content
 *   community_messages      posts other threads reply to
 *
 * The other six are session and personal state, and losing them with
 * the account is correct: accounts, sessions, notifications,
 * calendar_availability, calendar_blocks, walkthrough_progress.
 *
 * So this splits the footprint in two. Anything in `blockers` means the
 * answer is suspend, not delete. `clears` is shown anyway, because an
 * admin about to delete should see what goes with it rather than
 * discover it afterwards.
 *
 * THE REMAINING ~40 REFERENCES ARE POSTGRES'S JOB
 *
 * Every other foreign key to users.id has no onDelete clause, which
 * means NO ACTION, which means the delete is refused outright. That is
 * a better guard than anything written here because it cannot drift
 * from the schema. This reader does not try to duplicate it. The action
 * catches the violation and translates it into something readable
 * instead of a 500.
 *
 * ONE FUNCTION, BOTH CALLERS
 *
 * The drill-down page calls this to decide whether to render the delete
 * control, and the server action calls it again to decide whether to
 * honour the request. The same function, not two lists that agree today
 * and disagree in a month. A visible button that the action refuses is
 * annoying; a hidden button the action would have honoured is a hole.
 * ─────────────────────────────────────────────────────────────
 */
import { count, eq } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { db } from "@/db/client";
import {
  accounts,
  agreements,
  artistEpks,
  calendarAvailability,
  calendarBlocks,
  communityMessages,
  mvpCompliancePenalties,
  mvpScores,
  notifications,
  payoutMethods,
  portfolioFraudSignals,
  portfolioItems,
  sessions,
  walkthroughProgress,
} from "@/db/schema";

export interface FootprintEntry {
  /** Table name, so the message matches what an admin sees in Studio. */
  table: string;
  /** Plain-language name for the admin surface. */
  label: string;
  count: number;
}

export interface MemberFootprint {
  /** Non-empty means this account must not be deleted. */
  blockers: FootprintEntry[];
  /** Rows that would go with the account, and should. */
  clears: FootprintEntry[];
  /** Unspent $BUILD. Any balance at all blocks. */
  buildTokenBalance: number;
  /** True only when nothing blocks. The single answer both callers use. */
  deletable: boolean;
}

async function countRows(
  table: PgTable,
  column: AnyPgColumn,
  uid: string,
): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(table)
    .where(eq(column, uid));
  return Number(row?.n ?? 0);
}

/**
 * Everything attached to one account, split by whether it may be lost.
 *
 * `buildTokenBalance` is passed in rather than re-read, because the
 * caller already has the user row and a second read is a second chance
 * for the two to disagree.
 */
export async function getMemberFootprint(
  uid: string,
  buildTokenBalance: string | number | null,
): Promise<MemberFootprint> {
  const [
    agreementCount,
    payoutMethodCount,
    portfolioCount,
    mvpScoreCount,
    penaltyCount,
    fraudSignalCount,
    epkCount,
    messageCount,
    accountCount,
    sessionCount,
    notificationCount,
    availabilityCount,
    blockCount,
    walkthroughCount,
  ] = await Promise.all([
    countRows(agreements, agreements.userId, uid),
    countRows(payoutMethods, payoutMethods.userId, uid),
    countRows(portfolioItems, portfolioItems.userId, uid),
    countRows(mvpScores, mvpScores.userId, uid),
    countRows(mvpCompliancePenalties, mvpCompliancePenalties.userId, uid),
    countRows(
      portfolioFraudSignals,
      portfolioFraudSignals.offendingUserId,
      uid,
    ),
    countRows(artistEpks, artistEpks.userId, uid),
    countRows(communityMessages, communityMessages.userId, uid),
    countRows(accounts, accounts.userId, uid),
    countRows(sessions, sessions.userId, uid),
    countRows(notifications, notifications.userId, uid),
    countRows(calendarAvailability, calendarAvailability.userId, uid),
    countRows(calendarBlocks, calendarBlocks.userId, uid),
    countRows(walkthroughProgress, walkthroughProgress.userId, uid),
  ]);

  const balance = Number(buildTokenBalance ?? 0);

  const blockers: FootprintEntry[] = [
    { table: "agreements", label: "Signed agreements", count: agreementCount },
    { table: "payout_methods", label: "Payout methods", count: payoutMethodCount },
    { table: "portfolio_items", label: "Portfolio items", count: portfolioCount },
    { table: "mvp_scores", label: "MVP standing", count: mvpScoreCount },
    {
      table: "mvp_compliance_penalties",
      label: "Compliance penalties",
      count: penaltyCount,
    },
    {
      table: "portfolio_fraud_signals",
      label: "Portfolio fraud signals",
      count: fraudSignalCount,
    },
    { table: "artist_epks", label: "EPK", count: epkCount },
    {
      table: "community_messages",
      label: "Community messages",
      count: messageCount,
    },
  ].filter((e) => e.count > 0);

  if (Number.isFinite(balance) && balance !== 0) {
    blockers.push({
      table: "users.build_token_balance",
      label: "Unspent $BUILD balance",
      count: balance,
    });
  }

  const clears: FootprintEntry[] = [
    { table: "accounts", label: "Sign-in provider links", count: accountCount },
    { table: "sessions", label: "Live sessions", count: sessionCount },
    { table: "notifications", label: "Notifications", count: notificationCount },
    {
      table: "calendar_availability",
      label: "Calendar availability",
      count: availabilityCount,
    },
    { table: "calendar_blocks", label: "Calendar blocks", count: blockCount },
    {
      table: "walkthrough_progress",
      label: "Walkthrough progress",
      count: walkthroughCount,
    },
  ].filter((e) => e.count > 0);

  return {
    blockers,
    clears,
    buildTokenBalance: Number.isFinite(balance) ? balance : 0,
    deletable: blockers.length === 0,
  };
}

/** One line an admin can read, for the audit entry and the error. */
export function describeBlockers(footprint: MemberFootprint): string {
  return footprint.blockers
    .map((b) => `${b.label} (${b.count})`)
    .join(", ");
}
