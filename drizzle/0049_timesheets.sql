-- Timesheets: the evidence behind an hourly invoice line.
--
-- ─────────────────────────────────────────────────────────────
-- WHY (2026-11-18)
--
-- Jamar: "Can we canonize this format for timesheets?" The format is
-- the CVC AV Translation System combined timesheet, built by hand
-- outside the app. Until now an hourly engagement produced an invoice
-- with a number on it and nothing anywhere saying which days the
-- hours were worked or what was done on them. That is the first thing
-- a client asks when they query a bill, and the answer lived in a PDF
-- on somebody's laptop.
--
-- TWO TABLES, NOT ONE
--
-- time_entries is the live record: what was worked, editable while
-- the engagement runs.
--
-- timesheets is a document issued from those entries at a moment in
-- time, and it SNAPSHOTS its lines rather than joining back. Same
-- rule as remittances, for the same reason written on that file: the
-- moment a document reconstructs its figures from current state it
-- stops being evidence. A client holding a timesheet saying 14.25
-- hours must still see 14.25 hours next year, after somebody has
-- corrected a description or logged more work.
--
-- WHY A REVISION CHAIN
--
-- The CVC sheet reads "Combined timesheet" and carries a
-- reconciliation line: previously reported 8.25 hours plus 6.00 of
-- additional work, earlier hours counted once. That is a document
-- superseding an earlier one, which is the normal case for ongoing
-- work and the exact place double-billing happens. supersedes_id
-- makes the chain explicit so the reconciliation is computed rather
-- than typed.
--
-- WHY THE RATE IS ON THE DOCUMENT
--
-- projects.engagement_rate can be renegotiated. The rate that was
-- billed is a fact about the document, not about the project as it
-- stands today.
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS time_entries (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- Who did the work. Not necessarily who logs it: an admin records
  -- time for a Builder who reported it by text.
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  logged_by_user_id text REFERENCES users(id) ON DELETE SET NULL,
  -- A calendar day, not an instant. The document says "Aug 25", and
  -- storing a timestamp would invent a precision nobody recorded.
  work_date date NOT NULL,
  hours numeric(6, 2) NOT NULL,
  description text NOT NULL,
  -- Drives the * and † marks on the rendered sheet. "exact" is a
  -- measured figure; "estimated" is a good-faith reconstruction;
  -- "provisional" is a start or break time still unconfirmed.
  -- Marking these on the document rather than quietly rounding is
  -- what makes it defensible when queried.
  precision text NOT NULL DEFAULT 'exact',
  -- No-charge, written-off and unpriced work. Kept rather than
  -- deleted: "Sep 2; Nov 5 reverted visitor changes; Nov 9; Nov 10"
  -- appears on the CVC sheet as work done and not billed, which is
  -- worth more to a client relationship than silence.
  billable boolean NOT NULL DEFAULT true,
  exclusion_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT time_entries_hours_positive CHECK (hours > 0),
  CONSTRAINT time_entries_precision_known
    CHECK (precision IN ('exact', 'estimated', 'provisional')),
  -- A non-billable entry has to say why. An unexplained zero-charge
  -- line is indistinguishable from a mistake.
  CONSTRAINT time_entries_exclusion_explained
    CHECK (billable OR exclusion_reason IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS time_entries_project_date_idx
  ON time_entries (project_id, work_date);

CREATE TABLE IF NOT EXISTS timesheets (
  id text PRIMARY KEY,
  project_id text NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  -- Null until issued. A draft is a working view; issuing is what
  -- makes it a document somebody can be shown.
  issued_at timestamptz,
  -- SET NULL rather than CASCADE: deleting a superseded timesheet
  -- must not take the current one with it.
  supersedes_id text REFERENCES timesheets(id) ON DELETE SET NULL,
  title text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  -- Client-facing gross, snapshotted. The Builder's net is derived
  -- from the split and never stored twice.
  hourly_rate numeric(12, 2) NOT NULL,
  -- The lines, frozen. Shape matches TimesheetLine in
  -- src/lib/timesheet.ts.
  lines jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Work done and deliberately not charged, carried as its own list
  -- so the note can name the dates.
  excluded jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_hours numeric(8, 2) NOT NULL,
  total_amount numeric(12, 2) NOT NULL,
  -- Hours already reported on the superseded sheet, so the
  -- reconciliation line is computed from the chain.
  prior_hours numeric(8, 2) NOT NULL DEFAULT 0,
  -- How time was measured, shown in the header. Free text because
  -- "Eastern Time · nearest quarter-hour" is a claim about method,
  -- not an enum we can usefully constrain.
  method_note text,
  -- The invoice this sheet is the evidence for. Jamar: "the output
  -- should be the black form we send to clients with invoice."
  --
  -- Nullable and on the timesheet rather than the invoice, because
  -- the sheet is usually issued first: an admin totals the hours,
  -- then raises an invoice for that figure. SET NULL so voiding an
  -- invoice does not destroy the record of work behind it.
  invoice_id text REFERENCES invoices(id) ON DELETE SET NULL,
  -- The credential for the client-facing view, same pattern as
  -- invoices and receipts. Null until issued.
  client_token text UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT timesheets_period_ordered CHECK (period_end >= period_start),
  CONSTRAINT timesheets_not_self_superseding CHECK (supersedes_id <> id)
);

CREATE INDEX IF NOT EXISTS timesheets_project_idx
  ON timesheets (project_id, period_end DESC);
