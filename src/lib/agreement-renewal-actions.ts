/**
 * Agreement renewal sweep (task #55).
 *
 * Talent Partner Agreement (Section 4): initial term of 2 years from
 * execution, then year-to-year "only so long as such continuance is
 * approved at least annually by both parties in writing." This module
 * fires escalating pre-renewal pings so neither side lets the annual
 * check-in slip:
 *
 *   60 days out → "Heads up: renewal window opening"
 *   30 days out → "Renewal action recommended"
 *   7 days out  → "Renewal due next week"
 *   day-of      → "Renewal decision due today"
 *   overdue     → daily admin escalation until resolved
 *
 * MVP-score gate: when the sweep fires an admin-side ping, we tag it
 * with the artist's current standing band. Champions Court eligible /
 * Future Modernist pool → default suggest renew. Probation review or
 * below → default suggest non-renewal admin review. In-app renewal
 * decision UI (accept/decline) lands as a follow-up; today the ping
 * links to the invite flow so admin can regenerate the signed
 * agreement for another year.
 *
 * Debounce: encoded in the notification href rather than a schema
 * column. A ping is a duplicate when the same recipient already has a
 * renewal notification with the same href inside the window. Real
 * Drizzle swap adds a proper last_renewal_notice_bucket column on
 * agreements.
 *
 * Only handles agreementType="loi" today (Talent Partner Agreement).
 * Extend to other renewable types (contributor_agreement,
 * membership_covenant) when their terms are locked in.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-07)
 *
 * This sweep is wired to /api/cron/sweep-milestones, so it has been
 * running on a schedule. It was reading seed data end to end: seed
 * agreements, seed MVP scores, seed admins. Three consequences, in
 * order of how much they cost.
 *
 * 1. **Real agreements were never swept.** The renewal clock exists so
 *    the annual written approval in Section 4 does not lapse. It was
 *    ticking against fixtures, which means the live Talent Partner
 *    agreements have had no 60, 30, 7 or day-of ping and would have
 *    had no overdue escalation either.
 *
 * 2. **The debounce could never fire.** It scanned the in-memory
 *    notifications array while notify() writes to Postgres, so every
 *    check returned false. Nothing repeated only because nothing real
 *    was ever pinged. The moment finding 1 was fixed on its own, every
 *    member with a renewal in range would have been notified again on
 *    every daily run.
 *
 * 3. **Admin pings were addressed to seed admins**, whose ids may not
 *    exist in the users table. notify() inserts against a foreign key,
 *    so this could have been throwing inside the cron on every run.
 *
 * The debounce also had a keying bug that only shows up once real data
 * flows through it. It matched on the href *suffix*, `?bucket=X&type=Y`,
 * which is identical for every member. Admin hrefs carry the member id,
 * so an admin pinged about one member would have been skipped for every
 * other member in the same bucket that day. It now matches the whole
 * href, which is per-member by construction.
 *
 * One query loads the window's renewal notifications up front instead
 * of one lookup per recipient per member. This runs in a cron with no
 * user waiting on it, but the old shape was O(members x admins)
 * queries and there is no reason to pay that.
 * ─────────────────────────────────────────────────────────────
 */
import { and, gt, isNotNull, like } from "drizzle-orm";
import { db } from "@/db/client";
import { agreements, notifications } from "@/db/schema";
import type {
  AgreementType,
  Notification,
  NotificationKind,
} from "@/lib/types";
import { getAdminUsers } from "@/lib/readers/users";
import { getMvpScore } from "@/lib/readers";
import { computeOvr, standingBand } from "@/lib/mvp-score";
import { notify } from "@/lib/writers/notifications";

const INITIAL_TERM_YEARS = 2;
const RENEWAL_TERM_YEARS = 1;

type RenewalBucket = "sixty_days" | "thirty_days" | "seven_days" | "day_of";
const BUCKET_ORDER: RenewalBucket[] = [
  "sixty_days",
  "thirty_days",
  "seven_days",
  "day_of",
];
const BUCKET_DAYS: Record<RenewalBucket, number> = {
  sixty_days: 60,
  thirty_days: 30,
  seven_days: 7,
  day_of: 0,
};
const BUCKET_TITLES: Record<
  RenewalBucket,
  { artist: string; admin: string }
> = {
  sixty_days: {
    artist: "Heads up: your Future Modern agreement renews in 60 days",
    admin: "Renewal window opening",
  },
  thirty_days: {
    artist: "Renewal in 30 days — action recommended",
    admin: "Renewal action recommended",
  },
  seven_days: {
    artist: "Renewal due next week",
    admin: "Renewal due next week",
  },
  day_of: {
    artist: "Renewal decision due today",
    admin: "Renewal decision due today",
  },
};

