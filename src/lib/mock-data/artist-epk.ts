/**
 * Artist EPK (Electronic Press Kit) seed data.
 *
 * One row per artist user. The four-artist initial cohort matches the
 * September launch plan: BBG (Head of Creative Strategy), Sahtyre,
 * Jrusalam, Keyboard Kid.
 *
 * Status conventions:
 *   - "draft": artist has saved but not submitted. Not visible in the admin queue.
 *   - "submitted": in admin review queue. A previously published version (if any)
 *     stays live until admin acts.
 *   - "published": visible on /u/[handle] when User.profileMode === "epk".
 *   - "needs_revision": admin sent back with a note. Any prior published
 *     version stays live while the artist iterates.
 *
 * REPLACE WITH: `artist_epks` Drizzle table. `featured_work` and `press`
 * become 1-to-many relations rather than embedded JSON when we move off
 * mock data.
 */
import type { ArtistEpk } from "@/lib/types";

export const MOCK_ARTIST_EPKS: ArtistEpk[] = [
  // ── BBG / Big Baby Gandhi: Head of Creative Strategy
  {
    userId: "u_bbg",
    status: "published",
    heroImageUrl: null,
    tagline: "Rapper · Producer · Future Modern Head of Creative Strategy",
    bioShort:
      "Bangladesh-born, Flushing-Queens-raised. Came up on Heems' Greedhead label in the early 2010s blog era; defined indie rap. Quit at peak to finish a pharmacy doctorate. Now back making music with crypto in the wallet instead of Spotify royalties.",
    bioLong:
      "Big Baby Gandhi was on every major rap publication by 21. Complex's 25 Best Rappers Under 25 in 2012, the early Greedhead roster, defined the indie blog era. He saw the industry abuses and quit at peak to finish his pharmacy doctorate. Six-figure pharma marketing job. Now he has the leverage to make music he wants without the negativity needed for clicks and likes, and takes what he learned in the corporate world to better the culture of the underground. He earns equity at Future Modern; we put crypto in his wallet to speak truth the algorithm can't suppress.",
    featuredWork: [
      {
        id: "fw_bbg_001",
        title: "HEEMS DRAKE OBAMA",
        embedUrl:
          "ethereum://0x6Bc15259DeB2C6A54FDFc84738bE86CF501D699d/",
        platform: "other",
        releaseDate: "2022-12-16",
        contractAddress: "0x6Bc15259DeB2C6A54FDFc84738bE86CF501D699d",
        context:
          "Diss track at former label head Heems. Self-produced beat, lyrics, and video. Reviewed by The Needle Drop.",
      },
    ],
    press: [
      {
        id: "pr_bbg_001",
        outlet: "Complex",
        quote: "25 Best Rappers 25 and Under.",
        url: "https://amp.www.complex.com/music/2012/06/the-25-best-rappers-25-and-under/",
        date: "2012-06-01",
      },
      {
        id: "pr_bbg_002",
        outlet: "KQED",
        quote:
          "Paid in Full: How the Rap World Embraced Bitcoin. Despite one of the all-time sellingest Bandcamp catalogs, Gandhi made more from his music with crypto than he ever did through traditional labels or platforms.",
        url: "https://www.kqed.org/arts/13827706/paid-in-full-how-the-rap-world-embraced-bitcoin",
        date: "2014-01-01",
      },
      {
        id: "pr_bbg_003",
        outlet: "The Needle Drop",
        quote: "Reviewed the HEEMS DRAKE OBAMA music video.",
        url: "",
        date: "2022-12-20",
      },
    ],
    trackRecord: [
      "Featured on every major rap publication by age 21.",
      "Complex 25 Best Rappers Under 25 (2012).",
      "Among the first artists to accept Bitcoin for music sales (2013).",
      "HEEMS DRAKE OBAMA reviewed by The Needle Drop (Dec 2022).",
      "Head of Creative Strategy at Future Modern.",
    ],
    socialHandles: [
      { platform: "twitter", url: "https://twitter.com/BigBabyGandhi", handle: "BigBabyGandhi" },
      { platform: "instagram", url: "https://instagram.com/bigbabygandhi", handle: "bigbabygandhi" },
      { platform: "bandcamp", url: "https://bigbabygandhi.bandcamp.com", handle: "bigbabygandhi" },
    ],
    web3Profiles: [
      {
        platform: "zora",
        url: "https://zora.co/collect/eth:0x6Bc15259DeB2C6A54FDFc84738bE86CF501D699d",
        handle: null,
        contractAddress: "0x6Bc15259DeB2C6A54FDFc84738bE86CF501D699d",
        context: "HEEMS DRAKE OBAMA collection.",
      },
    ],
    metrics: [
      { platform: "twitter", metric: "Followers", value: "18.2k", capturedAt: "2026-05-01T00:00:00Z" },
      { platform: "bandcamp", metric: "All-time supporters", value: "Top-decile catalog (KQED, 2014)", capturedAt: "2026-05-01T00:00:00Z" },
      { platform: "zora", metric: "HEEMS DRAKE OBAMA mints", value: "Sold out", capturedAt: "2026-05-01T00:00:00Z" },
    ],
    bookingNote:
      "Booking and features routed through Future Modern only. No direct DMs.",
    submittedAt: "2026-04-30T00:00:00Z",
    publishedAt: "2026-05-01T00:00:00Z",
    adminRevisionNote: null,
    createdAt: "2026-04-25T00:00:00Z",
    updatedAt: "2026-05-01T00:00:00Z",
  },

  // ── Sahtyre: long-time FM collaborator
  {
    userId: "u_sahtyre",
    status: "draft",
    heroImageUrl: null,
    tagline: "Rapper · Future Modern collaborator since 2022",
    bioShort:
      "Released the wild, woozy exclusive 'STILL HIGH' on Catalog through Future Modern's curated series in October 2022. Long-time FM artist roster member.",
    bioLong: null,
    featuredWork: [
      {
        id: "fw_sahtyre_001",
        title: "STILL HIGH",
        embedUrl:
          "https://market.zora.co/collections/0x0bC2A24ce568DAd89691116d5B34DEB6C203F342/4",
        platform: "zora",
        releaseDate: "2022-10-25",
        contractAddress: "0x0bC2A24ce568DAd89691116d5B34DEB6C203F342",
        context: "FM-curated exclusive on Catalog.",
      },
    ],
    press: [],
    trackRecord: [
      "Future Modern Catalog curated series (Oct 2022).",
      "Long-standing collaborator on FM artist roster.",
    ],
    socialHandles: [
      { platform: "instagram", url: "https://www.instagram.com/sahtyre/", handle: "sahtyre" },
    ],
    web3Profiles: [
      {
        platform: "zora",
        url: "https://market.zora.co/collections/0x0bC2A24ce568DAd89691116d5B34DEB6C203F342/4",
        handle: null,
        contractAddress: "0x0bC2A24ce568DAd89691116d5B34DEB6C203F342",
        context: "STILL HIGH release, FM-curated Catalog series.",
      },
    ],
    metrics: [],
    bookingNote: null,
    submittedAt: null,
    publishedAt: null,
    adminRevisionNote: null,
    createdAt: "2026-05-04T00:00:00Z",
    updatedAt: "2026-05-04T00:00:00Z",
  },

  // ── Jrusalam: Parable Rap, Raleigh native (content from his existing EPK)
  {
    userId: "u_jrusalam",
    status: "submitted",
    heroImageUrl: null,
    tagline: "Hip Hop Artist · Parable Rap · Raleigh, NC",
    bioShort:
      "Raleigh native born from the cypher at the NCSU Free Expression Tunnel. Often labeled a \"conscious\" rapper, but really a chameleon of styles and aesthetics. He calls his art Parable Rap, reflecting the cultural inflections and intonations of the Bible Belt. More than an artist; a place you can visit. Welcome to Jrusalam.",
    bioLong: null,
    featuredWork: [
      {
        id: "fw_jr_spotify",
        title: "Jrusalam on Spotify",
        embedUrl: "https://open.spotify.com/artist/4KQeFAIlDDUEhTAFMdqifM",
        platform: "spotify",
        releaseDate: null,
        contractAddress: null,
        context:
          "Full discography: F.A.K.S, ROSHAMBO, and MELOTHESIAN.",
      },
      {
        id: "fw_jr_melothesian",
        title: "MELOTHESIAN (2018)",
        embedUrl: "https://open.spotify.com/artist/4KQeFAIlDDUEhTAFMdqifM",
        platform: "spotify",
        releaseDate: "2018-01-01",
        contractAddress: null,
        context: "Full project. Cover features the melothesian hand iconography.",
      },
      {
        id: "fw_jr_faks_video",
        title: "F.A.K.S (2017)",
        embedUrl: "",
        platform: "youtube",
        releaseDate: "2017-01-01",
        contractAddress: null,
        context: "Music video.",
      },
      {
        id: "fw_jr_roshambo_video",
        title: "ROSHAMBO (2017)",
        embedUrl: "",
        platform: "youtube",
        releaseDate: "2017-01-01",
        contractAddress: null,
        context: "Music video.",
      },
    ],
    press: [],
    trackRecord: [
      "Born from the cypher at the NCSU Free Expression Tunnel.",
      "Releases: F.A.K.S (2017), ROSHAMBO (2017), MELOTHESIAN (2018).",
      "Self-described 'Parable Rap' style. Chameleon of styles and aesthetics.",
      "Personal site at jrusalam.com.",
    ],
    socialHandles: [
      { platform: "spotify", url: "https://open.spotify.com/artist/4KQeFAIlDDUEhTAFMdqifM", handle: "Jrusalam" },
      { platform: "personal_site", url: "https://jrusalam.com", handle: null },
    ],
    web3Profiles: [],
    metrics: [],
    bookingNote:
      "Direct booking line on his existing EPK is jrusalam@example.com. Admin to confirm during curation whether to keep direct or route through Future Modern.",
    submittedAt: "2026-05-04T12:00:00Z",
    publishedAt: null,
    adminRevisionNote: null,
    createdAt: "2026-05-04T00:00:00Z",
    updatedAt: "2026-05-04T12:00:00Z",
  },

  // ── Keyboard Kid: BasedWorld
  {
    userId: "u_keyboard_kid",
    status: "draft",
    heroImageUrl: null,
    tagline: "Producer · Rapper · BasedWorld",
    bioShort:
      "Released the first-ever BasedWorld NFT through Catalog's inaugural release campaign. 'Days Past Gone' commemorated the cutting of his dreads.",
    bioLong: null,
    featuredWork: [
      {
        id: "fw_kk_001",
        title: "Days Past Gone",
        embedUrl: "",
        platform: "catalog",
        releaseDate: null,
        contractAddress: null,
        context: "Commemorates the cutting of his dreads.",
      },
      {
        id: "fw_kk_002",
        title: "First-ever BasedWorld NFT",
        embedUrl: "",
        platform: "catalog",
        releaseDate: null,
        contractAddress: null,
        context: "Catalog inaugural release campaign.",
      },
    ],
    press: [],
    trackRecord: [
      "First-ever BasedWorld NFT in Catalog's inaugural release campaign.",
      "FM-curated 'Days Past Gone' release.",
    ],
    socialHandles: [],
    web3Profiles: [
      { platform: "catalog", url: "", handle: null, contractAddress: null, context: "Days Past Gone." },
    ],
    metrics: [],
    bookingNote: null,
    submittedAt: null,
    publishedAt: null,
    adminRevisionNote: null,
    createdAt: "2026-05-04T00:00:00Z",
    updatedAt: "2026-05-04T00:00:00Z",
  },
];

/** Get a single artist's EPK by userId. */
export function epkForUser(userId: string): ArtistEpk | null {
  return MOCK_ARTIST_EPKS.find((e) => e.userId === userId) ?? null;
}

/** Pending submissions for the admin review queue, newest-first. */
export function pendingEpkSubmissions(): ArtistEpk[] {
  return MOCK_ARTIST_EPKS.filter((e) => e.status === "submitted").sort(
    (a, b) =>
      (b.submittedAt ?? b.updatedAt).localeCompare(a.submittedAt ?? a.updatedAt),
  );
}

/** Whether a user's EPK is currently visible on /u/[handle]. */
export function isEpkLive(userId: string): boolean {
  const epk = epkForUser(userId);
  if (!epk) return false;
  return epk.status === "published";
}
