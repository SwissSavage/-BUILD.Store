/**
 * Admin contract index — the entry point for the Phase 1 admin surfaces:
 *   - attribution ledger entry per contract
 *   - revenue split engine + settlement
 *
 * Lists every contract grouped by stage in the lifecycle so an admin can
 * pick the next thing that needs them. Internal projects don't appear here.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { getContracts } from "@/lib/readers/projects";
import { attributionReader, splitReader, safely } from "@/lib/readers";
import { trashProject } from "@/lib/project-trash-actions";
import {
  HUBSPOT_STAGE_LABELS,
  INDUSTRY_LABELS,
  type Project,
  type AttributionEntry,
  type RevenueSplit,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { HubspotStageBadge } from "@/components/HubspotStageBadge";

export const dynamic = "force-dynamic";

export default async function AdminContractsIndex() {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) redirect("/dashboard");

  const [{ projects: contracts }, splits, attributions] = await Promise.all([
    getContracts(),
    safely(() => splitReader.all(), []),
    safely(() => attributionReader.all(), []),
  ]);

  // Bucket by lifecycle stage.
  // Grouped by contract so each card gets its own slice without a
  // query per row — this page renders every contract the cooperative
  // has.
  const attributionsBy = new Map<string, AttributionEntry[]>();
  for (const a of attributions) {
    const list = attributionsBy.get(a.contractId) ?? [];
    list.push(a);
    attributionsBy.set(a.contractId, list);
  }
  const splitsBy = new Map<string, RevenueSplit[]>();
  for (const sp of splits) {
    if (!sp.contractId) continue;
    const list = splitsBy.get(sp.contractId) ?? [];
    list.push(sp);
    splitsBy.set(sp.contractId, list);
  }

  // Which contracts have been settled, from the splits themselves.
  const settledContractIds = new Set(
    splits.map((s) => s.contractId).filter((id): id is string => Boolean(id)),
  );
  const settled = contracts.filter((p) => settledContractIds.has(p.id));
  const collectedUnsettled = contracts.filter(
    (p) => p.collectedRevenue && !settled.includes(p),
  );
  const inFlight = contracts.filter(
    (p) => p.rfpApprovedAt && !p.collectedRevenue && p.status !== "completed",
  );
  const pending = contracts.filter((p) => !p.rfpApprovedAt);

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <Link href="/admin" className="text-sm text-ink-muted hover:text-ink">
        ← Admin home
      </Link>
      <h1 className="mt-3 font-display text-4xl font-semibold">Contract operations</h1>
      <p className="mt-2 text-ink-muted">
        Run the attribution ledger and the 85 / 15 split engine. Each contract
        moves left → right through these stages.
      </p>

      {collectedUnsettled.length > 0 && (
        <Section
          title={`Ready to settle (${collectedUnsettled.length})`}
          subtitle="Revenue has landed — run the split engine."
          accent="#D828A0"
          contracts={collectedUnsettled}
          attributionsBy={attributionsBy}
          splitsBy={splitsBy}
        />
      )}

      {inFlight.length > 0 && (
        <Section
          title={`In-flight (${inFlight.length})`}
          subtitle="Open or active contracts. Log attribution as the work happens."
          accent="#5070F0"
          contracts={inFlight}
          attributionsBy={attributionsBy}
          splitsBy={splitsBy}
        />
      )}

      {settled.length > 0 && (
        <Section
          title={`Settled (${settled.length})`}
          subtitle="Splits dispatched. Read-only audit view."
          accent="#007048"
          contracts={settled}
          attributionsBy={attributionsBy}
          splitsBy={splitsBy}
        />
      )}

      {pending.length > 0 && (
        <Section
          title={`In RFP intake (${pending.length})`}
          subtitle="Vet these in /admin/rfps before they show up here."
          accent="#5070F0"
          contracts={pending}
          attributionsBy={attributionsBy}
          splitsBy={splitsBy}
          hideActions
        />
      )}
    </div>
  );
}

function Section({
  title,
  subtitle,
  accent,
  contracts,
  hideActions = false,
  attributionsBy,
  splitsBy,
}: {
  title: string;
  subtitle: string;
  accent: string;
  contracts: Project[];
  hideActions?: boolean;
  attributionsBy: Map<string, AttributionEntry[]>;
  splitsBy: Map<string, RevenueSplit[]>;
}) {
  return (
    <section className="mt-10">
      <h2
        className="font-display text-2xl font-semibold"
        style={{ color: accent }}
      >
        {title}
      </h2>
      <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {contracts.map((p) => (
          <ContractRow
            key={p.id}
            project={p}
            hideActions={hideActions}
            attributions={attributionsBy.get(p.id) ?? []}
            splits={splitsBy.get(p.id) ?? []}
          />
        ))}
      </div>
    </section>
  );
}

function ContractRow({
  project,
  hideActions,
  attributions,
  splits,
}: {
  project: Project;
  hideActions: boolean;
  attributions: AttributionEntry[];
  splits: RevenueSplit[];
}) {

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <CardEyebrow>{INDUSTRY_LABELS[project.industry]}</CardEyebrow>
          <CardTitle className="mt-1 truncate">{project.title}</CardTitle>
        </div>
        <HubspotStageBadge stage={project.hubspotStage} />
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <Stat label="Budget" value={`$${Number(project.budget).toLocaleString()}`} />
        <Stat
          label="Collected"
          value={
            project.collectedRevenue
              ? `$${Number(project.collectedRevenue).toLocaleString()}`
              : "—"
          }
        />
        <Stat
          label="Attribution"
          value={attributions.length === 0 ? "0 entries" : `${attributions.length} logged`}
        />
      </div>

      {project.hubspotStage && (
        <p className="mt-3 text-xs text-ink-faint">
          HubSpot deal stage: {HUBSPOT_STAGE_LABELS[project.hubspotStage]}
        </p>
      )}

      {!hideActions && (
        <div className="mt-4 flex flex-wrap gap-2 border-t border-[var(--surface-border)] pt-4">
          <Link
            href={`/admin/contracts/${project.id}/tracker`}
            className="rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs hover:bg-[var(--surface-inset)]"
          >
            Milestone tracker
          </Link>
          <Link
            href={`/admin/contracts/${project.id}/attribution`}
            className="rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs hover:bg-[var(--surface-inset)]"
          >
            {attributions.length === 0 ? "Start attribution" : "Edit attribution"}
          </Link>
          <Link
            href={`/admin/contracts/${project.id}/ledger`}
            className="rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs hover:bg-[var(--surface-inset)]"
          >
            AR / AP ledger
          </Link>
          <Link
            href={`/admin/contracts/${project.id}/settle`}
            className={`rounded-full px-3 py-1.5 text-xs font-medium text-white ${
              splits.length > 0 ? "" : "shadow"
            }`}
            style={{
              backgroundColor: splits.length > 0 ? "#007048" : "#D828A0",
            }}
          >
            {splits.length > 0 ? "View settlement" : "Settle revenue"}
          </Link>
        </div>
      )}

      {/* Delete. Soft — goes to /admin/trash and is restorable for 30
          days. Refuses outright once a payout has been dispatched,
          since at that point the contract is a financial record.
          Sits on this page as well as /admin/projects because this is
          where you come looking for a contract. */}
      <details className="mt-3">
        <summary className="cursor-pointer text-[11px] text-ink-faint hover:text-brand-magenta">
          Delete contract
        </summary>
        <form action={trashProject} className="mt-2 max-w-sm space-y-2">
          <input type="hidden" name="id" value={project.id} />
          <input
            name="reason"
            placeholder="Reason (optional)"
            className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] px-3 py-1.5 text-xs text-ink"
          />
          <button
            type="submit"
            className="rounded-full border border-brand-magenta/50 px-3 py-1.5 text-[11px] text-brand-magenta hover:border-brand-magenta"
          >
            Move to trash
          </button>
        </form>
      </details>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[var(--surface-inset)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-ink-faint">
        {label}
      </div>
      <div className="mt-0.5 font-medium text-ink">{value}</div>
    </div>
  );
}
