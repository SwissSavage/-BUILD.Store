/**
 * Timesheets: the evidence behind an hourly invoice.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-11-18)
 *
 * Jamar: "the white one was what we received, the black one is what
 * we submit. When we collect time sheets through the app, they should
 * put in their hours against the fixed contract rate attached to the
 * deal and the output should be the black form we send to clients
 * with invoice."
 *
 * Two PDFs arrived covering the same 14.25 hours on CVC AV
 * Translation System. One at $150.00/hr totalling $2,137.50, one at
 * $176.47/hr totalling $2,514.70. $176.47 is $150 / 0.85 and
 * $2,514.70 x 0.85 = $2,137.50 to the penny: the two ends of the 85
 * percent split on one engagement.
 *
 * Only the client-facing end is built here. The Builder's own net
 * view already exists as the remittance statement, so modelling it
 * twice would create two documents that can disagree about one
 * person's pay.
 *
 * WHAT IT REPLACES: an hourly engagement produced an invoice with a
 * number on it and nothing, anywhere, recording which days were
 * worked or what was done on them. That is the first question a
 * client asks when they query a bill.
 *
 * ─────────────────────────────────────────────────────────────
 * THE BUILDER NEVER TYPES A RATE
 *
 * Hours and a description, nothing else. The rate comes off
 * projects.engagementRate, which is already documented "Client-facing
 * rate or total. Never shown to the Builder." Letting a Builder enter
 * the figure the client is billed would invite exactly the confusion
 * the two PDFs represent.
 *
 * ─────────────────────────────────────────────────────────────
 * ROUNDING IS HALF-TO-EVEN, AND THAT IS NOT A STYLE CHOICE
 *
 * Checked against every line of the CVC sheet before writing this.
 * The canonical document rounds half to even, and Math.round does
 * not: it rounds half away from zero.
 *
 * It shows up on exactly the lines where the cent is a dead heat.
 * 1.50 x 176.47 = 264.7050. Half-even gives $264.70, which is what
 * the PDF says. Math.round gives $264.71. There are two such lines,
 * so the naive version prints a column that adds to $2,514.72 under
 * a header reading $2,514.70, and a billing document that disagrees
 * with its own arithmetic by two cents is the kind of thing a client
 * notices and then stops trusting the rest of.
 *
 * Hence round2 below, which is half-even, and is why it is not the
 * one-liner it looks like it should be.
 *
 * Totals are computed from UNROUNDED hours x rate and rounded once:
 * 14.25 x 176.47 = 2514.6975 -> $2,514.70. On this sheet the rounded
 * lines happen to sum to the same figure, which is luck rather than
 * a guarantee, so lineAmountsSumTo exists to notice when they do not.
 *
 * ─────────────────────────────────────────────────────────────
 * THE RECONCILIATION SENTENCE IS WHERE DOUBLE BILLING HAPPENS
 *
 * The CVC sheet reads: "Includes the previously reported 8.25 hours
 * (Aug 25, Aug 27, Sep 8) plus 6.00 hours of additional work (Sep 30
 * – Nov 17). Earlier hours are counted once."
 *
 * That sentence is the difference between a combined sheet and
 * invoicing the same morning twice. It is computed from the revision
 * chain rather than typed, because a human retyping it is precisely
 * the failure it guards against.
 *
 * NO DATABASE IMPORTS. Pure, so the arithmetic above can be checked
 * without a connection and the shapes can cross to a client
 * component.
 * ─────────────────────────────────────────────────────────────
 */

export type TimePrecision = "exact" | "estimated" | "provisional";

/** A line as frozen onto an issued sheet. */
export interface TimesheetLine {
  /** ISO date, YYYY-MM-DD. */
  workDate: string;
  description: string;
  hours: number;
  precision: TimePrecision;
}

/** Work done and deliberately not charged. */
export interface TimesheetExclusion {
  workDate: string;
  description: string;
  reason: string;
}

export interface TimesheetTotals {
  /** Sum of billable hours, exact. */
  hours: number;
  /** hours x rate, rounded once. */
  amount: number;
}

