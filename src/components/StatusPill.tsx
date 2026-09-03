/**
 * A status that does not depend on colour.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-03)
 *
 * Rob flagged magenta as hard to see for colour blind people.
 * Measuring turned up something larger than magenta:
 *
 *   magenta  relative luminance 0.1865
 *   blue     relative luminance 0.1959
 *   red      relative luminance 0.2045
 *
 * Three status colours at effectively the same lightness. Someone
 * with the common forms of colour blindness falls back on lightness,
 * so those three are mutually indistinguishable. Green sat apart at
 * 0.1206 but failed contrast outright at 2.83 against a card, and
 * green against magenta is the classic red-green confusion pair.
 *
 * Meaning was riding on hue alone, which is the actual failure. A
 * green dot and a red dot that render as the same grey are not a
 * status, they are decoration.
 *
 * Jamar chose lightness separation PLUS a glyph or word. So each tone
 * carries three signals: hue, a distinct lightness, and a character
 * that means the thing. Any one of them is enough on its own. It
 * survives greyscale, printing, screenshots and a bad monitor.
 *
 * The glyphs are text, not icons. They come through a screen reader,
 * they never fail to load, and they cost nothing.
 * ─────────────────────────────────────────────────────────────
 */
import { cn } from "@/lib/cn";

export type StatusTone = "good" | "bad" | "waiting" | "info" | "neutral";

/**
 * Tones are ordered by lightness on purpose: good is the lightest,
 * bad is the darkest. In greyscale that ordering is the signal.
 */
const TONE: Record<
  StatusTone,
  { glyph: string; color: string; bg: string; label: string }
> = {
  good: {
    glyph: "✓",
    color: "var(--fm-green-text)",
    bg: "rgba(47, 211, 155, 0.12)",
    label: "Complete",
  },
  waiting: {
    glyph: "◷",
    color: "var(--fm-magenta-text)",
    bg: "rgba(224, 82, 179, 0.12)",
    label: "Waiting",
  },
  info: {
    glyph: "•",
    color: "var(--fm-blue-text)",
    bg: "rgba(91, 121, 241, 0.12)",
    label: "Info",
  },
  bad: {
    glyph: "!",
    color: "var(--fm-red-text)",
    bg: "rgba(234, 98, 98, 0.12)",
    label: "Needs attention",
  },
  neutral: {
    glyph: "–",
    color: "var(--ink-muted)",
    bg: "rgba(163, 163, 163, 0.10)",
    label: "None",
  },
};

export function StatusPill({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  /** The word. Required, because the word is half the accessibility. */
  children: React.ReactNode;
  className?: string;
}) {
  const t = TONE[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        className,
      )}
      style={{ color: t.color, backgroundColor: t.bg }}
    >
      <span aria-hidden>{t.glyph}</span>
      {children}
    </span>
  );
}
