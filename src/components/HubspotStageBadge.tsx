/**
 * Read-only HubSpot deal-stage indicator.
 *
 * Mirrors the deal stage we sync from HubSpot via webhook (see
 * `applyHubspotStageWebhook` in lib/crm-stub.ts). Shown to contributors so
 * they see funnel progression without seeing client PII or raw HubSpot
 * record IDs.
 *
 * Color rule of thumb: blue while in motion, green for closed-won, red for
 * closed-lost. Internal projects render nothing (they have no deal).
 */
import { HUBSPOT_STAGE_LABELS, type HubspotStage } from "@/lib/types";

const STAGE_COLOR: Record<HubspotStage, string> = {
  discovery: "#5070F0",
  proposal_sent: "#5070F0",
  negotiation: "#D828A0",
  closed_won: "#007048",
  closed_lost: "#E53E3E",
};

export function HubspotStageBadge({
  stage,
  className,
}: {
  stage: HubspotStage | null;
  className?: string;
}) {
  if (!stage) return null;
  const color = STAGE_COLOR[stage];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${className ?? ""}`}
      style={{
        backgroundColor: `${color}26`,
        color,
      }}
      title={`HubSpot stage: ${HUBSPOT_STAGE_LABELS[stage]}`}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: color }}
      />
      {HUBSPOT_STAGE_LABELS[stage]}
    </span>
  );
}
