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
import { desc } from "drizzle-orm";
import { requireAdmin } from "@/lib/auth-stub";
import { getAllProjects } from "@/lib/readers/projects";
import { safely } from "@/lib/readers";
import { db } from "@/db/client";
import { inviteLinks, users as usersTable } from "@/db/schema";
import {
  extendInviteExpiry,
  generateInviteLink,
  resendInviteLink,
  revokeInviteLink,
} from "@/lib/invite-actions";
import {
  TIER_LABELS,
  adminName,
  type MembershipTier,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

export const dynamic = "force-dynamic";

type InviteRow = typeof inviteLinks.$inferSelect;

// Invite form is restricted to Partner + Member. Anyone else gets a
// public signup link. Viewer isn't invitable because it's the default
// state for any signed-up account and doesn't merit the ceremonial
// invite ritual. Only vouched-in tiers earn the invite artifact.
const INVITABLE_TIERS: Exclude<MembershipTier, "viewer">[] = ["partner", "member"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function inviteStatus(invite: InviteRow): {
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
  const base = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "";
  return `${base.replace(/\/$/, "")}/invite/${code}`;
}

export default async function InviteMemberPage({
  searchParams,
}: {
  searchParams?: Promise<{
    email?: string;
    name?: string;
    note?: string;
    fromInboundId?: string;
  }>;
}) {
  await requireAdmin();

  // Prefill support — the /admin/inbound "Promote to invite" action
  // redirects here with the applicant's email + name so admin can
  // one-click generate the invite off an external application (task
  // #43 Track B). Never trust the query string for anything other
  // than form defaultValues; the actual invite creation still runs
  // through generateInviteLink's own validation.
  const sp = searchParams ? await searchParams : {};
  const prefill = {
    email: (sp.email ?? "").trim().toLowerCase().slice(0, 200),
    name: (sp.name ?? "").trim().slice(0, 120),
    note: (sp.note ?? "").trim().slice(0, 400),
    fromInboundId: (sp.fromInboundId ?? "").trim().slice(0, 40),
  };

  // Contracts an invitee can be pointed at. Cancelled and completed
  // work is excluded — landing someone on a finished contract as
  // their first screen tells them nothing.
  const { projects: allProjects } = await safely(() => getAllProjects(), {
    projects: [],
    source: "postgres" as const,
  });
  const invitableProjects = allProjects
    .filter((p) => p.status === "open" || p.status === "in_progress")
    .sort((a, b) => a.title.localeCompare(b.title));

  // Freshest first. Pull the last N invites — 50 is plenty for the
  // admin surface; older ones live in the audit log.
  const invites = await db
    .select()
    .from(inviteLinks)
    .orderBy(desc(inviteLinks.createdAt))
    .limit(50);

  // Preload the users the invites reference (issuer + consumer) so
  // we don't hit the DB per-row inside the map. Union of both id sets.
  const userIds = new Set<string>();
  for (const i of invites) {
    userIds.add(i.createdByUserId);
    if (i.consumedByUserId) userIds.add(i.consumedByUserId);
  }
  const userRows = userIds.size
    ? await db.select().from(usersTable)
    : [];
  const userById = new Map(
    userRows
      .filter((u) => userIds.has(u.id))
      .map((u) => [u.id, u]),
  );
  function nameFor(id: string | null): string {
    if (!id) return "unknown";
    const u = userById.get(id);
    if (u) return u.name ?? u.handle ?? u.email;
    // The fixture fallback that used to live here predated the users
    // table read above, which now covers seed and real accounts
    // alike. An id that misses is genuinely unknown.
    return "unknown";
  }

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
                defaultValue={prefill.email}
                className="mt-1 block w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] px-3 py-2 text-sm text-ink"
                placeholder="alex@example.com"
              />
            </label>
            <label className="text-xs text-ink-muted">
              Target tier
              <select
                name="targetTier"
                required
                defaultValue="partner"
                className="mt-1 block w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] px-3 py-2 text-sm text-ink"
              >
                {INVITABLE_TIERS.map((t) => (
                  <option key={t} value={t}>
                    {TIER_LABELS[t]}
                  </option>
                ))}
              </select>
              <span className="mt-1 block text-[10px] text-ink-faint">
                Member gets the full care package. Partner gets the LOI plus platform terms.
              </span>
            </label>
          </div>
          <label className="text-xs text-ink-muted block">
            Invite onto a contract (optional)
            <select
              name="targetProjectId"
              defaultValue=""
              className="mt-1 block w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] px-3 py-2 text-sm text-ink"
            >
              <option value="">None — general membership invite</option>
              {invitableProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[10px] text-ink-faint">
              Picking one lands them on that contract the moment they
              finish signup, instead of a generic welcome page.
            </span>
          </label>

          <label className="text-xs text-ink-muted block">
            Preset name (optional)
            <input
              type="text"
              name="targetName"
              defaultValue={prefill.name}
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
              defaultValue={prefill.note}
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
              const issuerName = nameFor(invite.createdByUserId);
              const consumerName = invite.consumedByUserId
                ? nameFor(invite.consumedByUserId)
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

                  {/* ─────────────────────────────────────────────
                      WHERE THIS INVITE ACTUALLY IS (2026-09-02)

                      The row showed "Consumed" and nothing else, so an
                      invitee who signed their LOI and never finished
                      the ceremony looked identical to one who never
                      opened the email. Owais signed at 16:59 on 09-02
                      and was invisible either way.

                      Signing is not joining. Documenso's webhook
                      deliberately no-ops on invitee completion and the
                      account is created by the ceremony, so the gap
                      between "signed" and "joined" is real, common,
                      and was unobservable. It is also actionable: a
                      person stuck there needs a nudge, not a new
                      invite.
                      ───────────────────────────────────────────── */}
                  {!invite.consumedAt && !invite.revokedAt && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px]">
                      <span className="text-ink-faint">Progress:</span>
                      <span
                        className={
                          invite.adminCountersignedAt
                            ? "text-ink-muted"
                            : "text-ink-faint"
                        }
                      >
                        {invite.adminCountersignedAt ? "✓" : "○"} countersigned
                      </span>
                      <span
                        className={
                          invite.inviteeEmailSentAt
                            ? "text-ink-muted"
                            : "text-ink-faint"
                        }
                      >
                        {invite.inviteeEmailSentAt ? "✓" : "○"} email sent
                      </span>
                      <span className="text-ink-faint">○ joined</span>
                      {invite.inviteeEmailSentAt && (
                        <span style={{ color: "#d4a752" }}>
                          Waiting on them. Signing the agreement does not
                          finish signup.
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-3 grid gap-x-4 gap-y-1 text-[11px] text-ink-faint md:grid-cols-2">
                    <span>
                      Issued by {issuerName} on{" "}
                      {formatDate(invite.createdAt)}
                    </span>
                    <span>Expires {formatDate(invite.expiresAt)}</span>
                    {invite.adminCountersignedAt && (
                      <span>
                        Countersigned {formatDate(invite.adminCountersignedAt)}
                      </span>
                    )}
                    {invite.inviteeEmailSentAt && (
                      <span>
                        Invitee emailed {formatDate(invite.inviteeEmailSentAt)}
                      </span>
                    )}
                    {invite.consumedAt && (
                      <span>
                        Consumed {formatDate(invite.consumedAt)}
                        {consumerName && ` by ${consumerName}`}
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
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {/* Task #25 — resend + extend + revoke lifecycle
                          actions inline. Compact so the row doesn't
                          balloon; revoke is behind a details summary
                          because it needs the optional reason field. */}
                      <form action={resendInviteLink}>
                        <input
                          type="hidden"
                          name="inviteId"
                          value={invite.id}
                        />
                        <button
                          type="submit"
                          className="rounded-full border border-brand-magenta/40 px-3 py-1 text-[11px] text-brand-magenta hover:border-brand-magenta hover:bg-brand-magenta/10"
                        >
                          Resend email
                        </button>
                      </form>
                      <form action={extendInviteExpiry}>
                        <input
                          type="hidden"
                          name="inviteId"
                          value={invite.id}
                        />
                        <button
                          type="submit"
                          className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-[11px] text-ink-muted hover:border-brand-magenta hover:text-brand-magenta"
                        >
                          Extend +14 days
                        </button>
                      </form>
                      <details className="grow">
                        <summary className="cursor-pointer text-[11px] text-ink-faint hover:text-brand-magenta">
                          Revoke →
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
                    </div>
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
