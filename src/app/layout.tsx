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

/**
 * Canonical site URL. Overridable via NEXT_PUBLIC_SITE_URL for preview
 * deploys; falls back to the production origin so metadataBase resolves
 * even when the env var isn't set (sandbox, local dev).
 */
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://buildstore.example";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "$BUILD.Store — cooperative talent platform",
    template: "%s · $BUILD.Store",
  },
  description:
    "A member-owned cooperative of Fortune 500-level STEM, Creative Media, and Professional Services talent. Built Web3-native. A Future Modern cooperative.",
  applicationName: "$BUILD.Store",
  authors: [{ name: "Future Modern Builderberg LLC" }],
  keywords: [
    "talent cooperative",
    "creative cooperative",
    "STEM talent",
    "creative media talent",
    "professional services talent",
    "Web3 platform",
    "ERC-6551",
    "cooperative platform",
    "Future Modern",
    "$BUILD.Store",
  ],
  /**
   * Open Graph — how links unfurl in iMessage, Slack, LinkedIn, X.
   * Points at `public/og-image.png`, which Bayu ships at 1200×630 as
   * the branded share card. Google + all major social platforms handle
   * a missing OG image gracefully, so this is non-blocking until the
   * asset lands.
   */
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "$BUILD.Store",
    title: "$BUILD.Store — cooperative talent platform",
    description:
      "A member-owned cooperative of Fortune 500-level STEM, Creative Media, and Professional Services talent. Built Web3-native.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "$BUILD.Store — a Future Modern cooperative",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "$BUILD.Store — cooperative talent platform",
    description:
      "A member-owned cooperative of Fortune 500-level STEM, Creative Media, and Professional Services talent. Built Web3-native.",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/brand/turtle.png",
    shortcut: "/brand/turtle.png",
    apple: "/brand/turtle.png",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
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
 * JSON-LD block below is Organization + WebSite structured data. Google
 * uses this to render sitelinks, knowledge-panel entries, and rich
 * results. Rendered once at the root so every page inherits it.
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
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${SITE_URL}#organization`,
        name: "Future Modern Builderberg LLC",
        alternateName: ["Future Modern", "$BUILD.Store"],
        url: SITE_URL,
        logo: `${SITE_URL}/brand/wordmark.png`,
        description:
          "A member-owned cooperative of Fortune 500-level STEM, Creative Media, and Professional Services talent. Built Web3-native.",
        foundingLocation: {
          "@type": "Place",
          address: {
            "@type": "PostalAddress",
            addressCountry: "US",
            addressRegion: "FL",
          },
        },
        sameAs: [
          "https://paragraph.com/@future-modern",
          "https://github.com/SwissSavage/-BUILD.Store",
        ],
      },
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}#website`,
        url: SITE_URL,
        name: "$BUILD.Store",
        description:
          "Cooperative talent platform for STEM, Creative Media, and Professional Services.",
        publisher: { "@id": `${SITE_URL}#organization` },
        inLanguage: "en-US",
      },
    ],
  };

  return (
    <html lang="en" className={abel.variable} suppressHydrationWarning>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className="min-h-screen bg-[var(--surface)] text-[var(--ink)] antialiased"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
