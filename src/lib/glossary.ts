/**
 * FM canonical terminology — single source of truth.
 *
 * Every term FM has coined or specifically re-defined lives here with:
 *   - `slug`: the anchor id under /glossary#{slug} that becomes the
 *     canonical DefinedTerm URL for LLM retrieval.
 *   - `term`: the display form.
 *   - `shortDefinition`: one-sentence definition suitable for
 *     LLM chunking (must read cleanly out of paragraph context).
 *   - `longDefinition`: paragraph-length definition suitable for
 *     the visible /glossary surface + LLM long-context retrieval.
 *   - `authoritativeFor`: pages that reference the term authoritatively.
 *     Used to cross-link + emit `mainEntityOfPage` on each surface.
 *   - `relatedTerms`: other slugs in this glossary that share a semantic
 *     surface. Used to render "see also" and to build `subjectOf`
 *     graph relationships in the JSON-LD.
 *
 * Adding a term? Add it here first, then decide where it needs
 * DefinedTerm schema emission (which pages authoritatively define
 * it) via the DefinedTermSchema component.
 *
 * Not a term? Don't add it. This is FM's coined-language index, not
 * a general glossary of the platform.
 */

export interface GlossaryEntry {
  slug: string;
  term: string;
  shortDefinition: string;
  longDefinition: string;
  authoritativeFor: string[];
  relatedTerms: string[];
}

