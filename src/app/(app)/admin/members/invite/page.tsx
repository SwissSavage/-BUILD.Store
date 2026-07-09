/**
 * /admin/members/invite — admin-issued signup invite generator.
 *
 * Sandbox: admin fills the form; server action creates an invite
 * record and displays the redemption URL in the "Recent invites" list
 * below. Admin copies the URL and sends it manually via whatever
 * channel matches (email, Signal, DM).
 *
 * Production: same form + action, but on successful create the
 * configured email provider dispatches a magic-link email to the
 * target address. Admin still sees the record; the URL surface flips
 * from "copy me" to "sent to X".
 *
 * Audit verbs: user.invited on create, user.invite_revoked on revoke,
 * user.invite_consumed on redemption (fired from the signup route).
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-stub";
import { MOCK_INVITE_LINKS } from "@/lib/mock-data/invite-links";
import {
  generateInviteLink,
  revokeInviteLink,
} from "@/lib/invite-actions";
import { MOCK_USERS } from "@/lib/mock-data/users";
import {
  TIER_LABELS,
  adminName,
  type MembershipTier,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

const TIERS: MembershipTier[] = ["viewer", "prospect", "partner", "member"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function inviteStatus(
  invite: (typeof MOCK_INVITE_LINKS)[number],
): {
  label: string;
  color: string;
} {
  if (invite.consumedAt) {
    return { label: "Consumed", color: "#007048" };
  }
  if (invite.revokedAt) {
    return { label: "Revoked", color: "#666666" };
  }
  if (new Date(invite.expiresAt).getTime() < Date.now()) {
    return { label: "Expired", color: "#666666" };
  }
  return { label: "Live", color: "#5070F0" };
}

function inviteUrl(code: string): string {
  // Sandbox displays a relative URL; production wires the origin.
  return `/signin/invite/${code}`;
}

export default async function InviteMemberPage() {
  await requireAdmin();

  // Freshest first.
  const invites = [...MOCK_INVITE_LINKS].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/admin/members"
        className="text-sm text-ink-muted hover:text-ink"
      >
        ← All members
      </Link>
      <div className="mt-3">
        <CardEyebrow>Invite</CardEyebrow>
      </div>
      <h1 className="mt-2 font-display text-4xl font-semibold">
        Invite a new member
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-ink-muted">
        Issue a redemption link for a specific email + tier. Sandbox
        displays the URL to copy; production dispatches by email. Every
        issue, revoke, and consumption is audit-logged.
      </p>

      <Card className="mt-6">
        <CardEyebrow>Generate</CardEyebrow>
        <form action={generateInviteLink} className="mt-3 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <label className="text-xs text-ink-muted">
              Target email
              <input
                type="email"
                name="targetEmail"
                required
                className="mt-1 block w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] px-3 py-2 text-sm text-ink"
                placeholder="alex@example.com"
              />
            </label>
            <label className="text-xs text-ink-muted">
              Target tier
              <select
                name="targetTier"
                required
                defaultValue="prospect"
                className="mt-1 block w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] px-3 py-2 text-sm text-ink"
              >
                {TIERS.map((t) => (
                  <option key={t} value={t}>
                    {TIER_LABELS[t]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="text-xs text-ink-muted block">
            Preset name (optional)
            <input
              type="text"
              name="targetName"
              className="mt-1 block w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] px-3 py-2 text-sm text-ink"
              placeholder="Preset first-name shown on the redemption page"
            />
          </label>
          <label className="text-xs text-ink-muted block">
            Note (optional — recorded on the audit log)
            <textarea
              name="note"
              rows={2}
              maxLength={400}
              className="mt-1 block w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] px-3 py-2 text-sm text-ink"
              placeholder="Which lens they cover · why now · anything relevant for the record"
            />
          </label>
          <button
            type="submit"
            className="rounded-full bg-brand-magenta px-5 py-2 text-sm text-white hover:opacity-90"
          >
            Generate invite link
          </button>
          <p className="text-[11px] text-ink-faint">
            Default lifetime: 14 days. Cannot be edited after issue —
            revoke and reissue if the target hasn&apos;t redeemed and
            circumstances change.
          </p>
        </form>
      </Card>

      <section className="mt-10">
        <h2 className="font-display text-2xl font-semibold">
          Recent invites ({invites.length})
        </h2>
        {invites.length === 0 ? (
          <Card className="mt-4">
            <p className="text-sm text-ink-muted">
              No invites issued yet. Generate one above to open the
              cohort.
            </p>
          </Card>
        ) : (
          <div className="mt-4 space-y-3">
            {invites.map((invite) => {
              const status = inviteStatus(invite);
              const issuer = MOCK_USERS.find(
                (u) => u.id === invite.createdByUserId,
              );
              const consumer = invite.consumedByUserId
                ? MOCK_USERS.find((u) => u.id === invite.consumedByUserId)
                : null;
              const live = status.label === "Live";
              return (
                <Card key={invite.id}>
                  <div className="flex flex-wrap items-baseline justify-between gap-3">
                    <div>
                      <CardTitle className="text-lg">
                        {invite.targetName ?? invite.targetEmail}
                      </CardTitle>
                      <p className="mt-1 text-xs text-ink-muted">
                        {invite.targetEmail} · target tier{" "}
                        {TIER_LABELS[invite.targetTier]}
                      </p>
                    </div>
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[10px] uppercase tracking-wider"
                      style={{
                        color: status.color,
                        borderColor: status.color,
                        borderWidth: 1,
                        borderStyle: "solid",
                      }}
                    >
                      {status.label}
                    </span>
                  </div>

                  {live && (
                    <div className="mt-3 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wider text-ink-faint">
                        Redemption URL — copy and send to target
                      </p>
                      <code className="mt-1 block break-all font-mono text-xs text-brand-magenta">
                        {inviteUrl(invite.code)}
                      </code>
                    </div>
                  )}

                  <div className="mt-3 grid gap-x-4 gap-y-1 text-[11px] text-ink-faint md:grid-cols-2">
                    <span>
                      Issued by {issuer ? adminName(issuer) : "unknown"} on{" "}
                      {formatDate(invite.createdAt)}
                    </span>
                    <span>Expires {formatDate(invite.expiresAt)}</span>
                    {invite.consumedAt && (
                      <span>
                        Consumed {formatDate(invite.consumedAt)}
                        {consumer && ` by ${adminName(consumer)}`}
                      </span>
                    )}
                    {invite.revokedAt && (
                      <span>
                        Revoked {formatDate(invite.revokedAt)}
                        {invite.revokedReason && `: ${invite.revokedReason}`}
                      </span>
                    )}
                  </div>

                  {invite.note && (
                    <p className="mt-2 text-xs italic text-ink-muted">
                      Note: {invite.note}
                    </p>
                  )}

                  {live && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-[11px] text-brand-magenta hover:underline">
                        Revoke this invite
                      </summary>
                      <form
                        action={revokeInviteLink}
                        className="mt-2 space-y-2"
                      >
                        <input
                          type="hidden"
                          name="inviteId"
                          value={invite.id}
                        />
                        <input
                          type="text"
                          name="reason"
                          className="w-full rounded-md border border-[var(--surface-border)] bg-[var(--surface-inset)] px-2 py-1 text-xs text-ink"
                          placeholder="Optional reason (recorded)"
                        />
                        <button
                          type="submit"
                          className="rounded-full border border-brand-magenta/40 px-3 py-1 text-xs text-brand-magenta hover:border-brand-magenta"
                        >
                          Revoke
                        </button>
                      </form>
                    </details>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <div className="mt-10 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-4">
        <p className="text-[11px] uppercase tracking-wider text-ink-muted">
          Production swap
        </p>
        <p className="mt-1 text-xs text-ink-muted">
          When email delivery lands (production-swap-checklist §7c), the
          redemption URL panel above disappears — invite creation
          dispatches the magic-link email directly to{" "}
          <code>targetEmail</code>, admin surface just confirms delivery.
          Auth.js handles the redemption route (
          <code>/signin/invite/[code]</code>): validates the code + tier +
          expiry, creates or matches the user, grants the target tier,
          fires <code>user.invite_consumed</code> audit entry.
        </p>
      </div>
    </div>
  );
}
