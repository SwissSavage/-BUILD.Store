/**
 * What each Builder on a contract is billed to the client at.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-27)
 *
 * The invoice draft form was a description box and an amount box.
 * "Ozy Design Services $65/hr" was typed into one and a total typed
 * into the other, and nothing connected either number to the rate the
 * client had actually agreed to. The invoice could say any rate at all
 * and the app would have no opinion.
 *
 * Jamar: service rate "should come from contract".
 *
 * WHY TWO SOURCES
 *
 * A contract gets its client-facing rate from one of two places,
 * depending on how the work was won, and both have to be read because
 * both kinds of engagement are live:
 *
 *   won through an RFP    cooperative_quotes.proposed_builders[].
 *                         clientPricing, per Builder. This is the
 *                         grossed-up number the client approved, not
 *                         the Builder's payout.
 *
 *   composed directly     projects.engagement_rate. One set of terms
 *                         per engagement by design, so it is one rate
 *                         and it belongs to whoever is assigned.
 *
 * The quote wins where both exist: it is the document the client
 * signed, and engagementRate on an RFP-won project is either absent
 * or a leftover.
 *
 * WHAT THIS IS NOT
 *
 * Not the Builder's payout. Nothing in here should ever reach a payout
 * calculation. The client rate and the Builder rate differ by the 15%,
 * and confusing them is the bug that put a member's own $55/hr on a
 * client quote back in October.
 * ─────────────────────────────────────────────────────────────
 */
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { cooperativeQuotes, projects } from "@/db/schema";
import type {
  ContractRate,
  CooperativeQuotePricing,
  ProposedBuilder,
} from "@/lib/types";

// ContractRate lives in types.ts, not here. The invoice line form is a
// client component and check-client-boundary refuses any "use client"
// file that imports a module reaching src/db/client.ts, which this one
// does. Re-exported so server callers can keep importing it from the
// function that resolves it.
export type { ContractRate };

/** The headline client number out of a stored pricing shape. */
function headline(p: CooperativeQuotePricing): {
  rate: string | null;
  basis: ContractRate["basis"];
} {
  switch (p.type) {
    case "hourly":
      return { rate: p.hourlyRate.toFixed(2), basis: "hourly" };
    case "fixed":
      return { rate: p.baseAmount.toFixed(2), basis: "fixed" };
    case "range":
      // The bottom of the band. An invoice is a demand for a specific
      // amount, and billing the top of a range the client read as "from"
      // is the kind of surprise that costs a renewal.
      return { rate: p.baseAmountMin.toFixed(2), basis: "fixed" };
    default:
      return { rate: null, basis: "negotiable" };
  }
}

export async function contractRatesForProject(
  projectId: string,
): Promise<ContractRate[]> {
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) return [];

  const [quote] = await db
    .select()
    .from(cooperativeQuotes)
    .where(eq(cooperativeQuotes.projectId, projectId))
    .limit(1);

  if (quote) {
    const builders = (quote.proposedBuilders ?? []) as ProposedBuilder[];
    // The lead, when the client picked one. Before that, every
    // proposed Builder is still a candidate and all of them are shown.
    const chosen = quote.selectedLeadUserId
      ? builders.filter((b) => b.userId === quote.selectedLeadUserId)
      : builders;
    const rates = chosen.map((b) => {
      const pricing = b.clientPricing ?? b.pricing;
      const { rate, basis } = headline(pricing);
      return {
        userId: b.userId,
        rate,
        basis,
        unitLabel: basis === "hourly" ? "hours" : "deliverables",
        source: "quote" as const,
      };
    });
    if (rates.length > 0) return rates;
  }

  // Directly composed. One set of terms, so the rate belongs to
  // whoever is assigned to the engagement.
  const basis = project.engagementBasis === "fixed" ? "fixed" : "hourly";
  const rate = project.engagementRate
    ? Number(project.engagementRate).toFixed(2)
    : null;
  return (project.assignedMemberIds ?? []).map((userId) => ({
    userId,
    rate,
    basis,
    unitLabel: basis === "hourly" ? "hours" : "deliverables",
    source: "engagement" as const,
  }));
}
