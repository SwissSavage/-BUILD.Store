/**
 * schema.org Person JSON-LD emitter for public talent profiles
 * (task #31). Google + AI answer engines use this to include FM
 * talent in Person search results ("who is Sarah at Future Modern"
 * style queries) and long-tail skill-based searches.
 *
 * First-name / alias only per FM's public policy — full names never
 * leak into structured data. `alternateName` carries the disambigu-
 * ated form (first + last initial) when there are collisions in the
 * cohort.
 *
 * `sameAs` is the anti-circumvention gate: we deliberately DO NOT
 * emit external portfolio URLs / personal domains on the public
 * profile Person markup — clients discovering talent through search
 * should route back through FM as the contract of record. Client
 * routing lives in the invite flow.
 */

interface PersonJsonLdProps {
  /** Display name (already first-name-masked / disambiguated). */
  name: string;
  /** Public /u/[handle] canonical URL. */
  url: string;
  /** Optional short one-liner (from the user's tagline). */
  description?: string;
  /** Job title / discipline label ("RevOps Strategist", etc.). */
  jobTitle?: string;
  /** Skill tags surfaced as knowsAbout. */
  knowsAbout?: string[];
  /** Portrait / avatar URL if present. */
  image?: string;
  /** FM org anchor so Google connects the person to the cooperative. */
  memberOfOrgUrl?: string;
}

export function PersonJsonLd(props: PersonJsonLdProps) {
  const payload: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: props.name,
    url: props.url,
  };

  if (props.description) payload.description = props.description;
  if (props.jobTitle) payload.jobTitle = props.jobTitle;
  if (props.image) payload.image = props.image;
  if (props.knowsAbout && props.knowsAbout.length > 0) {
    payload.knowsAbout = props.knowsAbout;
  }
  if (props.memberOfOrgUrl) {
    payload.memberOf = {
      "@type": "Organization",
      url: props.memberOfOrgUrl,
    };
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}

/**
 * schema.org CreativeWork emitter for public portfolio items
 * (task #33). Renders once per published portfolio item on the
 * talent's public profile — long-tail SEO for "case study of X"
 * queries and AI answer-engine attribution.
 *
 * `creator` uses the first-name-masked display so full identity
 * never appears in structured data.
 */
export function CreativeWorkJsonLd(props: {
  name: string;
  url: string;
  description?: string;
  image?: string;
  creatorName: string;
  creatorUrl: string;
  keywords?: string[];
}) {
  const payload: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: props.name,
    url: props.url,
    creator: {
      "@type": "Person",
      name: props.creatorName,
      url: props.creatorUrl,
    },
  };
  if (props.description) payload.description = props.description;
  if (props.image) payload.image = props.image;
  if (props.keywords && props.keywords.length > 0) {
    payload.keywords = props.keywords.join(", ");
  }
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
