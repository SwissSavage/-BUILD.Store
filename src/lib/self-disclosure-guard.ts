/**
 * Stop a member from writing their way around the cooperative.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-22)
 *
 * The public profile renders a member as "Rob T." and then prints a
 * bio underneath that says "Rob Turley, also known as The RevOps
 * Hitman" and names his firm. The first-name convention exists to stop
 * a client contacting talent directly. A bio that gives the full name
 * and the company defeats it in one paragraph, and no amount of care
 * in the name rendering matters while that is true.
 *
 * `pii-scrub.ts` already catches the mechanical half: emails, phones,
 * booking links, "DM me". It runs at render and it is not wired to the
 * bio. This runs at save, and it adds the two things a member writes
 * about themselves that a generic scrubber cannot know to look for:
 * their own full name, and a company name.
 *
 * WHY BLOCK RATHER THAN REDACT
 *
 * Jamar's call, and it is the right one for this field. Redacting a
 * bio silently would leave a member reading "[redacted] is a dedicated
 * disruptor" on their own profile with no idea why. Blocking at save
 * tells them what to change while they are still in the editor with
 * the text in front of them.
 *
 * WHAT IT DELIBERATELY DOES NOT CATCH
 *
 * A bare brand with no company suffix, "The RevOps Hitman" on its own,
 * is not caught, because there is no way to tell it from any other
 * phrase. A lone surname is not caught either: too many surnames are
 * ordinary words, and blocking "Young" or "Black" mid-sentence would
 * make the editor feel broken. Nor is a company someone merely worked
 * for, which is work history and belongs in a bio. Those are review
 * decisions, not automatic ones. This module is a floor, not a
 * guarantee.
 * ─────────────────────────────────────────────────────────────
 */
import { scrubForClient } from "@/lib/pii-scrub";

export type DisclosureCode =
  | "email"
  | "phone"
  | "booking_link"
  | "external_url"
  | "off_platform_phrase"
  | "full_name"
  | "company_name";

export interface DisclosureFinding {
  code: DisclosureCode;
  /** Shown to the member, in the editor, next to the field. */
  message: string;
}

/**
 * Trading-name suffixes. A capitalised run ending in one of these is a
 * company.
 */
const COMPANY_RE =
  /\b(?:[A-Z][\w&'’-]*\.?\s+){1,5}(?:LLC|L\.L\.C\.|Inc\.?|Incorporated|Co\.|Corp\.?|Corporation|Ltd\.?|Limited|GmbH|Consulting|Consultancy|Agency|Studios?|Collective|Partners|Ventures|Holdings|Labs?)\b/;

/**
 * ...but naming a company is only a problem when it is THEIR company.
 *
 * "Built the RevOps function at Acme Consulting" is work history and
 * the whole point of a bio. "Through his consulting firm, X Co." is a
 * second place to buy the same work. Without this cue the guard blocks
 * every member who has ever had an employer, which would make the
 * editor feel broken and teach people to write nothing.
 */
const OWNED_COMPANY_CUE =
  /\b(?:my|our|his|her|their)\s+(?:[\w-]+\s+){0,3}(?:firm|company|agency|studio|practice|consultancy|shop|business|brand)\b|\b(?:founder|co-founder|owner|principal|proprietor)\s+(?:and\s+\w+\s+)?(?:of|at)\b|\bI\s+(?:run|own|founded|started)\b|\bfounded\s+(?:my|our)\b/i;

/**
 * A domain with no scheme in front of it. pii-scrub's URL matcher
 * requires http(s)://, so "calendly.com/robturley" sails straight
 * through it. That is the form people actually type.
 */
const BARE_DOMAIN_RE =
  /\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9-]+)*\.(?:com|net|org|io|co|me|dev|app|xyz|agency|studio|design|consulting|biz|info|link|site|shop)\b(?:\/\S*)?/i;

const MESSAGES: Record<DisclosureCode, string> = {
  email:
    "There is an email address in here. Clients reach you through the cooperative.",
  phone:
    "There is a phone number in here. Clients reach you through the cooperative.",
  booking_link:
    "There is an external booking link in here. Calls get scheduled through the cooperative.",
  external_url:
    "There is a link to an outside site in here. Put work in your portfolio instead, where it stays attributed to you.",
  off_platform_phrase:
    "This invites people to contact you off-platform.",
  full_name:
    "This gives your full name. Public surfaces use your first name and last initial so a client cannot route around the cooperative to reach you.",
  company_name:
    "This names a company. Your own firm does not belong in your cooperative profile; a client reading it has somewhere else to buy the same work.",
};

/**
 * Does this text name the person who wrote it?
 *
 * Matches first and last name near each other, so "Rob Turley" and
 * "Rob A. Turley" both count, and "Rob" on its own does not. Anchored
 * on the last name being present, since that is the part that makes
 * someone findable.
 */
function namesSelf(
  text: string,
  first: string | null | undefined,
  last: string | null | undefined,
): boolean {
  const f = first?.trim();
  const l = last?.trim();
  if (!f || !l || f.length < 2 || l.length < 2) return false;
  const esc = (v: string) => v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Up to two tokens between them covers a middle name or initial.
  const re = new RegExp(
    `\\b${esc(f)}\\b(?:[\\s,]+\\S+){0,2}[\\s,]+\\b${esc(l)}\\b`,
    "i",
  );
  return re.test(text);
}

/**
 * Everything wrong with one piece of member-authored text.
 *
 * Returns all findings rather than the first, so somebody fixing their
 * bio makes one pass instead of discovering the next problem each time
 * they press save.
 */
export function findSelfDisclosure(
  text: string | null | undefined,
  author: { firstName?: string | null; lastName?: string | null },
): DisclosureFinding[] {
  const value = (text ?? "").trim();
  if (!value) return [];

  const codes = new Set<DisclosureCode>(scrubForClient(value).hits);
  if (namesSelf(value, author.firstName, author.lastName)) {
    codes.add("full_name");
  }
  if (COMPANY_RE.test(value) && OWNED_COMPANY_CUE.test(value)) {
    codes.add("company_name");
  }
  if (BARE_DOMAIN_RE.test(value)) codes.add("external_url");

  return [...codes].map((code) => ({ code, message: MESSAGES[code] }));
}
