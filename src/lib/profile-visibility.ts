/**
 * Profile visibility predicate.
 *
 * Codifies the visibility matrix locked in `future-modern.md`:
 *
 *   Tier                                 | Public discovery | Direct-link
 *   -------------------------------------|-----------------|------------
 *   Member                               | Yes             | Yes
 *   Partner (no active recognition)      | No              | Yes
 *   Partner (active recognition window)  | Yes             | Yes
 *   Prospect / Viewer                    | No              | Public-shaped
 *
 * Direct-link access is always available — Partners can distribute their
 * own `/u/[handle]` URL freely to clients. Discovery filtering applies
 * to platform-side surfaces (showcase, member directory, homepage
 * featured-talent sections, search results).
 *
 * Active recognition window: the user has at least one recognition row
 * whose period is current (current calendar month for monthly winners,
 * current calendar year for Constellation).
 */
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import { futureModernistRecognitions } from "@/db/schema";
import { periodKeyFor } from "@/lib/recognition-period";
import type { User } from "@/lib/types";

/**
 * User ids holding a recognition whose window is currently open.
 *
 * Loaded once by the caller and passed into `publicProfileEligible`.
 * This used to read a fixture array inside the predicate, which meant
 * the Partner half of the discovery gate was answered from seed data:
 * a Partner who actually won a recognition stayed invisible, and
 * seeded winners were visible whether or not they existed. A privacy
 * control answering from fixtures is worse than one that is simply
 * strict.
 */
export async function activeRecognitionUserIds(): Promise<Set<string>> {
  const now = new Date();
  const monthKey = periodKeyFor(now, "month").key;
  const yearKey = periodKeyFor(now, "year").key;
  const rows = await db
    .select({
      userId: futureModernistRecognitions.userId,
      periodKey: futureModernistRecognitions.periodKey,
    })
    .from(futureModernistRecognitions)
    .where(
      inArray(futureModernistRecognitions.periodKey, [monthKey, yearKey]),
    );
  return new Set(rows.map((r) => r.userId));
}

/**
 * Whether the user's profile should appear in public discovery surfaces
 * (showcase, member directory, homepage talent rails, search). Direct-
 * link access to `/u/[handle]` is separate and always available.
 *
 * Two gates compose:
 *   1. Tier eligibility — Member (always) OR Partner with active
 *      recognition window.
 *   2. `profilePublic` flag — even Member-tier profiles can opt out of
 *      discovery (or be opted out by admin for defensive reasons, e.g.,
 *      a Member in unresolved legal dispute).
 *
 * Both must hold for discovery to apply.
 */
export function publicProfileEligible(
  user: Pick<User, "id" | "membershipTier" | "profilePublic">,
  /**
   * Ids with an open recognition window, from
   * `activeRecognitionUserIds()`. Omitted means "none" — the strict
   * reading, so a caller that forgets to load them under-exposes
   * Partners rather than over-exposing them.
   */
  recognized?: Set<string>,
): boolean {
  // Discovery gate first — opt-out applies regardless of tier.
  if (user.profilePublic === false) return false;
  if (user.membershipTier === "member") return true;
  return recognized?.has(user.id) ?? false;
}

/**
 * Whether search engines should index a profile direct-link URL. Members
 * + recognized Partners → index. Everyone else → noindex (the URL still
 * works for direct sharing, but Google won't crawl it; Partners control
 * who sees the link).
 */
export function profileShouldIndex(
  user: Pick<User, "id" | "membershipTier" | "profilePublic">,
  recognized?: Set<string>,
): boolean {
  return publicProfileEligible(user, recognized);
}

/**
 * Filter a list of users to only those public-discovery eligible. Use
 * on listing surfaces (showcase, member directory, homepage rails).
 */
export function filterToPublicProfiles<
  T extends Pick<User, "id" | "membershipTier" | "profilePublic">,
>(users: T[]): T[] {
  return users.filter((u) => publicProfileEligible(u));
}
