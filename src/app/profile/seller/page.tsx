/**
 * Member-facing marketplace application (Phase 2.1 sandbox preview).
 *
 * Three states this page can be in:
 *   1. No application yet → show the form.
 *   2. Pending review → show submission summary + "we'll be in touch".
 *   3. Decided (approved / rejected) → show decision + admin note +
 *      re-apply CTA if rejected.
 *
 * Shape mirrors /admin/marketplace — a member posts an application,
 * admin decides there. The applicant never sees other members'
 * submissions, only their own.
 *
 * REPLACE WITH: Drizzle insert on `seller_applications` + lookup by the
 * authenticated user id. Currently writes to MOCK_SELLER_APPLICATIONS in
 * memory so the admin queue updates live across the sandbox.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_SELLER_APPLICATIONS } from "@/lib/mock-data/seller-applications";
import {
  MARKETPLACE_CATEGORY_LABELS,
  SELLER_APPLICATION_STATUS_LABELS,
  type MarketplaceCategory,
  type SellerApplication,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

const CATEGORY_ORDER: MarketplaceCategory[] = [
  "goods",
  "saas",
  "energy",
  "creative-services",
  "clothing",
];

async function submitApplication(formData: FormData) {
  "use server";
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required");
  const requestedCategories = CATEGORY_ORDER.filter(
    (c) => formData.get(`cat_${c}`) === "on",
  );
  if (requestedCategories.length === 0) {
    throw new Error("Select at least one category.");
  }
  const pitch = String(formData.get("pitch") ?? "").trim();
  if (pitch.length < 40) {
    throw new Error("Pitch must be at least 40 characters.");
  }

  const now = new Date().toISOString();
  const application: SellerApplication = {
    id: `sa_${Date.now()}`,
    userId: user.id,
    requestedCategories,
    pitch,
    status: "pending",
    reviewedBy: null,
    reviewedAt: null,
    adminNote: null,
    createdAt: now,
  };
  MOCK_SELLER_APPLICATIONS.push(application);
  revalidatePath("/profile/seller");
  revalidatePath("/admin/marketplace");
  revalidatePath("/admin");
}

export default async function SellerApplicationPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin?next=/profile/seller");

  // Most recent application (if any)
  const mine = [...MOCK_SELLER_APPLICATIONS]
    .filter((a) => a.userId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const latest = mine[0];
  const isApproved = latest?.status === "approved";
  const isPending = latest?.status === "pending";

  // Heading + subtitle are state-driven. Once a member is approved this
  // stops being an application page and becomes their seller home — the
  // form collapses to a "request more categories" affordance below.
  const heading = isApproved
    ? "Marketplace seller"
    : isPending
      ? "Marketplace seller — application in review"
      : "Apply to sell on the cooperative store";
  const subtitle = isApproved
    ? "Your seller home. Categories you've been approved for, fulfillment dashboard, and the option to request access to more categories."
    : isPending
      ? "Your application is with admin. Once it clears, this page becomes your seller home with categories, fulfillment, and the option to request more access."
      : "$BUILD.Store accepts listings from vetted Future Modern members. Every approved listing contributes 15% to the cooperative; 85% routes to you. Tell us what you'd like to sell and how fulfillment works.";

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/profile" className="text-sm text-ink-muted hover:text-ink">
        ← Profile
      </Link>
      <h1 className="mt-3 font-display text-4xl font-semibold">{heading}</h1>
      <p className="mt-2 text-ink-muted">{subtitle}</p>

      {latest && latest.status === "pending" && (
        <Card className="mt-8">
          <CardEyebrow>Current submission</CardEyebrow>
          <CardTitle className="mt-2">Pending review</CardTitle>
          <p className="mt-3 text-sm text-ink-muted">
            Admin is reviewing your request for{" "}
            {latest.requestedCategories
              .map((c) => MARKETPLACE_CATEGORY_LABELS[c])
              .join(" + ")}
            . You&apos;ll get an update as soon as a decision is made,
            usually within 3 business days.
          </p>
          <p className="mt-3 text-xs text-ink-faint">
            Submitted {new Date(latest.createdAt).toLocaleDateString()}
          </p>
        </Card>
      )}

      {latest && latest.status === "approved" && (
        <Card className="mt-8 border-brand-green/40">
          <CardEyebrow>Listing access</CardEyebrow>
          <CardTitle className="mt-2">
            {latest.requestedCategories
              .map((c) => MARKETPLACE_CATEGORY_LABELS[c])
              .join(" + ")}
          </CardTitle>
          <p className="mt-3 text-sm text-ink-muted">
            You can draft listings in any of the categories above. Each
            new listing still goes through a pending-review pass before
            it shows up on /store, which keeps quality tight.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/profile/seller/orders"
              className="inline-block rounded-full px-5 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: "#D828A0" }}
            >
              Open fulfillment dashboard →
            </Link>
            <Link
              href="/profile"
              className="inline-block rounded-full border border-[var(--surface-border)] px-5 py-2 text-sm hover:border-brand-magenta hover:text-brand-magenta"
            >
              Draft a new listing →
            </Link>
          </div>
          {latest.adminNote && (
            <p className="mt-4 text-xs text-ink-faint">
              Admin note: {latest.adminNote}
            </p>
          )}
        </Card>
      )}

      {latest && latest.status === "rejected" && (
        <Card className="mt-8">
          <CardEyebrow>Not approved — yet</CardEyebrow>
          <CardTitle className="mt-2">
            {SELLER_APPLICATION_STATUS_LABELS[latest.status]}
          </CardTitle>
          {latest.adminNote && (
            <p className="mt-3 text-sm text-ink-muted">
              Admin note: {latest.adminNote}
            </p>
          )}
          <p className="mt-3 text-sm text-ink-muted">
            Address the note above and resubmit. The form below stays open.
          </p>
        </Card>
      )}

      {(!latest || latest.status === "rejected") && (
        <form action={submitApplication} className="mt-10 space-y-6">
          <fieldset>
            <legend className="text-xs uppercase tracking-wider text-brand-magenta">
              Categories I want to sell in
            </legend>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {CATEGORY_ORDER.map((c) => (
                <label
                  key={c}
                  className="flex cursor-pointer items-center justify-between rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-3 text-sm transition-colors hover:border-brand-magenta"
                >
                  {MARKETPLACE_CATEGORY_LABELS[c]}
                  <input
                    type="checkbox"
                    name={`cat_${c}`}
                    className="accent-brand-magenta"
                  />
                </label>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="text-xs uppercase tracking-wider text-brand-magenta">
              Pitch
            </span>
            <textarea
              name="pitch"
              rows={6}
              required
              minLength={40}
              placeholder="What are you selling, how is it fulfilled, and what makes it cooperative-aligned? Admins weigh logistics, provenance, and fit with other members."
              className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
            />
            <span className="mt-1 block text-xs text-ink-faint">
              40 characters minimum. Be specific about fulfillment — this
              is what admin reviews on.
            </span>
          </label>

          <button
            type="submit"
            className="w-full rounded-full bg-ink py-3 font-medium text-[var(--surface)] transition-colors hover:bg-brand-magenta hover:text-brand-white"
          >
            Submit for review
          </button>
        </form>
      )}

      {!isApproved && (
        <Card className="mt-12">
          <CardEyebrow>What admin checks</CardEyebrow>
          <p className="mt-2 text-sm text-ink-muted">
            Logistics fit (can you actually fulfill what you&apos;re
            listing?), provenance for any resale categories, returns
            policy, category overlap with existing sellers. Goods, SaaS,
            energy and creative services each have their own vetting
            lens.
          </p>
        </Card>
      )}
    </div>
  );
}
