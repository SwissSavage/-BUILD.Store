/**
 * Article registry — pipe from paragraph.com/@future-modern.
 *
 * Paragraph.com is FM's Web3-native writing rail (formerly Mirror; the
 * archive carried over after Paragraph acquired Mirror). Every piece
 * lives canonically at Paragraph. This registry surfaces titles,
 * excerpts, and metadata on the FM domain so:
 *   1. FM's own site indexes the writing (SEO recovery — right now our
 *      words rank on paragraph.com but not on our own domain).
 *   2. Visitors can browse the corpus from the marketing surface
 *      without leaving to Paragraph unless they want the full piece.
 *   3. Canonical link stays on Paragraph so Google doesn't split
 *      ranking signal or read us as duplicating content.
 *
 * Production posture (deferred):
 *   Fetch from Paragraph's RSS/oEmbed at build time and materialize
 *   into a build-time static list. On-demand ISR or edge revalidate
 *   keeps it fresh. Sandbox: the mock array below.
 *
 * Titles pulled from the local retrospective archive at
 * `Future Modern/Paragraph Retrospectives/`. Slugs are approximate
 * kebab-case placeholders; when the actual Paragraph URLs are pulled
 * in production, swap `paragraphSlug` for each entry.
 */

export interface Article {
  id: string;
  title: string;
  /** Paragraph slug on paragraph.com/@future-modern/[slug]. */
  paragraphSlug: string;
  /** ISO date the piece was originally published on Paragraph/Mirror. */
  publishedAt: string;
  /** Short pull-quote or excerpt for the index card. */
  excerpt: string;
  /**
   * Editorial tags — used for on-page filtering + long-tail SEO.
   * Keep specific: "catalog-works" better than "music"; "web3-music-nft"
   * better than "crypto"; "release-retrospective" better than "review".
   */
  tags: string[];
}

/** Base URL for canonical link construction. */
export const PARAGRAPH_BASE = "https://paragraph.com/@future-modern";

/** Build the canonical Paragraph URL for an article. */
export function paragraphUrl(article: Article): string {
  return `${PARAGRAPH_BASE}/${article.paragraphSlug}`;
}

