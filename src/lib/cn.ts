/**
 * Tailwind class merger.
 * Wraps `clsx` for conditional joins + `tailwind-merge` to dedupe conflicts.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
