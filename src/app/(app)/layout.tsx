/**
 * (app) route group layout.
 *
 * All auth-aware surfaces render inside this layout: profile, admin,
 * wallet, activity, calendar, dashboard, notifications, projects,
 * contracts, locker, walkthrough, everything in between.
 *
 * Dynamic by design: reads the session cookie in Nav and
 * ViewingAsBanner so we can render personalized nav, admin dropdowns,
 * unread notification counts, and the "viewing-as" flip-back. That
 * dynamism stays confined here so it doesn't infect the marketing
 * surfaces in (public).
 *
 * The floating visitor ChatWidget does NOT render here — Members have
 * DMs, notifications, and admin channels for cooperative-internal
 * communication. Visitor chat only exists on marketing surfaces.
 */
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ViewingAsBanner } from "@/components/ViewingAsBanner";

export default function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <ViewingAsBanner />
      <Nav />
      <main>{children}</main>
      <Footer />
    </>
  );
}