export const MOCK_ARTICLES: Article[] = [
  {
    id: "art_retro_intro",
    title: "Future Modern presents: release retrospectives",
    paragraphSlug: "future-modern-presents-release-retrospectives",
    publishedAt: "2024-11-01",
    excerpt:
      "Curatorial notes on a mint-era Catalog Works run — the artists, the drops, the moment when 1/1 music NFTs briefly made the music-industry math work for the people who wrote the songs.",
    tags: ["release-retrospective", "catalog-works", "web3-music-nft"],
  },
  {
    id: "art_soundclash",
    title: "50% sold out — first-gen avatars drop for music shooter SOUNDCLASH!",
    paragraphSlug: "soundclash-first-gen-avatars-drop",
    publishedAt: "2024-03-15",
    excerpt:
      "SOUNDCLASH! debuts its first-gen avatar collection — half sold in the opening window. Notes on the game, the collectible loop, and what a music-native shooter says about where interactive audio is headed.",
    tags: ["release-retrospective", "web3-gaming", "generative-avatars"],
  },
  {
    id: "art_heems_drake_obama",
    title: "HEEMS DRAKE OBAMA breaks the internet",
    paragraphSlug: "heems-drake-obama-breaks-the-internet",
    publishedAt: "2023-06-01",
    excerpt:
      "Heems drops one of the most-discussed tracks of the season. A retrospective on why the meme worked, the song landed, and the timing hit.",
    tags: ["release-retrospective", "catalog-works", "hip-hop"],
  },
  {
    id: "art_allan_kingdom_reasons",
    title: "Allan Kingdom's Reasons tops web3 charts",
    paragraphSlug: "allan-kingdom-reasons-tops-web3-charts",
    publishedAt: "2023-04-10",
    excerpt:
      "Allan Kingdom's Reasons climbs to number one across web3 music charts. A closer look at the release, the collector reception, and what the chart move means for artist-owned distribution.",
    tags: ["release-retrospective", "catalog-works", "hip-hop", "chart-topper"],
  },
  {
    id: "art_allan_kingdom_2nd_round",
    title: "Allan Kingdom debuts 2nd Round on Catalog",
    paragraphSlug: "allan-kingdom-debuts-2nd-round-on-catalog",
    publishedAt: "2023-02-14",
    excerpt:
      "Allan Kingdom's Catalog debut — 2nd Round — arrives with the collector base ready. Curatorial context and the artist's take on why on-chain release fit this song.",
    tags: ["release-retrospective", "catalog-works", "hip-hop"],
  },
  {
    id: "art_marcy_mane_bull_market_ballad",
    title:
      "Coinbase manager calls Marcy Mane single \"a bull market ballad\"",
    paragraphSlug: "coinbase-manager-marcy-mane-bull-market-ballad",
    publishedAt: "2023-01-08",
    excerpt:
      "Marcy Mane's single earns an unexpected endorsement from a Coinbase manager, framing the track as the sound of the moment. Notes on how crypto-native tastemaking coincides with music discovery.",
    tags: ["release-retrospective", "catalog-works", "hip-hop"],
  },
  {
    id: "art_domino_heaven_or_hell",
    title: "Domino drops his first 1/1 music NFT — Heaven or Hell — on Catalog",
    paragraphSlug: "domino-heaven-or-hell-first-1-of-1-catalog",
    publishedAt: "2022-11-20",
    excerpt:
      "Domino's first 1/1 music NFT lands on Catalog. Retrospective notes on how the release framed the artist's next chapter and what a 1/1 signals in music-NFT taxonomy.",
    tags: ["release-retrospective", "catalog-works", "1-of-1"],
  },
  {
    id: "art_jon_waltz_trainwreck",
    title: "Jon Waltz's Trainwreck sells for 6 ETH",
    paragraphSlug: "jon-waltz-trainwreck-sells-for-6-eth",
    publishedAt: "2022-10-04",
    excerpt:
      "Jon Waltz's Trainwreck clears at 6 ETH. Retrospective on the release, the moment, and what the sale price meant against a converging bear market.",
    tags: ["release-retrospective", "catalog-works", "hip-hop"],
  },
  {
    id: "art_keyboard_kid_basedworld",
    title:
      "Keyboard Kid sells first-ever BasedWorld NFT in Catalog's inaugural release campaign",
    paragraphSlug: "keyboard-kid-basedworld-catalog-inaugural",
    publishedAt: "2022-08-16",
    excerpt:
      "Keyboard Kid's BasedWorld drops as the first NFT of Catalog's inaugural release campaign. Curatorial notes on choosing an anchor artist for a platform launch.",
    tags: ["release-retrospective", "catalog-works", "hip-hop", "platform-launch"],
  },
  {
    id: "art_keyboard_kid_days_past_gone",
    title:
      "Keyboard Kid's Days Past Gone commemorates cutting of his dreads",
    paragraphSlug: "keyboard-kid-days-past-gone-cutting-dreads",
    publishedAt: "2022-09-02",
    excerpt:
      "A release that doubles as a personal chapter marker. Keyboard Kid's Days Past Gone is scored, framed, and released as a commemorative — a case study in music-NFT-as-life-artifact.",
    tags: ["release-retrospective", "catalog-works", "hip-hop"],
  },
  {
    id: "art_sahtyre_still_high",
    title: "Sahtyre drops wild, woozy exclusive STILL HIGH on Catalog",
    paragraphSlug: "sahtyre-still-high-catalog-exclusive",
    publishedAt: "2022-07-19",
    excerpt:
      "Sahtyre's STILL HIGH arrives as a Catalog exclusive — the mood, the mix, and the collector response. Retrospective from FM's curatorial seat.",
    tags: ["release-retrospective", "catalog-works", "hip-hop"],
  },
  {
    id: "art_tayf3rd_i_smoke_i_drank_i_jerk",
    title:
      "i smoke i drank i jerk — the Tayf3rd song that sparked the jerk movement, drops on Catalog",
    paragraphSlug: "tayf3rd-i-smoke-i-drank-i-jerk-jerk-movement",
    publishedAt: "2022-06-11",
    excerpt:
      "The song credited with sparking the jerk movement lands on-chain. Notes on how the release retrospectively locates the moment in a broader West Coast timeline.",
    tags: [
      "release-retrospective",
      "catalog-works",
      "hip-hop",
      "west-coast",
      "jerk-movement",
    ],
  },
];
