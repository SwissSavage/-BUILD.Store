/**
 * Signed-agreements admin actions.
 *
 * Compose + edit + remove entries in the paperwork registry at
 * /admin/agreements. Sandbox mutates MOCK_AGREEMENTS in memory;
 * production persists to the Drizzle `agreements` table (see
 * src/db/schema.ts).
 *
 * Design posture:
 *   - One row = one signature event. Re-signing a revised covenant
 *     creates a new row rather than overwriting — the old row is the
 *     historical record.
 *   - Every mutation writes to the audit log with an `agreement.*`
 *     verb. Retention is at least 12 months and 7 years for the
 *     financial-adjacent subset (LOI / seller_agreement) so the trail
 *     survives audits.
 *   - Storage URL is a pointer, not a blob. Actual artifacts live at
 *     the provider (Adobe Sign / DocuSign) or under
 *     `Future Modern/deliverables/legal/signed-agreements/` in the
 *     repo. The registry answers "who signed what, when"; the
 *     artifact resolves "what did they sign, exactly."
 *   - Validation is defensive but not draconian — Adobe Sign
 *     provider entries need an externalRef, manual entries need
 *     either storageUrl or notes explaining why not, other
 *     combinations are allowed with an informational message on the
 *     admin surface (not a hard block).
 */
"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-stub";
import { MOCK_AGREEMENTS } from "@/lib/mock-data/agreements";
import { MOCK_USERS } from "@/lib/mock-data/users";
import {
  logAuditEvent,
  snapshotActorRole,
} from "@/lib/mock-data/audit-log";
import {
  publicName,
  type Agreement,
  type AgreementProvider,
  type AgreementType,
} from "@/lib/types";
import { DOCUMENSO_TEMPLATES, DocumensoError, inviteRecipientToTemplate, inviteRecipientsToTemplate, type DocumensoRecipient } from "@/lib/documenso";

// Local guards mirror the union — allows the parser to fail loudly
// on typos in FormData string values without pulling in a full zod
// dependency for a handful of narrow enums.
const AGREEMENT_TYPES: readonly AgreementType[] = [
  "talent_data",
  "membership_covenant",
  "loi",
  "seller_agreement",
  "contributor_agreement",
  "other",
] as const;

const AGREEMENT_PROVIDERS: readonly AgreementProvider[] = [
  "adobesign",
  "docusign",
  "documenso",
  "manual",
  "in_app",
  "other",
] as const;

function isAgreementType(raw: string): raw is AgreementType {
  return (AGREEMENT_TYPES as readonly string[]).includes(raw);
}

function isAgreementProvider(raw: string): raw is AgreementProvider {
  return (AGREEMENT_PROVIDERS as readonly string[]).includes(raw);
}

