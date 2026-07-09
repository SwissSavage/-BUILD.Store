/**
 * (public) route group layout.
 *
 * All marketing / unauthenticated-friendly surfaces render inside this
 * layout: landing, about, governance, policies, trust, partners,
 * whitelist, team, contact, showcase, membership, signin, signup,
 * public profiles at /u/[handle].
 *
 * Perf posture: this layout is fully static. Zero cookie access, zero
 * dynamic dependencies, zero server-action calls at render time. That
 * unlocks `export const dynamic = "force-static"` on every page below
 * — marketing surfaces serve from the edge with cached HTML instead of
 * spinning up a Node handler per request.
 *
 * Contrast with (app)/layout.tsx, which keeps the auth-aware Nav +
 * ViewingAsBanner + all dynamic dependencies — because member/admin
 * surfaces need the personalization and can't be static regardless.
 */
import { PublicNav } from "@/components/PublicNav";
import { Footer } from "@/components/Footer";
import { ChatWidgetLoader } from "@/components/ChatWidgetLoader";

export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <PublicNav />
      <main>{children}</main>
      <Footer />
      <ChatWidgetLoader />
    </>
  );
}
