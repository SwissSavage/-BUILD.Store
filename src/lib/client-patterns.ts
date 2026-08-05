/**
 * Client-dissatisfaction pattern aggregations.
 *
 * Keys off `customerEmail` from customer_feedback as the client
 * identity (external clients don't have platform accounts, so email
 * is the natural stable id). Rolls up rebates + low ratings +
 * disputes per client so admin can spot counterparty patterns
 * instead of treating every event as isolated.
 *
 * The flag threshold — "3+ rebates OR 3+ disputes in rolling 12mo"
 * — signals a client whose behavior may warrant review. It's a
 * signal, not a verdict; admin makes the call.
 *
 * Read-only. No side effects. Powers the /admin/clients surface.
 */
import { MOCK_CUSTOMER_FEEDBACK } from "@/lib/mock-data/customer-feedback";
import { MOCK_RESERVE_POOL_LEDGER } from "@/lib/mock-data/reserve-pool";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import type {
  CustomerFeedback,
  ReservePoolLedgerEntry,
} from "@/lib/types";

/** Low-rating threshold — client rated the engagement at or below this. */
export const LOW_RATING_THRESHOLD = 3;

/** Pattern-flag thresholds — hits in rolling 12mo trigger the flag. */
export const PATTERN_FLAG_REBATES = 3;
export const PATTERN_FLAG_DISPUTES = 3;
export const PATTERN_FLAG_LOW_RATINGS = 4;

/** Rolling window in milliseconds — 12 months. */
const ROLLING_WINDOW_MS = 365 * 24 * 60 * 60 * 1000;

export interface ClientPatternSummary {
  /** Email is the client identity. Lowercased for case-insensitive keying. */
  customerEmail: string;
  /** Display name — from the most recent feedback row. */
  customerName: string;
  /** Total feedback entries on file across all engagements. */
  totalFeedback: number;
  /** Feedback with overallStars ≤ LOW_RATING_THRESHOLD. */
  lowRatingsAllTime: number;
  lowRatingsRolling: number;
  /** Feedback with clientConfirmationStatus === "disputed". */
  disputesAllTime: number;
  disputesRolling: number;
  /** Reserve-pool rebate debit entries on this client's projects. */
  rebatesAllTime: number;
  rebatesRolling: number;
  rebateTotalUsd: number;
  /** Every project id we have feedback on for this client. */
  projectIds: string[];
  /** True when any of the pattern thresholds land within the 12mo window. */
  flagged: boolean;
  flagReasons: string[];
}

function isWithinWindow(iso: string, nowMs: number): boolean {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return false;
  return nowMs - t <= ROLLING_WINDOW_MS;
}

/**
 * Compute the pattern summary for every unique client email in the
 * customer_feedback ledger. Sorted with flagged clients first.
 */
