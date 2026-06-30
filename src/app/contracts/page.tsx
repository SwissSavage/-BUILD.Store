/**
 * Contracts — external one-off client work.
 * Open RFPs a member can bid on, plus their own active/completed contracts.
 *
 * For INTERNAL co-op initiatives, see /projects.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { INDUSTRY_LABELS, userHasPillar, userPillars } from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { HubspotStageBadge } from "@/components/HubspotStageBadge";
import { NotificationStrip } from "@/components/NotificationStrip";

export default async function ContractsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const contracts = MOCK_PROJECTS.filter((p) => p.kind === "contract");
  const pillars = userPillars(user);

  // Only admin-vetted RFPs appear on the public member feed. RFPs still in the
  // intake queue (rfpApprovedAt === null) stay behind /admin/rfps until cleared.
  const openInPillar = contracts.filter(
    (p) =>
      p.isRfp &&
      p.status === "open" &&
      p.rfpApprovedAt &&
      userHasPillar(user, p.industry),
  );
  const openOther = contracts.filter(
    (p) =>
      p.isRfp &&
      p.status === "open" &&
      p.rfpApprovedAt &&
      !userHasPillar(user, p.industry),
  );
  const myActive = contracts.filter(
    (p) => p.assignedMemberIds.includes(user.id) && p.status !== "completed",
  );

  const pillarLabel =
    pillars.length === 0
      ? "your pillar"
      : pillars.length === 1
        ? INDUSTRY_LABELS[pillars[0]]
        : `${pillars.map((p) => INDUSTRY_LABELS[p]).join(" + ")}`;

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-display text-4xl font-semibold">Contracts</h1>
          <p className="mt-1 text-ink-muted">
            One-off client work. Bid on open RFPs, track active engagements.
          </p>
        </div>
        <Link
          href="/contracts/new"
          className="self-start rounded-full px-6 py-2.5 text-sm font-medium text-white"
          style={{ backgroundColor: "#D828A0" }}
        >
          Submit an RFP
        </Link>
      </div>

      <NotificationStrip
        userId={user.id}
        kinds={["rfp_status", "contract_stage", "invoice_received"]}
        surfaceLabel="Contracts"
      />

      {myActive.length > 0 && (
        <Section title="Your active contracts">
          <Grid items={myActive} />
        </Section>
      )}

      <Section
        title={`Open RFPs in ${pillarLabel}`}
        subtitle={`Skill-filtered to ${pillars.length > 1 ? "your pillars" : "your pillar"}.`}
      >
        {openInPillar.length === 0 ? <Empty /> : <Grid items={openInPillar} />}
      </Section>

      <Section
        title="Other open RFPs"
        subtitle={`Outside ${pillars.length > 1 ? "your pillars" : "your pillar"} — visible for context.`}
      >
        {openOther.length === 0 ? <Empty /> : <Grid items={openOther} />}
      </Section>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-12">
      <h2 className="font-display text-2xl font-semibold">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Grid({ items }: { items: typeof MOCK_PROJECTS }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map((p) => (
        <Card key={p.id}>
          <CardEyebrow>{INDUSTRY_LABELS[p.industry]}</CardEyebrow>
          <CardTitle className="mt-2">{p.title}</CardTitle>
          <p className="mt-3 text-sm text-ink-muted">{p.description}</p>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {p.skillsRequired.map((s) => (
              <span
                key={s}
                className="rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-xs text-ink-muted"
              >
                {s}
              </span>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between">
            <div>
              <div className="text-xs uppercase tracking-wider text-ink-faint">Budget</div>
              <div className="font-medium">
                ${Number(p.budget).toLocaleString()}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span
                className="rounded-full px-2.5 py-0.5 text-xs font-medium capitalize"
                style={{ backgroundColor: "rgba(216,40,160,0.15)", color: "#D828A0" }}
              >
                {p.status.replace("_", " ")}
              </span>
              {/* HubSpot deal stage chip — only visible to contributors on
                  contracts they're assigned to. RFP cards (anyone can see)
                  hide it to avoid leaking funnel intel about other clients. */}
              {p.assignedMemberIds.length > 0 && (
                <HubspotStageBadge stage={p.hubspotStage} />
              )}
            </div>
          </div>

          {/* Your comp structure — visible when the contract has
              base+bonus structure set. Per locked policy this is talent-
              facing only; clients NEVER see the bonus gate. RFPs without
              structure (most) render nothing here. */}
          {p.talentBonusAmount && (
            <div className="mt-4 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-3 text-xs">
              <div className="text-[10px] uppercase tracking-wider text-brand-magenta">
                Your comp structure
              </div>
              <div className="mt-1.5 flex flex-wrap gap-3">
                <div>
                  <div className="text-[10px] text-ink-faint">Base (guaranteed)</div>
                  <div className="font-mono">
                    ${Number(p.talentBaseAmount ?? 0).toLocaleString()}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] text-ink-faint">
                    Ceiling (earnable at close)
                  </div>
                  <div className="font-mono">
                    ${Number(p.talentBonusAmount).toLocaleString()}
                  </div>
                </div>
                {p.bonusDecision === "released" && (
                  <div>
                    <div className="text-[10px] text-ink-faint">Ceiling</div>
                    <div className="text-[#007048]">★ Released</div>
                  </div>
                )}
                {p.bonusDecision === "reclaimed" && (
                  <div>
                    <div className="text-[10px] text-ink-faint">Ceiling</div>
                    <div className="text-brand-magenta">Did not clear</div>
                  </div>
                )}
              </div>
              {p.bonusDecision === "pending" && (
                <p className="mt-1.5 text-[10px] text-ink-faint">
                  Ceiling releases at engagement close on a quality gate
                  (client rating, peer review, PM rating). See your wallet
                  history when settlement runs.
                </p>
              )}
            </div>
          )}

          {p.isRfp && p.status === "open" && (
            <div className="mt-4 border-t border-[var(--surface-border)] pt-4">
              <Link
                href={`/contracts/${p.id}/quote`}
                className="text-sm font-medium hover:underline"
                style={{ color: "#D828A0" }}
              >
                Submit a quote →
              </Link>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

function Empty() {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--surface-border)] p-8 text-center text-sm text-ink-muted">
      No open RFPs right now.
    </div>
  );
}
