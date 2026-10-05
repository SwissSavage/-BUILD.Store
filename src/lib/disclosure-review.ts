/**
 * Pure helpers for circumvention review.
 *
 * Separate from disclosure-review-actions.ts because that file carries
 * "use server" and a "use server" module may only export async
 * functions. The hash is needed by the review page, which is not a
 * server action, so it lives here.
 */
import { createHash } from "crypto";

export type DisclosureField = "bio" | "tagline";

/**
 * Stable identity for one exact piece of text.
 *
 * A review is recorded against the text an admin actually read, so
 * clearing a bio clears that bio rather than that member. Edit the
 * text, the hash changes, and the row returns to the queue.
 */
export function hashDisclosureText(text: string | null | undefined): string {
  return createHash("sha256").update((text ?? "").trim()).digest("hex");
}
