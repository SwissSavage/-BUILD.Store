/**
 * Issue the statement, rather than wait for an invoice.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-29)
 *
 * Jamar, on whether contractors should have to invoice the
 * cooperative to be paid: "It's something Chibu used to require for no
 * reason at all in my mind that I found completely stupid and
 * unnecessary given the paper trail, and I've never had to invoice any
 * service platform."
 *
 * He is right, and the alternative has a name. An invoice asserts an
 * amount owed by somebody who has not agreed it yet. By settlement the
 * cooperative already holds a countersigned engagement carrying the
 * rate, an attribution ledger, a milestone record, and splits computed
 * from all three. A contractor's invoice would restate numbers this
 * system generated: a document, no information, and a delay borne by
 * the person who already did the work.
 *
 * So the cooperative issues the statement and the recipient
 * acknowledges it. That is better evidence than an invoice, because it
 * is generated from the rows actually written and therefore cannot
 * disagree with what was paid.
 *
 * WHY IT READS THE ROWS INSTEAD OF RECOMPUTING
 *
 * The settle page already computed the split and wrote it. Computing
 * it a second time here would create a second opinion about the same
 * money, and the two would agree right up until somebody changed one
 * of them. So this reads revenue_splits and build_vouchers after the
 * fact and reports what is there.
 *
 * WHY IT IS BEST-EFFORT
 *
 * Settlement has already happened by the time this runs. A failure to
 * produce a statement must not unwind a payment or leave the contract
 * half-settled, so the caller swallows errors the same way it does for
 * the voucher cascade. An unissued remittance is a missing document;
 * a rolled-back settlement is a money problem.
 * ─────────────────────────────────────────────────────────────
 */
import { randomUUID } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  buildVouchers,
  invoices,
  remittances,
  revenueSplits,
} from "@/db/schema";
import { getAllUsers } from "@/lib/readers/users";
import { pushNotification } from "@/lib/milestone-core";
import { publicName } from "@/lib/types";

export interface IssueRemittancesInput {
  contractId: string;
  contractTitle: string;
  issuedByUserId: string;
  /** Rail and reference for the client payment that funded this. */
  paymentRail?: string | null;
  externalReference?: string | null;
}

/**
 * Pools a human is actually paid from. Treasury and LP are the house,
 * and "reserve" is the contract reserve, which is not a person either.
 * Typed as the narrow union so the insert below cannot smuggle a pool
 * the remittances column does not accept.
 */
const PAYABLE_POOLS = ["contributor", "admin"] as const;
type PayablePool = (typeof PAYABLE_POOLS)[number];

function payablePool(pool: string): PayablePool | null {
  return pool === "contributor" || pool === "admin" ? pool : null;
}

const RAIL_LABEL: Record<string, string> = {
  found: "Found",
  mercury: "Mercury",
  check: "Check",
  zelle: "Zelle",
  stripe: "Stripe",
  other: "Other",
};

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

async function resolveFunding(
  contractId: string,
  input: IssueRemittancesInput,
): Promise<{ rail: string | null; reference: string | null }> {
  if (input.paymentRail) {
    return {
      rail: input.paymentRail,
      reference: input.externalReference ?? null,
    };
  }
  const rows = await db
    .select({
      rail: invoices.paymentRail,
      reference: invoices.externalReference,
      paidAt: invoices.paidAt,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.contractId, contractId),
        eq(invoices.status, "received"),
      ),
    )
    .orderBy(desc(invoices.paidAt))
    .limit(1);
  const row = rows[0];
  return { rail: row?.rail ?? null, reference: row?.reference ?? null };
}

export async function issueRemittancesForSettlement(
  input: IssueRemittancesInput,
): Promise<{ issued: number }> {
  const { contractId } = input;

  // Where the money came from, read rather than passed in, so the
  // caller cannot get it wrong and a statement cannot name a rail the
  // ledger does not agree with. Most recent received invoice on the
  // contract wins; a blank rail stays blank.
  const funding = await resolveFunding(contractId, input);

  const [splits, vouchers, { users: roster }] = await Promise.all([
    db.select().from(revenueSplits).where(eq(revenueSplits.contractId, contractId)),
    db
      .select()
      .from(buildVouchers)
      .where(eq(buildVouchers.sourceRefId, contractId)),
    getAllUsers(),
  ]);

  const nameById = new Map(roster.map((u) => [u.id, publicName(u)]));

  // $BUILD issued to each person in the same pass, summed. The voucher
  // cascade writes one row per leg, so a contributor can have several.
  const voucherByUser = new Map<string, number>();
  for (const v of vouchers) {
    voucherByUser.set(
      v.userId,
      (voucherByUser.get(v.userId) ?? 0) + Number(v.amount),
    );
  }

  const now = new Date().toISOString();
  let issued = 0;

  for (const split of splits) {
    const pool = payablePool(split.pool);
    if (!split.recipientId || !pool) continue;

    // One statement per recipient per pool. Re-running settlement
    // must not produce a second copy of the same statement, which the
    // unique index also enforces.
    const [existing] = await db
      .select({ id: remittances.id })
      .from(remittances)
      .where(
        and(
          eq(remittances.contractId, contractId),
          eq(remittances.recipientId, split.recipientId),
          eq(remittances.pool, pool),
        ),
      )
      .limit(1);
    if (existing) continue;

    const cash = Number(split.amount);
    const build = voucherByUser.get(split.recipientId) ?? 0;
    const label = nameById.get(split.recipientId) ?? split.recipientId;

    // The "why this number" block, frozen now. See the WHY in the
    // migration on why this is a snapshot rather than a join.
    const basis: { label: string; value: string }[] = [
      { label: "Engagement", value: input.contractTitle },
      {
        label: "Pool",
        value:
          pool === "contributor"
            ? "Contributor — 85%, divided by attribution weight"
            : "Executive — 12%, split evenly across the deal's list",
      },
    ];
    if (split.sharePct) {
      basis.push({
        label: "Your share of the pool",
        value: `${Number(split.sharePct).toFixed(1)}%`,
      });
    }
    if (funding.rail) {
      basis.push({
        label: "Funded by",
        value: funding.reference
          ? `${RAIL_LABEL[funding.rail] ?? funding.rail} · ${funding.reference}`
          : `${RAIL_LABEL[funding.rail] ?? funding.rail} — no reference recorded`,
      });
    }
    if (build > 0) {
      basis.push({
        label: "$BUILD issued",
        value: build.toLocaleString(),
      });
    }

    await db.insert(remittances).values({
      id: `rem_${randomUUID()}`,
      contractId,
      recipientId: split.recipientId,
      pool,
      cashAmount: cash.toFixed(2),
      sharePct: split.sharePct ? String(split.sharePct) : null,
      voucherAmount: build.toFixed(2),
      basis,
      recipientLabel: label,
      issuedAt: now,
      issuedByUserId: input.issuedByUserId,
      acknowledgedAt: null,
      disputedAt: null,
      disputeNote: null,
      createdAt: now,
    });
    issued += 1;

    // voucher-issuance.ts has no notification of any kind, so before
    // this a member earned $BUILD from a settlement and found out by
    // going to look. Cash and vouchers are issued together and belong
    // in the same message.
    await pushNotification({
      userId: split.recipientId,
      kind: "split_distributed",
      title: `You were paid on ${input.contractTitle}`,
      body:
        build > 0
          ? `${usd(cash)} plus ${build.toLocaleString()} $BUILD. Check the statement and confirm it looks right.`
          : `${usd(cash)}. Check the statement and confirm it looks right.`,
      href: "/profile/payouts",
    });
  }

  return { issued };
}
