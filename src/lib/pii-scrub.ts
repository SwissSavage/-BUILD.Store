/**
 * Client-safe PII scrub (task #39).
 *
 * Strips personally-identifying + off-platform-routing signals from
 * any string before it reaches a client-facing surface. Prevents
 * client-poaching (contractor slipping their direct email into a
 * pitch) and off-platform circumvention (external booking links,
 * personal domains, DM invitations).
 *
 * Used by:
 *   - Bid cards on /projects/[id]/quotes before rendering to clients
 *   - Pitches in the /admin/inbound triage view before promoting
 *   - Portfolio item descriptions when they hit public /u/[handle]
 *   - Public community chat messages (task #64)
 *
 * Not used on admin-facing surfaces — admin needs to see raw content
 * to make routing decisions.
 *
 * Non-goal: this is not a security tool. It's a hygiene layer that
 * catches accidental + casual attempts. Determined bad actors can
 * obfuscate around any regex. Compliance-tier + Conduct Standards
 * (LOI §17) do the actual enforcement.
 */

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

// Phone-number heuristic: 10+ digits with optional country code,
// separators, or parentheses. Loose enough to catch common formats,
// tight enough to skip 4-digit "2024" year references.
const PHONE_RE =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}/g;

// External booking/scheduling links that route around FM. Extend the
// list as new tools appear.
const BOOKING_HOSTS = [
  "calendly.com",
  "cal.com",
  "savvycal.com",
  "tidycal.com",
  "koalendar.com",
  "youcanbook.me",
  "acuityscheduling.com",
  "book.me",
];

// URL matcher — captures the host so we can compare against denylists
// without over-scrubbing legitimate portfolio links.
const URL_RE = /\bhttps?:\/\/([^\s/$.?#].[^\s]*)/gi;

// Explicit "reach me off-platform" phrases. These are casual invitations
// admins would want flagged even without a link/email attached.
const OFF_PLATFORM_PHRASES = [
  /\bDM\s+me\b/gi,
  /\bemail\s+me\s+at\b/gi,
  /\btext\s+me\s+at\b/gi,
  /\bcall\s+me\s+at\b/gi,
  /\breach\s+me\s+at\b/gi,
  /\bhit\s+me\s+up\s+at\b/gi,
];

const REDACTED = "[redacted]";

export interface PiiScrubResult {
  /** Scrubbed text, safe to render to a client. */
  scrubbed: string;
  /** Categories of hits that fired — surfaced to admin as flags. */
  hits: Array<
    "email" | "phone" | "booking_link" | "external_url" | "off_platform_phrase"
  >;
  /** Count of individual redactions performed. */
  redactionCount: number;
}

/**
 * Scrub a piece of user-generated text intended for a client-facing
 * surface. Returns the redacted string + the categories flagged so
 * admin queues can show a warning badge on the raw submission.
 */
export function scrubForClient(input: string | null | undefined): PiiScrubResult {
  if (!input || input.trim().length === 0) {
    return { scrubbed: "", hits: [], redactionCount: 0 };
  }

  let text = input;
  const hits = new Set<PiiScrubResult["hits"][number]>();
  let redactionCount = 0;

  // Emails
  text = text.replace(EMAIL_RE, () => {
    hits.add("email");
    redactionCount += 1;
    return REDACTED;
  });

  // Phone numbers (post-email so email-looking strings can't leak digits)
  text = text.replace(PHONE_RE, () => {
    hits.add("phone");
    redactionCount += 1;
    return REDACTED;
  });

  // URLs — split into booking-tool denylist + generic external-URL
  // observation. Booking tools redact; other URLs pass through since
  // portfolio links are legitimate — admin sees the "external_url"
  // flag as informational context, not as a redaction.
  text = text.replace(URL_RE, (match, hostAndPath) => {
    const host = String(hostAndPath).split("/")[0].toLowerCase();
    const isBookingTool = BOOKING_HOSTS.some(
      (b) => host === b || host.endsWith(`.${b}`),
    );
    if (isBookingTool) {
      hits.add("booking_link");
      redactionCount += 1;
      return REDACTED;
    }
    hits.add("external_url");
    return match;
  });

  // Off-platform phrasing
  for (const phrase of OFF_PLATFORM_PHRASES) {
    text = text.replace(phrase, () => {
      hits.add("off_platform_phrase");
      redactionCount += 1;
      return REDACTED;
    });
  }

  return {
    scrubbed: text,
    hits: Array.from(hits),
    redactionCount,
  };
}

/**
 * Convenience helper — returns just the scrubbed string, dropping
 * the flags. Use in JSX render paths where the flag surface isn't
 * needed.
 */
export function scrubbedText(input: string | null | undefined): string {
  return scrubForClient(input).scrubbed;
}

/**
 * Convenience helper — returns true if the input contained anything
 * that would be redacted. Use in admin queues to render a warning
 * badge on flagged submissions.
 */
export function containsPii(input: string | null | undefined): boolean {
  return scrubForClient(input).redactionCount > 0;
}
