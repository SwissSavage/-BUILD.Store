/**
 * Phygital canonization-card request — sandbox stub.
 *
 * Per production-swap-checklist §7m (phygital marketplace, v1.1+):
 * physical cards print on-demand via card printer integration (Make-
 * playingcards / DriveThruCards / custom) with NFC or QR scan-to-verify
 * tied to the on-chain ERC-6551 TBA. Members buy their own at near-cost;
 * outsiders buy as collectibles at market rate; Champion's Court
 * legendary cards command premium pricing with real holographic foil.
 *
 * Sandbox stub: this action just pushes a notification to admins
 * acknowledging the request. Production layers Stripe payment intent +
 * fulfillment routing to the print partner.
 */
"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth-stub";
import { getAdminUsers } from "@/lib/readers/users";
import { getCanonizationsForUser } from "@/lib/readers/recognitions";
import { notifyMany } from "@/lib/writers/notifications";

export async function requestPhygitalCanonCard(formData: FormData) {
  const me = await getCurrentUser();
  if (!me) throw new Error("Sign in required");
  const canonId = String(formData.get("canonId") ?? "").trim();
  const shippingNote = String(formData.get("shippingNote") ?? "").trim();

  // Scoped to the member's own canonizations, which doubles as the
  // ownership check: a canon id belonging to someone else is simply
  // not in this list.
  const mine = await getCanonizationsForUser(me.id);
  const canon = mine.find((c) => c.id === canonId);
  if (!canon) {
    throw new Error(
      "Canonization not found. Members can request phygital prints of their own cards; outsider purchases route through the public marketplace (v1.1+).",
    );
  }

  // Sandbox stub: notify admin pool that a phygital request is in queue.
  // Production swap: dispatches Stripe payment intent + print-partner job.
  //
  // Was a push onto the in-memory notifications array addressed to seed
  // admins, so the request reached nobody and left no trace. The member
  // saw the form succeed.
  const { users: admins } = await getAdminUsers();
  await notifyMany(
    admins.map((a) => a.id),
    {
      kind: "direct_message",
      title: `Phygital request: ${me.firstName ?? me.handle}, ${canon.year} card`,
      body: `${me.firstName ?? me.handle} requested a phygital print of their ${canon.year} canonization (tier: ${canon.tier}). ${shippingNote ? `Notes: ${shippingNote}` : "No additional notes."} Production swap dispatches to print partner.`,
      href: "/admin",
    },
  );

  revalidatePath("/profile/canon");
  revalidatePath("/notifications");
}
