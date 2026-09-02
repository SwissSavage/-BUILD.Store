/**
 * Agreements a member has signed.
 *
 * Added 2026-09-02. /profile called agreementsForUser from mock-data,
 * so "Your signed agreements" was rendered from seed data and was
 * empty for every real member no matter what they had signed. Billy
 * signed through the invite ceremony and saw nothing.
 */
import { desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { agreements } from "@/db/schema";
import type { Agreement } from "@/lib/types";

export async function getAgreementsForUser(
  userId: string,
): Promise<Agreement[]> {
  const rows = await db
    .select()
    .from(agreements)
    .where(eq(agreements.userId, userId))
    .orderBy(desc(agreements.createdAt));
  return rows as unknown as Agreement[];
}
