/**
 * Propose an internal initiative (cooperative contribution).
 * Sandbox: appends to MOCK_PROJECTS in memory with kind="internal".
 *
 * REPLACE WITH: Drizzle insert, admin-approval queue, Slack/Discord ping.
 * Internal initiatives don't carry a client budget — compensation is
 * $BUILD token distribution determined by admins once delivered.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { INDUSTRY_LABELS, type Industry } from "@/lib/types";
import { Card, CardEyebrow } from "@/components/Card";

async function createInitiative(formData: FormData) {
  "use server";
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const industry = String(formData.get("industry") ?? "stem") as Industry;
  const skillsRaw = String(formData.get("skills") ?? "");
  const owner = String(formData.get("owner") ?? "");

  if (!title || !description) throw new Error("Title and description required");

  MOCK_PROJECTS.push({
    id: `p_${Date.now()}`,
    title,
    description,
    industry,
    skillsRequired: skillsRaw.split(",").map((s) => s.trim()).filter(Boolean),
    budget: "0.00",
    status: "open",
    clientId: owner || "internal_buildstore",
    assignedMemberIds: [],
    kind: "internal",
    isRfp: true,
    // Internal initiatives are admin-proposed, so they're implicitly approved
    // — they show up in /projects immediately, no intake-queue gate.
    rfpApprovedAt: new Date().toISOString(),
    rfpAdminNote: null,
    // Internal projects don't get a HubSpot deal — there's no client.
    hubspotStage: null,
    hubspotDealId: null,
    collectedRevenue: null,
    collectedAt: null,
    // Internal initiative — no commission to split.
    adminUserIds: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  redirect("/projects");
}

export default async function NewInitiativePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const industries: Industry[] = ["stem", "creative-media", "professional-services"];

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="font-display text-4xl font-semibold">Propose an initiative</h1>
      <p className="mt-2 text-ink-muted">
        Internal cooperative work. No client budget — contributors are compensated
        in $BUILD tokens determined by admins on delivery.
      </p>

      <Card className="mt-8">
        <CardEyebrow>Internal initiative</CardEyebrow>
        <form action={createInitiative} className="mt-4 space-y-5">
          <Field name="title" label="Title" required />

          <label className="block">
            <span className="text-xs uppercase tracking-wider text-ink-muted">
              What needs to happen
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
                defaultValue="stem"
                className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
              >
                {industries.map((i) => (
                  <option key={i} value={i}>
                    {INDUSTRY_LABELS[i]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-xs uppercase tracking-wider text-ink-muted">Owner</span>
              <select
                name="owner"
                defaultValue="internal_buildstore"
                className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
              >
                <option value="internal_buildstore">$BUILD.Store</option>
                <option value="internal_futuremodern">Future Modern</option>
              </select>
            </label>
          </div>

          <Field
            name="skills"
            label="Skills needed (comma separated)"
            defaultValue=""
          />

          <button
            type="submit"
            className="rounded-full px-6 py-2.5 text-sm font-medium text-white"
            style={{ backgroundColor: "#5070F0" }}
          >
            Propose
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
