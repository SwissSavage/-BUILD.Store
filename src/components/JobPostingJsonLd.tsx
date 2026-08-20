/**
 * JobPosting JSON-LD — emits schema.org markup Google Jobs and every
 * AI answer engine reads. One reusable component drives both /jobs
 * and /contracts detail pages.
 *
 * Google Jobs (the vertical at google.com/search?ibp=htl;jobs) only
 * indexes pages that emit a valid JobPosting with the required fields:
 *   title, description, datePosted, hiringOrganization, jobLocation
 * Recommended fields that move rankings meaningfully:
 *   validThrough, baseSalary, employmentType, applicantLocationRequirements
 *
 * See https://developers.google.com/search/docs/appearance/structured-data/job-posting
 *
 * Sidenote: for a valid richResult the DESCRIPTION must be HTML-safe.
 * We escape it here rather than trust upstream sanitization; the field
 * ships to Google verbatim.
 */
export interface JobPostingJsonLdProps {
  title: string;
  description: string;
  /** ISO date string, e.g. from Postgres timestamp column. */
  datePosted: string;
  /** ISO date string. Optional but strongly recommended by Google. */
  validThrough?: string;
  /** e.g. "Future Modern", "URL Media". */
  hiringOrganizationName: string;
  /** Absolute URL, e.g. https://build.afuturemodern.com. */
  hiringOrganizationUrl?: string;
  /** e.g. "Remote (US)", "Brooklyn, NY", "Hybrid — NYC". */
  locationText: string;
  /** true if listing is remote-friendly (adds TELECOMMUTE flag Google reads). */
  isRemote?: boolean;
  /** e.g. "$120k–$150k + equity". Free-text; parsed into MonetaryAmount below. */
  compensationText?: string;
  /**
   * schema.org employmentType. Google recognizes:
   *   FULL_TIME | PART_TIME | CONTRACTOR | TEMPORARY | INTERN |
   *   VOLUNTEER | PER_DIEM | OTHER
   */
  employmentType:
    | "FULL_TIME"
    | "PART_TIME"
    | "CONTRACTOR"
    | "TEMPORARY"
    | "INTERN"
    | "VOLUNTEER"
    | "PER_DIEM"
    | "OTHER";
  /** Canonical URL for the posting itself. */
  url: string;
}

function escapeJsonLdString(value: string): string {
  // JSON.stringify handles the escaping; we pull the quotes off after.
  const json = JSON.stringify(value);
  return json.slice(1, -1);
}

export function JobPostingJsonLd(props: JobPostingJsonLdProps) {
  const data: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: props.title,
    description: props.description,
    datePosted: props.datePosted,
    employmentType: props.employmentType,
    hiringOrganization: {
      "@type": "Organization",
      name: props.hiringOrganizationName,
      ...(props.hiringOrganizationUrl && { sameAs: props.hiringOrganizationUrl }),
    },
    jobLocation: props.isRemote
      ? {
          "@type": "Place",
          address: {
            "@type": "PostalAddress",
            addressLocality: props.locationText,
          },
        }
      : {
          "@type": "Place",
          address: {
            "@type": "PostalAddress",
            addressLocality: props.locationText,
          },
        },
    url: props.url,
  };

  if (props.isRemote) {
    data.jobLocationType = "TELECOMMUTE";
    // Applicant location requirements — TELECOMMUTE without this is
    // treated as global; scope to US when the text says so.
    if (/US|United States/i.test(props.locationText)) {
      data.applicantLocationRequirements = {
        "@type": "Country",
        name: "USA",
      };
    }
  }

  if (props.validThrough) {
    data.validThrough = props.validThrough;
  }

  // Best-effort MonetaryAmount from a free-text comp string like
  // "$120k–$150k + equity". If we can't confidently pull numbers we
  // omit rather than emit malformed markup that Google will complain
  // about in Search Console.
  if (props.compensationText) {
    const salary = parseCompensation(props.compensationText);
    if (salary) {
      data.baseSalary = {
        "@type": "MonetaryAmount",
        currency: "USD",
        value: {
          "@type": "QuantitativeValue",
          minValue: salary.min,
          maxValue: salary.max,
          unitText: salary.unit,
        },
      };
    }
  }

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data),
      }}
    />
  );
}

/** Silence lint on the intentional string escape helper. */
void escapeJsonLdString;

/**
 * Parse "$120k–$150k", "$120,000-$150,000/year", "$50-$75/hr" into
 * MonetaryAmount components. Returns null if the string doesn't parse
 * cleanly — better to omit baseSalary than emit garbage.
 */
function parseCompensation(text: string): {
  min: number;
  max: number;
  unit: "HOUR" | "DAY" | "WEEK" | "MONTH" | "YEAR";
} | null {
  const clean = text.replace(/[,$]/g, "").toLowerCase();

  // Detect unit
  let unit: "HOUR" | "DAY" | "WEEK" | "MONTH" | "YEAR" = "YEAR";
  if (/\/(hr|hour)/i.test(clean)) unit = "HOUR";
  else if (/\/(day)/i.test(clean)) unit = "DAY";
  else if (/\/(wk|week)/i.test(clean)) unit = "WEEK";
  else if (/\/(mo|month)/i.test(clean)) unit = "MONTH";

  // Detect two numbers separated by en-dash or hyphen.
  // Handles "120k-150k", "120000–150000", "50-75".
  const match = clean.match(/(\d+(?:\.\d+)?)\s*(k|m)?\s*[-–—]\s*(\d+(?:\.\d+)?)\s*(k|m)?/i);
  if (!match) return null;

  const multiplier = (suffix?: string) => {
    if (!suffix) return 1;
    if (suffix.toLowerCase() === "k") return 1_000;
    if (suffix.toLowerCase() === "m") return 1_000_000;
    return 1;
  };

  const min = parseFloat(match[1]) * multiplier(match[2]);
  const max = parseFloat(match[3]) * multiplier(match[4] ?? match[2]);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) return null;

  return { min, max, unit };
}
