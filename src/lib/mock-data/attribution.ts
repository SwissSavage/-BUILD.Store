/**
 * Mock attribution ledger entries.
 *
 * Append-only record of WHO did WHAT on each contract. The revenue split
 * engine reads these as the default starting point for the 85% contributor
 * pool — admins can override during settlement, but the ledger is the
 * primary record of contribution.
 *
 * Coverage:
 *   p_003 (open, in-progress GTM contract for DCG) — Rob introduced, Michael
 *         leads delivery, both contribute substantively.
 *   p_004 (closed editorial series for URL Media) — Aliza did the lion's
 *         share; Jamar introduced.
 *
 * REPLACE WITH: Drizzle inserts into `attribution_entries`. Append-only —
 * corrections happen via offsetting entries, never UPDATE/DELETE, so the
 * historical record remains intact for compensation recomputation.
 */
import type { AttributionEntry } from "@/lib/types";

export const MOCK_ATTRIBUTION: AttributionEntry[] = [
  {
    id: "att_001",
    contractId: "p_003",
    userId: "u_rob",
    role: "introducer",
    weight: 0.15,
    notes: "Inbound through Rob's DCG relationship.",
    loggedBy: "u_jamar",
    loggedAt: "2026-03-01T12:00:00Z",
  },
  {
    id: "att_002",
    contractId: "p_003",
    userId: "u_michael",
    role: "delivery_lead",
    weight: 0.55,
    notes: "Owns the market-selection memo and the readiness scorecard.",
    loggedBy: "u_jamar",
    loggedAt: "2026-03-02T09:30:00Z",
  },
  {
    id: "att_003",
    contractId: "p_003",
    userId: "u_rob",
    role: "contributor",
    weight: 0.30,
    notes: "Embedded SME on the MSP vertical; co-author on the memo.",
    loggedBy: "u_jamar",
    loggedAt: "2026-03-02T09:31:00Z",
  },
  {
    id: "att_004",
    contractId: "p_004",
    userId: "u_jamar",
    role: "introducer",
    weight: 0.10,
    notes: "URL Media intro via Jamar's standing relationship.",
    loggedBy: "u_jamar",
    loggedAt: "2025-11-01T10:00:00Z",
  },
  {
    id: "att_005",
    contractId: "p_004",
    userId: "u_aliza",
    role: "delivery_lead",
    weight: 0.90,
    notes:
      "Wrote all five long-form profiles, ran the photo direction. Sole substantive contributor.",
    loggedBy: "u_jamar",
    loggedAt: "2025-11-01T10:05:00Z",
  },
];
