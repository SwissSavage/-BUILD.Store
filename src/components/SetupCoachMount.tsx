/**
 * Decides whether the setup coach appears, and hands it the facts.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY A SEPARATE SERVER COMPONENT (2026-11-16)
 *
 * SetupCoach measures DOM rectangles, so it is "use client", and
 * check-client-boundary forbids a client module reaching
 * src/db/client.ts even through a type. Every query lives here and
 * crosses as a flat snapshot of booleans. Nothing identifying goes
 * over that boundary: the overlay is told "no tagline", never what
 * the tagline is, and never the email or Stripe id sitting on the
 * same row.
 *
 * WHY IT MOUNTS IN THE LAYOUT
 *
 * The coach has to survive navigation. Step one points at the avatar
 * in the nav, the rest at sections on /profile, and the member walks
 * between them while it is open. Mounted on a page it would unmount
 * on the first click it asked for.
 *
 * WHO SEES IT
 *
 * Signed in, never dismissed, and something still missing. Viewers
 * are excluded: they have applied and not been accepted, so there is
 * no profile for them to set up and a tutorial would be telling them
 * they are further along than they are.
 *
 * Every read is wrapped in safely(). This renders on every
 * authenticated page in the app, so a reader throwing here would take
 * out the whole application rather than one surface. The failure mode
 * is no coach, which is exactly where we were last week.
 * ─────────────────────────────────────────────────────────────
 */
import { getCurrentUser } from "@/lib/auth-stub";
import { getPortfolioForUser, safely } from "@/lib/readers";
import {
  outstandingSteps,
  setupProgress,
  type SetupSnapshot,
} from "@/lib/setup-coach";
import { dismissSetupCoach } from "@/lib/setup-coach-actions";
import { SetupCoach } from "@/components/SetupCoach";
import type { User } from "@/lib/types";

export async function SetupCoachMount() {
  // Explicitly typed, and swallowing the throw is deliberate.
  // auth-stub throws rather than guessing when the database is
  // unreachable, which is right: "we cannot verify who you are" must
  // never resolve to an identity. Here the only consequence of not
  // knowing is that no coach renders, and letting it propagate from
  // the layout would take down every authenticated page over a
  // tutorial.
  const user = await safely<User | null>(() => getCurrentUser(), null);
  if (!user) return null;
  if (user.setupCoachDismissedAt) return null;
  if (user.membershipTier === "viewer") return null;

  const portfolio = await safely(() => getPortfolioForUser(user.id), []);

  const snapshot: SetupSnapshot = {
    hasName: Boolean(user.firstName?.trim()),
    hasTagline: Boolean(user.tagline?.trim()),
    // Either image counts. A member who uploaded a portrait but no
    // avatar has done the thing being asked for.
    hasPhoto: Boolean(
      user.profileImageUrl?.trim() || user.avatarPortraitUrl?.trim(),
    ),
    hasDiscipline: Boolean(user.discipline?.trim()),
    hasSkills: (user.skills?.length ?? 0) > 0,
    // Drafts count. The step asks them to put work in, and admin
    // publishes. Holding it open until something is live would nag a
    // member for a decision that is not theirs.
    hasPortfolio: portfolio.length > 0,
  };

  const steps = outstandingSteps(snapshot);
  if (steps.length === 0) return null;

  const { done, total } = setupProgress(snapshot);

  return (
    <SetupCoach
      steps={steps}
      firstName={user.firstName ?? null}
      doneCount={done}
      totalCount={total}
      onDismiss={dismissSetupCoach}
    />
  );
}
