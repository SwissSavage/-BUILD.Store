/**
 * The admin-triggered half of inbound reconciliation.
 *
 * Separate module because this one is a genuine server action behind
 * requireAdmin, while the helper it sits next to runs during an
 * unauthenticated invite signup and must never be published as an
 * endpoint. See the note at the top of inbound-reconcile.ts.
 */
"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { inboundSubmissions, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-stub";
import { ADMISSION_KINDS, INBOUND_APPROVED } from "@/lib/inbound-triage";
import { UNRESOLVED_INBOUND } from "@/lib/inbound-reconcile";
/**
 * Sweep every open admission against the member roster.
 *
 * The hook on invite completion stops new duplicates. It cannot reach
 * backwards: Sahtyre had already accepted his invite and become a
 * member while his application sat in triage, and nothing was going to
 * fire for him again.
 *
 * Run from /admin/inbound rather than on page load. A GET that quietly
 * rewrites rows is how a queue starts changing under an admin while
 * they are reading it, and this one is a button so the admin knows the
 * merge happened and when.
 */
export async function reconcileInboundAgainstRoster(): Promise<{
  ok: boolean;
  message: string;
}> {
  await requireAdmin();

  const open = await db
    .select({
      id: inboundSubmissions.id,
      email: inboundSubmissions.submitterEmail,
      note: inboundSubmissions.triageNote,
    })
    .from(inboundSubmissions)
    .where(
      and(
        inArray(inboundSubmissions.kind, ADMISSION_KINDS),
        inArray(inboundSubmissions.status, [...UNRESOLVED_INBOUND]),
      ),
    );
  if (open.length === 0) {
    return { ok: true, message: "Nothing open to merge." };
  }

  const roster = await db
    .select({ id: users.id, email: users.email })
    .from(users);
  const memberByEmail = new Map(
    roster
      .filter((u) => u.email)
      .map((u) => [u.email.trim().toLowerCase(), u.id]),
  );

  const now = new Date().toISOString();
  let merged = 0;
  for (const row of open) {
    const email = (row.email ?? "").trim().toLowerCase();
    if (!email) continue;
    const userId = memberByEmail.get(email);
    if (!userId) continue;

    const note = [
      row.note?.trim(),
      `Already a member when this was reviewed on ${now.slice(0, 10)}. Application and account merged.`,
    ]
      .filter(Boolean)
      .join("\n\n");

    await db
      .update(inboundSubmissions)
      .set({
        status: INBOUND_APPROVED,
        linkedResourceId: userId,
        deepLinkHref: `/admin/members/${userId}`,
        triageNote: note,
        updatedAt: now,
      })
      .where(eq(inboundSubmissions.id, row.id));
    merged += 1;
  }

  revalidatePath("/admin/inbound");
  return {
    ok: true,
    message:
      merged === 0
        ? "No crossover found. Everything open is a genuinely new person."
        : `Merged ${merged} ${merged === 1 ? "application" : "applications"} with existing accounts.`,
  };
}
