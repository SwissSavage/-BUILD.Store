/**
 * Signed-agreements registry — the sandbox mirror of what will live
 * in the Postgres `agreements` table.
 *
 * One row per signature event. When a member re-signs a revised
 * covenant, that is a new row (the old row stays for the historical
 * record). Gate helpers read this store to answer "does user X have
 * a valid current signature on agreement type Y?" — see
 * `src/lib/agreements/gate-helpers.ts`.
 *
 * PRODUCTION SWAP:
 *   - Replace this in-memory array with a Drizzle read against the
 *     `agreements` table (see `src/db/schema.ts`).
 *   - Rob Turley's LOI is the first real filed artifact
 *     (`Future Modern/deliverables/legal/signed-agreements/`) and is
 *     seeded here as the reference row for the manual + storage_url
 *     pattern. Additional filed artifacts follow the same
 *     ISO-date-plus-slug naming pattern.
 *   - Adobe Sign entries need `externalRef` populated with the
 *     provider-native agreement/envelope id so admin can round-trip
 *     into the provider console; sandbox uses placeholder strings.
 *   - The OG-holder onboarding path (unmatched on-chain holder with
 *     no Agreement row) is handled by the admin surface, not the
 *     store itself — see `/admin/agreements` unmatched-holder rail.
 */
import type { Agreement } from "@/lib/types";

export const MOCK_AGREEMENTS: Agreement[] = [
  {
    id: "agreement_rob_loi_20230427",
    userId: "u_rob",
    agreementType: "loi",
    version: "1.0",
    signedAt: "2023-04-27T00:00:00Z",
    provider: "manual",
    externalRef: null,
    storageUrl:
      "Future Modern/deliverables/legal/signed-agreements/2023-04-27-turley-rob-loi.pdf",
    notes:
      "Countersigned 2023-04-27 by Rob Turley. Founder signature dated 2023-04-24. Predates the paperwork registry — filed retroactively as the reference row for the manual + storage_url pattern.",
    createdBy: "u_jamar",
    documensoEnvelopeId: null,
    signatureStatus: null,
    signatureCompletedAt: null,
    createdAt: "2026-07-23T18:00:00Z",
    updatedAt: "2026-07-23T18:00:00Z",
  },
  {
    id: "agreement_jamar_covenant_v1",
    userId: "u_jamar",
    agreementType: "membership_covenant",
    version: "1.0",
    signedAt: "2026-04-20T09:00:00Z",
    provider: "adobesign",
    externalRef: "CBSCTBAA3AAABLblqZhCxRefreshMe_JamarCovenantPlaceholder",
    storageUrl: null,
    notes: "Founder covenant, executed at the unified-repo baseline.",
    createdBy: "u_jamar",
    documensoEnvelopeId: null,
    signatureStatus: null,
    signatureCompletedAt: null,
    createdAt: "2026-04-20T09:15:00Z",
    updatedAt: "2026-04-20T09:15:00Z",
  },
  {
    id: "agreement_bayu_talent_v1",
    userId: "u_bayu",
    agreementType: "talent_data",
    version: "1.0",
    signedAt: "2026-06-28T14:30:00Z",
    provider: "adobesign",
    externalRef: "CBSCTBAA3AAABLblqZhCxRefreshMe_BayuTalentPlaceholder",
    storageUrl: null,
    notes: null,
    createdBy: "u_jamar",
    documensoEnvelopeId: null,
    signatureStatus: null,
    signatureCompletedAt: null,
    createdAt: "2026-06-28T14:35:00Z",
    updatedAt: "2026-06-28T14:35:00Z",
  },
  {
    id: "agreement_bayu_covenant_v1",
    userId: "u_bayu",
    agreementType: "membership_covenant",
    version: "1.0",
    signedAt: "2026-07-01T09:00:00Z",
    provider: "adobesign",
    externalRef: "CBSCTBAA3AAABLblqZhCxRefreshMe_BayuCovenantPlaceholder",
    storageUrl: null,
    notes: "Executed alongside promotion to Member (July 2026 cohort).",
    createdBy: "u_jamar",
    documensoEnvelopeId: null,
    signatureStatus: null,
    signatureCompletedAt: null,
    createdAt: "2026-07-01T09:10:00Z",
    updatedAt: "2026-07-01T09:10:00Z",
  },
  {
    id: "agreement_sunny_talent_v1",
    userId: "u_sunny",
    agreementType: "talent_data",
    version: "1.0",
    signedAt: "2026-06-03T11:00:00Z",
    provider: "adobesign",
    externalRef: "CBSCTBAA3AAABLblqZhCxRefreshMe_SunnyTalentPlaceholder",
    storageUrl: null,
    notes: "Partner-tier contributor release.",
    createdBy: "u_jamar",
    documensoEnvelopeId: null,
    signatureStatus: null,
    signatureCompletedAt: null,
    createdAt: "2026-06-03T11:05:00Z",
    updatedAt: "2026-06-03T11:05:00Z",
  },
  {
    id: "agreement_bbg_talent_v1",
    userId: "u_bbg",
    agreementType: "talent_data",
    version: "1.0",
    signedAt: "2026-05-12T16:00:00Z",
    provider: "manual",
    externalRef: null,
    storageUrl: null,
    notes:
      "Signed on paper during onboarding; storage_url pending upload of the countersigned PDF to signed-agreements/.",
    createdBy: "u_jamar",
    documensoEnvelopeId: null,
    signatureStatus: null,
    signatureCompletedAt: null,
    createdAt: "2026-05-12T16:20:00Z",
    updatedAt: "2026-05-12T16:20:00Z",
  },
];

/** Return every agreement filed for a user, freshest first. */
export function agreementsForUser(userId: string): Agreement[] {
  return MOCK_AGREEMENTS.filter((a) => a.userId === userId).sort((a, b) =>
    b.signedAt.localeCompare(a.signedAt),
  );
}

/**
 * Most-recent agreement of a specific type for a user. Returns null
 * if none on file. This is the primary predicate gate helpers read
 * against.
 */
export function latestAgreementOfType(
  userId: string,
  agreementType: Agreement["agreementType"],
): Agreement | null {
  const matches = MOCK_AGREEMENTS.filter(
    (a) => a.userId === userId && a.agreementType === agreementType,
  );
  if (matches.length === 0) return null;
  return matches.sort((a, b) => b.signedAt.localeCompare(a.signedAt))[0];
}

/**
 * True iff the user has any signed agreement of the given type on
 * file. Convenience wrapper for gate predicates.
 */
export function hasSignedAgreement(
  userId: string,
  agreementType: Agreement["agreementType"],
): boolean {
  return latestAgreementOfType(userId, agreementType) !== null;
}
