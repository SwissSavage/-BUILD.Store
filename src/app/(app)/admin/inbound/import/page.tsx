/**
 * /admin/inbound/import — one-shot CSV importer for Google-form
 * talent-roster exports (task #47).
 *
 * Admin uploads the CSV, importInboundCsv parses + fuzzy-maps
 * headers + inserts one inbound_submissions row per data row with
 * kind = join_talent_signup. From there the standard triage flow at
 * /admin/inbound handles vetting, tag review, and promote-to-invite.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-stub";
import { importInboundCsv } from "@/lib/csv-import-actions";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

export default async function InboundCsvImportPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href="/admin/inbound"
        className="text-sm text-ink-muted hover:text-ink"
      >
        ← Inbound queue
      </Link>
      <div className="mt-3">
        <CardEyebrow>CSV import</CardEyebrow>
      </div>
      <h1 className="mt-2 font-display text-4xl font-semibold">
        Import talent roster from CSV
      </h1>
      <p className="mt-2 max-w-xl text-sm text-ink-muted">
        Upload a Google-Forms export (or any similarly-shaped CSV).
        Each row lands in the inbound queue as a join_talent_signup
        submission and follows the standard triage flow from there.
      </p>

      <Card className="mt-6">
        <form
          action={importInboundCsv}
          className="space-y-4"
          encType="multipart/form-data"
        >
          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-ink-muted">
              CSV file (max 5 MB)
            </span>
            <input
              type="file"
              name="csv"
              accept=".csv,text/csv"
              required
              className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-[var(--fm-grad-from)] file:text-black file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
            />
          </label>

          <button
            type="submit"
            className="fm-btn-primary rounded-full px-5 py-2 text-sm font-medium"
          >
            Import to inbound queue
          </button>
          <p className="text-[11px] text-ink-faint">
            After import, review the new rows at{" "}
            <Link
              href="/admin/inbound"
              className="text-brand-magentaText hover:underline"
            >
              /admin/inbound
            </Link>{" "}
            and promote qualified applicants to invites from there.
          </p>
        </form>
      </Card>

      <Card className="mt-6">
        <CardTitle>Column mapping (fuzzy)</CardTitle>
        <p className="mt-1 text-xs text-ink-muted">
          The importer infers columns by header name. Rename or leave
          them as-is — matching is case-insensitive and forgiving:
        </p>
        <ul className="mt-3 space-y-1 text-xs text-ink">
          <li>
            <strong>Name:</strong> "Full name", "Name", or "First
            name" + "Last name" (split)
          </li>
          <li>
            <strong>Email:</strong> "Email", "Email address", "E-mail"
          </li>
          <li>
            <strong>Company:</strong> "Company", "Organization",
            "Studio", "Employer"
          </li>
          <li>
            <strong>Pillar:</strong> "Pillar", "Industry", "Sector" —
            values inferred from keywords (STEM / engineer / dev,
            creative / media / art / music / design, professional /
            services / strategy / ops / sales / marketing)
          </li>
          <li>
            <strong>Discipline:</strong> "Discipline", "Role",
            "Title", "Practice"
          </li>
          <li>
            <strong>Skills:</strong> "Skills", "Skill tags",
            "Expertise" — comma / space / semicolon separated
          </li>
          <li>
            <strong>Portfolio:</strong> "Portfolio", "Portfolio URL",
            "URL", "Website"
          </li>
          <li>
            <strong>Message:</strong> "Message", "Pitch", "About",
            "Notes", "Bio", "Summary"
          </li>
        </ul>
        <p className="mt-3 text-[11px] text-ink-faint">
          Rows without a name or email are skipped silently (defensive
          against trailing empty rows). Invalid email format skips the
          row with a reason on the audit log.
        </p>
      </Card>
    </div>
  );
}
