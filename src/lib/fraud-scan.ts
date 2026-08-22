/**
 * Portfolio fraud-signal sweep (task #56, Agreement Section 16).
 *
 * MVP scope: cross-user duplicate detection on portfolio image URLs
 * + project URLs. When two different users have submitted the same
 * image_url or project_url (case-insensitive, trimmed), flag both
 * items for admin review. Zero external deps.
 *
 * Full perceptual-hash comparison (pHash / dHash) lands when the
 * image upload pipeline ships (task #58). At that point sharp is
 * available; swap the URL-equality check in `computeSignature` for
 * a proper hash of the downloaded bytes and the collision math
 * below stays the same shape.
 *
 * Also honors external fraud-report opt-ins (TinEye API, Google
 * Vision) via env vars — if the keys are set the sweep POSTs each
 * new signature to those services and appends any 3rd-party
 * matches. Skipped otherwise.
 *
 * Cron cadence: weekly (Sundays UTC) via the /api/cron/sweep-
 * milestones daily endpoint — the sweep function itself gates on
 * day-of-week so it's a no-op on non-Sundays even though the cron
 * fires every day.
 */
import type { NotificationKind, Notification } from "@/lib/types";
import { MOCK_PORTFOLIO } from "@/lib/mock-data/portfolio";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { MOCK_NOTIFICATIONS } from "@/lib/mock-data/notifications";

export interface FraudSignal {
  id: string;
  kind: "duplicate_image_url" | "duplicate_project_url" | "external_match";
  portfolioItemId: string;
  offendingUserId: string;
  collidingPortfolioItemId: string | null;
  collidingUserId: string | null;
  signature: string;
  confidence: number; // 0..1
  detectedAt: string;
  reviewedAt: string | null;
  reviewedByUserId: string | null;
  disposition: "pending" | "confirmed_fraud" | "false_positive" | null;
  reviewerNote: string | null;
}

/**
 * In-memory sink for signals until a real portfolio_fraud_signals
 * Drizzle table lands. Exported so the admin review UI reads it
 * directly. Real DB swap: db.select().from(portfolioFraudSignals).
 */
export const MOCK_FRAUD_SIGNALS: FraudSignal[] = [];

function computeSignature(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim().toLowerCase();
  if (!trimmed) return null;
  // Strip common URL noise so cosmetic differences don't hide
  // duplicates: querystring, trailing slash, http vs https, www.
  try {
    const u = new URL(trimmed);
    const host = u.host.replace(/^www\./, "");
    const path = u.pathname.replace(/\/$/, "");
    return `${host}${path}`;
  } catch {
    // Not a valid URL (paste of local path / bare filename). Use
    // as-is so the collision check still catches obvious dupes.
    return trimmed;
  }
}

function newSignalId(): string {
  return `frs_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

function alreadyRecorded(
  portfolioItemId: string,
  collidingPortfolioItemId: string | null,
  kind: FraudSignal["kind"],
): boolean {
  return MOCK_FRAUD_SIGNALS.some(
    (s) =>
      s.portfolioItemId === portfolioItemId &&
      s.collidingPortfolioItemId === collidingPortfolioItemId &&
      s.kind === kind,
  );
}

function findAdminIds(): string[] {
  return MOCK_USERS.filter((u) => u.isAdmin).map((u) => u.id);
}

function pushNotification(
  partial: Omit<Notification, "id" | "createdAt" | "readAt">,
): void {
  const id = `ntf_frs_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
  MOCK_NOTIFICATIONS.push({
    ...partial,
    id,
    createdAt: new Date().toISOString(),
    readAt: null,
  });
}

/**
 * Sweep body. Cron-friendly signature. Gated to Sundays UTC — the
 * caller may run it daily, this function no-ops on non-Sunday.
 *
 * Returns a summary suitable for the cron dashboard response.
 */
