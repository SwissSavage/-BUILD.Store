/**
 * /timesheets/[token] — the black form, as the client sees it.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS PATH IS NOT IN THE MIDDLEWARE MATCHER (2026-11-18)
 *
 * The token IS the credential, same as /invoices/[token],
 * /quotes/[token] and /receipts/[token]. Clients do not have
 * $BUILD.Store logins and are not going to get one.
 *
 * This is worth stating explicitly because the matcher has now eaten
 * this exact class of surface twice: once for quotes, receipts,
 * feedback and trackers, fixed on 2026-10-24, and again for
 * /projects, fixed on 2026-11-13 after Rob was bounced to a sign-in
 * page. The matcher matches a URL PATH, not a route group, and
 * nobody testing a client link is ever signed out. If a future
 * entry gates /timesheets, every sheet we have sent stops opening.
 *
 * getTimesheetByToken returns only ISSUED sheets, so a draft token
 * resolves to nothing rather than showing a client figures that are
 * still being worked out.
 * ─────────────────────────────────────────────────────────────
 */
import { notFound } from "next/navigation";
import { TimesheetDocument } from "@/components/TimesheetDocument";
import {
  getTimesheetById,
  getTimesheetByToken,
} from "@/lib/readers/timesheets";
import {
  num,
  reconcile,
  shortDate,
  type TimesheetExclusion,
  type TimesheetLine,
} from "@/lib/timesheet";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Timesheet — Future Modern",
  // Never indexed. It is somebody's billing detail behind a token.
  robots: { index: false, follow: false },
};

export default async function ClientTimesheetPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const sheet = await getTimesheetByToken(token);
  if (!sheet) notFound();

  // The reconciliation sentence is recomputed from the frozen lines
  // of this sheet and the frozen lines of the one it superseded.
  // Both are snapshots, so this is deterministic rather than a read
  // of current state: the sentence a client saw on the day cannot
  // drift afterwards.
  const prior = sheet.supersedesId
    ? await getTimesheetById(sheet.supersedesId)
    : null;

  const lines = (sheet.lines ?? []) as TimesheetLine[];
  const priorLines = ((prior?.lines ?? []) as TimesheetLine[]) ?? [];
  const recon = reconcile(lines, priorLines, shortDate);

  return (
    <div style={{ backgroundColor: "#000000", minHeight: "100vh" }}>
      <TimesheetDocument
        title={sheet.title}
        kindLabel={prior ? "Combined timesheet" : "Timesheet"}
        periodStart={sheet.periodStart}
        periodEnd={sheet.periodEnd}
        revisedOn={
          prior && sheet.issuedAt
            ? new Date(sheet.issuedAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
                timeZone: "America/New_York",
              })
            : null
        }
        hourlyRate={num(sheet.hourlyRate)}
        lines={lines}
        excluded={(sheet.excluded ?? []) as TimesheetExclusion[]}
        methodNote={sheet.methodNote}
        reconciliationSentence={recon.sentence}
      />
    </div>
  );
}