function newAgreementId(): string {
  return `agreement_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

/**
 * Parse an ISO date-time string; accept either a full ISO 8601 or a
 * bare YYYY-MM-DD (interpreted as 00:00 UTC). Rejects anything else
 * so the registry never accepts a garbage timestamp.
 */
function parseSignedAt(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Signed-at date is required.");
  // Bare YYYY-MM-DD → normalize to 00:00 UTC ISO.
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return `${trimmed}T00:00:00Z`;
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(
      "Signed-at must be a valid date (YYYY-MM-DD or ISO 8601 datetime).",
    );
  }
  return parsed.toISOString();
}

/**
 * Author a new agreement row. All fields except externalRef,
 * storageUrl, and notes are required. Validates user + provider +
 * type against the seeded roster and the AgreementType/Provider
 * unions.
 */
export async function createAgreement(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const userId = String(formData.get("userId") ?? "").trim();
  const agreementTypeRaw = String(formData.get("agreementType") ?? "").trim();
  const version = String(formData.get("version") ?? "").trim();
  const signedAtRaw = String(formData.get("signedAt") ?? "").trim();
  const providerRaw = String(formData.get("provider") ?? "").trim();
  const externalRef = String(formData.get("externalRef") ?? "").trim() || null;
  const storageUrl = String(formData.get("storageUrl") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!userId) throw new Error("Pick a user for this agreement.");
  const user = MOCK_USERS.find((u) => u.id === userId);
  if (!user) throw new Error(`Unknown user: ${userId}`);

  if (!isAgreementType(agreementTypeRaw)) {
    throw new Error(
      `Unknown agreement type "${agreementTypeRaw}". Allowed: ${AGREEMENT_TYPES.join(", ")}`,
    );
  }
  const agreementType = agreementTypeRaw;

  if (!version) throw new Error("Version is required (e.g. \"1.0\", \"2026-04\").");

  const signedAt = parseSignedAt(signedAtRaw);

  if (!isAgreementProvider(providerRaw)) {
    throw new Error(
      `Unknown provider "${providerRaw}". Allowed: ${AGREEMENT_PROVIDERS.join(", ")}`,
    );
  }
  const provider = providerRaw;

  // Soft validation: provider-native entries should carry an
  // externalRef; manual entries should carry a storageUrl or a note.
  // Neither is a hard block — historical entries may have gaps —
  // but the admin surface should render an inline warning.
  // (Warnings are surfaced by /admin/agreements, not thrown here.)

  const now = new Date().toISOString();
  const row: Agreement = {
    id: newAgreementId(),
    userId,
    agreementType,
    version,
    signedAt,
    provider,
    externalRef,
    storageUrl,
    notes,
    // Manual createAgreement path doesn't touch Documenso — signature
    // tracking columns stay null. Rows created via the Documenso
    // webhook (task #19) will populate these.
    documensoEnvelopeId: null,
    signatureStatus: null,
    signatureCompletedAt: null,
    createdBy: admin.id,
    createdAt: now,
    updatedAt: now,
  };
  MOCK_AGREEMENTS.push(row);

  logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "agreement.created",
    resourceKind: "agreement",
    resourceId: row.id,
    before: null,
    after: {
      userId,
      agreementType,
      version,
      signedAt,
      provider,
      externalRef,
      storageUrl,
    },
    reason: `Logged ${agreementType} v${version} for ${user.firstName} ${user.lastName ?? ""}`.trim(),
  });

  revalidatePath("/admin/agreements");
  revalidatePath(`/admin/members/${userId}`);
}

/**
 * Update a subset of fields on an existing row. Intentionally
 * narrow: userId, agreementType, and signedAt are IMMUTABLE — if
 * any of those are wrong, remove the row and create a new one so
 * the audit trail stays honest. Only version, provider, externalRef,
 * storageUrl, and notes are editable.
 */
export async function updateAgreement(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  if (!id) throw new Error("Agreement id is required.");

  const row = MOCK_AGREEMENTS.find((a) => a.id === id);
  if (!row) throw new Error("Agreement not found.");

  const before = {
    version: row.version,
    provider: row.provider,
    externalRef: row.externalRef,
    storageUrl: row.storageUrl,
    notes: row.notes,
  };

  const version = String(formData.get("version") ?? row.version).trim();
  const providerRaw = String(formData.get("provider") ?? row.provider).trim();
  const externalRef = String(formData.get("externalRef") ?? "").trim() || null;
  const storageUrl = String(formData.get("storageUrl") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!version) throw new Error("Version cannot be empty.");
  if (!isAgreementProvider(providerRaw)) {
    throw new Error(`Unknown provider "${providerRaw}".`);
  }

  row.version = version;
  row.provider = providerRaw;
  row.externalRef = externalRef;
  row.storageUrl = storageUrl;
  row.notes = notes;
  row.updatedAt = new Date().toISOString();

  logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "agreement.updated",
    resourceKind: "agreement",
    resourceId: row.id,
    before,
    after: {
      version: row.version,
      provider: row.provider,
      externalRef: row.externalRef,
      storageUrl: row.storageUrl,
      notes: row.notes,
    },
    reason: null,
  });

  revalidatePath("/admin/agreements");
  revalidatePath(`/admin/members/${row.userId}`);
}

/**
 * Remove a row. Sandbox splices the array; production should
 * soft-delete instead so gate helpers can distinguish "was signed,
 * then repudiated" from "never signed." That distinction matters
 * for compliance disputes and OG-holder reconciliation.
 */
export async function removeAgreement(formData: FormData): Promise<void> {
  const admin = await requireAdmin();

  const id = String(formData.get("id") ?? "").trim();
  const reason = String(formData.get("reason") ?? "").trim() || null;
  if (!id) throw new Error("Agreement id is required.");

  const idx = MOCK_AGREEMENTS.findIndex((a) => a.id === id);
  if (idx === -1) throw new Error("Agreement not found.");
  const [removed] = MOCK_AGREEMENTS.splice(idx, 1);

  logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "agreement.removed",
    resourceKind: "agreement",
    resourceId: removed.id,
    before: {
      userId: removed.userId,
      agreementType: removed.agreementType,
      version: removed.version,
      signedAt: removed.signedAt,
      provider: removed.provider,
      externalRef: removed.externalRef,
      storageUrl: removed.storageUrl,
    },
    after: null,
    reason,
  });

  revalidatePath("/admin/agreements");
  revalidatePath(`/admin/members/${removed.userId}`);
}

// ────────────────────────────────────────────────────────────────
//  Documenso — Send Talent Partner LOI for signature
// ────────────────────────────────────────────────────────────────

/**
 * Dispatch the Talent Partner Letter of Intent through Documenso for
 * signature. This does NOT create an Agreement row yet — the row is
 * inserted by the webhook handler (task #19) on envelope.completed,
 * with signedAt populated from the actual completion time.
 *
 * FormData:
 *   - userId          FM user id of the invitee (required)
 *   - recipientEmail  optional override — defaults to the user's
 *                     account email
 *
 * Failure surfaces:
 *   - Missing DOCUMENSO_TEMPLATE_TALENT_PARTNER_LOI env var → hard
 *     error, admin should populate it in Dokploy.
 *   - Documenso 4xx/5xx → surfaced verbatim so the admin can debug
 *     on the sign.afuturemodern.com side.
 */
export async function sendLoiForSignature(
  formData: FormData,
): Promise<void> {
  const admin = await requireAdmin();

  const userId = String(formData.get("userId") ?? "").trim();
  const overrideEmail =
    String(formData.get("recipientEmail") ?? "").trim() || null;
  if (!userId) throw new Error("Pick a user to send the LOI to.");

  const user = MOCK_USERS.find((u) => u.id === userId);
  if (!user) throw new Error(`Unknown user: ${userId}`);

  const recipientEmail = overrideEmail ?? user.email;
  if (!recipientEmail) {
    throw new Error(
      `No email on file for ${publicName(user)}. Supply recipientEmail on the form to route this envelope.`,
    );
  }
  const recipientName = publicName(user);

  let envelopeId: string;
  try {
    // externalId is the correlation string the webhook route parses to
    // route the completion event back to the right FM resource. Format:
    //   agreement:<agreementType>:<userId>
    // The webhook handler splits on ":" to recreate the auto-Agreement
    // insert path that previously depended on Documenso passing metadata
    // through (which /api/v2/template/use doesn't support).
    const envelope = await inviteRecipientToTemplate({
      templateEnvelopeId: DOCUMENSO_TEMPLATES.TALENT_PARTNER_LOI,
      recipient: {
        email: recipientEmail,
        name: recipientName,
        role: "SIGNER",
      },
      title: `Talent Partner Letter of Intent — ${recipientName}`,
      externalId: `agreement:loi:${userId}`,
    });
    envelopeId = String(envelope.id);
  } catch (err) {
    if (err instanceof DocumensoError) {
      throw new Error(
        `Documenso rejected the envelope: ${err.message} (HTTP ${err.status}). ` +
          `Check DOCUMENSO_TEMPLATE_TALENT_PARTNER_LOI is set and the template exists on sign.afuturemodern.com.`,
      );
    }
    throw err;
  }

  logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "document.signature_requested",
    resourceKind: "agreement",
    // Envelope id doubles as the resource id until an Agreement row
    // exists — the webhook handler stitches the two together when it
    // creates the row on completion.
    resourceId: envelopeId,
    before: null,
    after: {
      documensoEnvelopeId: envelopeId,
      signatureStatus: "sent",
      agreementType: "loi",
      userId,
      recipientEmail,
    },
    reason: `Talent Partner LOI sent to ${recipientName} <${recipientEmail}> via Documenso.`,
  });

  revalidatePath("/admin/agreements");
  revalidatePath(`/admin/members/${userId}`);
}

// ────────────────────────────────────────────────────────────────
//  Documenso — Send Mutual NCNDA for signature
// ────────────────────────────────────────────────────────────────

/**
 * Dispatch the FM Mutual NCNDA (bilateral or multi-party variant)
 * through Documenso for signature.
 *
 * Unlike sendLoiForSignature, NCNDAs typically go to prospects/clients
 * who are NOT yet FM users, so this action takes raw name + email +
 * company fields per counterparty rather than resolving against
 * MOCK_USERS.
 *
 * FormData:
 *   - variant             "bilateral" or "multi" (required)
 *   - name_1 / email_1    counterparty 1 (required)
 *   - company_1           counterparty 1 company (optional, appended to name)
 *   - name_2 / email_2    counterparty 2 (multi only, optional)
 *   - name_3 / email_3    counterparty 3 (multi only, optional)
 *
 * Bilateral routes to DOCUMENSO_TEMPLATE_MUTUAL_NCNDA; multi routes
 * to DOCUMENSO_TEMPLATE_MUTUAL_NCNDA_MULTI. No Agreement row is created
 * at send time; the webhook handler (task #19) creates one on completion.
 */
export async function sendNcndaForSignature(
  formData: FormData,
): Promise<void> {
  const admin = await requireAdmin();

  const variantRaw = String(formData.get("variant") ?? "").trim();
  if (variantRaw !== "bilateral" && variantRaw !== "multi") {
    throw new Error(
      `Unknown NCNDA variant "${variantRaw}". Use "bilateral" or "multi".`,
    );
  }
  const variant = variantRaw as "bilateral" | "multi";
  const templateId =
    variant === "bilateral"
      ? DOCUMENSO_TEMPLATES.MUTUAL_NCNDA
      : DOCUMENSO_TEMPLATES.MUTUAL_NCNDA_MULTI;
  const envVarName =
    variant === "bilateral"
      ? "DOCUMENSO_TEMPLATE_MUTUAL_NCNDA"
      : "DOCUMENSO_TEMPLATE_MUTUAL_NCNDA_MULTI";

  // Collect up to 3 recipients from the form. Counterparty 1 is
  // required in both variants; counterparties 2 and 3 are additional
  // slots that only apply to the multi variant.
  type RawCounterparty = { name: string; email: string; company: string };
  const raw: RawCounterparty[] = [];
  const maxSlots = variant === "bilateral" ? 1 : 3;
  for (let i = 1; i <= maxSlots; i++) {
    const name = String(formData.get(`name_${i}`) ?? "").trim();
    const email = String(formData.get(`email_${i}`) ?? "").trim();
    const company = String(formData.get(`company_${i}`) ?? "").trim();
    if (!name && !email && !company) continue;
    if (!name || !email) {
      throw new Error(
        `Counterparty ${i} needs both name and email (or leave all three fields blank).`,
      );
    }
    raw.push({ name, email, company });
  }
  if (raw.length === 0) {
    throw new Error("Add at least one counterparty before sending.");
  }

  const recipients: DocumensoRecipient[] = raw.map((r) => ({
    name: r.company ? `${r.name} (${r.company})` : r.name,
    email: r.email,
    role: "SIGNER",
  }));

  const titleSuffix =
    raw.length === 1
      ? raw[0].company || raw[0].name
      : raw.map((r) => r.company || r.name).join(" / ");
  const title = `FM Mutual NCNDA — ${titleSuffix}`;

  let envelopeId: string;
  try {
    // externalId format: agreement:ncnda:<variant>. Webhook parses this
    // to know we've sent an NCNDA and which template variant it was.
    // For NCNDAs the FM-side Agreement row (if any) is created against
    // the primary counterparty on completion; multi-party variants log
    // one Agreement per completed signer per Documenso's per-recipient
    // completion events. See webhook route.
    const externalId = `agreement:ncnda:${variant}`;
    const envelope =
      variant === "bilateral"
        ? await inviteRecipientToTemplate({
            templateEnvelopeId: templateId,
            recipient: recipients[0],
            title,
            externalId,
          })
        : await inviteRecipientsToTemplate({
            templateEnvelopeId: templateId,
            recipients,
            title,
            externalId,
          });
    envelopeId = String(envelope.id);
  } catch (err) {
    if (err instanceof DocumensoError) {
      throw new Error(
        `Documenso rejected the NCNDA envelope: ${err.message} (HTTP ${err.status}). ` +
          `Check ${envVarName} is set and the template exists on sign.afuturemodern.com.`,
      );
    }
    throw err;
  }

  logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "document.signature_requested",
    resourceKind: "agreement",
    resourceId: envelopeId,
    before: null,
    after: {
      documensoEnvelopeId: envelopeId,
      signatureStatus: "sent",
      agreementType: "other",
      purpose: "ncnda",
      variant,
      recipients: recipients.map((r) => ({ name: r.name, email: r.email })),
    },
    reason: `Mutual NCNDA (${variant}) sent to ${recipients.map((r) => `${r.name} <${r.email}>`).join(", ")} via Documenso.`,
  });

  revalidatePath("/admin/agreements");
}
