/**
 * Put a named Builder on an RFP who never applied to it (#207).
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-24)
 *
 * The composer can only pick from bids. That is right as the default —
 * project-scoped applicant selection is the whole reason the dispatch
 * surface exists — but it has no answer for the common exception: the
 * right person for a scope is often somebody who was not watching the
 * board. Until now the only way to get them onto a client quote was to
 * ask them to go and file a bid, which is both slower than a phone call
 * and dishonest about who approached whom.
 *
 * WHY IT WRITES AN APPLICATION ROW
 *
 * Everything downstream of the composer is keyed on
 * project_applications: the pick list, one-bid-per-person, the
 * clientPresentedAt freeze on send, the audit entry, the per-bid form
 * fields. A parallel store for admin-added builders would mean a second
 * construction of ProposedBuilder — one that agrees with the first today
 * and drifts from it the next time pricing changes.
 *
 * So this writes the row the member would have written, records who
 * wrote it in addedByAdminId, and then does nothing else. The composer
 * is unchanged apart from showing the tag.
 *
 * WHY IT IS APPROVED, NOT PENDING
 *
 * `pending` means "a member asked, nobody has looked yet." That is the
 * opposite of what happened. An admin typed this row deliberately, so
 * it arrives reviewed, by them, with the reason in adminNote.
 *
 * WHY THE MEMBER IS TOLD
 *
 * Their name, rate and availability are about to go in front of a
 * client. Finding that out when the engagement lands is not acceptable,
 * and it is also the only chance to correct a term before the quote
 * goes out. The notification is the point at which an admin's guess at
 * someone's rate becomes something that person can object to.
 * ─────────────────────────────────────────────────────────────
 */
"use server";

import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { projectApplications, projects, users } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-stub";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import { pushNotification } from "@/lib/milestone-core";
import { computeRateBounds, validateRateAgainstBounds } from "@/lib/rate-bounds";
import { publicName } from "@/lib/types";
import type { User } from "@/lib/types";

/** Every field #207 requires before a quote can be compiled. */
interface AdminAddedTerms {
  proposedRole: string;
  hoursPerWeek: number;
  hoursPerWeekMax: number | null;
  priceMode: "hourly" | "fixed";
  hourlyRate: string | null;
  hourlyRateMax: string | null;
  fixedPriceMin: string | null;
  fixedPriceMax: string | null;
}

function money(raw: FormDataEntryValue | null): number {
  return Number(String(raw ?? "").replace(/[$,\s]/g, ""));
}

/**
 * #207 requires that missing role, availability or pricing prevents
 * compilation with field-level feedback. Enforced here rather than at
 * compile time: a row that reaches the pick list is already complete,
 * so there is no state where the composer holds a half-specified
 * builder and discovers it on submit.
 */
function readTerms(
  formData: FormData,
  member: Pick<User, "id" | "membershipTier">,
): AdminAddedTerms {
  const proposedRole = String(formData.get("proposedRole") ?? "").trim();
  if (proposedRole.length < 2) {
    throw new Error(
      "Role is required. Write what this person is being brought in to do.",
    );
  }

  const hoursPerWeek = Math.trunc(money(formData.get("hoursPerWeek")));
  const hoursMaxRaw = String(formData.get("hoursPerWeekMax") ?? "").trim();
  const hoursPerWeekMax = hoursMaxRaw ? Math.trunc(money(hoursMaxRaw)) : null;
  if (!Number.isFinite(hoursPerWeek) || hoursPerWeek <= 0) {
    throw new Error(
      "Availability is required. Confirm the hours per week with them before quoting it.",
    );
  }
  if (hoursPerWeek > 60) {
    throw new Error("Availability above 60 hours a week is not a real commitment.");
  }
  if (hoursPerWeekMax !== null && hoursPerWeekMax < hoursPerWeek) {
    throw new Error("The top of the availability range is below the bottom of it.");
  }

  const priceMode = formData.get("priceMode") === "fixed" ? "fixed" : "hourly";

  if (priceMode === "hourly") {
    const rate = money(formData.get("hourlyRate"));
    const rateMaxRaw = String(formData.get("hourlyRateMax") ?? "").trim();
    const rateMax = rateMaxRaw ? money(rateMaxRaw) : null;
    // The same ceiling and floor a member's own bid goes through. An
    // admin typing the number on someone's behalf is not a reason to
    // skip the check — it is the reason to keep it, since the member
    // is not there to notice a typo.
    const bounds = computeRateBounds(member);
    const problem = validateRateAgainstBounds(rate, bounds);
    if (problem) throw new Error(problem);
    if (rateMax !== null && rateMax < rate) {
      throw new Error("The top of the rate range is below the bottom of it.");
    }
    return {
      proposedRole,
      hoursPerWeek,
      hoursPerWeekMax,
      priceMode,
      hourlyRate: rate.toFixed(2),
      hourlyRateMax: rateMax !== null ? rateMax.toFixed(2) : null,
      fixedPriceMin: null,
      fixedPriceMax: null,
    };
  }

  const min = money(formData.get("fixedPriceMin"));
  const maxRaw = String(formData.get("fixedPriceMax") ?? "").trim();
  const max = maxRaw ? money(maxRaw) : null;
  if (!Number.isFinite(min) || min <= 0) {
    throw new Error("Project price is required for a fixed-price engagement.");
  }
  if (max !== null && max < min) {
    throw new Error("The top of the price range is below the bottom of it.");
  }
  return {
    proposedRole,
    hoursPerWeek,
    hoursPerWeekMax,
    priceMode,
    hourlyRate: null,
    hourlyRateMax: null,
    fixedPriceMin: min.toFixed(2),
    fixedPriceMax: max !== null ? max.toFixed(2) : null,
  };
}

