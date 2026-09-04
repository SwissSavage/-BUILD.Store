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
 * Debounce: encoded in a synthetic notification href suffix
 * `?bucket=<bucket>` so we don't need a new schema column. When a
 * bucket ping is already in the last 20h with a matching suffix,
 * skip. Real Drizzle swap adds a proper last_renewal_notice_bucket
 * column on agreements.
 *
 * Only handles agreementType="loi" today (Talent Partner Agreement).
 * Extend to other renewable types (contributor_agreement,
 * membership_covenant) when their terms are locked in.
 */
import type {
  AgreementType,
  Notification,
  NotificationKind,
} from "@/lib/types";
import { MOCK_AGREEMENTS } from "@/lib/mock-data/agreements";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { MOCK_NOTIFICATIONS } from "@/lib/mock-data/notifications";
import {
  mvpScoreForUser,
} from "@/lib/mock-data/mvp-scores";
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

function latestPerPair(): LatestAgreement[] {
  const bucket = new Map<string, LatestAgreement>();
  const counts = new Map<string, number>();
  // Iterate oldest-first so we can count renewals in order.
  // Only signed agreements have a renewal clock. Since migration 0025
  // a row can exist with signedAt null while the envelope is still
  // out, and an unsigned agreement has not started counting toward
  // anything. Same for one belonging to an outside counterparty
  // rather than a member: renewals here are a member-tier concept.
  const sorted = [...MOCK_AGREEMENTS]
    .filter((a): a is typeof a & { signedAt: string; userId: string } =>
      a.signedAt !== null && a.userId !== null,
    )
    .sort((a, b) => a.signedAt.localeCompare(b.signedAt));
  for (const a of sorted) {
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

function standingSuggestion(userId: string): {
  band: string;
  suggestion: "renew" | "review" | "unknown";
} {
  const snap = mvpScoreForUser(userId);
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

function findAdminIds(): string[] {
  return MOCK_USERS.filter((u) => u.isAdmin).map((u) => u.id);
}

function alreadyPingedInBucket(
  userId: string,
  agreementType: AgreementType,
  bucket: RenewalBucket,
  windowMs: number,
): boolean {
  const suffix = `?bucket=${bucket}&type=${agreementType}`;
  const now = Date.now();
  return MOCK_NOTIFICATIONS.some((n) => {
    if (n.userId !== userId) return false;
    if (!n.href.endsWith(suffix)) return false;
    return now - new Date(n.createdAt).getTime() < windowMs;
  });
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

  const adminIds = findAdminIds();
  const latest = latestPerPair();

  for (const l of latest) {
    scanned += 1;
    const renewalMs = nextRenewalAtMs(l);
    const artistHref = `/profile#agreements?bucket=day_of&type=${l.agreementType}`; // placeholder; overwritten below
    const standing = standingSuggestion(l.userId);

    // Overdue path — admin-only, daily until acted on.
    if (renewalMs < now) {
      const overdueKey: RenewalBucket = "day_of";
      const alreadyToday = adminIds.some((aid) =>
        alreadyPingedInBucket(
          aid,
          l.agreementType,
          overdueKey,
          overdueDebounceMs,
        ),
      );
      if (alreadyToday) continue;
      const daysOver = Math.ceil((now - renewalMs) / 86_400_000);
      for (const aid of adminIds) {
        await pushNotification({
          userId: aid,
          kind: "agreement_renewal_overdue",
          title: `Overdue renewal: ${labelForType(l.agreementType)}`,
          body: `${daysOver} day${daysOver === 1 ? "" : "s"} past renewal. Artist ${l.userId}. Standing: ${standing.band}. Suggested action: ${standing.suggestion}.`,
          href: `/admin/members/${l.userId}?bucket=${overdueKey}&type=${l.agreementType}`,
        });
      }
      overduePings += 1;
      continue;
    }

    // Pre-renewal escalation — same bucket-transition + debounce
    // pattern as milestone_due_soon.
    const bucket = currentBucket(renewalMs, now);
    if (!bucket) continue;

    // Artist-facing ping. Skip if the artist has been pinged in this
    // bucket already.
    if (
      !alreadyPingedInBucket(l.userId, l.agreementType, bucket, debounceMs)
    ) {
      await pushNotification({
        userId: l.userId,
        kind: `agreement_renewal_${bucket}` as NotificationKind,
        title: BUCKET_TITLES[bucket].artist,
        body: `Your ${labelForType(l.agreementType)} renews on ${new Date(renewalMs).toISOString().slice(0, 10)}. Continue as-is, opt out, or reach out to your account owner.`,
        href: `/profile#agreements?bucket=${bucket}&type=${l.agreementType}`,
      });
      bucketPings += 1;
    }

    // Admin-facing ping. Includes MVP-score band + suggestion so
    // admin can triage the renewal batch quickly.
    for (const aid of adminIds) {
      if (
        alreadyPingedInBucket(aid, l.agreementType, bucket, debounceMs)
      )
        continue;
      await pushNotification({
        userId: aid,
        kind: `agreement_renewal_${bucket}` as NotificationKind,
        title: `${BUCKET_TITLES[bucket].admin}: ${labelForType(l.agreementType)}`,
        body: `Artist ${l.userId}. Standing: ${standing.band}. Suggested action: ${standing.suggestion}. Renews ${new Date(renewalMs).toISOString().slice(0, 10)}.`,
        href: `/admin/members/${l.userId}?bucket=${bucket}&type=${l.agreementType}`,
      });
      bucketPings += 1;
    }

    // silence unused
    void artistHref;
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
