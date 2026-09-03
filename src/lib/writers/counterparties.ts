/**
 * Outside parties we have paperwork with.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-03)
 *
 * Jamar: "we want to keep them on file, because ideally they will be
 * using our system a lot more."
 *
 * So a counterparty is a row, keyed on email, and the same firm across
 * three agreements over two years is one record rather than three
 * copies of a name typed slightly differently each time.
 *
 * This exists because `agreements.userId` is a foreign key to members
 * and an NCNDA counterparty is not a member. The webhook used to
 * smuggle `ncnda:<email>` into that column, which cannot satisfy the
 * constraint, so every NCNDA insert threw and none were ever recorded.
 * ─────────────────────────────────────────────────────────────
 */
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { counterparties } from "@/db/schema";

export interface CounterpartyInput {
  email: string;
  name: string;
  company?: string | null;
}

/**
 * Find this counterparty or create them, and return the id.
 *
 * `onConflictDoUpdate` on the email rather than a read-then-write: two
 * NCNDAs going out to the same firm at once should produce one row,
 * and a select-then-insert loses that race.
 *
 * A repeat visit refreshes name, company and lastSeenAt, because the
 * newer envelope is the better record of what they call themselves
 * now. It never clears a company we already knew for a blank one.
 */
export async function upsertCounterparty(
  input: CounterpartyInput,
): Promise<string> {
  const email = input.email.trim().toLowerCase();
  if (!email) throw new Error("Counterparty email is required.");

  const name = input.name.trim() || email;
  const company = input.company?.trim() || null;
  const now = new Date().toISOString();

  const [row] = await db
    .insert(counterparties)
    .values({
      id: `cp_${randomUUID()}`,
      email,
      name,
      company,
      notes: null,
      firstSeenAt: now,
      lastSeenAt: now,
    })
    .onConflictDoUpdate({
      target: counterparties.email,
      set: {
        name,
        // Only overwrite company when we were actually told one.
        ...(company ? { company } : {}),
        lastSeenAt: now,
      },
    })
    .returning({ id: counterparties.id });

  return row.id;
}

/** Everything on file for one outside party. Admin surfaces. */
export async function getCounterpartyByEmail(email: string) {
  const [row] = await db
    .select()
    .from(counterparties)
    .where(eq(counterparties.email, email.trim().toLowerCase()))
    .limit(1);
  return row ?? null;
}

/** The whole book of outside parties, most recently active first. */
export async function listCounterparties() {
  const rows = await db.select().from(counterparties);
  return rows.sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt));
}
