/**
 * Propose an internal initiative (cooperative contribution).
 *
 * SANDBOX→LIVE swap history:
 *   - Pre-Beta cutover: in-memory push, no persistence.
 *   - Beta cutover (this file, 2026-08-13): db.insert(projects) against
 *     live Postgres. Internal initiatives are admin-proposed so they're
 *     implicitly approved (rfpApprovedAt set at creation, no intake-queue
 *     gate). No HubSpot deal, no client budget — compensation is $BUILD
 *     token distribution determined by admins on delivery.
 *   - Aug 2026 fix: unified owner (was two-option select FM / $BUILD.Store
 *     — those are the same entity; the platform is a Future Modern
 *     product). Added admin notification + audit-log on submit so
 *     proposers see the initiative land somewhere and admins can pick
 *     it up.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { projects, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth-stub";
import { INDUSTRY_LABELS, type Industry } from "@/lib/types";
import { Card, CardEyebrow } from "@/components/Card";
import { notify } from "@/lib/writers/notifications";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";

// Single canonical owner for internal cooperative work. Future Modern
// IS the entity; $BUILD.Store is the platform product. Keeping one
// value prevents the "which do I pick?" moment.
const INTERNAL_OWNER = "internal_futuremodern";

async function createInitiative(formData: FormData) {
  "use server";
  const proposer = await getCurrentUser();
  if (!proposer) redirect("/signin");

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const industry = String(formData.get("industry") ?? "stem") as Industry;
  const skillsRaw = String(formData.get("skills") ?? "");

  if (!title || !description) throw new Error("Title and description required");

  const now = new Date().toISOString();
  const projectId = `p_${Date.now()}`;

  await db.insert(projects).values({
    id: projectId,
    title,
    description,
    industry,
    skillsRequired: skillsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
    budget: "0.00",
    status: "open",
    clientId: INTERNAL_OWNER,
    assignedMemberIds: [],
    kind: "internal",
    isRfp: true,
    rfpApprovedAt: now,
    rfpAdminNote: `Proposed by ${proposer.firstName ?? proposer.handle ?? proposer.id}.`,
    hubspotStage: null,
    hubspotDealId: null,
    collectedRevenue: null,
    collectedAt: null,
    adminUserIds: [],
    talentBaseAmount: null,
    talentBonusAmount: null,
    bonusGate: null,
    pmEngagementRating: null,
    bonusDecision: null,
    bonusDecidedAt: null,
    createdAt: now,
    updatedAt: now,
  });

  // Fan out an admin notification so the initiative doesn't just
  // disappear into the void — proposer previously had no signal that
  // the submission went anywhere. Everyone flagged is_admin gets a
  // ping; production swaps in the notifications table proper.
  const admins = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.isAdmin, true));
  for (const admin of admins) {
    // Routed through the shared writer rather than pushed onto the
    // in-memory array — that push was why proposing an initiative
    // never lit the admin queue.
    await notify({
      userId: admin.id,
      kind: "prospective_contribution",
      title: `Initiative proposed: ${title}`,
      body: `${proposer.firstName ?? proposer.handle ?? "A member"} proposed a new internal initiative. Review + assign contributors.`,
      href: `/admin/projects`,
    });
  }

  await logAuditEvent({
    actorUserId: proposer.id,
    actorRoleSnapshot: snapshotActorRole(proposer),
    action: "user.applied",
    resourceKind: "project",
    resourceId: projectId,
    before: null,
    after: {
      kind: "internal_initiative",
      title,
      industry,
      proposerId: proposer.id,
    },
    reason: `Internal initiative proposed by ${proposer.firstName ?? proposer.handle ?? proposer.id}.`,
  });

  revalidatePath("/projects");
  revalidatePath("/dashboard");
  revalidatePath("/admin/projects");
  // Land the proposer on /projects with a hash the surface can pick
  // up to render a "your initiative is live" toast. Better than the
  // previous silent redirect.
  redirect(`/projects#new=${projectId}`);
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
            <span className="mt-1 block text-[11px] text-ink-faint">
              Owner is Future Modern (the cooperative — $BUILD.Store is our platform).
            </span>
          </label>

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