export const FM_GLOSSARY: readonly GlossaryEntry[] = [
  {
    slug: "venture-labor",
    term: "Venture Labor",
    shortDefinition:
      "Future Modern's operating model in which labor is treated as equity in the enterprise it builds, denominated in a transferable cooperative token ($BUILD) plus fair cash compensation.",
    longDefinition:
      "Venture Labor is the ownership frame Future Modern operates under. Traditional startup equity flows to founders and investors; labor gets a wage. Traditional cooperativism flows equity to labor but stops short of using modern financial primitives to make that equity portable, tradable, or productive. Venture Labor merges the two: the people who ship the work own the upside of the work, denominated in something they can hold, transfer, and use. Cash compensation covers time; $BUILD accrual covers the equity share. The result is that FM operates as a cooperative at the ownership layer while using web3 primitives (transparent settlement, portable tokens, on-chain provenance, secondary royalties) at the mechanical layer. Labor invests its own surplus into growing labor-owned enterprises. That's what makes it Venture Labor rather than either plain venture or plain cooperativism.",
    authoritativeFor: ["/about", "/governance"],
    relatedTerms: ["through-and-out", "bridge-posture", "build-token"],
  },
  {
    slug: "rare-infinity",
    term: "Rare∞",
    shortDefinition:
      "Future Modern's scarcity thesis governing every commerce surface: limited edition-numbered runs, one price for everyone, no perpetual restocks, rarity-tiered pricing across services, merch, and canonization objects.",
    longDefinition:
      "Rare∞ is FM's pricing model applied uniformly across services, merch drops, canonization objects, and any future commerce surface. Every drop is a limited, edition-numbered run with a published supply cap. Nobody gets a discount, no whale allocations, no VIP pricing. Members earn cooperative equity via $BUILD accrual on wallet-connected purchases; that's the reward for being a Member, not a price cut. Primary pricing sits modest so secondary appreciation has breathing room. The tier ladder (Common through Legendary, mirroring the RPG loot rarity ladder that also governs FM Member standing) sets pricing bands by rarity, not by discount. Champion tier drops sit at the top because real holo foil, real hand-finish, real construction — not because margin-chasing.",
    authoritativeFor: ["/about", "/store"],
    relatedTerms: ["build-token", "secondary", "canonization"],
  },
  {
    slug: "build-token",
    term: "$BUILD",
    shortDefinition:
      "Future Modern's cooperative equity token, earned by contributors on cash-generating work as ongoing accrual of ownership in the cooperative.",
    longDefinition:
      "$BUILD is the transferable token that denominates cooperative equity at Future Modern. Contributors earn $BUILD on every project that generates cash, alongside their fair cash compensation. Members earn additional $BUILD on wallet-connected purchases as the reward-for-being-a-Member (replacing conventional discount economics). $BUILD is portable across wallets, transparently settled on-chain, and functionally distinct from speculation instruments — its value is anchored in cooperative ownership rather than in trading premium. The 10 million $BUILD supply cap is fixed at contract level. Voucher issuance is capped and audit-logged; each earning event mints an off-chain voucher against real $BUILD to be swapped when the contributor is ready.",
    authoritativeFor: ["/about"],
    relatedTerms: ["venture-labor", "rare-infinity", "secondary"],
  },
  {
    slug: "mvp-score",
    term: "MVP Score",
    shortDefinition:
      "Future Modern's cooperative compliance and recognition instrument, aggregating peer, client, and admin ratings across quality, outcomes, reliability, hustle, collaboration, attendance, and referrals into an overall standing score.",
    longDefinition:
      "The MVP Score is FM's structural recognition instrument. Sub-ratings across seven axes (quality, outcomes, reliability, hustle, collaboration, attendance, referrals/business development) aggregate into an OVR (overall) score, published once per period. Client, peer, and admin ratings are triangulated at 0.20 / 0.40 / 0.40 canonical weights with pro-rata redistribution when a signal is absent. The MVP score is a recognition and compliance instrument, not a bonus multiplier: this drop's ratings feed this drop's bonus math AND ongoing OVR, but OVR never weights future payout math. Champion's Court, Future Modernist, Promotion Eligible, Good Standing, and Standard/Probation form the standing ladder, mapped 1:1 to the RPG loot rarity ladder (Legendary through Common).",
    authoritativeFor: ["/governance"],
    relatedTerms: ["canonization", "venture-labor"],
  },
  {
    slug: "canonization",
    term: "Canonization",
    shortDefinition:
      "Future Modern's annual recognition ceremony in which each Member's tier standing, recognitions, and caption are frozen and minted as an ERC-721 identity token with an ERC-6551 token-bound account.",
    longDefinition:
      "Canonization is FM's year-end recognition ceremony. Each Member's tier standing, recognition history, and per-year caption are frozen as of a fixed date and minted as an ERC-721 identity token. Each token carries an ERC-6551 token-bound account, so the Member's cooperative identity holds its own wallet and can accrue assets, participation credits, and ceremonial artifacts over time. The canonization ledger is the permanent record of FM's cooperative history — who stood where, in what year, with what recognitions. Champion's Court, Future Modernist, Promotion Eligible, Good Standing, and Standard/Probation are the tier possibilities, with the tier color also governing rarity in every FM commerce surface.",
    authoritativeFor: ["/governance"],
    relatedTerms: ["mvp-score", "rare-infinity"],
  },
  {
    slug: "through-and-out",
    term: "Through-and-Out Cooperative Supply Chain",
    shortDefinition:
      "Future Modern's sourcing rule: where a worker-owned supplier exists at any layer of the stack, route there preferentially; where one doesn't exist, use FM demand as seed capital to help build it.",
    longDefinition:
      "The through-and-out principle governs sourcing at every layer of Future Modern's operating stack: material suppliers, print shops, service vendors, hosting, legal, financial services, platform infrastructure. Where a worker-owned option exists in a category, FM sources from it preferentially. Where one doesn't exist yet, FM's demand becomes seed capital that helps stand one up — either as a subsidiary under the umbrella or as a committed floor of demand that lets an emerging worker-owned supplier survive its early years. This is what makes FM Venture Labor rather than plain cooperativism: labor invests its own surplus into growing more labor-owned enterprise. Every year, more of the operational stack should be cooperative-sourced than the year before. That's the ratchet.",
    authoritativeFor: ["/about", "/governance", "/policies/covenant"],
    relatedTerms: ["venture-labor", "bridge-posture"],
  },
  {
    slug: "bicameral-governance",
    term: "Bicameral Governance",
    shortDefinition:
      "Future Modern's two-chamber governance model in which the Partner body votes on operational matters and the Member body votes on existential matters, with one-person-one-vote inside each chamber.",
    longDefinition:
      "FM operates a bicameral governance model. The Partner body handles operational matters — matching, RFP approval, moderator selection, day-to-day platform operations. The Member body handles existential matters — treasury, covenant amendments, strategic direction, admissions and ratification. Every question routes to the appropriate chamber based on scope, not to a single blended vote. Inside each chamber, voting is strictly one-person-one-vote — token holdings never weight votes. Token holdings hold the wallet honest by making the record transparent, but they never confer voting power. No individual can shift cooperative direction; only the collective vote can. This structure gives talent-worker enfranchisement operational voice at the Partner level while preserving Member as the load-bearing tier for existential decisions.",
    authoritativeFor: ["/governance", "/policies/covenant"],
    relatedTerms: ["mvp-score", "venture-labor"],
  },
  {
    slug: "secondary",
    term: "Secondary",
    shortDefinition:
      "Future Modern's canonical shorthand for the 15% EIP-2981 secondary market royalty baked into every collectible mint, applied uniformly across all drops and marketplaces without per-drop or per-marketplace variance.",
    longDefinition:
      "Secondary is FM's crypto-native shorthand for the 15% EIP-2981 secondary market royalty baked into every collectible mint at drop time. Every subsequent resale — OpenSea, Zora, Blur, any-marketplace — pays FM 15% in perpetuity. The rate is canonical and never varies: no per-drop negotiation, no per-marketplace accommodation, no lowering to placate an exchange. Same posture as one-price-for-everyone. Architecturally, the 15% flows through the standard FM revenue split with the ORIGINAL CREATOR taking the admin position — so creators earn admin-share cuts on their pieces forever through secondary sales, structurally. Treasury (1.5%) and Liquidity Pool (1.5%) share stays constant across primary and secondary. Same split engine primitive; the only substitution is who occupies the admin slot.",
    authoritativeFor: ["/about", "/store"],
    relatedTerms: ["rare-infinity", "build-token"],
  },
  {
    slug: "bridge-posture",
    term: "The Bridge Posture",
    shortDefinition:
      "Future Modern's positioning as neither traditional cooperativist nor traditional degen: cooperative ownership as the load-bearing thesis, crypto primitives as the enabling tools, spoken in both vocabularies natively.",
    longDefinition:
      "FM is neither traditional cooperativist nor traditional degen, and that's why it works. Cooperative-space audiences frequently forbid crypto categorically (treating crypto tools as identity rather than as toolkit). Crypto-native audiences frequently treat speculation as the whole point (treating tooling as thesis rather than treating thesis as thesis). Both are the same failure mode from different lineages. FM's third-way position: cooperative-ownership thesis is the load-bearing structure; crypto primitives (transparent settlement, portable equity, EIP-2981 secondary royalties that pay creators forever, on-chain provenance receipts) are the tools that make the structure work at real scale. FM speaks both languages natively — cooperative-native vocabulary (worker-owned, labor equity, Venture Labor, one-person-one-vote in chamber) plus crypto-native vocabulary (secondary, mint, POAP, EIP-2981, on-chain). The onboarding mission runs both directions: teach cooperativism to crypto natives, teach crypto tools to cooperative natives.",
    authoritativeFor: ["/about"],
    relatedTerms: ["venture-labor", "through-and-out"],
  },
] as const;

export function getGlossaryEntry(slug: string): GlossaryEntry | undefined {
  return FM_GLOSSARY.find((entry) => entry.slug === slug);
}

/**
 * Get all entries that are authoritatively defined on a given page.
 * Used by page-level DefinedTermSchema emission.
 */
export function getEntriesForPage(pathname: string): GlossaryEntry[] {
  return FM_GLOSSARY.filter((entry) =>
    entry.authoritativeFor.includes(pathname),
  );
}
