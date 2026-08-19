/**
 * (public) route group layout.
 *
 * All marketing / unauthenticated-friendly surfaces render inside this
 * layout: landing, about, governance, policies, trust, partners,
 * whitelist, team, contact, showcase, membership, signin, signup,
 * public profiles at /u/[handle].
 *
 * Renders the auth-aware Nav so signed-in users don't lose their
 * session-aware header when they cross from an (app) route into a
 * marketing page (e.g. Dashboard → Showcase). Nav reads cookies via
 * getCurrentUser, which switches these routes from the previous
 * "force-static" posture into dynamic — the perf cost is small (still
 * CDN-cacheable via response headers) and the UX win is large: no
 * more "clicking Showcase logged me out" reports.
 *
 * Contrast with (app)/layout.tsx, which additionally renders
 * ViewingAsBanner and admin-only affordances.
 */
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ChatWidgetLoader } from "@/components/ChatWidgetLoader";

export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Nav />
      <main>{children}</main>
      <Footer />
      <ChatWidgetLoader />
    </>
  );
}