export function computeClientPatterns(): ClientPatternSummary[] {
  const nowMs = Date.now();
  const byEmail = new Map<
    string,
    {
      customerName: string;
      feedback: CustomerFeedback[];
      projectIds: Set<string>;
    }
  >();

  // Bucket feedback rows by client email (contract context only —
  // marketplace orders keyed to buyerId instead, out of scope for
  // client-dissatisfaction pattern surfacing).
  for (const f of MOCK_CUSTOMER_FEEDBACK) {
    if (f.contextKind !== "contract") continue;
    const key = f.customerEmail.trim().toLowerCase();
    if (!key) continue;
    const existing = byEmail.get(key) ?? {
      customerName: f.customerName,
      feedback: [],
      projectIds: new Set<string>(),
    };
    existing.feedback.push(f);
    existing.projectIds.add(f.contextId);
    // Freshest name wins for display.
    if (
      f.createdAt >=
      (existing.feedback[existing.feedback.length - 2]?.createdAt ?? "")
    ) {
      existing.customerName = f.customerName;
    }
    byEmail.set(key, existing);
  }

  // Aggregate rebate entries. Keying: rebate is on a project;
  // project maps to feedback → client email. Rebates on projects
  // with no feedback on file are counted separately below.
  const rebatesByProject = new Map<string, ReservePoolLedgerEntry[]>();
  for (const entry of MOCK_RESERVE_POOL_LEDGER) {
    if (entry.direction !== "debit") continue;
    if (entry.debitReason !== "client_rebate") continue;
    const list = rebatesByProject.get(entry.projectId) ?? [];
    list.push(entry);
    rebatesByProject.set(entry.projectId, list);
  }

  const summaries: ClientPatternSummary[] = [];
  for (const [email, group] of byEmail.entries()) {
    const lowRatingsAllTime = group.feedback.filter(
      (f) => f.overallStars <= LOW_RATING_THRESHOLD,
    ).length;
    const lowRatingsRolling = group.feedback.filter(
      (f) =>
        f.overallStars <= LOW_RATING_THRESHOLD &&
        isWithinWindow(f.createdAt, nowMs),
    ).length;
    const disputesAllTime = group.feedback.filter(
      (f) => f.clientConfirmationStatus === "disputed",
    ).length;
    const disputesRolling = group.feedback.filter(
      (f) =>
        f.clientConfirmationStatus === "disputed" &&
        isWithinWindow(f.createdAt, nowMs),
    ).length;

    // Rebates for this client's projects
    let rebatesAllTime = 0;
    let rebatesRolling = 0;
    let rebateTotalUsd = 0;
    for (const projectId of group.projectIds) {
      const entries = rebatesByProject.get(projectId) ?? [];
      for (const e of entries) {
        rebatesAllTime += 1;
        rebateTotalUsd += Math.abs(Number(e.amount));
        if (isWithinWindow(e.createdAt, nowMs)) {
          rebatesRolling += 1;
        }
      }
    }

    const flagReasons: string[] = [];
    if (rebatesRolling >= PATTERN_FLAG_REBATES) {
      flagReasons.push(
        `${rebatesRolling} rebates in the last 12 months (threshold ${PATTERN_FLAG_REBATES})`,
      );
    }
    if (disputesRolling >= PATTERN_FLAG_DISPUTES) {
      flagReasons.push(
        `${disputesRolling} disputes in the last 12 months (threshold ${PATTERN_FLAG_DISPUTES})`,
      );
    }
    if (lowRatingsRolling >= PATTERN_FLAG_LOW_RATINGS) {
      flagReasons.push(
        `${lowRatingsRolling} low ratings (≤${LOW_RATING_THRESHOLD}) in the last 12 months (threshold ${PATTERN_FLAG_LOW_RATINGS})`,
      );
    }

    summaries.push({
      customerEmail: email,
      customerName: group.customerName,
      totalFeedback: group.feedback.length,
      lowRatingsAllTime,
      lowRatingsRolling,
      disputesAllTime,
      disputesRolling,
      rebatesAllTime,
      rebatesRolling,
      rebateTotalUsd: Math.round(rebateTotalUsd * 100) / 100,
      projectIds: Array.from(group.projectIds),
      flagged: flagReasons.length > 0,
      flagReasons,
    });
  }

  // Flagged first; then by rebate count desc; then by name.
  summaries.sort((a, b) => {
    if (a.flagged !== b.flagged) return a.flagged ? -1 : 1;
    if (a.rebatesAllTime !== b.rebatesAllTime) {
      return b.rebatesAllTime - a.rebatesAllTime;
    }
    return a.customerName.localeCompare(b.customerName);
  });
  return summaries;
}

/**
 * Look up the pattern summary for a specific client by email.
 * Returns null when no feedback on file for that client.
 */
export function clientPatternForEmail(email: string): ClientPatternSummary | null {
  const key = email.trim().toLowerCase();
  return computeClientPatterns().find((s) => s.customerEmail === key) ?? null;
}

/**
 * Project titles for a client's engagement history — used by the
 * detail surface to show WHICH deals produced the pattern.
 */
export function projectTitlesForClient(projectIds: string[]): Array<{
  id: string;
  title: string;
}> {
  return projectIds.map((id) => {
    const p = MOCK_PROJECTS.find((x) => x.id === id);
    return { id, title: p?.title ?? id };
  });
}
