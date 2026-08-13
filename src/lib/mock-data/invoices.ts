/**
 * Mock invoices — the AR side of the cooperative ledger (Phase 1.5).
 *
 * Coverage:
 *   inv_p004_001 — Editorial series for URL Media. Fully received via
 *                  Mercury ACH; matches the $12,000 collectedRevenue on
 *                  p_004 that the split engine settles.
 *
 *   inv_p003_001 — GTM plan for DCG. Milestone 1 ($7,500) issued, partially
 *                  received ($3,750 deposit landed, balance outstanding).
 *                  Mirrors the in-flight contract.
 *
 *   inv_p002_001 — DCG smart-contract audit. Client requested CC at the
 *                  contracting stage, so this one is acceptsCard=true with
 *                  the gross-up line item baked in. Status=issued, awaiting
 *                  payment.
 *
 *   inv_p001_001 — URL Media brand film. Draft only — proposal still under
 *                  review, invoice not yet issued. Lets the admin AR
 *                  tracker show the "draft" state.
 *
 * REPLACE WITH: Drizzle inserts into `invoices` + `invoice_line_items`
 * tables. The `clientToken` comes from the magic-link signer (same
 * primitive as ClientProposal) and lookups happen on
 * /invoices/[token].
 */
import type { Invoice } from "@/lib/types";

