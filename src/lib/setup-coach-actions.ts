"use server";

/**
 * Dismissing the setup coach.
 *
 * One action, and it only ever writes a timestamp. The coach has no
 * per-step progress to record: what it shows is derived from the
 * profile itself, so completing a step IS filling the field in. See
 * the header on src/lib/setup-coach.ts.
 *
 * Idempotent. Dismissing twice keeps the first timestamp, because the
 * useful question later is "when did this member first wave it away",
 * not "when did they last".
 */
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth-stub";

export async function dismissSetupCoach(): Promise<void> {
  // Inlined rather than extracted into a helper: check-server-action-auth
  // matches the auth call inside each exported function body, so a
  // shared wrapper reads to the guard as an ungated action.
  const user = await getCurrentUser();
  if (!user) return;

  await db
    .update(users)
    .set({ setupCoachDismissedAt: new Date().toISOString() })
    .where(
      and(eq(users.id, user.id), isNull(users.setupCoachDismissedAt)),
    );

  revalidatePath("/profile");
  revalidatePath("/dashboard");
}
