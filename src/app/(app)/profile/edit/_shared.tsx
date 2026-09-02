/**
 * Shared plumbing for the /profile/edit section routes.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-09-02)
 *
 * The editor was one 1,200-line page with seven anchors. Jamar: "these
 * should not be taking people to different areas of a massive vertical
 * column. If the menu is going to be there, each piece of the menu
 * should have its own field."
 *
 * Each section is now its own route. They share one loader rather than
 * seven copies of the same reads, and the field primitives live here
 * so the section files stay close to pure markup.
 * ─────────────────────────────────────────────────────────────
 */
/**
 * Member profile editor.
 *
 * Sandbox: form posts but mutates an in-memory object;
 * REPLACE WITH: a real Drizzle UPDATE on the users table.
 *
 * Avatar upload in the sandbox is a URL field — swap for presigned S3 upload
 * or Vercel Blob when the real backend lands.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users as usersTable } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth-stub";
import { getApplicationsForUser } from "@/lib/readers/project-applications";
import {
  getAttributionForUser,
  mvpScoreReader,
  getPortfolioForUser,
  getQuotesForUser,
  getSplitsForRecipient,
  orderReader,
  safely,
  sellerApplicationReader,
} from "@/lib/readers";
import { getAllProjects } from "@/lib/readers/projects";
import { getAllUsers } from "@/lib/readers/users";
import { previewOrderSplit } from "@/lib/order-splits";
import {
  optInDataParticipation,
  optOutDataParticipation,
} from "@/lib/consent-actions";
import { claimDocumensoAccount } from "@/lib/documenso-member-actions";
import { uploadProfileAvatar } from "@/lib/image-upload-actions";
import {
  addMyTalentTag,
  removeMyTalentTag,
  rescanMyTalentTags,
} from "@/lib/talent-tag-actions";
import { getAgreementsForUser } from "@/lib/readers/agreements";
import { championsCourtMembers } from "@/lib/mvp-score";
import {
  AGREEMENT_PROVIDER_LABELS,
  AGREEMENT_TYPE_LABELS,
  INDUSTRY_LABELS,
  type Industry,
} from "@/lib/types";
import { Card, CardEyebrow } from "@/components/Card";
import { TierBadge } from "@/components/TierBadge";
import { Avatar } from "@/components/Avatar";
import { MvpCard } from "@/components/MvpCard";

export const ALL_INDUSTRIES: Industry[] = ["stem", "creative-media", "professional-services"];

export async function saveProfile(formData: FormData) {
  "use server";
  // Always resolve the writer from the actual session, not from a
  // hidden form field. Fixes the bug Rob hit: real Auth.js users
  // (like Rob, invited via Track A) weren't in the fixture array, so
  // the old lookup returned undefined and threw
  // "User not found" — everyone saw a broken save.
  const currentUser = await getCurrentUser();
  if (!currentUser) throw new Error("Sign in required");
  const uid = currentUser.id;

  // Compose the update patch from the form. Blank strings become
  // null for nullable columns; primaries fall back to current
  // values when empty so we don't clobber good data with a whitespace
  // submit.
  const firstName =
    String(formData.get("firstName") ?? "").trim() || currentUser.firstName;
  const lastName =
    String(formData.get("lastName") ?? "").trim() || currentUser.lastName;
  // Empty clears it and falls back to the first-name convention, so
  // someone can undo an alias without an admin.
  const displayName = String(formData.get("displayName") ?? "").trim() || null;
  const bio = String(formData.get("bio") ?? "").trim() || null;
  const rawTagline = String(formData.get("tagline") ?? "").trim();
  const tagline = rawTagline ? rawTagline.slice(0, 120) : null;
  const portfolioUrl =
    String(formData.get("portfolioUrl") ?? "").trim() || null;
  const profileImageUrl =
    String(formData.get("profileImageUrl") ?? "").trim() || null;

  const primaryRaw = String(formData.get("primaryIndustry") ?? "") as Industry;
  const primaryIndustry: Industry | null = ALL_INDUSTRIES.includes(primaryRaw)
    ? primaryRaw
    : currentUser.primaryIndustry;

  // Secondary pillars are checkbox values. Exclude the primary so
  // we never double-count.
  const rawSecondaries = formData.getAll("secondaryIndustries").map(String);
  const secondaryIndustries = rawSecondaries
    .filter((v): v is Industry => ALL_INDUSTRIES.includes(v as Industry))
    .filter((v) => v !== primaryIndustry);

  const skillsRaw = String(formData.get("skills") ?? "");
  const skills = skillsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const updatedAt = new Date().toISOString();

  // Real Postgres write. Wrapped in try so mock-only users
  // (view-as / seeded sandbox accounts that don't have a
  // Postgres row) still get their profile updated via the mock
  // path fallback — no regression for the dev/demo flow.
  // Writes straight to Postgres. No in-memory fallback: silently
  // "succeeding" into a mock array meant a member could edit their
  // profile, see a success state, and have nothing persist. Better to
  // surface the failure than to lie about it.
  const res = await db
    .update(usersTable)
    .set({
      firstName,
      displayName,
      lastName,
      bio,
      tagline,
      portfolioUrl,
      profileImageUrl,
      primaryIndustry,
      secondaryIndustries,
      skills,
      updatedAt,
    })
    .where(eq(usersTable.id, uid))
    .returning({ id: usersTable.id });

  if (res.length === 0) {
    throw new Error(
      "Could not save your profile — no matching account was found.",
    );
  }

  revalidatePath("/profile");
  revalidatePath("/dashboard");
  revalidatePath(`/u/${currentUser.handle}`);
}


/** Everything the edit sections read. One pass, shared by all of them. */
export async function loadProfileEditData() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  // Reader swap 2026-08-29: every block below read a fixture array, so
  // a member's own profile showed seed work, seed quotes, seed
  // earnings, and seed orders.
  const [
    myPortfolio,
    myQuotes,
    myAttribution,
    myPayouts,
    { projects: allProjects },
    allOrders,
    sellerApps,
    myMvpSnapshot,
    allScores,
    { users: roster },
  ] = await Promise.all([
    safely(() => getPortfolioForUser(user.id), []),
    safely(() => getQuotesForUser(user.id), []),
    safely(() => getAttributionForUser(user.id), []),
    safely(() => getSplitsForRecipient(user.id), []),
    safely(() => getAllProjects(), {
      projects: [],
      source: "postgres" as const,
    }),
    safely(() => orderReader.all(), []),
    safely(() => sellerApplicationReader.all(), []),
    safely(() => mvpScoreReader.byId(user.id), null),
    safely(() => mvpScoreReader.all(), []),
    safely(() => getAllUsers(), { users: [], source: "postgres" as const }),
  ]);
  const portfolioPublished = myPortfolio.filter((p) => p.publishedAt).length;
  const portfolioPending = myPortfolio.filter(
    (p) => !p.publishedAt && !p.rejectedAt,
  ).length;
  const portfolioRejected = myPortfolio.filter((p) => p.rejectedAt).length;

  const quotesApproved = myQuotes.filter((q) => q.approvedAt).length;
  const quotesPending = myQuotes.filter(
    (q) => !q.approvedAt && !q.rejectedAt,
  ).length;
  const quotesRejected = myQuotes.filter((q) => q.rejectedAt).length;

  // Attribution & payout snapshots — Phase 1 surfaces.
  const lifetimePaid = myPayouts
    .filter((s) => s.payoutStatus === "sent")
    .reduce((sum, s) => sum + Number(s.amount), 0);

  // Personal cockpit metrics + contracts list (task #61, moved from
  // a standalone /dashboard/personal into /profile per Jamar's call —
  // "yeah let's move that page to the profile tab and have people
  // surface their contracts there for quick uncluttered review").
  //
  // Client-side (users with projects where they're the client) view
  // ships when task #44 magic-link → optional account creation lands;
  // the shape below is talent-first.
  const myApplications = await safely(
    () => getApplicationsForUser(user.id),
    [],
  );
  // Hoisted: this used to be fetched inside a JSX IIFE, which cannot
  // await. Both reads now sit with the rest of the page's data.
  const myAgreements = await safely(() => getAgreementsForUser(user.id), []);
  const myProposalsSent = myApplications.length;
  const myProposalsAccepted = myApplications.filter(
    (a) => a.status === "approved",
  ).length;
  const myAssignedProjects = allProjects.filter(
    (p) => Array.isArray(p.assignedMemberIds) && p.assignedMemberIds.includes(user.id),
  );
  const myActiveContracts = myAssignedProjects.filter(
    (p) => p.status === "in_progress",
  );
  const myCompletedContracts = myAssignedProjects.filter(
    (p) => p.status === "completed",
  );
  // Cooperative profits attributable to this contributor's work:
  // approximate as FM's 15/85 share of the contributor's earned
  // payouts. Real figure comes from settlement metadata once the
  // revenue-split ledger lands its "fm_share" column; today's
  // approximation is a good-enough headline number.
  const coopProfitsFromMe = Math.round((lifetimePaid * 15) / 85);

  // Marketplace seller posture — drives the fulfillment dashboard card.
  const sellerApp = [...sellerApps]
    .filter((a) => a.userId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const isApprovedSeller = sellerApp?.status === "approved";
  const sellerOrders = allOrders.filter((o) => o.sellerId === user.id);
  const actionableOrders = sellerOrders.filter(
    (o) => o.status === "placed" || o.status === "paid" || o.status === "fulfilling",
  );
  const inFlightOrders = sellerOrders.filter((o) => o.status === "shipped");
  const settledOrders = sellerOrders.filter((o) => o.status === "delivered");
  const sellerLifetime = sellerOrders
    .filter((o) => o.splitDistributedAt)
    .reduce((sum, o) => sum + previewOrderSplit(Number(o.subtotal)).seller, 0);

  // Task #66 — /profile UX pass. Compute one place for the hero-strip
  // headline stats so the top of the page reads like a proper profile,
  // not a raw form. Every value here is already computed above; this
  // just names them for the hero.
  const heroStats: Array<{ label: string; value: string }> = [
    { label: "Proposals sent", value: String(myProposalsSent) },
    { label: "Active contracts", value: String(myActiveContracts.length) },
    { label: "Completed", value: String(myCompletedContracts.length) },
    {
      label: "Lifetime paid",
      value: `$${lifetimePaid.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    },
  ];
  const mvp = myMvpSnapshot;


  return {
    user,
    myPortfolio,
    myQuotes,
    myAttribution,
    myPayouts,
    allProjects,
    allOrders,
    sellerApps,
    myMvpSnapshot,
    allScores,
    roster,
    myApplications,
    myAgreements,
    portfolioPublished,
    portfolioPending,
    portfolioRejected,
    quotesApproved,
    quotesPending,
    quotesRejected,
    lifetimePaid,
    myProposalsSent,
    myProposalsAccepted,
    myAssignedProjects,
    myActiveContracts,
    myCompletedContracts,
    sellerApp,
    isApprovedSeller,
    sellerOrders,
    actionableOrders,
    inFlightOrders,
    settledOrders,
    mvp,
    coopProfitsFromMe,
    sellerLifetime,
  };
}

export function Field({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-ink-muted">{label}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
      />
    </label>
  );
}

export function Metric({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-3">
      <div className="text-[10px] uppercase tracking-wider text-ink-muted">
        {label}
      </div>
      <div className="mt-1 font-display text-2xl font-semibold">{value}</div>
      {hint && (
        <div className="mt-0.5 text-[10px] text-ink-faint">{hint}</div>
      )}
    </div>
  );
}

export function SellerStat({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: number | string;
  hint: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface)] px-4 py-3">
      <div
        className="text-[10px] uppercase tracking-wider"
        style={{ color: accent }}
      >
        {label}
      </div>
      <div className="mt-1 font-display text-2xl font-semibold">{value}</div>
      <div className="mt-0.5 text-[11px] text-ink-faint">{hint}</div>
    </div>
  );
}