export const MOCK_INVOICES: Invoice[] = [
  // ──────────────────────────────────────────────────────────────────────
  //  p_004 — Editorial series, URL Media. Mercury ACH, fully received.
  // ──────────────────────────────────────────────────────────────────────
  {
    id: "inv_p004_001",
    direction: "coop_to_client",
    documentKind: "invoice",
    sourceRefId: null,
    sourceInvoiceIds: null,
    issuerId: "u_jamar",
    recipientId: "client_url_media",
    contractId: "p_004",
    number: "FM-2026-0042",
    clientToken: "tok_invoice_p004_demo",
    status: "received",
    paymentMethod: "ach_mercury",
    acceptsCard: false,
    lineItems: [
      {
        id: "li_p004_001",
        description: "Artist profile series — five long-form features",
        amount: "10000.00",
      },
      {
        id: "li_p004_002",
        description: "Photography direction + on-set days",
        amount: "2000.00",
      },
    ],
    subtotal: "12000.00",
    processingFee: "0.00",
    total: "12000.00",
    issuedAt: "2026-02-01T00:00:00Z",
    dueAt: "2026-02-15T00:00:00Z",
    paidAt: "2026-02-20T00:00:00Z",
    paidAmount: "12000.00",
    mercuryReference: "merc_txn_8f2a31",
    stripePaymentIntentId: null,
    notes:
      "Paid in full via Mercury ACH on 2026-02-20. Settle page already ran the split (see splits.ts).",
    documensoEnvelopeId: null,
    signatureStatus: null,
    signatureCompletedAt: null,
    createdAt: "2026-01-30T00:00:00Z",
    updatedAt: "2026-02-20T00:00:00Z",
  },

  // ──────────────────────────────────────────────────────────────────────
  //  p_003 — GTM plan, DCG. Mercury ACH, milestone 1 partially received.
  // ──────────────────────────────────────────────────────────────────────
  {
    id: "inv_p003_001",
    direction: "coop_to_client",
    documentKind: "invoice",
    sourceRefId: null,
    sourceInvoiceIds: null,
    issuerId: "u_jamar",
    recipientId: "client_dcg",
    contractId: "p_003",
    number: "FM-2026-0051",
    clientToken: "tok_invoice_p003_demo",
    status: "partially_received",
    paymentMethod: "ach_mercury",
    acceptsCard: false,
    lineItems: [
      {
        id: "li_p003_001",
        description: "Milestone 1 — market selection memo",
        amount: "7500.00",
      },
    ],
    subtotal: "7500.00",
    processingFee: "0.00",
    total: "7500.00",
    issuedAt: "2026-03-15T00:00:00Z",
    dueAt: "2026-04-15T00:00:00Z",
    paidAt: "2026-03-22T00:00:00Z",
    paidAmount: "3750.00",
    mercuryReference: "merc_txn_9b71c4",
    stripePaymentIntentId: null,
    notes:
      "50% deposit landed 2026-03-22. Balance ($3,750) due on milestone 1 acceptance — Rob to chase the AP team this week.",
    documensoEnvelopeId: null,
    signatureStatus: null,
    signatureCompletedAt: null,
    createdAt: "2026-03-15T00:00:00Z",
    updatedAt: "2026-03-22T00:00:00Z",
  },

  // ──────────────────────────────────────────────────────────────────────
  //  p_002 — Smart-contract audit, DCG. Client opted into CC; gross-up
  //  line item is baked into the issued invoice.
  //
  //  Math: subtotal $14,000 → gross-up at 2.9% + $0.30
  //    gross = (14000 + 0.30) / (1 - 0.029) = 14418.43
  //    processing fee = 418.43
  // ──────────────────────────────────────────────────────────────────────
  {
    id: "inv_p002_001",
    direction: "coop_to_client",
    documentKind: "invoice",
    sourceRefId: null,
    sourceInvoiceIds: null,
    issuerId: "u_jamar",
    recipientId: "client_p002",
    contractId: "p_002",
    number: "FM-2026-0058",
    clientToken: "tok_invoice_p002_demo",
    status: "issued",
    paymentMethod: "cc_stripe",
    acceptsCard: true,
    lineItems: [
      {
        id: "li_p002_001",
        description: "Phase 1 — current-state audit (ERC-6551 vault)",
        amount: "9000.00",
      },
      {
        id: "li_p002_002",
        description: "Migration path memo + multisig integration plan",
        amount: "5000.00",
      },
      {
        id: "li_p002_fee",
        description: "Payment processing fee (2.9% + $0.30)",
        amount: "418.43",
        isProcessingFee: true,
      },
    ],
    subtotal: "14000.00",
    processingFee: "418.43",
    total: "14418.43",
    issuedAt: "2026-04-15T00:00:00Z",
    dueAt: "2026-05-15T00:00:00Z",
    paidAt: null,
    paidAmount: "0.00",
    mercuryReference: null,
    stripePaymentIntentId: null,
    notes:
      "Client requested CC at contracting (DCG procurement runs corporate Amex). Markup is the gross-up — cooperative still nets $14,000.",
    documensoEnvelopeId: null,
    signatureStatus: null,
    signatureCompletedAt: null,
    createdAt: "2026-04-15T00:00:00Z",
    updatedAt: "2026-04-15T00:00:00Z",
  },

  // ──────────────────────────────────────────────────────────────────────
  //  p_001 — Brand film, URL Media. Draft only (proposal still in flight).
  // ──────────────────────────────────────────────────────────────────────
  {
    id: "inv_p001_001",
    direction: "coop_to_client",
    documentKind: "invoice",
    sourceRefId: null,
    sourceInvoiceIds: null,
    issuerId: "u_jamar",
    recipientId: "client_p001",
    contractId: "p_001",
    number: "FM-2026-DRAFT-0061",
    clientToken: "tok_invoice_p001_demo",
    status: "draft",
    paymentMethod: "ach_mercury",
    acceptsCard: false,
    lineItems: [
      {
        id: "li_p001_001",
        description: "Pre-production + creative direction",
        amount: "12000.00",
      },
      {
        id: "li_p001_002",
        description: "Shoot days (3) + crew",
        amount: "21000.00",
      },
      {
        id: "li_p001_003",
        description: "Post — edit, color, sound, social cuts",
        amount: "12000.00",
      },
    ],
    subtotal: "45000.00",
    processingFee: "0.00",
    total: "45000.00",
    issuedAt: null,
    dueAt: null,
    paidAt: null,
    paidAmount: "0.00",
    mercuryReference: null,
    stripePaymentIntentId: null,
    notes:
      "Holding pending proposal acceptance. Once URL Media counter-signs, issue 50% deposit invoice and re-baseline.",
    documensoEnvelopeId: null,
    signatureStatus: null,
    signatureCompletedAt: null,
    createdAt: "2026-04-18T00:00:00Z",
    updatedAt: "2026-04-18T00:00:00Z",
  },

  // ──────────────────────────────────────────────────────────────────────
  //  Internal invoices — talent_to_coop
  //  Contributors on p_003 (DCG GTM plan) billing the coop for their work.
  //  Approved internals feed the contributor pool at settlement.
  // ──────────────────────────────────────────────────────────────────────
  {
    id: "inv_int_p003_aliza_001",
    direction: "talent_to_coop",
    documentKind: "invoice",
    contractId: "p_003",
    sourceRefId: null,
    sourceInvoiceIds: null,
    issuerId: "u_aliza",
    recipientId: "coop_cooperative",
    number: "FM-TALENT-2026-0001",
    clientToken: null,
    status: "received",
    paymentMethod: null,
    acceptsCard: false,
    lineItems: [
      {
        id: "li_int_p003_aliza_001",
        description: "GTM plan lead — market selection memo, milestone 1",
        amount: "4200.00",
      },
    ],
    subtotal: "4200.00",
    processingFee: "0.00",
    total: "4200.00",
    issuedAt: "2026-03-05T00:00:00Z",
    dueAt: null,
    paidAt: null,
    paidAmount: "0.00",
    mercuryReference: null,
    stripePaymentIntentId: null,
    notes:
      "Approved by u_jamar 2026-03-06. Locks in Aliza's contributor-pool share when p_003 settles.",
    documensoEnvelopeId: null,
    signatureStatus: null,
    signatureCompletedAt: null,
    createdAt: "2026-03-04T09:00:00Z",
    updatedAt: "2026-03-06T14:00:00Z",
  },
  {
    id: "inv_int_p003_michael_001",
    direction: "talent_to_coop",
    documentKind: "invoice",
    contractId: "p_003",
    sourceRefId: null,
    sourceInvoiceIds: null,
    issuerId: "u_michael",
    recipientId: "coop_cooperative",
    number: "FM-TALENT-2026-0002",
    clientToken: null,
    status: "issued",
    paymentMethod: null,
    acceptsCard: false,
    lineItems: [
      {
        id: "li_int_p003_michael_001",
        description: "Competitive landscape analysis — 12 hours × $175/hr",
        amount: "2100.00",
      },
    ],
    subtotal: "2100.00",
    processingFee: "0.00",
    total: "2100.00",
    issuedAt: "2026-03-08T00:00:00Z",
    dueAt: null,
    paidAt: null,
    paidAmount: "0.00",
    mercuryReference: null,
    stripePaymentIntentId: null,
    notes: "Awaiting admin approval.",
    documensoEnvelopeId: null,
    signatureStatus: null,
    signatureCompletedAt: null,
    createdAt: "2026-03-07T10:00:00Z",
    updatedAt: "2026-03-08T00:00:00Z",
  },

  // ──────────────────────────────────────────────────────────────────────
  //  Marketplace receipt — auto-generated on order fulfillment
  //  Documents a completed transaction; no separate invoice step.
  // ──────────────────────────────────────────────────────────────────────
  {
    id: "inv_rcpt_ord001",
    direction: "marketplace_receipt",
    documentKind: "receipt",
    contractId: null,
    sourceRefId: "ord_001",
    sourceInvoiceIds: null,
    issuerId: "u_bbg",
    recipientId: "buyer_ord_001",
    number: "FM-RCPT-2026-0001",
    clientToken: null,
    status: "received",
    paymentMethod: "cc_stripe",
    acceptsCard: true,
    lineItems: [
      {
        id: "li_rcpt_ord001_001",
        description: "Cooperative merch — hoodie + tee bundle",
        amount: "180.00",
      },
    ],
    subtotal: "180.00",
    processingFee: "5.52",
    total: "185.52",
    issuedAt: "2026-06-15T14:00:00Z",
    dueAt: null,
    paidAt: "2026-06-15T14:00:00Z",
    paidAmount: "185.52",
    mercuryReference: null,
    stripePaymentIntentId: "pi_mock_ord_001",
    notes: "Auto-generated on order fulfillment.",
    documensoEnvelopeId: null,
    signatureStatus: null,
    signatureCompletedAt: null,
    createdAt: "2026-06-15T14:00:00Z",
    updatedAt: "2026-06-15T14:00:00Z",
  },

  // ──────────────────────────────────────────────────────────────────────
  //  Retroactive receipt — closes an audit gap where the invoice flow
  //  was skipped. Rare-path rectification.
  // ──────────────────────────────────────────────────────────────────────
  {
    id: "inv_rcpt_retro_p001",
    direction: "retroactive_receipt",
    documentKind: "receipt",
    contractId: "p_001",
    sourceRefId: "p_001",
    sourceInvoiceIds: null,
    issuerId: "u_jamar",
    recipientId: "coop_cooperative",
    number: "FM-RCPT-RETRO-2026-0001",
    clientToken: null,
    status: "received",
    paymentMethod: null,
    acceptsCard: false,
    lineItems: [
      {
        id: "li_rcpt_retro_p001_001",
        description:
          "Contributor payout retroactively documented — original invoice missing due to early-days process gap",
        amount: "3500.00",
      },
    ],
    subtotal: "3500.00",
    processingFee: "0.00",
    total: "3500.00",
    issuedAt: "2026-07-25T00:00:00Z",
    dueAt: null,
    paidAt: "2026-07-25T00:00:00Z",
    paidAmount: "3500.00",
    mercuryReference: null,
    stripePaymentIntentId: null,
    notes:
      "Audit rectification. Ties an already-completed payout back to a documented event so the split ledger reconciles cleanly.",
    documensoEnvelopeId: null,
    signatureStatus: null,
    signatureCompletedAt: null,
    createdAt: "2026-07-25T00:00:00Z",
    updatedAt: "2026-07-25T00:00:00Z",
  },
];

/** Lookup helpers — kept in this file so callers don't reach into MOCK_INVOICES directly. */
export function getInvoicesForContract(contractId: string) {
  return MOCK_INVOICES.filter((inv) => inv.contractId === contractId);
}

export function getInvoiceByToken(token: string) {
  return MOCK_INVOICES.find((inv) => inv.clientToken === token) ?? null;
}

export function getInvoiceById(id: string) {
  return MOCK_INVOICES.find((inv) => inv.id === id) ?? null;
}