const RENEWABLE_TYPES: readonly AgreementType[] = ["loi"];

/**
 * Latest signed agreement per (userId, agreementType) so renewal
 * decisions run against the most recent signature, not the whole
 * history.
 */
interface LatestAgreement {
  userId: string;
  agreementType: AgreementType;
  signedAt: string;
  version: string;
  // Renewal-index: 0 for the very first signature (uses INITIAL_TERM),
  // 1+ for each renewal (uses RENEWAL_TERM).
  renewalIndex: number;
}

async function latestPerPair(): Promise<LatestAgreement[]> {
  const bucket = new Map<string, LatestAgreement>();
  const counts = new Map<string, number>();
  // Oldest-first so renewals can be counted in order.
  //
  // Only signed agreements have a renewal clock. Since migration 0025
  // a row can exist with signedAt null while the envelope is still
  // out, and an unsigned agreement has not started counting toward
  // anything. Same for one belonging to an outside counterparty
  // rather than a member: renewals here are a member-tier concept, and
  // a null userId is exactly how a counterparty row is stored.
  //
  // Both filters are in SQL rather than in a .filter() below, so the
  // sweep does not load every agreement in the system to discard most
  // of them.
  const sorted = await db
    .select({
      userId: agreements.userId,
      agreementType: agreements.agreementType,
      signedAt: agreements.signedAt,
      version: agreements.version,
    })
    .from(agreements)
    .where(
      and(isNotNull(agreements.signedAt), isNotNull(agreements.userId))!,
    )
    .orderBy(agreements.signedAt);

  for (const row of sorted) {
    // Narrowing only. The isNotNull filters above already guarantee
    // both, but the column types stay nullable.
    if (!row.signedAt || !row.userId) continue;
    const a = { ...row, signedAt: row.signedAt, userId: row.userId };
    if (!RENEWABLE_TYPES.includes(a.agreementType)) continue;
    const key = `${a.userId}::${a.agreementType}`;
    const prior = counts.get(key) ?? 0;
    counts.set(key, prior + 1);
    bucket.set(key, {
      userId: a.userId,
      agreementType: a.agreementType,
      signedAt: a.signedAt,
      version: a.version,
      renewalIndex: prior, // 0 = first, 1+ = subsequent renewals
    });
  }
  return Array.from(bucket.values());
}

function nextRenewalAtMs(latest: LatestAgreement): number {
  const base = new Date(latest.signedAt);
  const years =
    latest.renewalIndex === 0 ? INITIAL_TERM_YEARS : RENEWAL_TERM_YEARS;
  base.setUTCFullYear(base.getUTCFullYear() + years);
  return base.getTime();
}

function currentBucket(renewalMs: number, now: number): RenewalBucket | null {
  const remainingDays = (renewalMs - now) / 86_400_000;
  if (remainingDays < 0) return null; // overdue path handled separately
  // Most-urgent first.
  if (remainingDays <= 1) return "day_of";
  if (remainingDays <= 7) return "seven_days";
  if (remainingDays <= 30) return "thirty_days";
  if (remainingDays <= 60) return "sixty_days";
  return null;
}

async function standingSuggestion(userId: string): Promise<{
  band: string;
  suggestion: "renew" | "review" | "unknown";
}> {
  const snap = await getMvpScore(userId);
  if (!snap || snap.isProvisional) {
    return { band: "provisional", suggestion: "review" };
  }
  const ovr = computeOvr(snap.subRatings, snap.activePenalties);
  const band = standingBand(ovr);
  const suggestion: "renew" | "review" =
    band === "champions_court_eligible" ||
    band === "future_modernist_pool" ||
    band === "promotion_eligible"
      ? "renew"
      : "review";
  return { band, suggestion };
}

async function findAdminIds(): Promise<string[]> {
  const { users } = await getAdminUsers();
  return users.map((u) => u.id);
}

/**
 * Every renewal ping sent inside the debounce window, as a set of
 * `recipient|href` keys.
 *
 * Loaded once per sweep. The href is the whole debounce key: for an
 * artist ping it is their own profile anchor, and for an admin ping it
 * carries the member id, so one admin can be pinged about ten members
 * in the same bucket on the same day without suppressing nine of them.
 */
