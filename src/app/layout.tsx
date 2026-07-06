import type { Metadata } from "next";
import { Abel } from "next/font/google";
import "./globals.css";

/**
 * FM's platform typeface — Abel via next/font (self-hosted, no CLS).
 * Applies to everything except brand logos (which stay as image
 * assets). CSS variable `--font-abel` is available across the tree;
 * Tailwind's `font-sans` and `font-display` tokens both resolve to it
 * per `tailwind.config.ts`.
 */
const abel = Abel({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-abel",
  display: "swap",
});

export const metadata: Metadata = {
  title: "$BUILD.Store — cooperative talent platform",
  description:
    "Fortune 500-level STEM, Creative Media, and Professional Services talent. A Future Modern cooperative.",
};

/**
 * Root layout — intentionally bare.
 *
 * Site chrome (Nav, Footer, ViewingAsBanner, ChatWidget) lives in the
 * route-group layouts:
 *   - src/app/(public)/layout.tsx — static marketing chrome.
 *   - src/app/(app)/layout.tsx    — auth-aware member/admin chrome.
 *
 * Root stays as the html/body shell + font variable + metadata so it
 * carries no dynamic dependencies. That's what lets the (public) group
 * render statically at the edge — any auth read in a parent layout
 * would poison every descendant page's ability to be `force-static`.
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
    <html lang="en" className={abel.variable} suppressHydrationWarning>
      <body
        className="min-h-screen bg-[var(--surface)] text-[var(--ink)] antialiased"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
