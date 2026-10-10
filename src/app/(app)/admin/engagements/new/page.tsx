/**
 * /admin/engagements/new — start work directly.
 *
 * The counterpart to the RFP queue. That path is for cold acquisition:
 * post it, dispatch it, take bids, compile a quote. This one is for a
 * client who already knows who they want and what it costs, which is
 * most of how FM actually sells.
 *
 * What it produces is the record that a text message was standing in
 * for: client, Builder, rate, ceiling, scope, and a HubSpot deal, all
 * from one screen entered by an admin.
 */
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth-stub";
import { db } from "@/db/client";
import { clients } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getAllUsers } from "@/lib/readers/users";
import { safely } from "@/lib/readers";
import { INDUSTRY_LABELS, publicName, type Industry } from "@/lib/types";
import { CardEyebrow } from "@/components/Card";
import { StartEngagementForm } from "@/components/StartEngagementForm";

export const dynamic = "force-dynamic";

export default async function NewEngagementPage() {
  const admin = await requireAdmin();
  if (!admin) redirect("/signin?next=/admin/engagements/new");

  const clientRows = await safely(
    () =>
      db
        .select({ id: clients.id, displayName: clients.displayName })
        .from(clients)
        .where(eq(clients.status, "active")),
    [] as { id: string; displayName: string }[],
  );

  const { users: roster } = await safely(() => getAllUsers(), {
    users: [],
    source: "postgres" as const,
  });

  // Anyone who can be put on an engagement. Suspended accounts are
  // excluded because assigning work to a suspended member is a mistake
  // the form should not make possible.
  const talent = roster
    .filter((u) => !u.suspendedAt)
    .map((u) => ({
      id: u.id,
      name: publicName(u),
      discipline: u.discipline ?? null,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const industries = (Object.keys(INDUSTRY_LABELS) as Industry[]).map((value) => ({
    value,
    label: INDUSTRY_LABELS[value],
  }));

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <CardEyebrow>Admin · Engagements</CardEyebrow>
      <h1 className="mt-2 font-display text-4xl font-semibold">
        Start an engagement
      </h1>
      <p className="mt-3 max-w-prose text-sm text-ink-muted">
        For a client who already knows who they want. No RFP, no bids, no
        quote. Everything here is entered once by you; the Builder and the
        client each do one thing afterwards, which is sign.
      </p>

      <div className="mt-8">
        <StartEngagementForm
          clients={clientRows.sort((a, b) =>
            a.displayName.localeCompare(b.displayName),
          )}
          talent={talent}
          industries={industries}
        />
      </div>
    </div>
  );
}
