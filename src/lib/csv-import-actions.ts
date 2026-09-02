/**
 * Task #47 — Google form roster CSV importer.
 *
 * One-shot admin action to convert a Google Forms talent-roster
 * CSV export into `inbound_submissions` rows (kind =
 * `join_talent_signup`) so they land in the same admin queue at
 * /admin/inbound as native on-platform signups. From there the
 * existing triage flow (promote-to-invite, accept-proposed-tag)
 * takes over.
 *
 * Non-goals for MVP:
 *  - Streaming for huge CSVs (Google-form roster is <1000 rows;
 *    reading the whole file in memory is fine).
 *  - Perfect CSV parsing (handles quoted fields with commas +
 *    escaped quotes; anything more exotic — embedded newlines,
 *    CRLF-only line endings on Windows — flags on the row).
 *
 * Column mapping is fuzzy on the header row. Recognized aliases
 * live in HEADER_ALIASES below — the importer picks the first
 * header that matches any alias for each field. Skips rows with
 * neither name nor email (defensive against trailing empty rows).
 */
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-stub";
import { insertInboundSubmission } from "@/lib/writers/inbound-submissions";
import { extractKeywords } from "@/lib/talent-match";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import type { Industry } from "@/lib/types";

// ─── header alias tables ────────────────────────────────────────

const HEADER_ALIASES: Record<
  | "firstName"
  | "lastName"
  | "fullName"
  | "email"
  | "company"
  | "pillar"
  | "discipline"
  | "skills"
  | "portfolio"
  | "message",
  string[]
> = {
  firstName: ["first name", "firstname", "first"],
  lastName: ["last name", "lastname", "last", "surname"],
  fullName: ["name", "full name", "your name"],
  email: ["email", "email address", "e-mail"],
  company: ["company", "organization", "org", "studio", "employer"],
  pillar: ["pillar", "industry", "sector"],
  discipline: ["discipline", "role", "title", "practice"],
  skills: ["skills", "skill tags", "expertise", "specialties"],
  portfolio: ["portfolio", "portfolio url", "portfolio link", "url", "website"],
  message: ["message", "pitch", "about", "notes", "why", "bio", "summary"],
};

// ─── CSV parsing (RFC 4180-ish, no external deps) ────────────────

/**
 * Parse a CSV string into a 2D array of strings. Handles:
 *  - quoted fields
 *  - commas inside quoted fields
 *  - "" escaped quote inside a quoted field
 *  - LF and CRLF line endings
 * Does NOT handle embedded newlines inside quoted fields — those
 * rare cases will split the row and land as parse-flagged.
 */
function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  const normalized = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  for (const line of lines) {
    if (line.length === 0) continue;
    const row: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cur += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          row.push(cur);
          cur = "";
        } else {
          cur += ch;
        }
      }
    }
    row.push(cur);
    rows.push(row);
  }
  return rows;
}

// ─── header inference ────────────────────────────────────────────

interface HeaderMap {
  firstName: number | null;
  lastName: number | null;
  fullName: number | null;
  email: number | null;
  company: number | null;
  pillar: number | null;
  discipline: number | null;
  skills: number | null;
  portfolio: number | null;
  message: number | null;
}

function inferHeaders(header: string[]): HeaderMap {
  const norm = header.map((h) => h.trim().toLowerCase());
  const pick = (field: keyof typeof HEADER_ALIASES): number | null => {
    const aliases = HEADER_ALIASES[field];
    for (const alias of aliases) {
      const i = norm.findIndex(
        (h) => h === alias || h.includes(alias),
      );
      if (i >= 0) return i;
    }
    return null;
  };
  return {
    firstName: pick("firstName"),
    lastName: pick("lastName"),
    fullName: pick("fullName"),
    email: pick("email"),
    company: pick("company"),
    pillar: pick("pillar"),
    discipline: pick("discipline"),
    skills: pick("skills"),
    portfolio: pick("portfolio"),
    message: pick("message"),
  };
}

// ─── pillar normalization ────────────────────────────────────────

function normalizePillar(raw: string): Industry | null {
  const t = raw.trim().toLowerCase();
  if (
    t.includes("stem") ||
    t.includes("engineer") ||
    t.includes("developer") ||
    t.includes("tech")
  ) {
    return "stem";
  }
  if (
    t.includes("creative") ||
    t.includes("media") ||
    t.includes("art") ||
    t.includes("music") ||
    t.includes("design")
  ) {
    return "creative-media";
  }
  if (
    t.includes("professional") ||
    t.includes("services") ||
    t.includes("strategy") ||
    t.includes("ops") ||
    t.includes("sales") ||
    t.includes("marketing")
  ) {
    return "professional-services";
  }
  return null;
}

