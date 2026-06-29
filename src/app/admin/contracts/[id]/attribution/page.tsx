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
import { MOCK_ATTRIBUTION } from "@/lib/mock-data/attribution";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { MOCK_USERS } from "@/lib/mock-data/users";
import {
  ATTRIBUTION_ROLE_LABELS,
  adminName,
  type AttributionRole,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
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

  MOCK_ATTRIBUTION.push({
    id: `att_${Date.now()}`,
    contractId,
    userId,
    role,
    weight,
    notes,
    loggedBy: admin.id,
    loggedAt: new Date().toISOString(),
  });

  revalidatePath(`/admin/contracts/${contractId}/attribution`);
  revalidatePath(`/admin/contracts/${contractId}/settle`);
  revalidatePath("/admin/contracts");
}

export default async function AttributionLedgerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const admin = await getCurrentUser();
  if (!admin || !admin.isAdmin) redirect("/dashboard");

  const { id } = await params;
  const project = MOCK_PROJECTS.find((p) => p.id === id);
  if (!project) notFound();

  const entries = MOCK_ATTRIBUTION.filter((a) => a.contractId === id).sort(
    (a, b) => a.loggedAt.localeCompare(b.loggedAt),
  );

  // Suggest contributors who already touched the contract — assigned members
  // and anyone who submitted a quote.
  const suggested = new Set<string>(project.assignedMemberIds);

  const totalWeight = entries.reduce((sum, e) => sum + e.weight, 0);

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
          Append-only record of who did what. Drives the default 85%
          contributor split at settlement.
        </p>
      </header>

      <Card className="mt-8">
        <div className="flex items-baseline justify-between">
          <CardTitle>Entries ({entries.length})</CardTitle>
          {entries.length > 0 && (
            <span
              className={`text-xs ${
                Math.abs(totalWeight - 1) < 0.01
                  ? "text-brand-green"
                  : "text-ink-faint"
              }`}
            >
              Total weight: {totalWeight.toFixed(2)}
              {Math.abs(totalWeight - 1) > 0.01 && " (does not sum to 1.00)"}
            </span>
          )}
        </div>

        {entries.length === 0 ? (
          <p className="mt-4 text-sm text-ink-muted">
            No entries yet. Add the first one below.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-[var(--surface-border)]">
            {entries.map((e) => {
              const u = MOCK_USERS.find((u) => u.id === e.userId);
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
                        <div className="text-sm font-medium" style={{ color: "#5070F0" }}>
                          weight {e.weight.toFixed(2)}
                        </div>
                      </div>
                      {e.notes && (
                        <p className="mt-1 text-sm text-ink-muted">{e.notes}</p>
                      )}
                      <p className="mt-1 text-xs text-ink-faint">
                        Logged by {adminName(MOCK_USERS.find((u) => u.id === e.loggedBy))}{" "}
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
              {MOCK_USERS.filter((u) => u.membershipTier !== "viewer").map((u) => (
                <option key={u.id} value={u.id}>
                  {adminName(u)}
                  {suggested.has(u.id) ? " (assigned)" : ""}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-ink-muted">
                Role
              </span>
              <select
                name="role"
                required
                defaultValue="contributor"
                className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
              >
                {(Object.keys(ATTRIBUTION_ROLE_LABELS) as AttributionRole[]).map(
                  (r) => (
                    <option key={r} value={r}>
                      {ATTRIBUTION_ROLE_LABELS[r]}
                    </option>
                  ),
                )}
              </select>
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-ink-muted">
                Weight (0.00 – 1.00)
              </span>
              <input
                name="weight"
                type="number"
                min="0"
                max="1"
                step="0.05"
                defaultValue="0.5"
                required
                className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
              />
            </label>
          </div>

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

          <button
            type="submit"
            className="rounded-full px-5 py-2 text-sm font-medium text-white"
            style={{ backgroundColor: "#5070F0" }}
          >
            Log entry
          </button>
        </form>
      </Card>
    </div>
  );
}
