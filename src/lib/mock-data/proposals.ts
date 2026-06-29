/**
 * Mock client proposal magic-link records.
 *
 * When an admin approves a QuoteSheet for a client, the system generates a
 * `ClientProposal` row with a signed token and "sends" the client an email
 * containing the link. The client lands on /proposals/[token] for a
 * read-only proposal view that mirrors the URL Media Google Doc layout —
 * scrubbed of contributor PII.
 *
 * Coverage:
 *   prop_001 → q_001 (Aliza's brand-film bid). Approved + sent + viewed.
 *   prop_002 → q_002 (Chibu's audit bid). Approved + sent, never opened.
 *
 * REPLACE WITH: Drizzle inserts; tokens generated as short-lived signed
 * JWTs or as random IDs with a server-side lookup. Email send via Resend
 * or Postmark; bounce + open events captured via webhooks. View tracking
 * happens server-side on /proposals/[token] route hits.
 */
import type { ClientProposal } from "@/lib/types";

export const MOCK_PROPOSALS: ClientProposal[] = [
  {
    id: "prop_001",
    quoteSheetId: "q_001",
    contractId: "p_001",
    token: "tk_aliza_brandfilm_b3f1c0d4e8a7",
    sentAt: "2026-04-09T11:30:00Z",
    lastViewedAt: "2026-04-10T08:14:00Z",
    viewCount: 3,
    expiresAt: "2026-05-09T11:30:00Z",
  },
  {
    id: "prop_002",
    quoteSheetId: "q_002",
    contractId: "p_002",
    token: "tk_chibu_audit_8a4d92f7e1c0",
    sentAt: "2026-04-15T17:00:00Z",
    lastViewedAt: null,
    viewCount: 0,
    expiresAt: "2026-05-15T17:00:00Z",
  },
];
