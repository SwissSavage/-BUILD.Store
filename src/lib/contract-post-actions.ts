/**
 * Admin-posted contracts and internal initiatives.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS EXISTS (2026-09-01)
 *
 * `/contracts/new` is the CLIENT intake form. It creates a project
 * with `isRfp: true` and `rfpApprovedAt: null`, which lands in the
 * vetting queue at /admin/rfps and shows on no public board until an
 * admin approves it.
 *
 * That's correct for a client submitting work. It is the wrong shape
 * for an admin who already has a signed contract and wants it on the
 * board — that admin had to submit a request to themselves and then
 * go approve it, in two places, and the first place was a form
 * addressed to clients.
 *
 * This posts directly. Approved at creation, live immediately,
 * because the admin posting it IS the vetting step.
 * ─────────────────────────────────────────────────────────────
 */
"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db/client";
import { projects } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-stub";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";
import type { Industry } from "@/lib/types";

const INDUSTRIES: Industry[] = [
  "stem",
  "creative-media",
  "professional-services",
];

/**
 * Post a contract or internal initiative straight to the board.
 *
 * `kind` decides where it surfaces: a contract goes to /contracts for
 * bids, an internal initiative goes to /projects for contributors.
 * Both are the same table; the distinction is what the cooperative is
 * asking people to do with it.
 */
export async function postContract(formData: FormData) {
  const admin = await requireAdmin();

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const industryRaw = String(formData.get("industry") ?? "").trim();
  const kindRaw = String(formData.get("kind") ?? "contract").trim();
  const budget = String(formData.get("budget") ?? "").trim();
  const clientName = String(formData.get("clientName") ?? "").trim();
  const skillsRequired = String(formData.get("skillsRequired") ?? "")
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (!title) throw new Error("Title is required.");
  if (description.length < 30) {
    throw new Error(
      "Description must be at least 30 characters — this is what people decide to bid on.",
    );
  }
  if (!INDUSTRIES.includes(industryRaw as Industry)) {
    throw new Error("Pick a pillar.");
  }
  if (kindRaw !== "contract" && kindRaw !== "internal") {
    throw new Error("Unknown kind.");
  }

  const now = new Date().toISOString();
  const id = `p_${randomUUID()}`;
  const isContract = kindRaw === "contract";

  await db.insert(projects).values({
    id,
    title,
    description,
    industry: industryRaw as Industry,
    skillsRequired,
    // Budget stays optional. FM's rule is that talent prices the work,
    // not the client — an empty field is the normal case, not a gap.
    budget: budget || "0",
    status: "open",
    // No client user row for an admin-posted contract. The client's
    // name lives in the description; wiring a real clientId happens
    // when they're onboarded.
    clientId: admin.id,
    assignedMemberIds: [],
    kind: isContract ? "contract" : "internal",
    // Posted by an admin, so it is already vetted. This is the whole
    // difference from the client intake form.
    isRfp: isContract,
    rfpApprovedAt: isContract ? now : null,
    rfpAdminNote: clientName ? `Client: ${clientName}` : null,
    hubspotStage: "discovery",
    hubspotDealId: null,
    collectedRevenue: null,
    collectedAt: null,
    adminUserIds: [admin.id],
    talentBaseAmount: null,
    talentBonusAmount: null,
    bonusGate: null,
    pmEngagementRating: null,
    bonusDecision: null,
    bonusDecidedAt: null,
    rfpAttachments: [],
    createdAt: now,
    updatedAt: now,
  });

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "rfp.approved",
    resourceKind: "project",
    resourceId: id,
    before: null,
    after: { title, kind: kindRaw, industry: industryRaw },
    reason: `Posted directly by admin — no separate vetting step.`,
  });

  revalidatePath("/contracts");
  revalidatePath("/projects");
  revalidatePath("/admin/projects");
  revalidatePath("/admin/contracts");
  revalidatePath("/admin");

  // Straight to the thing that was just created, so the next step —
  // inviting someone onto it — is one click away.
  redirect(isContract ? `/contracts/${id}` : `/projects/${id}`);
}
