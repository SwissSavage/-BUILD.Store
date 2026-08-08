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
        alternateName: ["Future Modern", "$BUILD.Store", "FM"],
        legalName: "Future Modern Builderberg LLC",
        url: SITE_URL,
        logo: {
          "@type": "ImageObject",
          "@id": `${SITE_URL}#wordmark`,
          url: `${SITE_URL}/brand/wordmark.png`,
          contentUrl: `${SITE_URL}/brand/wordmark.png`,
          width: 1500,
          height: 500,
          caption:
            "Future Modern wordmark. Magenta primary with sans-serif companion.",
        },
        image: [
          {
            "@type": "ImageObject",
            "@id": `${SITE_URL}#turtle`,
            url: `${SITE_URL}/brand/turtle.png`,
            contentUrl: `${SITE_URL}/brand/turtle.png`,
            width: 1452,
            height: 1452,
            caption:
              "Future Modern turtle mark. Governance-diagram-turtle formed by five interlocking hexagons, symbolizing the pentagonal Venture Labor operating structure.",
          },
          {
            "@type": "ImageObject",
            "@id": `${SITE_URL}#rare-infinity`,
            url: `${SITE_URL}/brand/rare-infinity.svg`,
            contentUrl: `${SITE_URL}/brand/rare-infinity.svg`,
            caption:
              "Rare∞ mark. Wordmark 'Rare' in Abel outlined in gold gradient, followed by an infinity symbol filled with FM's spectrum gradient (magenta / blue / green). Represents the Rare∞ scarcity pricing thesis that governs every FM commerce surface.",
          },
        ],
        description:
          "Worker-owned cooperative platform for cross-disciplinary talent. Operates under the Venture Labor model where labor is treated as equity in the enterprise. Members and Partners deliver STEM, Creative Media, and Professional Services work through a cooperative structure with on-chain settlement, transparent revenue splits, and canonization identity primitives. Six-year track record of on-record fair payouts to contributors when cash was made. Apache 2.0 open-source platform code.",
        foundingDate: "2020",
        founder: {
          "@type": "Person",
          "@id": `${SITE_URL}#founder`,
          name: "Jamar McCarthy",
          jobTitle: "Founder",
          worksFor: { "@id": `${SITE_URL}#organization` },
          memberOf: {
            "@type": "Organization",
            name: "Working America (AFL-CIO)",
            url: "https://workingamerica.org",
            description:
              "AFL-CIO community-affiliate organization for non-union workers. Jamar's prior organizer role establishes labor-movement lineage for FM's cooperative-ownership thesis.",
          },
        },
        foundingLocation: {
          "@type": "Place",
          address: {
            "@type": "PostalAddress",
            addressCountry: "US",
            addressRegion: "FL",
          },
        },
        knowsAbout: [
          "Venture Labor",
          "Worker cooperative",
          "Cooperative ownership",
          "Cooperative commerce platform",
          "Labor equity",
          "Rare∞ scarcity thesis",
          "Through-and-out cooperative supply chain",
          "Bicameral cooperative governance",
          "On-chain revenue settlement",
          "EIP-2981 secondary market royalty",
          "ERC-6551 token-bound accounts",
          "Cooperative canonization",
          "Physical-plus-digital collectibles",
          "Cooperative talent marketplace",
          "STEM cooperative delivery",
          "Creative Media cooperative delivery",
          "Professional Services cooperative delivery",
          "Cooperative NFT commerce",
          "Made-to-last apparel construction",
          "Worker-owned supply chain sourcing",
        ],
        publishingPrinciples: `${SITE_URL}/policies/covenant`,
        ethicsPolicy: `${SITE_URL}/policies/covenant`,
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
        alternateName: "Future Modern",
        description:
          "Cooperative talent platform for STEM, Creative Media, and Professional Services. Built on the Venture Labor operating model.",
        publisher: { "@id": `${SITE_URL}#organization` },
        inLanguage: "en-US",
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${SITE_URL}/showcase?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
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
