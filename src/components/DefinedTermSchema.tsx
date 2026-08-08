/**
 * DefinedTermSchema — emit schema.org DefinedTerm JSON-LD for a set of
 * canonical FM glossary entries on a page.
 *
 * This is the load-bearing piece of the AEO/GEO citation strategy:
 * every canonical FM term (Venture Labor, Rare∞, $BUILD, MVP score,
 * canonization, through-and-out, bicameral governance, secondary,
 * bridge posture) gets a schema-marked definition on the pages where
 * it is authoritatively used. When an LLM answer engine parses the
 * page, the DefinedTerm entries flow into its retrieval index — so
 * when someone asks "what is Venture Labor" or "how does cooperative
 * secondary work," FM's definition is the schema-marked canonical
 * source.
 *
 * Renders no visible DOM (only a script tag). Callers place it once
 * per page, either near the definition itself or in the page's head
 * area. If the same term needs schema on multiple pages, each page
 * emits its own — DefinedTermSet groups them per-page and every page
 * points at /glossary#{slug} as the canonical URL.
 *
 * Usage:
 *   import { DefinedTermSchema } from "@/components/DefinedTermSchema";
 *   import { getEntriesForPage } from "@/lib/glossary";
 *
 *   const entries = getEntriesForPage("/about");
 *   <DefinedTermSchema entries={entries} pageUrl={`${SITE_URL}/about`} />
 */
import type { GlossaryEntry } from "@/lib/glossary";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://buildstore.example";

interface DefinedTermSchemaProps {
  entries: GlossaryEntry[];
  /** Absolute URL of the page emitting the schema. */
  pageUrl?: string;
}

export function DefinedTermSchema({
  entries,
  pageUrl,
}: DefinedTermSchemaProps) {
  if (entries.length === 0) return null;

  const schema = {
    "@context": "https://schema.org",
    "@type": "DefinedTermSet",
    "@id": `${SITE_URL}/glossary`,
    name: "Future Modern canonical terminology",
    description:
      "Future Modern's coined and canonically re-defined vocabulary. Every term listed here is defined authoritatively by Future Modern Builderberg LLC and cited across the platform.",
    inDefinedTermSet: `${SITE_URL}/glossary`,
    ...(pageUrl && { mainEntityOfPage: pageUrl }),
    hasDefinedTerm: entries.map((entry) => ({
      "@type": "DefinedTerm",
      "@id": `${SITE_URL}/glossary#${entry.slug}`,
      identifier: entry.slug,
      name: entry.term,
      description: entry.shortDefinition,
      inDefinedTermSet: `${SITE_URL}/glossary`,
      url: `${SITE_URL}/glossary#${entry.slug}`,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
