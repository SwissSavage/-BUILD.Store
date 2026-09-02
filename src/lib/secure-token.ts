/**
 * Cryptographically secure tokens for anything that acts as a credential.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-02)
 *
 * Six public routes are keyed on a token that IS the credential:
 * /invoices/[token], /quotes/[token], /proposals/[token],
 * /receipts/[token], /feedback/confirm/[token] and the invite code.
 * Anyone holding the string sees the document.
 *
 * Four of them were generated with Math.random() plus a timestamp:
 *
 *   invoice clientToken   tok_ext_<ts>_<4 chars>   36^4 = 1.6 million
 *   quote clientToken     q_<projectId>_<6 chars>  project id included
 *   feedback confirm      cfconf_<ts>_<6 chars>
 *   proposal token        tk_<12 chars><ts>
 *
 * The invoice token is the worst: four base-36 characters, with a
 * timestamp prefix an attacker can narrow to the hour. Every client
 * invoice was enumerable in a modest number of requests.
 *
 * The quote token embeds the project id, which appears in public URLs,
 * so only six characters stood between a known contract and its quote.
 *
 * Math.random() is the deeper problem in all four. It is not a CSPRNG:
 * V8 uses xorshift128+, and observing a handful of outputs is enough to
 * recover the generator state and predict the rest. Anyone who holds
 * one legitimate token, which every client does, is in that position.
 *
 * randomBytes is the fix, and it costs nothing. Existing tokens keep
 * working, since this only changes how new ones are minted.
 * ─────────────────────────────────────────────────────────────
 */
import { randomBytes } from "crypto";

/**
 * A URL-safe token with 128 bits of entropy by default.
 *
 * base64url rather than hex: same entropy in fewer characters, and no
 * padding or reserved characters to escape in a path segment.
 *
 * No timestamp and nothing derived from the record. A token should say
 * nothing about what it unlocks or when it was made.
 */
export function secureToken(prefix: string, bytes = 16): string {
  const raw = randomBytes(bytes).toString("base64url");
  return prefix ? `${prefix}_${raw}` : raw;
}