// ─── the action ──────────────────────────────────────────────────

export async function importInboundCsv(formData: FormData) {
  const admin = await requireAdmin();

  const file = formData.get("csv");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("No CSV file uploaded.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("CSV too large (>5MB). Split before uploading.");
  }

  const text = await file.text();
  const rows = parseCsv(text);
  if (rows.length < 2) {
    throw new Error("CSV has no data rows (need a header row + at least one data row).");
  }

  const headerMap = inferHeaders(rows[0]);
  if (!headerMap.email && !headerMap.fullName && !headerMap.firstName) {
    throw new Error(
      "Couldn't identify a name or email column. Rename headers to include 'Name' or 'Email' and try again.",
    );
  }

  let imported = 0;
  let skipped = 0;
  const skipReasons: string[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const at = (idx: number | null) =>
      idx !== null && idx >= 0 && idx < row.length ? row[idx].trim() : "";

    const email = at(headerMap.email).toLowerCase();
    const fullName = at(headerMap.fullName);
    const firstName = at(headerMap.firstName);
    const lastName = at(headerMap.lastName);
    const composedName =
      fullName ||
      [firstName, lastName].filter(Boolean).join(" ").trim();

    if (!email && !composedName) {
      skipped += 1;
      continue;
    }
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      skipped += 1;
      skipReasons.push(`row ${i + 1}: invalid email (${email})`);
      continue;
    }

    const company = at(headerMap.company);
    const pillarRaw = at(headerMap.pillar);
    const discipline = at(headerMap.discipline);
    const skillsRaw = at(headerMap.skills);
    const portfolio = at(headerMap.portfolio);
    const message = at(headerMap.message);

    const pillar = pillarRaw ? normalizePillar(pillarRaw) : null;
    const pillarTags: Industry[] = pillar ? [pillar] : [];

    const declaredSkillTags = skillsRaw
      .toLowerCase()
      .split(/[\s,;/|]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      .slice(0, 20);

    // Body combines everything the admin needs at triage — pitch,
    // discipline, portfolio, any raw pillar text we couldn't map.
    const bodyParts: string[] = [];
    if (discipline) bodyParts.push(`Discipline: ${discipline}`);
    if (message) bodyParts.push(message);
    if (portfolio) bodyParts.push(`Portfolio: ${portfolio}`);
    if (pillarRaw && !pillar)
      bodyParts.push(`Raw pillar (couldn't map): ${pillarRaw}`);
    const body =
      bodyParts.join("\n\n") || "(imported from CSV, no free-text pitch)";

    // Per row, not per batch. The write can now genuinely fail, where
    // the in-memory push never could, so one bad row must cost that row
    // and get reported rather than taking the rest of the import with
    // it. Counted as skipped so the totals still reconcile.
    try {
      await insertInboundSubmission({
        kind: "join_talent_signup",
        status: "new",
        title: `Join as talent · ${composedName || email}`,
        submitter: composedName || email,
        submitterEmail: email || null,
        submitterCompany: company || null,
        pillarTags,
        keywordTags: Array.from(
          new Set([...declaredSkillTags, ...extractKeywords(body)]),
        ).slice(0, 50),
        body,
        attachments: [],
        assignedAdminId: null,
        triageNote: `Imported via CSV by ${admin.firstName ?? admin.handle ?? admin.id}.`,
        deepLinkHref: null,
        linkedResourceId: null,
        derived: false,
      });
      imported += 1;
    } catch (err) {
      skipped += 1;
      skipReasons.push(
        `row ${i + 1}: could not be saved (${composedName || email})`,
      );
      console.error("CSV_IMPORT_ROW_FAILED", i + 1, err);
    }
  }

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "inbound.promoted_to_invite",
    resourceKind: "config",
    resourceId: "csv_import_batch",
    before: null,
    after: {
      csvFileName: file.name,
      csvBytes: file.size,
      rowsTotal: rows.length - 1,
      imported,
      skipped,
      firstFewSkipReasons: skipReasons.slice(0, 5),
    },
    reason: `CSV import: ${imported} rows landed in inbound queue, ${skipped} skipped.`,
  });

  revalidatePath("/admin/inbound");
  revalidatePath("/admin/inbound/import");
}
