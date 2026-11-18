/**
 * The black form. What we submit.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS IS NOT THEMED (2026-11-18)
 *
 * Every colour here is literal rather than a CSS variable, which is
 * the opposite of the rule everywhere else in the app. This is a
 * client-facing document, not an app surface. It has to look the same
 * in a browser, in a print dialogue, in a PDF, and in whatever mail
 * client renders the attachment, and it must not flip to a light
 * theme because the recipient's operating system prefers one. A
 * document that changes appearance depending on who opens it is not
 * a document.
 *
 * Jamar: "the white one was what we received, the black one is what
 * we submit." Only this one is built. The Builder's own view of the
 * same hours at their net rate is the remittance statement, which
 * already exists; rendering it twice would create two documents that
 * can disagree about one person's pay.
 *
 * WHAT IT RENDERS FROM
 *
 * A frozen snapshot, never live entries. The lines come off the
 * issued timesheet row. See the header on src/lib/timesheet.ts and
 * the same rule on remittances: the moment a document recomputes
 * itself from current state it stops being evidence.
 *
 * ON THE ARITHMETIC SHOWN
 *
 * Amounts are round-half-to-even, matching the canonical sheet.
 * Math.round would print $264.71 on the two 1.50-hour lines and make
 * the column sum to $2,514.72 beneath a header reading $2,514.70.
 * round2 in lib/timesheet.ts carries the detail.
 * ─────────────────────────────────────────────────────────────
 */
import {
  computeTotals,
  exclusionsNote,
  formatHours,
  formatMoney,
  lineAmount,
  lineAmountsSumTo,
  marker,
  markersUsed,
  periodLabel,
  shortDate,
  sortLines,
  type TimesheetExclusion,
  type TimesheetLine,
} from "@/lib/timesheet";

const INK = "#FFFFFF";
const MUTED = "#8A8F98";
const FAINT = "#6B7079";
const RULE = "#1E2026";
const PANEL = "#0C0D10";
const PAGE = "#000000";
const MAGENTA = "#D828A0";
const BLUE = "#5070F0";
const GREEN = "#1F9D6B";

export interface TimesheetDocumentProps {
  /** The engagement name, e.g. "CVC AV Translation System". */
  title: string;
  /** "Combined timesheet", or whatever this sheet is. */
  kindLabel: string;
  periodStart: string;
  periodEnd: string;
  /** Null on a first issue; set when this supersedes an earlier sheet. */
  revisedOn: string | null;
  hourlyRate: number;
  lines: TimesheetLine[];
  excluded: TimesheetExclusion[];
  /** "Eastern Time · nearest quarter-hour". */
  methodNote: string | null;
  /** Computed from the revision chain, never typed. */
  reconciliationSentence: string | null;
  /** Shown as a watermark until the sheet is issued. */
  draft?: boolean;
}

