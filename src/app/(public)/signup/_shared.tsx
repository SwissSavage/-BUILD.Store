/**
 * Shared presentational bits for the three signup-intent pages.
 *
 * Only layout + the generic contact fields live here — per-intent
 * content (JD brief, team scope, portfolio link) stays inline in the
 * individual pages so each page reads top-to-bottom on its own.
 */
import Link from "next/link";
import { INDUSTRY_LABELS, type Industry } from "@/lib/types";

export const INDUSTRY_OPTIONS: Industry[] = [
  "stem",
  "creative-media",
  "professional-services",
];

export function Field({
  name,
  label,
  type = "text",
  required = false,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-ink-muted">
        {label}
      </span>
      <input
        name={name}
        type={type}
        required={required}
        className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
      />
    </label>
  );
}

export function ContactFields({ showPillarSelect = true }: { showPillarSelect?: boolean } = {}) {
  return (
    <>
      <div className="grid gap-4 md:grid-cols-2">
        <Field name="firstName" label="First name" required />
        <Field name="lastName" label="Last name" required />
        <Field name="email" label="Email" type="email" required />
        <Field name="company" label="Company (optional)" />
      </div>

      {showPillarSelect && (
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-brand-magenta">
            Pillar
          </span>
          <select
            name="industry"
            className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
            defaultValue="creative-media"
          >
            {INDUSTRY_OPTIONS.map((i) => (
              <option key={i} value={i}>
                {INDUSTRY_LABELS[i]}
              </option>
            ))}
          </select>
        </label>
      )}
    </>
  );
}

/**
 * Multi-select pillar block for cross-discipline intakes ($BUILD a team).
 * Submits as repeated `pillars` form values. At least one is required;
 * the field validates client-side via `required` on the first checkbox
 * and server-side in `handleSignup`.
 */
export function PillarMultiSelect() {
  return (
    <fieldset className="space-y-3">
      <legend className="text-xs uppercase tracking-wider text-brand-magenta">
        Pillars (select all that apply)
      </legend>
      <p className="text-xs text-ink-muted">
        Cross-pillar engagements are common. Pick every discipline this
        team needs to cover — we balance the squad against your scope.
      </p>
      <div className="grid gap-2 md:grid-cols-3">
        {INDUSTRY_OPTIONS.map((i) => (
          <label
            key={i}
            className="flex items-center gap-2 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
          >
            <input type="checkbox" name="pillars" value={i} />
            <span>{INDUSTRY_LABELS[i]}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/**
 * JD / role-spec uploader. Accepts PDF, DOCX, DOC, TXT, MD up to 10MB
 * each. Sandbox logs the file metadata via `crm-stub`; production swap
 * uploads to object storage (S3 or uploadthing) and persists URLs on
 * the lead record.
 */
export function JdUploadField({
  label = "Upload JDs / role specs (optional)",
  helper = "Attach role descriptions, scope docs, or briefs. PDF, DOCX, DOC, TXT, MD up to 10MB each.",
}: {
  label?: string;
  helper?: string;
} = {}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-brand-magenta">
        {label}
      </span>
      <p className="mt-1 text-xs text-ink-muted">{helper}</p>
      <input
        name="jdUploads"
        type="file"
        multiple
        accept=".pdf,.doc,.docx,.txt,.md,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,text/markdown"
        className="mt-2 block w-full text-xs text-ink-muted file:mr-3 file:rounded-full file:border file:border-[var(--surface-border)] file:bg-[var(--surface-inset)] file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-ink"
      />
    </label>
  );
}

export function SignupHeader({
  eyebrow,
  headline,
  blurb,
}: {
  eyebrow: string;
  headline: string;
  blurb: string;
}) {
  return (
    <>
      <Link
        href="/signup"
        className="text-sm text-ink-muted hover:text-brand-magenta"
      >
        ← Pick a different path
      </Link>
      <p className="mt-6 text-xs uppercase tracking-wider text-brand-magenta">
        {eyebrow}
      </p>
      <h1 className="mt-2 font-display text-4xl font-semibold md:text-5xl">
        {headline}
      </h1>
      <p className="mt-3 text-ink-muted">{blurb}</p>
    </>
  );
}

export function SubmitRow() {
  return (
    <>
      <button
        type="submit"
        className="w-full rounded-full bg-ink py-3 font-medium text-[var(--surface)] transition-colors hover:bg-brand-magenta hover:text-brand-white"
      >
        Submit
      </button>
      <p className="mt-4 text-xs text-ink-faint">
        Submission is logged to the CRM stub (server console). Production
        wires this to HubSpot with the correct pipeline per intent.
      </p>
    </>
  );
}
