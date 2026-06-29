/**
 * ============================================================
 * STUB — transactional email (Phase 1.2).
 *
 * REPLACE WITH: Resend or Postmark API calls. Templates live in
 * `src/emails/` (React Email components).
 *
 * Sandbox behavior:
 *   - Logs the would-be send to the server console.
 *   - Returns a fake message id and stamp.
 * ============================================================
 */

export interface ProposalEmailPayload {
  toEmail: string;
  toName: string | null;
  proposalToken: string;
  /** Friendly project title for the subject line. */
  projectTitle: string;
  /** Absolute URL the client will land on. */
  proposalUrl: string;
}

export async function sendClientProposalEmail(
  payload: ProposalEmailPayload,
): Promise<{ messageId: string; sentAt: string }> {
  // eslint-disable-next-line no-console
  console.log("[email-stub] would send proposal to client:", {
    to: `${payload.toName ?? "(no name)"} <${payload.toEmail}>`,
    subject: `Your proposal for ${payload.projectTitle}`,
    body: `Open the proposal: ${payload.proposalUrl}`,
  });
  return {
    messageId: `msg_sandbox_${Date.now().toString(36)}`,
    sentAt: new Date().toISOString(),
  };
}

/**
 * Generate a sandbox token. In production, swap for a signed JWT with a
 * short TTL or a random ID stored in the `client_proposals` table with a
 * lookup index.
 */
export function generateProposalToken(): string {
  const rand = Math.random().toString(36).slice(2, 14);
  const stamp = Date.now().toString(36);
  return `tk_${rand}${stamp}`;
}