export function TimesheetDocument({
  title,
  kindLabel,
  periodStart,
  periodEnd,
  revisedOn,
  hourlyRate,
  lines,
  excluded,
  methodNote,
  reconciliationSentence,
  draft = false,
}: TimesheetDocumentProps) {
  const ordered = sortLines(lines);
  const totals = computeTotals(ordered, hourlyRate);
  const marks = markersUsed(ordered);
  const exclusions = exclusionsNote(excluded, shortDate);
  const { matchesTotal } = lineAmountsSumTo(ordered, hourlyRate);

  return (
    <article
      style={{
        backgroundColor: PAGE,
        color: INK,
        padding: "40px 36px 28px",
        maxWidth: 860,
        margin: "0 auto",
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      {/* Three-segment rule. The pillar colours, in order. */}
      <div style={{ display: "flex", height: 3, marginBottom: 28 }}>
        <div style={{ flex: 1, backgroundColor: MAGENTA }} />
        <div style={{ flex: 1, backgroundColor: BLUE }} />
        <div style={{ flex: 1, backgroundColor: GREEN }} />
      </div>

      {draft && (
        <p
          style={{
            margin: "0 0 20px",
            padding: "8px 12px",
            border: `1px solid ${MAGENTA}`,
            color: MAGENTA,
            fontSize: 11,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
          }}
        >
          Draft · not issued · figures may still change
        </p>
      )}

      {/* ── Masthead ─────────────────────────────────────── */}
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 24,
          marginBottom: 28,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <PrismMark />
          <div>
            <h1
              style={{
                margin: 0,
                fontSize: 27,
                fontWeight: 600,
                letterSpacing: "-0.01em",
              }}
            >
              {title}
            </h1>
            <p style={{ margin: "4px 0 0", color: MUTED, fontSize: 12.5 }}>
              {kindLabel} · {periodLabel(periodStart, periodEnd)}
            </p>
          </div>
        </div>
        <div
          style={{
            textAlign: "right",
            color: MUTED,
            fontSize: 11.5,
            lineHeight: 1.7,
            whiteSpace: "nowrap",
          }}
        >
          {revisedOn && (
            <div>
              Revised <span style={{ color: INK }}>{revisedOn}</span>
            </div>
          )}
          <div>
            Rate{" "}
            <span style={{ color: INK }}>{formatMoney(hourlyRate)}</span> /
            hour
          </div>
          {methodNote && <div>{methodNote}</div>}
        </div>
      </header>

      {/* ── The three figures, before any detail ─────────── */}
      <div style={{ display: "flex", gap: 14, marginBottom: 26 }}>
        <Stat label="Billable hours" value={formatHours(totals.hours)} accent={MAGENTA} />
        <Stat label="Hourly rate" value={formatMoney(hourlyRate)} accent={BLUE} />
        <Stat label="Amount due" value={formatMoney(totals.amount)} accent={GREEN} />
      </div>

      {/* ── Lines ────────────────────────────────────────── */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          backgroundColor: PANEL,
        }}
      >
        <thead>
          <tr>
            <Th style={{ width: 92 }}>
              Date
              <br />
              <span style={{ fontSize: 9 }}>({periodStart.slice(0, 4)})</span>
            </Th>
            <Th>Work performed</Th>
            <Th align="right" style={{ width: 86 }}>
              Hours
            </Th>
            <Th align="right" style={{ width: 104 }}>
              Amount
            </Th>
          </tr>
        </thead>
        <tbody>
          {ordered.length === 0 ? (
            <tr>
              <td
                colSpan={4}
                style={{
                  padding: "18px 16px",
                  color: FAINT,
                  borderTop: `1px solid ${RULE}`,
                }}
              >
                No billable hours recorded for this period.
              </td>
            </tr>
          ) : (
            ordered.map((line, i) => (
              <tr key={`${line.workDate}-${i}`}>
                <Td style={{ color: MAGENTA, whiteSpace: "nowrap" }}>
                  {shortDate(line.workDate)}
                </Td>
                <Td>{line.description}</Td>
                <Td align="right" style={{ whiteSpace: "nowrap" }}>
                  {formatHours(line.hours)}
                  {marker(line.precision) && (
                    <span style={{ color: MUTED }}>
                      {" "}
                      {marker(line.precision)}
                    </span>
                  )}
                </Td>
                <Td align="right" style={{ whiteSpace: "nowrap" }}>
                  {formatMoney(lineAmount(line, hourlyRate))}
                </Td>
              </tr>
            ))
          )}
          <tr>
            <Td
              style={{
                borderTop: `1px solid ${RULE}`,
                fontSize: 14,
                paddingTop: 14,
                paddingBottom: 14,
              }}
            >
              Total
            </Td>
            <Td
              style={{
                borderTop: `1px solid ${RULE}`,
                color: MUTED,
                paddingTop: 14,
                paddingBottom: 14,
              }}
            >
              Cumulative, {shortDate(periodStart)} – {shortDate(periodEnd)}
            </Td>
            <Td
              align="right"
              style={{
                borderTop: `1px solid ${RULE}`,
                fontSize: 14,
                paddingTop: 14,
                paddingBottom: 14,
                whiteSpace: "nowrap",
              }}
            >
              {formatHours(totals.hours)}
            </Td>
            <Td
              align="right"
              style={{
                borderTop: `1px solid ${RULE}`,
                fontSize: 14,
                paddingTop: 14,
                paddingBottom: 14,
                whiteSpace: "nowrap",
              }}
            >
              {formatMoney(totals.amount)}
            </Td>
          </tr>
        </tbody>
      </table>

      {/* ── Notes ────────────────────────────────────────── */}
      <div style={{ marginTop: 18, color: MUTED, fontSize: 11.5, lineHeight: 1.65 }}>
        {reconciliationSentence && (
          <p style={{ margin: "0 0 8px" }}>
            <span style={{ color: INK, fontWeight: 600 }}>
              Reconciliation.
            </span>{" "}
            {reconciliationSentence}
          </p>
        )}

        {(marks.estimated || marks.provisional || exclusions) && (
          <p style={{ margin: "0 0 8px" }}>
            {marks.estimated && <>* Estimated time. </>}
            {marks.provisional && <>† Start and break times provisional. </>}
            {exclusions}
          </p>
        )}

        {/*
          Only when it actually happens. Half-to-even keeps the column
          and the total in agreement on nearly every sheet, but a
          document should say so rather than let a client find a
          discrepancy and wonder what else is off.
        */}
        {!matchesTotal && (
          <p style={{ margin: "0 0 8px" }}>
            Line amounts are rounded to the cent. The total is
            calculated on exact hours, so it may differ from the
            column by a penny.
          </p>
        )}
      </div>

      {/* ── Footer ───────────────────────────────────────── */}
      <footer
        style={{
          marginTop: 30,
          paddingTop: 16,
          borderTop: `1px solid ${RULE}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          color: FAINT,
          fontSize: 10.5,
          letterSpacing: "0.08em",
        }}
      >
        <span style={{ textTransform: "uppercase" }}>
          Future Modern Builderberg LLC
        </span>
        <span style={{ letterSpacing: "0.02em" }}>
          Jamar@afuturemodern.com · (919) 830-2903 · afuturemodern.com
        </span>
      </footer>
    </article>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      style={{
        flex: 1,
        backgroundColor: PANEL,
        borderTop: `2px solid ${accent}`,
        padding: "14px 16px 16px",
      }}
    >
      <div
        style={{
          color: MUTED,
          fontSize: 9.5,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div style={{ marginTop: 8, fontSize: 25, fontWeight: 600 }}>
        {value}
      </div>
    </div>
  );
}

function Th({
  children,
  align = "left",
  style,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  style?: React.CSSProperties;
}) {
  return (
    <th
      style={{
        textAlign: align,
        padding: "10px 16px",
        color: BLUE,
        fontSize: 9.5,
        fontWeight: 600,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        verticalAlign: "bottom",
        ...style,
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  style,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  style?: React.CSSProperties;
}) {
  return (
    <td
      style={{
        textAlign: align,
        padding: "11px 16px",
        borderTop: `1px solid ${RULE}`,
        verticalAlign: "top",
        ...style,
      }}
    >
      {children}
    </td>
  );
}

/**
 * The prism mark, drawn rather than loaded.
 *
 * An <img> would need a URL that resolves wherever this document is
 * opened, including a print dialogue and a saved PDF, and a broken
 * logo on a billing document is worse than none. Inline SVG travels
 * with the markup.
 */
function PrismMark() {
  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 44 44"
      aria-hidden="true"
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="fm-prism" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={MAGENTA} />
          <stop offset="55%" stopColor={BLUE} />
          <stop offset="100%" stopColor={GREEN} />
        </linearGradient>
      </defs>
      <path
        d="M22 4 L38 13 L38 31 L22 40 L6 31 L6 13 Z"
        fill="none"
        stroke="url(#fm-prism)"
        strokeWidth="1.6"
      />
      <path
        d="M22 4 L22 40 M6 13 L38 31 M38 13 L6 31"
        stroke="url(#fm-prism)"
        strokeWidth="1"
        opacity="0.65"
      />
      <circle cx="22" cy="22" r="3.4" fill={MAGENTA} />
    </svg>
  );
}
