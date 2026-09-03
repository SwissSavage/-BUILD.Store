/**
 * Membership tiers + application flow. Shows the four tiers,
 * marks the current one, and lets the user submit a promotion
 * application to the next tier.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth-stub";
import { randomUUID } from "crypto";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { membershipApplications } from "@/db/schema";
import { membershipApplicationReader, safely } from "@/lib/readers";
import { TIER_LABELS, type MembershipTier } from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { TierBadge } from "@/components/TierBadge";
import { cn } from "@/lib/cn";

export const dynamic = "force-dynamic";

const TIER_ORDER: MembershipTier[] = ["viewer", "partner", "member"];

const TIER_DESCRIPTIONS: Record<MembershipTier, string> = {
  viewer: "Public browsing. See showcase, partners, public content.",
  partner:
    "Active revenue-sharing contributor. Project access, wallet, profile. Votes in the Partner body on operational governance.",
  member:
    "Full cooperative stewardship. Votes in both bodies (operational plus existential), holds treasury and covenant voice, ratifies structural changes, and holds DAO-style autonomy on awarded projects.",
};

async function applyForTier(formData: FormData) {
  "use server";
  const uid = String(formData.get("uid") ?? "");
  const currentTier = String(formData.get("currentTier") ?? "") as MembershipTier;
  const requestedTier = String(formData.get("requestedTier") ?? "") as Exclude<MembershipTier, "viewer">;
  const why = String(formData.get("why") ?? "");

  // Persisted. This pushed to an in-memory array, so a member applied
  // to move up a tier, saw a pending state, and /admin/applications
  // never received it.
  await db.insert(membershipApplications).values({
    id: `app_${randomUUID()}`,
    userId: uid,
    requestedTier,
    currentTier,
    status: "pending",
    applicationData: { why },
    reviewedBy: null,
    reviewedAt: null,
    createdAt: new Date().toISOString(),
  });

  revalidatePath("/membership");
  revalidatePath("/admin/applications");
}

export default async function MembershipPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  // Scoped to this member in SQL — nobody's tier application should
  // cause a read of anyone else's.
  const myPending = await safely(
    () =>
      membershipApplicationReader.one(
        and(
          eq(membershipApplications.userId, user.id),
          eq(membershipApplications.status, "pending"),
        )!,
      ),
    null,
  );
  const currentIdx = TIER_ORDER.indexOf(user.membershipTier);
  const nextTier = TIER_ORDER[currentIdx + 1] as Exclude<MembershipTier, "viewer"> | undefined;

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <h1 className="font-display text-4xl font-semibold">Membership</h1>
      <p className="mt-2 text-ink-muted">
        Progression is application-based. Admin review.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {TIER_ORDER.map((tier) => {
          const isCurrent = tier === user.membershipTier;
          return (
            <Card
              key={tier}
              className={cn(
                isCurrent && "border-brand-magenta",
              )}
            >
              <div className="flex items-start justify-between">
                <CardEyebrow>{isCurrent ? "Your tier" : "Tier"}</CardEyebrow>
                <TierBadge tier={tier} />
              </div>
              <CardTitle className="mt-3">{TIER_LABELS[tier]}</CardTitle>
              <p className="mt-2 text-sm text-ink-muted">
                {TIER_DESCRIPTIONS[tier]}
              </p>
            </Card>
          );
        })}
      </div>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">Apply for promotion</h2>

        {myPending ? (
          <Card className="mt-4">
            <CardEyebrow>Pending application</CardEyebrow>
            <CardTitle className="mt-2">
              Requested: {TIER_LABELS[myPending.requestedTier]}
            </CardTitle>
            <p className="mt-2 text-sm text-ink-muted">
              Submitted {new Date(myPending.createdAt).toLocaleDateString()}. An admin
              will review.
            </p>
          </Card>
        ) : !nextTier ? (
          <Card className="mt-4">
            <p className="text-sm text-ink-muted">
              You&apos;re at the top tier. Nothing to apply for.
            </p>
          </Card>
        ) : (
          <Card className="mt-4">
            <CardEyebrow>Next tier</CardEyebrow>
            <CardTitle className="mt-2">{TIER_LABELS[nextTier]}</CardTitle>
            <form action={applyForTier} className="mt-4 space-y-4">
              <input type="hidden" name="uid" value={user.id} />
              <input type="hidden" name="currentTier" value={user.membershipTier} />
              <input type="hidden" name="requestedTier" value={nextTier} />
              <label className="block">
                <span className="text-xs uppercase tracking-wider text-ink-muted">
                  Why now?
                </span>
                <textarea
                  name="why"
                  rows={4}
                  required
                  className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
                />
              </label>
              <button
                type="submit"
                className="rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-[var(--surface)] hover:bg-brand-magenta hover:text-black"
              >
                Submit application
              </button>
            </form>
          </Card>
        )}
      </section>
    </div>
  );
}