async function recentRenewalPings(windowMs: number): Promise<Set<string>> {
  const cutoff = new Date(Date.now() - windowMs).toISOString();
  const rows = await db
    .select({ userId: notifications.userId, href: notifications.href })
    .from(notifications)
    .where(
      and(
        gt(notifications.createdAt, cutoff),
        like(notifications.kind, "agreement_renewal%"),
      )!,
    );
  return new Set(rows.map((r) => `${r.userId}|${r.href}`));
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
 * Sweep body. Cron-friendly signature: no auth, no revalidate.
 * Callers (the /api/cron/sweep-milestones route) handle auth via
 * shared secret. Async signature satisfies the "use server"
 * contract on the neighbouring milestone module and is future-proof
 * for the Drizzle swap.
 */
export async function runAgreementRenewalSweep(): Promise<{
  scanned: number;
  bucketPings: number;
  overduePings: number;
}> {
  const now = Date.now();
  const debounceMs = 20 * 60 * 60 * 1000; // 20h — cron runs daily
  const overdueDebounceMs = debounceMs; // daily admin escalation while overdue
  let scanned = 0;
  let bucketPings = 0;
  let overduePings = 0;

  const adminIds = await findAdminIds();
  const latest = await latestPerPair();
  // Widest window wins: both paths are on the same daily cadence, so
  // one load covers both checks.
  const pinged = await recentRenewalPings(
    Math.max(debounceMs, overdueDebounceMs),
  );

  /** Send unless this exact ping already went out inside the window. */
  const sendOnce = async (
    n: Omit<Notification, "id" | "createdAt" | "readAt">,
  ): Promise<boolean> => {
    const key = `${n.userId}|${n.href}`;
    if (pinged.has(key)) return false;
    await pushNotification(n);
    // Guard within this run too. A member with two renewable
    // agreements of the same type should not produce two identical
    // admin pings before the next sweep reloads the set.
    pinged.add(key);
    return true;
  };

  for (const l of latest) {
    scanned += 1;
    const renewalMs = nextRenewalAtMs(l);
    const standing = await standingSuggestion(l.userId);
    const renewalDate = new Date(renewalMs).toISOString().slice(0, 10);

    // Overdue path — admin-only, daily until acted on.
    if (renewalMs < now) {
      const overdueKey: RenewalBucket = "day_of";
      const daysOver = Math.ceil((now - renewalMs) / 86_400_000);
      let sent = false;
      for (const aid of adminIds) {
        const did = await sendOnce({
          userId: aid,
          kind: "agreement_renewal_overdue",
          title: `Overdue renewal: ${labelForType(l.agreementType)}`,
          body: `${daysOver} day${daysOver === 1 ? "" : "s"} past renewal. Artist ${l.userId}. Standing: ${standing.band}. Suggested action: ${standing.suggestion}.`,
          href: `/admin/members/${l.userId}?bucket=${overdueKey}&type=${l.agreementType}`,
        });
        sent = sent || did;
      }
      // Counted per agreement, not per admin, so the number still
      // reads as "renewals escalated today".
      if (sent) overduePings += 1;
      continue;
    }

    // Pre-renewal escalation — same bucket-transition + debounce
    // pattern as milestone_due_soon.
    const bucket = currentBucket(renewalMs, now);
    if (!bucket) continue;

    // Artist-facing ping.
    if (
      await sendOnce({
        userId: l.userId,
        kind: `agreement_renewal_${bucket}` as NotificationKind,
        title: BUCKET_TITLES[bucket].artist,
        body: `Your ${labelForType(l.agreementType)} renews on ${renewalDate}. Continue as-is, opt out, or reach out to your account owner.`,
        href: `/profile#agreements?bucket=${bucket}&type=${l.agreementType}`,
      })
    ) {
      bucketPings += 1;
    }

    // Admin-facing ping. Includes MVP-score band + suggestion so
    // admin can triage the renewal batch quickly.
    for (const aid of adminIds) {
      const did = await sendOnce({
        userId: aid,
        kind: `agreement_renewal_${bucket}` as NotificationKind,
        title: `${BUCKET_TITLES[bucket].admin}: ${labelForType(l.agreementType)}`,
        body: `Artist ${l.userId}. Standing: ${standing.band}. Suggested action: ${standing.suggestion}. Renews ${renewalDate}.`,
        href: `/admin/members/${l.userId}?bucket=${bucket}&type=${l.agreementType}`,
      });
      if (did) bucketPings += 1;
    }
  }

  return { scanned, bucketPings, overduePings };
}

function labelForType(t: AgreementType): string {
  switch (t) {
    case "loi":
      return "Talent Partner Agreement";
    case "talent_data":
      return "Talent Data Agreement";
    case "membership_covenant":
      return "Membership Covenant";
    case "seller_agreement":
      return "Seller Agreement";
    case "contributor_agreement":
      return "Contributor Agreement";
    default:
      return "Agreement";
  }
}

// Expose bucket names for tests / logging.
export const RENEWAL_BUCKETS = BUCKET_ORDER;
export const RENEWAL_BUCKET_DAYS = BUCKET_DAYS;
