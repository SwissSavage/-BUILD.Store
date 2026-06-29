import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ViewingAsBanner } from "@/components/ViewingAsBanner";
import { ChatWidgetMount } from "@/components/ChatWidgetMount";

export const metadata: Metadata = {
  title: "$BUILD.Store — cooperative talent platform",
  description:
    "Fortune 500-level STEM, Creative Media, and Professional Services talent. A Future Modern cooperative.",
};

/**
 * Root layout. The site is dark-only — light mode was retired
 * 2026-04-27. Semantic tokens (--surface, --ink, etc.) live in
 * globals.css under `:root` and don't flip.
 *
 * `suppressHydrationWarning` on <html> stays — it's the Next.js
 * posture for any time something outside React may mutate the root
 * element before hydration (browser extensions: QuillBot writes
 * `data-qb-installed`, Grammarly writes `data-gr-*`, password
 * managers inject their own attributes). It ONLY silences attribute
 * diffs on <html> itself, not descendants.
 */
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="min-h-screen bg-[var(--surface)] text-[var(--ink)] antialiased"
        suppressHydrationWarning
      >
        <ViewingAsBanner />
        <Nav />
        <main>{children}</main>
        <Footer />
        <ChatWidgetMount />
      </body>
    </html>
  );
}
