import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost";
type ButtonSize = "compact" | "default" | "large" | "icon";

const variantClass: Record<ButtonVariant, string> = {
  primary: "fm-btn-primary border-transparent",
  secondary:
    "border-[var(--surface-border)] bg-transparent text-ink hover:border-brand-magenta/60 hover:bg-[var(--surface-elevated)]",
  ghost:
    "border-transparent bg-transparent text-ink-muted hover:bg-[var(--surface-elevated)] hover:text-ink",
};

const sizeClass: Record<ButtonSize, string> = {
  compact: "min-h-8 px-3 py-1.5 text-xs",
  default: "min-h-10 px-4 py-2 text-sm",
  large: "min-h-11 px-5 py-2.5 text-sm",
  icon: "size-10 p-0",
};

export function buttonClassName({
  variant,
  size,
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    "fm-button inline-flex items-center justify-center gap-2 font-medium leading-5 transition-[background-color,border-color,color,filter,transform,box-shadow] duration-150 ease-out active:translate-y-px focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60",
    variant ? variantClass[variant] : undefined,
    size ? sizeClass[size] : undefined,
    className,
  );
}

export function Button({
  variant,
  size,
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      className={buttonClassName({ variant, size, className })}
      {...props}
    />
  );
}
