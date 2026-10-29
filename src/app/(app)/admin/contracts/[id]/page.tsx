/**
 * /admin/contracts/[id] — the engagement, as one object.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS PAGE EXISTS (2026-10-28)
 *
 * Jamar: "admins should be able to settle cards directly from the job.
 * That's most practical."
 *
 * A contract had four admin pages hanging off it, attribution, ledger,
 * settle and tracker, and no page of its own. The URL structure
 * mirrored the machinery, four tables so four screens, and the
 * engagement itself had nowhere to live. You navigated the engine
 * instead of the deal.
 *
 * The cost of that is not clicks. It is that the order of operations
 * became knowledge somebody had to carry in their head. Attribution
 * has to precede settlement because the contributor pool divides by
 * it. Revenue has to land before the allocator will render. Owners
 * have to be set before settlement or the 12% operations pool is
 * written with no recipient. None of those four pages knows about the
 * other three, so none of them could ever say so, and the first time
 * anyone found out was by asking.
 *
 * This page knows about all of them. It reads the state of each stage,
 * says which are done, and names the unmet prerequisites on the ones
 * that are not.
 *
 * WHY THERE IS NO SETTLE BUTTON HERE
 *
 * Settlement writes money and cannot be taken back. Collapsing it to
 * one click on a summary card is how a split gets written against
 * empty attribution at eleven at night. The stages are consolidated;
 * the gates are not. Each action still happens on the surface that
 * owns it, with the full context in front of you.
 *
 * The one exception is the owners field, which is inline, because it
 * is a single column, it blocks settlement, and the only reason it was
 * ever somewhere else is that it happened to live on a project edit
 * form.
 * ─────────────────────────────────────────────────────────────
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db/client";
import {
  attributionEntries,
  buildVouchers,
  customerFeedback,
  invoices as invoicesTable,
  portfolioEntries,
  revenueSplits,
} from "@/db/schema";
import { requireAdmin } from "@/lib/auth-stub";
import { getProjectById } from "@/lib/readers/projects";
import { getAllUsers } from "@/lib/readers/users";
import { getMilestonesForProject, safely } from "@/lib/readers";
import { setContractOwners } from "@/lib/contract-owner-actions";
import { publicName } from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { AdminOwnerField } from "@/components/AdminOwnerField";
import { MilestoneProgress } from "@/components/MilestoneProgress";

export const dynamic = "force-dynamic";

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

/**
 * One stage of the engagement.
 *
 * `blockedBy` is the whole point of the component. A stage that cannot
 * run says why, in the words of the thing that is missing, rather than
 * rendering a link that leads to a page which refuses.
 */
function Stage({
  n,
  title,
  done,
  detail,
  blockedBy,
  href,
  hrefLabel,
  children,
}: {
  n: number;
  title: string;
  done: boolean;
  detail?: string;
  blockedBy?: string[];
  href?: string;
  hrefLabel?: string;
  children?: React.ReactNode;
}) {
  const blocked = (blockedBy?.length ?? 0) > 0;
  return (
    <Card className={done ? "border-[#13A06A]/40" : undefined}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-medium"
            style={
              done
                ? { backgroundColor: "rgba(19,160,106,0.15)", color: "#13A06A" }
                : {
                    backgroundColor: "rgba(102,102,102,0.15)",
                    color: "var(--ink-muted)",
                  }
            }
          >
            {done ? "✓" : n}
          </span>
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            {detail && (
              <p className="mt-1 text-xs text-ink-muted">{detail}</p>
            )}
          </div>
        </div>
        {href && !blocked && (
          <Link
            href={href}
            className="shrink-0 text-xs text-brand-magentaText hover:underline"
          >
            {hrefLabel ?? "Open"} →
          </Link>
        )}
      </div>

      {blocked && (
        <p className="mt-3 rounded-lg border border-brand-magenta/40 bg-brand-magenta/5 px-3 py-2 text-xs text-ink">
          Waiting on {blockedBy!.join(", ")}.
        </p>
      )}

      {children && <div className="mt-3">{children}</div>}
    </Card>
  );
}