/**
 * Round to cents, half to even. See the header: Math.round is half
 * away from zero and prints $264.71 where the canonical sheet says
 * $264.70.
 *
 * The epsilon is not decoration. 1.5 * 176.47 in binary floating
 * point is 264.70500000000004, not 264.705, so a bare check for
 * "exactly half" never fires and the tie-breaking rule would be dead
 * code that silently did nothing. Scaling and comparing within a
 * tolerance is what makes the half-even branch reachable at all.
 */
export function round2(n: number): number {
  const scaled = n * 100;
  const floor = Math.floor(scaled);
  const diff = scaled - floor;
  const EPS = 1e-9;

  if (Math.abs(diff - 0.5) < EPS) {
    // Dead heat: take the even cent.
    const even = floor % 2 === 0 ? floor : floor + 1;
    return even / 100;
  }
  return Math.round(scaled) / 100;
}

/**
 * numeric() comes back as a string from node-postgres, and three
 * money pages threw over exactly this. See #94.
 */
export function num(v: string | number | null | undefined): number {
  if (v === null || v === undefined) return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Hours carry two decimals and quarter-hours must read as .25, not .3. */
export function formatHours(h: number): string {
  return h.toFixed(2);
}

export function formatMoney(n: number): string {
  return `$${n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** What one line is worth, for display only. Never summed into a total. */
export function lineAmount(line: TimesheetLine, rate: number): number {
  return round2(line.hours * rate);
}

/**
 * The totals, computed from unrounded hours. See the rounding note in
 * the header: this is deliberately not a sum of lineAmount().
 */
export function computeTotals(
  lines: TimesheetLine[],
  rate: number,
): TimesheetTotals {
  const hours = lines.reduce((sum, l) => sum + l.hours, 0);
  return { hours: round2(hours), amount: round2(hours * rate) };
}

/**
 * Whether the displayed line amounts happen to add up to the
 * displayed total. They usually do; when they do not, it is the
 * rounding described in the header and the document should say so
 * rather than quietly disagreeing with itself.
 */
export function lineAmountsSumTo(
  lines: TimesheetLine[],
  rate: number,
): { sum: number; matchesTotal: boolean } {
  const sum = round2(
    lines.reduce((acc, l) => acc + lineAmount(l, rate), 0),
  );
  return { sum, matchesTotal: sum === computeTotals(lines, rate).amount };
}

/** Which marks this sheet actually needs in its footnotes. */
export function markersUsed(lines: TimesheetLine[]): {
  estimated: boolean;
  provisional: boolean;
} {
  return {
    estimated: lines.some((l) => l.precision === "estimated"),
    provisional: lines.some((l) => l.precision === "provisional"),
  };
}

/** The * or † that follows the hours on a line. */
export function marker(p: TimePrecision): string {
  if (p === "estimated") return "*";
  if (p === "provisional") return "†";
  return "";
}

export interface Reconciliation {
  /** Hours already reported on the sheet this one supersedes. */
  priorHours: number;
  /** Hours on this sheet that were not on the previous one. */
  additionalHours: number;
  /** Dates making up the prior block, in order. */
  priorDates: string[];
  /** Dates making up the additional block, in order. */
  additionalDates: string[];
  /** Null when this is a first sheet and there is nothing to reconcile. */
  sentence: string | null;
}

/**
 * Split this sheet's lines into "already reported" and "new since".
 *
 * Matching is by date and hours rather than by entry id, because the
 * prior sheet is a frozen snapshot: its lines carry no ids, and an
 * entry can legitimately have been edited since. Two entries on the
 * same day for the same duration are indistinguishable, which is
 * correct here. The question being answered is "how many of these
 * hours did we already bill", and the answer does not depend on which
 * of two identical half-hours it was.
 */
export function reconcile(
  lines: TimesheetLine[],
  priorLines: TimesheetLine[],
  formatDate: (iso: string) => string,
): Reconciliation {
  if (priorLines.length === 0) {
    return {
      priorHours: 0,
      additionalHours: round2(lines.reduce((s, l) => s + l.hours, 0)),
      priorDates: [],
      additionalDates: lines.map((l) => l.workDate),
      sentence: null,
    };
  }

  // Consume the prior lines as they match, so a day that appears
  // twice this time and once before counts as one prior and one new.
  const remaining = priorLines.map((l) => ({
    key: `${l.workDate}|${l.hours}`,
    used: false,
  }));

  const prior: TimesheetLine[] = [];
  const additional: TimesheetLine[] = [];
  for (const line of lines) {
    const key = `${line.workDate}|${line.hours}`;
    const hit = remaining.find((r) => !r.used && r.key === key);
    if (hit) {
      hit.used = true;
      prior.push(line);
    } else {
      additional.push(line);
    }
  }

  const priorHours = round2(prior.reduce((s, l) => s + l.hours, 0));
  const additionalHours = round2(
    additional.reduce((s, l) => s + l.hours, 0),
  );

  const span = (ls: TimesheetLine[]): string => {
    if (ls.length === 0) return "";
    if (ls.length <= 3) {
      return ls.map((l) => formatDate(l.workDate)).join(", ");
    }
    return `${formatDate(ls[0].workDate)} – ${formatDate(
      ls[ls.length - 1].workDate,
    )}`;
  };

  const parts: string[] = [];
  if (priorHours > 0) {
    parts.push(
      `Includes the previously reported ${formatHours(priorHours)} hours (${span(prior)})`,
    );
  }
  if (additionalHours > 0) {
    parts.push(
      `${parts.length > 0 ? "plus" : "Includes"} ${formatHours(
        additionalHours,
      )} hours of additional work (${span(additional)})`,
    );
  }

  return {
    priorHours,
    additionalHours,
    priorDates: prior.map((l) => l.workDate),
    additionalDates: additional.map((l) => l.workDate),
    sentence:
      parts.length > 0
        ? `${parts.join(" ")}. Earlier hours are counted once.`
        : null,
  };
}

/**
 * The exclusions footnote: "No-charge, written-off and unpriced work
 * is excluded (Sep 2; Nov 5 reverted visitor changes; Nov 9; Nov 10)."
 *
 * Named rather than silently dropped. Work done for free is worth
 * more to a client relationship when the client knows about it.
 */
export function exclusionsNote(
  excluded: TimesheetExclusion[],
  formatDate: (iso: string) => string,
): string | null {
  if (excluded.length === 0) return null;
  const items = excluded.map((e) => {
    const d = formatDate(e.workDate);
    const r = e.reason?.trim();
    // The CVC sheet reads "Nov 5 reverted visitor changes" — the
    // reason only earns its space when it says something the date
    // does not.
    return r && r.toLowerCase() !== "no-charge" ? `${d} ${r}` : d;
  });
  return `No-charge, written-off and unpriced work is excluded (${items.join("; ")}).`;
}

/** Sorted by date, which is the order the document reads in. */
export function sortLines(lines: TimesheetLine[]): TimesheetLine[] {
  return [...lines].sort((a, b) => a.workDate.localeCompare(b.workDate));
}

/** "Aug 25". The document's own date style. */
export function shortDate(iso: string): string {
  // Parsed as UTC deliberately. new Date("2026-08-25") is midnight
  // UTC, and formatting that in a negative-offset timezone renders
  // Aug 24. A date column has no timezone and must not acquire one on
  // the way to the page.
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const MONTHS = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${MONTHS[m - 1]} ${d}`;
}

/** "August 25 – November 17, 2026" for the header. */
export function periodLabel(startIso: string, endIso: string): string {
  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const [sy, sm, sd] = startIso.split("-").map(Number);
  const [ey, em, ed] = endIso.split("-").map(Number);
  if (!sy || !ey) return `${startIso} – ${endIso}`;
  const start = `${MONTHS[sm - 1]} ${sd}`;
  const end = `${MONTHS[em - 1]} ${ed}`;
  return sy === ey
    ? `${start} – ${end}, ${ey}`
    : `${start}, ${sy} – ${end}, ${ey}`;
}
