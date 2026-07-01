/**
 * Admin-issued invite links (beta / handoff cohort tooling).
 *
 * REPLACE WITH: `invite_links` table queries. Consumption endpoint
 * validates the code + expiry + revocation state, creates the User
 * (or matches an existing one by email), grants the target tier,
 * and writes user.invite_consumed audit entry.
 */
import type { InviteLink, MembershipTier } from "@/lib/types";

export const MOCK_INVITE_LINKS: InviteLink[] = [];

let _inviteSeq = 0;
function nextInviteId(): string {
  _inviteSeq += 1;
  return `invite_${Date.now().toString(36)}_${_inviteSeq
    .toString()
    .padStart(4, "0")}`;
}

/**
 * URL-safe token. Sandbox uses timestamp + random suffix; production
 * uses a cryptographically-secure random (`crypto.randomBytes(24)`)
 * base64url-encoded. Length in production: 32 bytes → 43 chars.
 */
function nextInviteCode(): string {
  const random = Math.random().toString(36).slice(2, 14);
  const stamp = Date.now().toString(36);
  return `${stamp}${random}`;
}

/**
 * Default invite lifetime — 14 days from issue. Production overrides
 * possible per-cohort via admin config.
 */
const DEFAULT_LIFETIME_MS = 14 * 24 * 60 * 60 * 1000;

export function createInviteLinkRecord(input: {
  targetEmail: string;
  targetTier: MembershipTier;
  targetName: string | null;
  note: string | null;
  createdByUserId: string;
  lifetimeMs?: number;
}): InviteLink {
  const now = new Date();
  const lifetime = input.lifetimeMs ?? DEFAULT_LIFETIME_MS;
  const record: InviteLink = {
    id: nextInviteId(),
    code: nextInviteCode(),
    targetEmail: input.targetEmail,
    targetTier: input.targetTier,
    targetName: input.targetName,
    note: input.note,
    createdByUserId: input.createdByUserId,
    createdAt: now.toISOString(),
    expiresAt: new Date(now.getTime() + lifetime).toISOString(),
    consumedAt: null,
    consumedByUserId: null,
    revokedAt: null,
    revokedReason: null,
  };
  MOCK_INVITE_LINKS.push(record);
  return record;
}

export function findInviteById(id: string): InviteLink | undefined {
  return MOCK_INVITE_LINKS.find((i) => i.id === id);
}

export function findInviteByCode(code: string): InviteLink | undefined {
  return MOCK_INVITE_LINKS.find((i) => i.code === code);
}

export function invitesByEmail(email: string): InviteLink[] {
  const normalized = email.trim().toLowerCase();
  return MOCK_INVITE_LINKS.filter(
    (i) => i.targetEmail.toLowerCase() === normalized,
  );
}

export function isInviteConsumable(invite: InviteLink): boolean {
  if (invite.consumedAt) return false;
  if (invite.revokedAt) return false;
  if (new Date(invite.expiresAt).getTime() < Date.now()) return false;
  return true;
}
