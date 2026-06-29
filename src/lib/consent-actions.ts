/**
 * Consent / data-participation server actions.
 *
 * Tier-2 data participation is the cooperative's labor-value research +
 * collective-bargaining tooling scope. It's an explicit opt-in distinct
 * from the registration baseline T&C (which covers Tier-1 operational
 * use: internal pricing, matching, calibration). Members toggle their
 * Tier-2 status from /profile at any time. Default is opt-out.
 *
 * Audit posture: opt-in / opt-out events should land in an audit log
 * for governance review. Sandbox writes the flag in memory; production
 * swap is a `users.data_participation` Drizzle column plus an
 * append-only `data_participation_audit` table with `userId`,
 * `priorValue`, `newValue`, `actorId`, `at`, and the request IP.
 */
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_USERS } from "@/lib/mock-data/users";

/**
 * Member opts in to Tier-2 data participation.
 */
export async function optInDataParticipation() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required");
  const row = MOCK_USERS.find((u) => u.id === user.id);
  if (!row) throw new Error("User not found");
  row.dataParticipation = true;
  row.updatedAt = new Date().toISOString();
  revalidatePath("/profile");
}

/**
 * Member opts out of Tier-2 data participation.
 *
 * Stops new collection for Tier-2 purposes. Already-published anonymized
 * aggregates remain in their published form (non-revocable in effect by
 * design).
 */
export async function optOutDataParticipation() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required");
  const row = MOCK_USERS.find((u) => u.id === user.id);
  if (!row) throw new Error("User not found");
  row.dataParticipation = false;
  row.updatedAt = new Date().toISOString();
  revalidatePath("/profile");
}