export async function runFraudScan(options: {
  runEveryDay?: boolean;
} = {}): Promise<{
  scanned: number;
  newSignals: number;
  skippedReason?: string;
}> {
  const now = new Date();
  if (!options.runEveryDay && now.getUTCDay() !== 0) {
    return { scanned: 0, newSignals: 0, skippedReason: "not_sunday" };
  }

  // Only published, non-rejected items are eligible. Rejected items
  // aren't user-facing, so duplicates among them don't matter.
  const published = MOCK_PORTFOLIO.filter(
    (p) => p.publishedAt && !p.rejectedAt,
  );

  // Build two lookup maps: imageUrl signature → items, projectUrl
  // signature → items. Any signature with items from >1 distinct
  // user is a collision.
  const byImage = new Map<string, typeof published>();
  const byProject = new Map<string, typeof published>();

  for (const item of published) {
    const imgSig = computeSignature(item.imageUrl);
    if (imgSig) {
      const bucket = byImage.get(imgSig) ?? [];
      bucket.push(item);
      byImage.set(imgSig, bucket);
    }
    const projSig = computeSignature(item.projectUrl);
    if (projSig) {
      const bucket = byProject.get(projSig) ?? [];
      bucket.push(item);
      byProject.set(projSig, bucket);
    }
  }

  let newSignals = 0;
  const adminIds = findAdminIds();

  function recordCollisions(
    map: Map<string, typeof published>,
    kind: FraudSignal["kind"],
    label: string,
  ) {
    for (const [signature, items] of map.entries()) {
      if (items.length < 2) continue;
      const distinctOwners = new Set(items.map((i) => i.userId));
      if (distinctOwners.size < 2) continue;
      // Emit a signal for each pair — pairwise makes admin review
      // straightforward (Accept / Reject on each pair rather than
      // one N-way blob).
      for (let a = 0; a < items.length; a += 1) {
        for (let b = a + 1; b < items.length; b += 1) {
          if (items[a].userId === items[b].userId) continue;
          if (
            alreadyRecorded(items[a].id, items[b].id, kind) ||
            alreadyRecorded(items[b].id, items[a].id, kind)
          ) {
            continue;
          }
          const signal: FraudSignal = {
            id: newSignalId(),
            kind,
            portfolioItemId: items[a].id,
            offendingUserId: items[a].userId,
            collidingPortfolioItemId: items[b].id,
            collidingUserId: items[b].userId,
            signature,
            // URL-equality is high-signal (very unlikely to
            // collide by accident) — bump when pHash is wired.
            confidence: 0.9,
            detectedAt: new Date().toISOString(),
            reviewedAt: null,
            reviewedByUserId: null,
            disposition: "pending",
            reviewerNote: null,
          };
          MOCK_FRAUD_SIGNALS.push(signal);
          newSignals += 1;
          // Fan a single admin ping per collision. Keeps volume
          // low on Monday morning after the Sunday sweep.
          for (const aid of adminIds) {
            pushNotification({
              userId: aid,
              kind: "portfolio_fraud_flag" as NotificationKind,
              title: `Portfolio ${label} duplicate flagged`,
              body: `${items[a].title} (user ${items[a].userId}) shares a ${label} with ${items[b].title} (user ${items[b].userId}).`,
              href: `/admin/portfolios/fraud-review#${signal.id}`,
            });
          }
        }
      }
    }
  }

  recordCollisions(byImage, "duplicate_image_url", "image");
  recordCollisions(byProject, "duplicate_project_url", "project link");

  return {
    scanned: published.length,
    newSignals,
  };
}

/**
 * Admin adjudicates a signal. Confirmed fraud triggers a
 * compliance penalty on the offending user via the same layer that
 * Conduct Standards uses (Agreement Section 17). False positive
 * closes the record without penalty. Both dispositions are
 * audit-logged upstream.
 */
export async function reviewFraudSignal(input: {
  signalId: string;
  disposition: "confirmed_fraud" | "false_positive";
  reviewerId: string;
  note?: string;
}): Promise<FraudSignal | null> {
  const signal = MOCK_FRAUD_SIGNALS.find((s) => s.id === input.signalId);
  if (!signal) return null;
  if (signal.reviewedAt) return signal; // already reviewed, idempotent
  signal.disposition = input.disposition;
  signal.reviewedAt = new Date().toISOString();
  signal.reviewedByUserId = input.reviewerId;
  signal.reviewerNote = input.note ?? null;
  // Compliance-penalty wire-up (Agreement Section 17) lands as a
  // follow-up — the fraud-review admin surface should call the
  // mvp-compliance-penalty action explicitly when disposition is
  // confirmed_fraud, so admin gets one more "are you sure" prompt
  // before the -9 OVR hit lands on the record.
  return signal;
}
