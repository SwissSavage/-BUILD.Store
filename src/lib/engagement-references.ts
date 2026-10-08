/**
 * The material an engagement runs on, as named items.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-08)
 *
 * Jamar: "If links/ attachments could be included that would also be
 * ideal. They're almost always necessary, but I don't like having them
 * sitting raw in the UX." Then: "There should also be a way to add
 * additional/ multiple links or attachments."
 *
 * He is right that they are always necessary. The engagement being
 * composed right now is two documents to redesign, both of them Google
 * Docs the client already holds. With nowhere to put them they would
 * have been pasted into the scope field, where a 180-character URL with
 * a /edit?usp=sharing tail becomes the first thing the Builder reads.
 *
 * So references are structured: every one carries a label, the label is
 * what renders, and the URL lives behind it. Many of each, added and
 * removed one row at a time.
 *
 * WHY LINKS AND FILES ARE SEPARATE LISTS
 *
 * A link is a pointer to a living document that the client will keep
 * editing. A file is a copy frozen at the moment it was attached. On a
 * redesign job that difference decides whether the Builder is working
 * from current copy, so the review screen says which is which rather
 * than flattening both into one list of attachments.
 * ─────────────────────────────────────────────────────────────
 */

import {
  MAX_ENGAGEMENT_FILE_BYTES,
  MAX_ENGAGEMENT_FILES,
  MAX_ENGAGEMENT_LINKS,
  type EngagementFile,
  type EngagementLink,
} from "@/lib/engagement-reference-limits";

export {
  MAX_ENGAGEMENT_FILES,
  MAX_ENGAGEMENT_LINKS,
  formatFileSize,
} from "@/lib/engagement-reference-limits";
export type {
  EngagementFile,
  EngagementLink,
} from "@/lib/engagement-reference-limits";

/**
 * Rendered where a URL would otherwise be, so a label is not optional:
 * an unlabelled link is the raw URL this exists to avoid. When someone
 * pastes a URL and types no label, the host stands in, because
 * "docs.google.com" is a worse label than "Current brand guide" and a
 * much better one than the full path with its query string.
 */
export function labelForUrl(url: string, typed: string): string {
  const label = typed.trim();
  if (label) return label.slice(0, 120);
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Reference";
  }
}

/**
 * http and https only.
 *
 * Not a general URL parse: javascript: and data: URLs parse perfectly
 * well and would render as a clickable link with a label of somebody
 * else's choosing on a page an admin asked a Builder to trust.
 */
export function isSafeReferenceUrl(value: string): boolean {
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Pull the link rows out of the form.
 *
 * Rows are posted as parallel `referenceLabel` / `referenceUrl` arrays,
 * which is how repeatable fields arrive from a plain form. Blank rows
 * are dropped rather than rejected: an empty row is the row the admin
 * added and changed their mind about, not an error to stop on.
 */
export function readEngagementLinks(
  formData: FormData,
): { links: EngagementLink[]; error?: string } {
  const labels = formData.getAll("referenceLabel").map((v) => String(v));
  const urls = formData.getAll("referenceUrl").map((v) => String(v));

  const links: EngagementLink[] = [];
  for (let i = 0; i < urls.length; i += 1) {
    const url = urls[i].trim();
    if (!url) continue;
    if (!isSafeReferenceUrl(url)) {
      return {
        links: [],
        error: `"${url.slice(0, 60)}" is not a web address. Links must start with http:// or https://.`,
      };
    }
    links.push({ label: labelForUrl(url, labels[i] ?? ""), url });
  }

  if (links.length > MAX_ENGAGEMENT_LINKS) {
    return {
      links: [],
      error: `Up to ${MAX_ENGAGEMENT_LINKS} links. Put the rest in a folder and link that.`,
    };
  }
  return { links };
}

/**
 * Same inline-base64 approach as proposal and RFP attachments.
 *
 * Server-only despite living in a module the composer form imports:
 * `Buffer` is referenced inside the body and never at module scope, so
 * the bundler drops it from the client chunk. The constants and the
 * formatters above are the parts the form actually uses.
 */
export async function readEngagementFiles(
  formData: FormData,
): Promise<{ files: EngagementFile[]; error?: string }> {
  const raw = formData
    .getAll("referenceFile")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (raw.length > MAX_ENGAGEMENT_FILES) {
    return {
      files: [],
      error: `Attach up to ${MAX_ENGAGEMENT_FILES} files. Link anything beyond that.`,
    };
  }

  const files: EngagementFile[] = [];
  for (const file of raw) {
    if (file.size > MAX_ENGAGEMENT_FILE_BYTES) {
      return {
        files: [],
        error: `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB. Max per file is 4 MB. Link anything larger.`,
      };
    }
    files.push({
      name: file.name.slice(0, 200),
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      base64: Buffer.from(await file.arrayBuffer()).toString("base64"),
    });
  }
  return { files };
}

/**
 * A HubSpot company id out of whatever the admin pasted.
 *
 * They paste the browser URL, because that is what is in the address
 * bar when you are looking at the company. The field wanted the bare
 * numeric id, got
 * `https://app.hubspot.com/contacts/39608246/record/0-2/12345678901/`,
 * and `getHubspotCompany` returned null without complaining, which
 * created a client row silently unlinked from the CRM.
 *
 * In that URL the portal id comes first and the object id last, so the
 * last long run of digits is the company. Returns "" when there is no
 * id to find, which the caller treats as no CRM link rather than as an
 * error: a relationship FM has not put in HubSpot yet is still a real
 * relationship.
 */
export function parseHubspotCompanyId(input: string): string {
  const value = input.trim();
  if (!value) return "";
  if (/^\d+$/.test(value)) return value;

  const recordMatch = value.match(/\/record\/[^/]+\/(\d+)/);
  if (recordMatch) return recordMatch[1];

  const digitRuns = value.match(/\d{4,}/g);
  return digitRuns ? digitRuns[digitRuns.length - 1] : "";
}
