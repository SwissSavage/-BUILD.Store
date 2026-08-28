/**
 * Notification writer — the single place notifications get created.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS EXISTS (2026-08-28)
 *
 * Eleven different action files each defined their own private
 * `pushNotification` helper, and every one of them appended to the
 * in-memory MOCK_NOTIFICATIONS array. Nineteen call sites total.
 *
 * That meant every notification the platform generated — new bid on
 * your RFP, milestone due, peer review requested, agreement expiring,
 * DM received — lived only inside one container process and vanished
 * on the next deploy. The bell icon was decorative.
 *
 * Consolidating to one writer means:
 *   - Notifications actually persist.
 *   - Adding a delivery channel later (email digest, push) is one
 *     edit here rather than eleven.
 *   - The index added in drizzle/0012 on (user_id, created_at DESC)
 *     finally gets used by a real query.
 * ─────────────────────────────────────────────────────────────
 *
 * Failure posture: notification delivery must NEVER break the action
 * that triggered it. If a member submits a bid and the admin notify
 * fails, the bid still stands. Every function here swallows its own
 * errors and falls back to the in-memory array so local dev without
 * Postgres keeps working.
 */
import { randomUUID } from "crypto";
import { db } from "@/db/client";
import { notifications as notificationsTable } from "@/db/schema";
import { MOCK_NOTIFICATIONS } from "@/lib/mock-data/notifications";
import type { Notification } from "@/lib/types";

export interface NotifyInput {
  userId: string;
  kind: Notification["kind"];
  title: string;
  body: string;
  href: string;
}

/**
 * Create one notification. Returns the row that was written (or the
 * in-memory stand-in when Postgres is unreachable).
 *
 * Callers should NOT await-and-throw on this — it's fire-and-continue
 * by design. See the failure posture note in the file header.
 */
export async function notify(input: NotifyInput): Promise<Notification> {
  const row: Notification = {
    id: `n_${randomUUID()}`,
    userId: input.userId,
    kind: input.kind,
    title: input.title,
    body: input.body,
    href: input.href,
    createdAt: new Date().toISOString(),
    readAt: null,
  };

  try {
    await db.insert(notificationsTable).values({
      id: row.id,
      userId: row.userId,
      kind: row.kind,
      title: row.title,
      body: row.body,
      href: row.href,
      createdAt: row.createdAt,
      readAt: null,
    });
  } catch {
    // Postgres unreachable, or the recipient has no users row yet
    // (seed-only id referenced by not-yet-swapped mock data). Keep the
    // in-memory copy so the UI still reflects the event this session.
    MOCK_NOTIFICATIONS.push(row);
  }

  return row;
}

/**
 * Fan out the same notification to several recipients — the common
 * "tell every admin" pattern.
 *
 * Inserts as one statement rather than N round-trips. A single admin
 * with a missing users row would fail the whole batch, so on error we
 * retry individually and let each one fall back on its own.
 */
export async function notifyMany(
  userIds: string[],
  input: Omit<NotifyInput, "userId">,
): Promise<void> {
  const unique = Array.from(new Set(userIds)).filter(Boolean);
  if (unique.length === 0) return;

  const now = new Date().toISOString();
  const rows = unique.map((userId) => ({
    id: `n_${randomUUID()}`,
    userId,
    kind: input.kind,
    title: input.title,
    body: input.body,
    href: input.href,
    createdAt: now,
    readAt: null,
  }));

  try {
    await db.insert(notificationsTable).values(rows);
  } catch {
    // Batch failed — retry one at a time so a single bad recipient
    // doesn't silently drop notifications for everyone else.
    for (const userId of unique) {
      await notify({ ...input, userId });
    }
  }
}
