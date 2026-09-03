/**
 * /profile — your profile. Literally the same page a client sees.
 *
 * ─────────────────────────────────────────────────────────────
 * FOUR ATTEMPTS. HERE IS WHAT WAS WRONG WITH EACH (2026-09-03)
 *
 * 1. A 1,200-line settings form.
 * 2. Summary cards linking out to /profile/edit/<section>.
 * 3. The same cards with the forms inlined, captioned NAME, TAGLINE,
 *    ABOUT, PILLARS, SKILLS, each with an Edit pill.
 * 4. The same content with the captions removed and pencils in the
 *    corners.
 *
 * Every one of those was a page ABOUT the profile. Jamar, finally
 * plainly: "The profile page is not a place to edit the profile. The
 * profile page needs to BE the profile."
 *
 * I kept fixating on the editing affordance, which was never the
 * point. He was not asking for better-placed pencils. He was asking to
 * click Profile and see his profile: the card, the standing, the work,
 * the ratings, the thing he is going to send to a client.
 *
 * WHAT THIS DOES NOW
 *
 * It renders the public profile page component itself, for the signed
 * in member. Not a copy of it, not a version of it, the same component
 * that serves /u/[handle]. So what he sees here IS what a client sees,
 * with no possibility of the two drifting apart, which was the stated
 * worry back in attempt two.
 *
 * Editing is one link. It is not the page.
 *
 * WHY REUSE THE COMPONENT RATHER THAN REBUILD IT
 *
 * The public profile is 1,098 lines: trading card and tier, MVP
 * standing, recognitions and canonizations, published portfolio with
 * admin redactions applied, peer rating aggregate, testimonials, EPK
 * mode, JSON-LD. Rebuilding a second version of that for the owner is
 * how the two rot into disagreement, and then nobody knows which one
 * clients actually get.
 *
 * The DM compose block hides itself on your own profile already
 * (`viewer.id !== user.id`), so nothing needs special-casing here.
 *
 * A member with no handle cannot have a public profile to show, so
 * they go to the editor to set one rather than seeing a 404.
 * ─────────────────────────────────────────────────────────────
 */
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import PublicProfilePage from "@/app/(public)/u/[handle]/page";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  if (!user.handle) redirect("/profile/edit/identity");

  // The profile. The actual component, not a second rendering of it.
  // `params` is a Promise because that is the Next 15 page contract
  // this component was written against. `owner` turns on the pencils
  // and is never supplied by the router, so /u/[handle] is untouched.
  return (
    <PublicProfilePage
      params={Promise.resolve({ handle: user.handle })}
      owner
    />
  );
}
