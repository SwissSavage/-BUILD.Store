import { Button } from "@/components/Button";
/**
 * Attribution ledger entry surface (Phase 1.4).
 *
 * Lists every attribution entry for a contract and lets an admin add new
 * ones. The ledger is APPEND-ONLY in production — corrections happen via
 * offsetting entries, never edits, so the historical record stays intact
 * and compensation can be recomputed years later.
 *
 * Sandbox: appends to MOCK_ATTRIBUTION in memory.
 * REPLACE WITH: Drizzle insert into `attribution_entries`. Fire a
 * notification to anyone whose name was added so they can confirm.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth-stub";
import { randomUUID } from "crypto";
import { db } from "@/db/client";
import { attributionEntries as attributionTable } from "@/db/schema";
import { getProjectById } from "@/lib/readers/projects";
import { getAttributionForUser, attributionReader, safely } from "@/lib/readers";
import { getAllUsers } from "@/lib/readers/users";
import {
  ATTRIBUTION_ROLE_LABELS,
  rolePool,
  adminName,
  type AttributionRole,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { AttributionRoleField } from "@/components/AttributionRoleField";
import { Avatar } from "@/components/Avatar";

async function logEntry(formData: FormData) {
  "use server";
  const admin = await getCurrentUser();
  if (!admin || !admin.isAdmin) throw new Error("Admin only");

  const contractId = String(formData.get("contractId") ?? "");
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "") as AttributionRole;
  const weight = Number(formData.get("weight") ?? "0");
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!contractId || !userId || !role || Number.isNaN(weight)) {
    throw new Error("Missing required fields");
  }
  if (weight < 0 || weight > 1) {
    throw new Error("Weight must be between 0 and 1");
  }

  // Writer swap 2026-08-29: was an in-memory push. Attribution
  // entries are the input to the revenue split engine — an admin
  // logging who contributed what watched it save and then vanish, so
  // splits would have been computed against nothing.
  await db.insert(attributionTable).values({
    id: `att_${randomUUID()}`,
    contractId,
    userId,
    role,
    weight: String(weight),
    notes,
    loggedBy: admin.id,
    loggedAt: new Date().toISOString(),
  });

  revalidatePath(`/admin/contracts/${contractId}/attribution`);
  revalidatePath(`/admin/contracts/${contractId}/settle`);
  revalidatePath("/admin/contracts");
}

export const dynamic = "force-dynamic";

export default async function AttributionLedgerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await getCurrentUser();
  if (!admin || !admin.isAdmin) redirect("/dashboard");

  const { id } = await params;
  // Reader swap 2026-08-29: attribution ledger read seed data, so the
  // contributor sheet an admin uses to compute splits was fiction.
  const project = await getProjectById(id);
  if (!project) notFound();

  const [allAttribution, { users: roster }] = await Promise.all([
    safely(() => attributionReader.all(), []),
    safely(() => getAllUsers(), { users: [], source: "postgres" as const }),
  ]);
  const userById = new Map(roster.map((u) => [u.id, u]));

  const entries = allAttribution.filter((a) => a.contractId === id).sort(
    (a, b) => a.loggedAt.localeCompare(b.loggedAt),
  );

  // Suggest contributors who already touched the contract — assigned members
  // and anyone who submitted a quote.
  const suggested = new Set<string>(project.assignedMemberIds);

  // ──────────────────────────────────────────────────────────────
  // TWO POOLS, TWO MECHANISMS (2026-10-29)
  //
  // rolePool sends contributor and delivery_lead to the 85% pool and
  // introducer and advisor to the 12% pool, and the two are settled in
  // completely different ways:
  //
  //   contributor   proportional. The settle page normalises, so the
  //                 weights are relative to each other and a single
  //                 contributor at 0.50 takes the whole pool.
  //   admin         binary and even. The settle page says it outright:
  //                 "contract.adminUserIds is the source of truth." It
  //                 divides by headcount and never reads a weight.
  //
  // This page showed one flat list with a weight on every row and
  // warned when the total missed 1.00. So an admin-role entry looked
  // like it was buying a share, the number typed into it was silently
  // discarded, and a correct contributor ledger was reported as broken
  // because relative weights do not sum to one.
  //
  // Jamar, on Ozy sitting at 0.50 alone: "Why would it be assumed that
  // someone's contribution doesn't sum to 100."
  // ──────────────────────────────────────────────────────────────
  const contributorEntries = entries.filter(
    (e) => rolePool(e.role) === "contributor",
  );
  const adminEntries = entries.filter((e) => rolePool(e.role) === "admin");
  const totalContribWeight = contributorEntries.reduce(
    (sum, e) => sum + e.weight,
    0,
  );
  // What each contributor actually receives, computed the same way the
  // settle page computes it, so this page stops being a different
  // opinion about the same arithmetic.
  const sharePct = (weight: number) =>
    totalContribWeight > 0 ? (weight / totalContribWeight) * 100 : 0;

  // Admin-role entries only nominate. Anyone logged here who is not on
  // the contract's executive list will not be paid from the 12%.
  const onAdminList = new Set(project.adminUserIds ?? []);
  const nominatedNotOnList = adminEntries
    .map((e) => e.userId)
    .filter((uid) => !onAdminList.has(uid));

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/admin/contracts"
        className="text-sm text-ink-muted hover:text-ink"
      >
        ← Contract operations
      </Link>

      <header className="mt-3">
        <CardEyebrow>Attribution ledger</CardEyebrow>
        <h1 className="mt-2 font-display text-3xl font-semibold">
          {project.title}
        </h1>
        <p className="mt-2 text-ink-muted">
          Append-only record of who did what. Contributor roles divide
          the 85% pool in proportion to each other. Admin roles nominate
          people for the 12% pool, which splits evenly and is set by the
          contract&apos;s executive list rather than here.
        </p>
      </header>

      <Card className="mt-8">
        <div className="flex items-baseline justify-between">
          <CardTitle>
            Contributor pool &mdash; 85% ({contributorEntries.length})
          </CardTitle>
          {/* Relative, not absolute. The old copy read "Total weight:
              0.50 (does not sum to 1.00)", which reported a correct
              ledger as broken: the settle page normalises, so one
              contributor at 0.50 takes the entire pool. */}
          {contributorEntries.length > 0 && (
            <span className="text-xs text-ink-faint">
              Weights are relative. Total {totalContribWeight.toFixed(2)}.
            </span>
          )}
        </div>

        {contributorEntries.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">
            Nobody logged yet, so the 85% pool has nothing to divide by.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--surface-border)]">
            {contributorEntries.map((e) => {
              const u = userById.get(e.userId);
              return (
                <li key={e.id} className="py-3">
                  <div className="flex items-start gap-3">
                    {u && <Avatar user={u} size="sm" />}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-medium">
                          {adminName(u)}{" "}
                          <span className="text-ink-faint">·</span>{" "}
                          <span className="text-ink-muted">
                            {ATTRIBUTION_ROLE_LABELS[e.role]}
                          </span>
                        </div>
                        {/* The share is the number that decides what
                            they are paid. The raw weight is shown
                            beside it because it is what you edit. */}
                        <div className="shrink-0 text-right">
                          <div
                            className="text-sm font-medium tabular-nums"
                            style={{ color: "var(--fm-blue-text)" }}
                          >
                            {sharePct(e.weight).toFixed(0)}% of the pool
                          </div>
                          <div className="text-[10px] text-ink-faint tabular-nums">
                            weight {e.weight.toFixed(2)}
                          </div>
                        </div>
                      </div>
                      {e.notes && (
                        <p className="mt-1 text-sm text-ink-muted">{e.notes}</p>
                      )}
                      <p className="mt-1 text-xs text-ink-faint">
                        Logged by {adminName(e.loggedBy ? userById.get(e.loggedBy) : undefined)}{" "}
                        on {new Date(e.loggedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {/* The executive pool, stated plainly, because this page used to mix
          it into the list above with a weight on it and pay none of
          that any attention at settlement. */}
      <Card className="mt-6">
        <CardTitle>Executive pool &mdash; 12%</CardTitle>
        <p className="mt-1 text-xs text-ink-muted">
          Splits evenly across everyone on the contract&apos;s
          executive list. There is no weighting: being on the deal is the
          qualification. Introducer and advisor entries below are
          nominations, and the weight on them is not used.
        </p>

        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-wider text-ink-muted">
            On the executive list &mdash; these are the people who get paid
          </p>
          {onAdminList.size === 0 ? (
            <p className="mt-1 text-sm text-brand-magentaText">
              Nobody. The 12% will be allocated with no recipient if you
              settle like this.
            </p>
          ) : (
            <p className="mt-1 text-sm">
              {Array.from(onAdminList)
                .map((uid) => adminName(userById.get(uid)))
                .join(", ")}{" "}
              <span className="text-ink-faint">
                ({(100 / onAdminList.size).toFixed(0)}% each)
              </span>
            </p>
          )}
          <Link
            href={`/admin/contracts/${project.id}`}
            className="mt-2 inline-block text-xs text-brand-magentaText hover:underline"
          >
            Change the executive list on the contract →
          </Link>
        </div>

        {adminEntries.length > 0 && (
          <div className="mt-5 border-t border-[var(--surface-border)] pt-4">
            <p className="text-[10px] uppercase tracking-wider text-ink-muted">
              Nominated here ({adminEntries.length})
            </p>
            <ul className="mt-2 space-y-1">
              {adminEntries.map((e) => (
                <li key={e.id} className="text-sm">
                  {adminName(userById.get(e.userId))}{" "}
                  <span className="text-ink-muted">
                    · {ATTRIBUTION_ROLE_LABELS[e.role]}
                  </span>
                  {!onAdminList.has(e.userId) && (
                    <span className="ml-2 text-xs text-brand-magentaText">
                      not on the executive list, will not be paid
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {nominatedNotOnList.length > 0 && (
              <p className="mt-3 rounded-lg border border-brand-magenta/40 bg-brand-magenta/5 px-3 py-2 text-xs text-ink">
                {nominatedNotOnList.length === 1 ? "One person is" : `${nominatedNotOnList.length} people are`}{" "}
                nominated here but not on the executive list. Nominating
                somebody does not pay them.
              </p>
            )}
          </div>
        )}
      </Card>

      <Card className="mt-6">
        <CardTitle>Add an entry</CardTitle>
        <p className="mt-1 text-xs text-ink-faint">
          To revise an existing entry, add a new one with an offsetting weight
          (positive or negative). The historical record stays intact.
        </p>

        <form action={logEntry} className="mt-5 space-y-4">
          <input type="hidden" name="contractId" value={project.id} />

          <label className="block">
            <span className="text-xs uppercase tracking-wider text-ink-muted">
              Contributor
            </span>
            <select
              name="userId"
              required
              className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
            >
              <option value="">Select…</option>
              {roster.filter((u) => u.membershipTier !== "viewer").map((u) => (
                <option key={u.id} value={u.id}>
                  {adminName(u)}
                  {suggested.has(u.id) ? " (assigned)" : ""}
                </option>
              ))}
            </select>
          </label>

          <AttributionRoleField />

          <label className="block">
            <span className="text-xs uppercase tracking-wider text-ink-muted">
              Notes (optional)
            </span>
            <textarea
              name="notes"
              rows={2}
              className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
              placeholder="Specifics — what did this person actually do?"
            />
          </label>

          <Button
            type="submit"
            className="rounded-full px-5 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: "#5070F0" }}
          >
            Log entry
          </Button>
        </form>
      </Card>
    </div>
  );
}
