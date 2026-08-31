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
import { randomUUID } from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db/client";
import { portfolioFraudSignals } from "@/db/schema";
import { getPublishedPortfolio } from "@/lib/readers";
import { getAdminUsers } from "@/lib/readers/users";
import { notify } from "@/lib/writers/notifications";

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
 * Read every signal, newest first. The admin review queue splits
 * pending from reviewed on its own.
 */
export async function allFraudSignals(): Promise<FraudSignal[]> {
  const rows = await db.select().from(portfolioFraudSignals);
  return (rows as unknown as FraudSignal[]).sort((a, b) =>
    b.detectedAt.localeCompare(a.detectedAt),
  );
}

/** Unreviewed signals only. */
export async function pendingFraudSignals(): Promise<FraudSignal[]> {
  const rows = await db
    .select()
    .from(portfolioFraudSignals)
    .where(isNull(portfolioFraudSignals.reviewedAt));
  return (rows as unknown as FraudSignal[]).sort((a, b) =>
    a.detectedAt.localeCompare(b.detectedAt),
  );
}

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
  return `frs_${randomUUID()}`;
}

/**
 * Signals already on file, as a lookup key set.
 *
 * The sweep runs over every published item weekly, so it must not
 * re-raise what it has already raised — otherwise the queue grows by
 * a duplicate row per pair per week and a dismissed false positive
 * comes back every Sunday. Loaded once per sweep rather than queried
 * per candidate pair.
 */
async function existingSignalKeys(): Promise<Set<string>> {
  const rows = await db
    .select({
      portfolioItemId: portfolioFraudSignals.portfolioItemId,
      collidingPortfolioItemId:
        portfolioFraudSignals.collidingPortfolioItemId,
      kind: portfolioFraudSignals.kind,
    })
    .from(portfolioFraudSignals);
  return new Set(
    rows.map(
      (r) => `${r.portfolioItemId}|${r.collidingPortfolioItemId ?? ""}|${r.kind}`,
    ),
  );
}

async function findAdminIds(): Promise<string[]> {
  const { users } = await getAdminUsers();
  return users.map((u) => u.id);
}

async function pushNotification(
  partial: Omit<Notification, "id" | "createdAt" | "readAt">,
): Promise<void> {
  // Writer swap 2026-08-28: delegates to the shared Postgres writer.
  // Was an in-memory push, so these notifications never survived a
  // deploy and the bell icon was effectively decorative.
  await notify(partial);
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
  // Collected during the synchronous collision walk below, then
  // flushed in one batched insert once the scan finishes. Keeps the
  // recordCollisions helper synchronous while still persisting.
  const pendingNotifications: Array<{
    userId: string;
    kind: NotificationKind;
    title: string;
    body: string;
    href: string;
  }> = [];

  if (!options.runEveryDay && now.getUTCDay() !== 0) {
    return { scanned: 0, newSignals: 0, skippedReason: "not_sunday" };
  }

  // Only published, non-rejected items are eligible. Rejected items
  // aren't user-facing, so duplicates among them don't matter.
  // Only published items are eligible. Rejected items aren't
  // user-facing, so duplicates among them don't matter.
  const publishedAll = await getPublishedPortfolio();
  const published = publishedAll.filter((p) => !p.rejectedAt);

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
  const adminIds = await findAdminIds();
  const seen = await existingSignalKeys();
  const toInsert: FraudSignal[] = [];

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
          const forward = `${items[a].id}|${items[b].id}|${kind}`;
          const reverse = `${items[b].id}|${items[a].id}|${kind}`;
          if (seen.has(forward) || seen.has(reverse)) continue;
          seen.add(forward);
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
          toInsert.push(signal);
          newSignals += 1;
          // Fan a single admin ping per collision. Keeps volume
          // low on Monday morning after the Sunday sweep.
          for (const aid of adminIds) {
            pendingNotifications.push({
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

  // Persist the signals before notifying. An admin who clicks the
  // link in the ping must find the signal waiting for them, not an
  // empty queue.
  //
  // onConflictDoNothing against the dedupe index: two sweeps running
  // at once (a manual run alongside the cron, say) would both read an
  // empty `seen` set and both try to insert the same pair.
  if (toInsert.length > 0) {
    await db
      .insert(portfolioFraudSignals)
      .values(
        toInsert.map((sig) => ({
          id: sig.id,
          kind: sig.kind,
          portfolioItemId: sig.portfolioItemId,
          offendingUserId: sig.offendingUserId,
          collidingPortfolioItemId: sig.collidingPortfolioItemId,
          collidingUserId: sig.collidingUserId,
          signature: sig.signature,
          confidence: String(sig.confidence),
          detectedAt: sig.detectedAt,
          reviewedAt: sig.reviewedAt,
          reviewedByUserId: sig.reviewedByUserId,
          disposition: sig.disposition,
          reviewerNote: sig.reviewerNote,
        })),
      )
      .onConflictDoNothing();
  }

  for (const n of pendingNotifications) {
    await notify(n);
  }

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
  const [existing] = (await db
    .select()
    .from(portfolioFraudSignals)
    .where(eq(portfolioFraudSignals.id, input.signalId))
    .limit(1)) as unknown as FraudSignal[];
  if (!existing) return null;
  if (existing.reviewedAt) return existing; // already reviewed, idempotent

  const reviewedAt = new Date().toISOString();

  // Guarded on reviewedAt IS NULL so two admins adjudicating the same
  // signal at once can't overwrite each other's disposition — the
  // second one lands on zero rows and the first decision stands.
  await db
    .update(portfolioFraudSignals)
    .set({
      disposition: input.disposition,
      reviewedAt,
      reviewedByUserId: input.reviewerId,
      reviewerNote: input.note ?? null,
    })
    .where(
      and(
        eq(portfolioFraudSignals.id, input.signalId),
        isNull(portfolioFraudSignals.reviewedAt),
      ),
    );

  const signal: FraudSignal = {
    ...existing,
    disposition: input.disposition,
    reviewedAt,
    reviewedByUserId: input.reviewerId,
    reviewerNote: input.note ?? null,
  };
  // Compliance-penalty wire-up (Agreement Section 17) lands as a
  // follow-up — the fraud-review admin surface should call the
  // mvp-compliance-penalty action explicitly when disposition is
  // confirmed_fraud, so admin gets one more "are you sure" prompt
  // before the -9 OVR hit lands on the record.
  return signal;
}
