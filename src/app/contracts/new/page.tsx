/**
 * Submit a contract RFP (external client work).
 * Sandbox: appends to MOCK_PROJECTS in memory.
 * REPLACE WITH: Drizzle insert into `projects` table, PII vetting queue,
 * email notification to the client for review.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
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

  MOCK_PROJECTS.push({
    id: `p_${Date.now()}`,
    title,
    description,
    industry,
    skillsRequired: skillsRaw.split(",").map((s) => s.trim()).filter(Boolean),
    budget,
    status: "open",
    clientId,
    assignedMemberIds: [],
    kind: "contract",
    isRfp: true,
    rfpApprovedAt: null, // pending admin vetting
    rfpAdminNote: null,
    // HubSpot sync writes the deal stage on the way in (Phase 1.3); we
    // mirror "discovery" as the default until the webhook fires.
    hubspotStage: "discovery",
    hubspotDealId: null,
    collectedRevenue: null,
    collectedAt: null,
    // Admin team gets assigned during RFP review.
    adminUserIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
