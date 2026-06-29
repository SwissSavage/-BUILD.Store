import { TIER_LABELS, type MembershipTier } from "@/lib/types";
import { cn } from "@/lib/cn";

const TIER_STYLES: Record<MembershipTier, string> = {
  viewer: "bg-[var(--surface)] text-ink-muted border-[var(--surface-border)]",
  prospect: "bg-brand-blue/15 text-brand-blue border-brand-blue/30",
  partner: "bg-brand-green/15 text-brand-green border-brand-green/30",
  member: "bg-brand-magenta/15 text-brand-magenta border-brand-magenta/30",
};

export function TierBadge({ tier }: { tier: MembershipTier }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        TIER_STYLES[tier],
      )}
    >
      {TIER_LABELS[tier]}
    </span>
  );
}