export default async function ContractHubPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const viewer = await requireAdmin();
  const { id } = await params;

  const project = await getProjectById(id);
  if (!project || project.kind !== "contract") notFound();

  const [
    { users: roster },
    attributions,
    splits,
    invoices,
    vouchers,
    feedback,
    portfolio,
    milestones,
  ] = await Promise.all([
    safely(() => getAllUsers(), { users: [], source: "postgres" as const }),
    safely(
      () =>
        db
          .select()
          .from(attributionEntries)
          .where(eq(attributionEntries.contractId, id)),
      [],
    ),
    safely(
      () => db.select().from(revenueSplits).where(eq(revenueSplits.contractId, id)),
      [],
    ),
    safely(
      () => db.select().from(invoicesTable).where(eq(invoicesTable.contractId, id)),
      [],
    ),
    safely(
      () =>
        db
          .select()
          .from(buildVouchers)
          .where(eq(buildVouchers.sourceRefId, id)),
      [],
    ),
    safely(
      () =>
        db
          .select()
          .from(customerFeedback)
          .where(eq(customerFeedback.contextId, id)),
      [],
    ),
    safely(
      () =>
        db
          .select()
          .from(portfolioEntries)
          .where(eq(portfolioEntries.projectId, id))
          .limit(1),
      [],
    ),
    safely(() => getMilestonesForProject(id), []),
  ]);

  const adminRoster = roster.filter((u) => u.isAdmin && !u.suspendedAt);
  const nameById = new Map(roster.map((u) => [u.id, publicName(u)]));

  const owners = project.adminUserIds ?? [];
  const hasOwners = owners.length > 0;
  const hasAttribution = attributions.length > 0;
  const collected = project.collectedRevenue
    ? Number(project.collectedRevenue)
    : 0;
  const hasRevenue = collected > 0;
  const isSettled = splits.length > 0;
  const received = invoices.filter((i) => i.status === "received");
  const entry = portfolio[0] ?? null;
  const completedMilestones = milestones.filter(
    (m) => m.status === "completed",
  ).length;

  // The prerequisites, stated once. Everything below reads them rather
  // than re-deriving its own opinion of what blocks what.
  const settleBlockers: string[] = [];
  if (!hasRevenue) settleBlockers.push("revenue to land on the ledger");
  if (!hasAttribution) settleBlockers.push("attribution entries");

  const stage = isSettled
    ? "Settled"
    : hasRevenue
      ? "Ready to settle"
      : project.status === "completed"
        ? "Delivered, unbilled"
        : project.engagementState === "awaiting_talent"
          ? "Awaiting the Builder"
          : "In flight";

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/admin/contracts"
        className="text-sm text-ink-muted hover:text-ink"
      >
        ← Contract operations
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardEyebrow>
            {project.isRfp ? "Won through an RFP" : "Direct engagement"}
          </CardEyebrow>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            {project.title}
          </h1>
        </div>
        <span
          className="mt-2 shrink-0 rounded-full px-3 py-1 text-[11px] uppercase tracking-wider"
          style={{
            backgroundColor: isSettled
              ? "rgba(19,160,106,0.15)"
              : "rgba(80,112,240,0.15)",
            color: isSettled ? "#13A06A" : "#5070F0",
          }}
        >
          {stage}
        </span>
      </div>

      <p className="mt-2 text-sm text-ink-muted">
        Every stage of this engagement, and what each one is waiting on.
        Actions still happen on the surface that owns them.
      </p>

      <div className="mt-8 space-y-4">
        <Stage
          n={1}
          title="Owners"
          done={hasOwners}
          detail={
            hasOwners
              ? owners.map((o) => nameById.get(o) ?? o).join(", ")
              : "The 12% operations pool is allocated from this list at settlement. Empty means that share is written with no recipient."
            }
        >
          {!isSettled && (
            <form action={setContractOwners}>
              <input type="hidden" name="projectId" value={project.id} />
              <AdminOwnerField
                admins={adminRoster}
                selected={owners}
                currentAdminId={viewer.id}
                hint="Takes the admin share at settlement, can open reference files, and hears about overdue milestones."
              />
              <button
                type="submit"
                className="mt-3 rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-xs hover:border-brand-magenta hover:text-brand-magentaText"
              >
                Save owners
              </button>
            </form>
          )}
        </Stage>

        <Stage
          n={2}
          title="Delivery"
          done={milestones.length > 0 && completedMilestones === milestones.length}
          detail={
            milestones.length === 0
              ? "No milestones on this engagement."
              : `${completedMilestones} of ${milestones.length} landed.`
          }
          href={`/admin/contracts/${project.id}/tracker`}
          hrefLabel="Tracker"
        >
          <MilestoneProgress
            completed={completedMilestones}
            total={milestones.length}
            label="Milestones"
            compact
          />
        </Stage>

        <Stage
          n={3}
          title="Attribution"
          done={hasAttribution}
          detail={
            hasAttribution
              ? `${attributions.length} ${attributions.length === 1 ? "entry" : "entries"} logged. This is what the 85% contributor pool divides by.`
              : "Nobody is on the ledger yet, so the contributor pool has nothing to divide by."
          }
          href={`/admin/contracts/${project.id}/attribution`}
          hrefLabel="Attribution"
        />

        <Stage
          n={4}
          title="Revenue"
          done={hasRevenue}
          detail={
            hasRevenue
              ? `${usd(collected)} collected across ${received.length} received ${received.length === 1 ? "invoice" : "invoices"}.`
              : `${invoices.length} ${invoices.length === 1 ? "invoice" : "invoices"} on file, none marked received. Marking one received is what writes collectedRevenue.`
          }
          href={`/admin/contracts/${project.id}/ledger`}
          hrefLabel="Ledger"
        />

        <Stage
          n={5}
          title="Settlement"
          done={isSettled}
          blockedBy={isSettled ? undefined : settleBlockers}
          detail={
            isSettled
              ? `${splits.length} splits written. This is also what set the contract to completed.`
              : "Writes the 85/12/3 splits, flips the contract to completed, and issues the $BUILD vouchers in the same pass."
          }
          href={`/admin/contracts/${project.id}/settle`}
          hrefLabel="Settle"
        />

        <Stage
          n={6}
          title="Vouchers"
          done={vouchers.length > 0}
          detail={
            vouchers.length > 0
              ? `${vouchers.length} issued, ${usd(vouchers.reduce((a, v) => a + Number(v.amount), 0))} total.`
              : "Issued automatically by settlement. Nothing to do here by hand, and issuing manually beforehand double-issues."
          }
          href={vouchers.length > 0 ? "/admin/vouchers" : undefined}
          hrefLabel="Vouchers"
        />

        <Stage
          n={7}
          title="Client feedback"
          done={feedback.length > 0}
          detail={
            feedback.length > 0
              ? `Captured. ${feedback[0]?.overallStars ?? "?"} stars overall.`
              : "Issue the questionnaire link from the settle page, or capture a written report on /admin/reserve against a linked meeting minute."
          }
          href={`/admin/contracts/${project.id}/settle`}
          hrefLabel="Issue link"
        />

        <Stage
          n={8}
          title="Portfolio"
          done={entry?.state === "published"}
          blockedBy={
            project.status === "completed" ? undefined : ["the contract to complete"]
          }
          detail={
            entry
              ? entry.state === "published"
                ? `Published as a case study, with consent from ${entry.clientConsentBy}.`
                : entry.clientConsentAt
                  ? "Written up and the client has agreed. Ready to publish."
                  : "Written up. Needs recorded client consent before it can be published."
              : "Not written up. Nothing reaches the public case studies without going through here first."
          }
          href="/admin/portfolio"
          hrefLabel="Portfolio"
        />
      </div>

      {/* The full record, for the fields this page does not carry.
          Linked from here because /admin/projects/[id]/edit was
          reachable by typing the URL and no other way, which is how
          the owner pool ended up invisible for months. */}
      <div className="mt-8 flex flex-wrap items-center gap-4 text-xs">
        <Link
          href={`/admin/projects/${project.id}/edit`}
          className="text-brand-magentaText hover:underline"
        >
          Edit the full record →
        </Link>
        <Link
          href={`/contracts/${project.id}`}
          target="_blank"
          rel="noreferrer"
          className="text-ink-muted hover:text-ink"
        >
          Public contract page ↗
        </Link>
      </div>

      <p className="mt-6 text-xs text-ink-faint">
        There is deliberately no settle button on this page. Settlement
        writes money and cannot be undone, so it happens on its own
        surface with the allocator in front of you.
      </p>
    </div>
  );
}
