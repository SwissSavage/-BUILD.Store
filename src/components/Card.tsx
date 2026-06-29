/**
 * Shared card primitive. Use everywhere instead of repeating
 * the border + padding + rounded combo inline.
 */
import { cn } from "@/lib/cn";

export function Card({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-6",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3 className={cn("font-display text-xl font-semibold", className)}>{children}</h3>
  );
}

export function CardEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-xs uppercase tracking-wider text-brand-magenta">
      {children}
    </div>
  );
}
