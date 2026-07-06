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
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { MOCK_ATTRIBUTION } from "@/lib/mock-data/attribution";
import { MOCK_SPLITS } from "@/lib/mock-data/splits";
import {
  HUBSPOT_STAGE_LABELS,
  INDUSTRY_LABELS,
  type Project,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { HubspotStageBadge } from "@/components/HubspotStageBadge";

export default async function AdminContractsIndex() {
  const user = await getCurrentUser();
  if (!user || !user.isAdmin) redirect("/dashboard");

  const contracts = MOCK_PROJECTS.filter((p) => p.kind === "contract");

  // Bucket by lifecycle stage.
  const settled = contracts.filter(
    (p) => MOCK_SPLITS.some((s) => s.contractId === p.id),
  );
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
        />
      )}

      {inFlight.length > 0 && (
        <Section
          title={`In-flight (${inFlight.length})`}
          subtitle="Open or active contracts. Log attribution as the work happens."
          accent="#5070F0"
          contracts={inFlight}
        />
      )}

      {settled.length > 0 && (
        <Section
          title={`Settled (${settled.length})`}
          subtitle="Splits dispatched. Read-only audit view."
          accent="#007048"
          contracts={settled}
        />
      )}

      {pending.length > 0 && (
        <Section
          title={`In RFP intake (${pending.length})`}
          subtitle="Vet these in /admin/rfps before they show up here."
          accent="#5070F0"
          contracts={pending}
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
}: {
  title: string;
  subtitle: string;
  accent: string;
  contracts: Project[];
  hideActions?: boolean;
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
          <ContractRow key={p.id} project={p} hideActions={hideActions} />
        ))}
      </div>
    </section>
  );
}

function ContractRow({
  project,
  hideActions,
}: {
  project: Project;
  hideActions: boolean;
}) {
  const attributions = MOCK_ATTRIBUTION.filter(
    (a) => a.contractId === project.id,
  );
  const splits = MOCK_SPLITS.filter((s) => s.contractId === project.id);

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
