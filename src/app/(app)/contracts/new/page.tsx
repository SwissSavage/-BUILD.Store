/**
 * Submit a contract RFP (external client work).
 *
 * SANDBOX→LIVE swap history:
 *   - Pre-Beta cutover: MOCK_PROJECTS.push mutation, no DB persistence.
 *   - Beta cutover (this file, 2026-08-13): db.insert(projects) against
 *     live Postgres. RFP lands in the intake queue with isRfp=true +
 *     rfpApprovedAt=null. Admin scrubs + approves via /admin/rfps.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { projects } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth-stub";
import { createHubspotLead } from "@/lib/crm-stub";
import { INDUSTRY_LABELS, type Industry } from "@/lib/types";
import { Card, CardEyebrow } from "@/components/Card";

async function createRfp(formData: FormData) {
  "use server";
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const industry = String(formData.get("industry") ?? "creative-media") as Industry;
  const skillsRaw = String(formData.get("skills") ?? "");
  const budget = String(formData.get("budget") ?? "0");
  const clientId = String(formData.get("clientId") ?? "client_anon");

  if (!title || !description) throw new Error("Title and description required");

  // Land the RFP in HubSpot as a contact + deal before we persist the
  // Project locally, so hubspotDealId is populated from creation instead
  // of waiting on a follow-up sync. Client contact info comes from the
  // signed-in User record (this form doesn't collect name/email — the
  // submitter is already authenticated). A CRM hiccup shouldn't block the
  // RFP itself from going into the intake queue, so this degrades to a
  // null hubspotDealId (same as before) on failure rather than throwing.
  const user = await getCurrentUser();
  let hubspotDealId: string | null = null;
  if (user) {
    try {
      const lead = await createHubspotLead({
        email: user.email,
        firstName: user.firstName || undefined,
        lastName: user.lastName || undefined,
        industry,
        intent: "build_a_team",
        source: "rfp_submission",
        teamScope: description,
        pillars: [industry],
        opportunityBrief: `RFP: ${title}. Budget: ${budget || "not specified"}.`,
      });
      hubspotDealId = lead.dealId;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("[contracts/new] HubSpot sync failed for RFP", err);
    }
  }

  const now = new Date().toISOString();
  // Budget field defaults to "0" when the submitter leaves it blank —
  // consistent with FM's canonical no-budget-on-RFPs principle (talent
  // sets pricing, not the client). Schema still requires the column;
  // migration to nullable is queued as a follow-up.
  const budgetValue = budget || "0";

  await db.insert(projects).values({
    id: `p_${Date.now()}`,
    title,
    description,
    industry,
    skillsRequired: skillsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    budget: budgetValue,
    status: "open",
    clientId,
    assignedMemberIds: [],
    kind: "contract",
    isRfp: true,
    rfpApprovedAt: null, // pending admin vetting
    rfpAdminNote: null,
    // Mirrors HubSpot's real dealstage until the webhook (Phase 1.3)
    // fires a change — see mapHubspotStageToAppStage in lib/crm-stub.ts.
    hubspotStage: "discovery",
    hubspotDealId,
    collectedRevenue: null,
    collectedAt: null,
    // Admin team gets assigned during RFP review.
    adminUserIds: [],
    // Comp structure assigned during quote-sheet approval. Left null
    // until a follow-up wires the base/bonus split into intake.
    talentBaseAmount: null,
    talentBonusAmount: null,
    bonusGate: null,
    pmEngagementRating: null,
    bonusDecision: null,
    bonusDecidedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  revalidatePath("/contracts");
  revalidatePath("/dashboard");
  revalidatePath("/admin/rfps");
  redirect("/contracts");
}

export default async function NewContractPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const industries: Industry[] = ["stem", "creative-media", "professional-services"];

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-display text-4xl font-semibold">Submit an RFP</h1>
      <p className="mt-2 text-ink-muted">
        External client work. Goes into our intake queue first — admins scrub
        any direct-contact info before it reaches members. The cooperative then
        returns 3–5 qualified team options.
      </p>

      <Card className="mt-8">
        <CardEyebrow>Contract</CardEyebrow>
        <form action={createRfp} className="mt-4 space-y-5">
          <input type="hidden" name="clientId" value={user.id} />

          <Field name="title" label="Title" required />

          <label className="block">
            <span className="text-xs uppercase tracking-wider text-ink-muted">
              Description
            </span>
            <textarea
              name="description"
              rows={5}
              required
              className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-ink-muted">Pillar</span>
              <select
                name="industry"
                defaultValue="creative-media"
                className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
              >
                {industries.map((i) => (
                  <option key={i} value={i}>
                    {INDUSTRY_LABELS[i]}
                  </option>
                ))}
              </select>
            </label>
            <Field name="budget" label="Budget (USD)" defaultValue="" />
          </div>

          <Field
            name="skills"
            label="Skills required (comma separated)"
            defaultValue=""
          />

          <button
            type="submit"
            className="rounded-full px-6 py-2.5 text-sm font-medium text-white"
            style={{ backgroundColor: "#D828A0" }}
          >
            Submit RFP
          </button>
        </form>
      </Card>
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue = "",
  required = false,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-ink-muted">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
      />
    </label>
  );
}