export async function addBuilderOutsideApplications(formData: FormData) {
  const admin = await requireAdmin();

  const rfpId = String(formData.get("rfpId") ?? "").trim();
  const userId = String(formData.get("userId") ?? "").trim();
  const note = String(formData.get("adminNote") ?? "").trim();
  if (!rfpId) throw new Error("rfpId is required.");
  if (!userId) {
    throw new Error("Pick the person you are adding before saving.");
  }
  if (note.length < 10) {
    throw new Error(
      "Say why this person is being added without a bid. It goes in the audit trail and on their notification.",
    );
  }

  // Same gate the composer uses. An admin-added builder is still only
  // meaningful on an approved, open RFP.
  const [rfp] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, rfpId))
    .limit(1);
  if (
    !rfp ||
    rfp.kind !== "contract" ||
    !rfp.isRfp ||
    rfp.status !== "open" ||
    !rfp.rfpApprovedAt
  ) {
    throw new Error("RFP not found or not open for compilation.");
  }

  const [member] = await db
    .select()
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!member) throw new Error("That member no longer exists.");
  if (member.suspendedAt) {
    throw new Error(
      "That member is suspended. Lift the suspension before putting them in front of a client.",
    );
  }

  // Read after the member is known, so a rate an admin types on
  // somebody's behalf is bounded by that person's own rate rules.
  const terms = readTerms(formData, member);

  // If they already have a live row on this RFP, they did apply — or
  // somebody already added them. Either way the answer is to use the
  // bid that exists rather than create a second one, since the
  // composer refuses two bids from the same person anyway.
  const [existing] = await db
    .select({ id: projectApplications.id })
    .from(projectApplications)
    .where(
      and(
        eq(projectApplications.projectId, rfpId),
        eq(projectApplications.userId, userId),
        sql`${projectApplications.status} IN ('pending', 'approved')`,
      ),
    )
    .limit(1);
  if (existing) {
    throw new Error(
      "That person already has a live bid on this RFP. Use it rather than adding a second one.",
    );
  }

  const now = new Date().toISOString();
  const id = `pa_${Date.now().toString(36)}`;
  // The pitch is the admin's note, labelled as such. The composer
  // renders this under "What they wrote", and it must not read as
  // though the member wrote it — the whole point of this path is that
  // they did not.
  const pitch = `Added by ${publicName(admin)} without a bid. ${note}`;

  await db.insert(projectApplications).values({
    id,
    projectId: rfpId,
    userId,
    proposedRole: terms.proposedRole,
    pitch,
    hoursPerWeek: terms.hoursPerWeek,
    hoursPerWeekMax: terms.hoursPerWeekMax,
    hourlyRate: terms.hourlyRate,
    hourlyRateMax: terms.hourlyRateMax,
    priceMode: terms.priceMode,
    fixedPriceMin: terms.fixedPriceMin,
    fixedPriceMax: terms.fixedPriceMax,
    portfolioLink: null,
    attachments: [],
    // Reviewed, because it was: an admin typed it on purpose.
    status: "approved",
    reviewedBy: admin.id,
    reviewedAt: now,
    adminNote: note,
    withdrawnAt: null,
    clientPresentedAt: null,
    addedByAdminId: admin.id,
    createdAt: now,
  });

  // The member finds out now, not when the engagement lands. This is
  // also their only chance to correct a rate or an availability an
  // admin guessed at before it reaches a client.
  await pushNotification({
    userId,
    kind: "rfp_status",
    title: `You were put forward for ${rfp.title}`,
    body: `${publicName(admin)} added you to this quote as ${terms.proposedRole} without a bid from you. Check the terms on the contract page and tell them if anything is wrong before it goes to the client.`,
    href: `/contracts/${rfpId}`,
  });

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "rfp.builder_added_outside_applications",
    resourceKind: "project_application",
    resourceId: id,
    before: null,
    after: {
      projectId: rfpId,
      userId,
      proposedRole: terms.proposedRole,
      priceMode: terms.priceMode,
      hourlyRate: terms.hourlyRate,
      hourlyRateMax: terms.hourlyRateMax,
      fixedPriceMin: terms.fixedPriceMin,
      fixedPriceMax: terms.fixedPriceMax,
      hoursPerWeek: terms.hoursPerWeek,
      hoursPerWeekMax: terms.hoursPerWeekMax,
    },
    reason: `Added ${publicName(member)} to ${rfp.title} without a bid: ${note}`,
  });

  revalidatePath(`/admin/rfps/${rfpId}/bids`);
  revalidatePath("/admin/projects/applications");
  revalidatePath("/notifications");
}
