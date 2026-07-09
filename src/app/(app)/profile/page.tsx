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
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_USERS } from "@/lib/mock-data/users";
import { MOCK_PORTFOLIO } from "@/lib/mock-data/portfolio";
import { MOCK_QUOTES } from "@/lib/mock-data/quotes";
import { MOCK_ATTRIBUTION } from "@/lib/mock-data/attribution";
import { MOCK_SPLITS } from "@/lib/mock-data/splits";
import { MOCK_ORDERS } from "@/lib/mock-data/orders";
import { MOCK_SELLER_APPLICATIONS } from "@/lib/mock-data/seller-applications";
import { previewOrderSplit } from "@/lib/order-splits";
import {
  optInDataParticipation,
  optOutDataParticipation,
} from "@/lib/consent-actions";
import {
  addMyTalentTag,
  removeMyTalentTag,
  rescanMyTalentTags,
} from "@/lib/talent-tag-actions";
import { mvpScoreForUser, MOCK_MVP_SCORES } from "@/lib/mock-data/mvp-scores";
import { championsCourtMembers } from "@/lib/mvp-score";
import { INDUSTRY_LABELS, type Industry } from "@/lib/types";
import { Card, CardEyebrow } from "@/components/Card";
import { TierBadge } from "@/components/TierBadge";
import { Avatar } from "@/components/Avatar";
import { MvpCard } from "@/components/MvpCard";

const ALL_INDUSTRIES: Industry[] = ["stem", "creative-media", "professional-services"];

async function saveProfile(formData: FormData) {
  "use server";
  const uid = String(formData.get("uid") ?? "");
  const u = MOCK_USERS.find((x) => x.id === uid);
  if (!u) throw new Error("User not found");

  u.firstName = String(formData.get("firstName") ?? "") || u.firstName;
  u.lastName = String(formData.get("lastName") ?? "") || u.lastName;
  u.bio = String(formData.get("bio") ?? "") || null;
  u.portfolioUrl = String(formData.get("portfolioUrl") ?? "") || null;
  u.profileImageUrl = String(formData.get("profileImageUrl") ?? "") || null;

  const primary = String(formData.get("primaryIndustry") ?? "") as Industry;
  if (ALL_INDUSTRIES.includes(primary)) {
    u.primaryIndustry = primary;
  }

  // Secondary pillars arrive as individual checkbox values. FormData.getAll
  // collects them. Exclude the primary so we never double-count.
  const rawSecondaries = formData.getAll("secondaryIndustries").map(String);
  u.secondaryIndustries = rawSecondaries
    .filter((v): v is Industry => ALL_INDUSTRIES.includes(v as Industry))
    .filter((v) => v !== u.primaryIndustry);

  const skillsRaw = String(formData.get("skills") ?? "");
  u.skills = skillsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  u.updatedAt = new Date().toISOString();

  revalidatePath("/profile");
  revalidatePath("/dashboard");
}

export default async function ProfilePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const myPortfolio = MOCK_PORTFOLIO.filter((p) => p.userId === user.id);
  const portfolioPublished = myPortfolio.filter((p) => p.publishedAt).length;
  const portfolioPending = myPortfolio.filter(
    (p) => !p.publishedAt && !p.rejectedAt,
  ).length;
  const portfolioRejected = myPortfolio.filter((p) => p.rejectedAt).length;

  const myQuotes = MOCK_QUOTES.filter((q) => q.userId === user.id);
  const quotesApproved = myQuotes.filter((q) => q.approvedAt).length;
  const quotesPending = myQuotes.filter(
    (q) => !q.approvedAt && !q.rejectedAt,
  ).length;
  const quotesRejected = myQuotes.filter((q) => q.rejectedAt).length;

  // Attribution & payout snapshots — Phase 1 surfaces.
  const myAttribution = MOCK_ATTRIBUTION.filter((a) => a.userId === user.id);
  const myPayouts = MOCK_SPLITS.filter((s) => s.recipientId === user.id);
  const lifetimePaid = myPayouts
    .filter((s) => s.payoutStatus === "sent")
    .reduce((sum, s) => sum + Number(s.amount), 0);

  // Marketplace seller posture — drives the fulfillment dashboard card.
  const sellerApp = [...MOCK_SELLER_APPLICATIONS]
    .filter((a) => a.userId === user.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  const isApprovedSeller = sellerApp?.status === "approved";
  const sellerOrders = MOCK_ORDERS.filter((o) => o.sellerId === user.id);
  const actionableOrders = sellerOrders.filter(
    (o) => o.status === "placed" || o.status === "paid" || o.status === "fulfilling",
  );
  const inFlightOrders = sellerOrders.filter((o) => o.status === "shipped");
  const settledOrders = sellerOrders.filter((o) => o.status === "delivered");
  const sellerLifetime = sellerOrders
    .filter((o) => o.splitDistributedAt)
    .reduce((sum, o) => sum + previewOrderSplit(Number(o.subtotal)).seller, 0);

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-4xl font-semibold">Your profile</h1>
        <TierBadge tier={user.membershipTier} />
      </div>

      <Card className="mt-8">
        <CardEyebrow>Edit</CardEyebrow>
        <form action={saveProfile} className="mt-4 space-y-5">
          <input type="hidden" name="uid" value={user.id} />

          <div className="flex items-center gap-4">
            <Avatar user={user} size="xl" />
            <div className="flex-1">
              <label className="block">
                <span className="text-xs uppercase tracking-wider text-ink-muted">
                  Profile image URL
                </span>
                <input
                  name="profileImageUrl"
                  defaultValue={user.profileImageUrl ?? ""}
                  placeholder="https://… (leave blank for initials)"
                  className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
                />
              </label>
              <p className="mt-1.5 text-xs text-ink-faint">
                Sandbox mode — paste any public image URL. Replaced by real
                uploads once storage is wired up.
              </p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Field name="firstName" label="First name" defaultValue={user.firstName ?? ""} />
            <Field name="lastName" label="Last name" defaultValue={user.lastName ?? ""} />
          </div>

          <label className="block">
            <span className="text-xs uppercase tracking-wider text-ink-muted">
              Primary pillar
            </span>
            <select
              name="primaryIndustry"
              defaultValue={user.primaryIndustry ?? "creative-media"}
              className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
            >
              {ALL_INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {INDUSTRY_LABELS[i]}
                </option>
              ))}
            </select>
            <p className="mt-1.5 text-xs text-ink-faint">
              Where you spend most of your time. Drives default RFP and job matching.
            </p>
          </label>

          <fieldset className="rounded-lg border border-[var(--surface-border)] p-4">
            <legend className="px-2 text-xs uppercase tracking-wider text-ink-muted">
              Secondary pillars
            </legend>
            <p className="text-xs text-ink-faint">
              Additional areas you contribute to. Expands matching beyond your primary.
            </p>
            <div className="mt-3 flex flex-wrap gap-4">
              {ALL_INDUSTRIES.map((i) => (
                <label key={i} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="secondaryIndustries"
                    value={i}
                    defaultChecked={user.secondaryIndustries.includes(i)}
                    className="h-4 w-4 rounded border-[var(--surface-border)]"
                  />
                  {INDUSTRY_LABELS[i]}
                </label>
              ))}
            </div>
          </fieldset>

          <Field
            name="skills"
            label="Skills (comma separated)"
            defaultValue={user.skills.join(", ")}
          />

          <Field name="portfolioUrl" label="Portfolio URL" defaultValue={user.portfolioUrl ?? ""} />

          <label className="block">
            <span className="text-xs uppercase tracking-wider text-ink-muted">Bio</span>
            <textarea
              name="bio"
              rows={4}
              defaultValue={user.bio ?? ""}
              className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
            />
          </label>

          <button
            type="submit"
            className="rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-[var(--surface)] hover:bg-brand-magenta hover:text-brand-white"
          >
            Save profile
          </button>
        </form>
      </Card>

      {(() => {
        const mvpSnapshot = mvpScoreForUser(user.id);
        if (!mvpSnapshot) return null;
        const courtIds = new Set(championsCourtMembers(MOCK_MVP_SCORES, MOCK_USERS));
        const isInCourt = courtIds.has(user.id);
        return (
          <div className="mt-6">
            <MvpCard
              snapshot={mvpSnapshot}
              user={user}
              mode="self"
              isInCourt={isInCourt}
            />
            <p className="mt-2 text-[11px] text-ink-faint">
              Your MVP Score. Sub-rating breakdown is self-only by
              cooperative policy. Peer Members see your OVR + standing
              band + active compliance signal (if any), nothing else.
              Public web sees nothing. See <code>future-modern.md</code>{" "}
              &quot;MVP Score&quot; for the full architecture.
            </p>
          </div>
        );
      })()}

      <Card className="mt-6 border-[#5070F0]/40">
        <CardEyebrow>Data participation</CardEyebrow>
        <h2 className="mt-1 font-display text-xl font-semibold">
          Labor-value research opt-in
        </h2>
        <p className="mt-2 max-w-prose text-sm text-ink-muted">
          When you opt in, the cooperative includes your engagement data
          in the anonymized aggregates we publish as labor-value research
          and use as inputs to collective-bargaining tooling. Worker-side
          aligned by covenant. Raw price points never leave; anonymized
          only. Opt out anytime. Read the{" "}
          <Link
            href="/data-use-policy"
            className="text-brand-magenta hover:underline"
          >
            Data Use Policy
          </Link>{" "}
          for the full scope.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span
            className="rounded-full px-3 py-1 text-xs"
            style={{
              backgroundColor: user.dataParticipation
                ? "rgba(0, 112, 72, 0.12)"
                : "rgba(102, 102, 102, 0.12)",
              color: user.dataParticipation ? "#007048" : "#666666",
            }}
          >
            {user.dataParticipation ? "Opted in" : "Not opted in"}
          </span>
          {user.dataParticipation ? (
            <form action={optOutDataParticipation}>
              <button
                type="submit"
                className="rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-xs hover:border-brand-magenta hover:text-brand-magenta"
              >
                Opt out
              </button>
            </form>
          ) : (
            <form action={optInDataParticipation}>
              <button
                type="submit"
                className="rounded-full px-4 py-1.5 text-xs font-medium text-white"
                style={{ backgroundColor: "#5070F0" }}
              >
                Opt in
              </button>
            </form>
          )}
        </div>
        <p className="mt-3 text-xs text-ink-faint">
          Tier-1 operational use (internal pricing, matching, calibration)
          is governed by your registration terms and is not affected by
          this toggle.
        </p>
      </Card>

      <Card className="mt-6 border-[#D828A0]/40">
        <CardEyebrow>Talent match tags</CardEyebrow>
        <h2 className="mt-1 font-display text-xl font-semibold">
          How the cooperative routes opportunities to you
        </h2>
        <p className="mt-2 max-w-prose text-sm text-ink-muted">
          The cooperative scrubs your bio, skills, discipline, and
          portfolio for keywords, then matches them against incoming
          briefs even when clients use different vocabulary. You can
          add tags we missed and remove anything that doesn&apos;t
          represent you. Tier-1 operational use (internal matching) is
          governed by registration terms.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {(user.talentTags ?? []).length === 0 ? (
            <span className="text-xs text-ink-muted">
              No tags yet. Rescan to populate.
            </span>
          ) : (
            (user.talentTags ?? []).map((t) => (
              <form key={t} action={removeMyTalentTag}>
                <input type="hidden" name="tag" value={t} />
                <button
                  type="submit"
                  className="group rounded-full px-3 py-1 text-xs"
                  style={{
                    backgroundColor: "rgba(216, 40, 160, 0.10)",
                    color: "#D828A0",
                  }}
                  title="Click to remove"
                >
                  #{t}{" "}
                  <span className="opacity-0 transition-opacity group-hover:opacity-100">
                    ✕
                  </span>
                </button>
              </form>
            ))
          )}
        </div>

        <form action={addMyTalentTag} className="mt-4 flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-[11px] uppercase tracking-wider text-ink-muted">
            Add tag(s) — comma or space separated
            <input
              name="tag"
              placeholder="retrofit, brand-system, gtm"
              className="mt-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-1.5 text-sm normal-case tracking-normal text-ink"
            />
          </label>
          <button
            type="submit"
            className="rounded-full px-4 py-1.5 text-xs font-medium text-white"
            style={{ backgroundColor: "#D828A0" }}
          >
            Append
          </button>
        </form>

        <form action={rescanMyTalentTags} className="mt-3">
          <button
            type="submit"
            className="rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-xs hover:border-brand-magenta hover:text-brand-magenta"
          >
            Rescan from bio + skills + portfolio
          </button>
        </form>
      </Card>

      {isApprovedSeller ? (
        <section
          className="mt-6 rounded-2xl border p-6"
          style={{
            borderColor: "rgba(216, 40, 160, 0.45)",
            background:
              "linear-gradient(135deg, rgba(216,40,160,0.08), rgba(80,112,240,0.05))",
          }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardEyebrow>Marketplace fulfillment</CardEyebrow>
              <h2 className="mt-2 font-display text-2xl font-semibold">
                Your seller control room
              </h2>
              <p className="mt-2 max-w-xl text-sm text-ink-muted">
                Triage placed orders, save tracking, advance shipments, and
                watch the split engine settle. Buyers see status changes in
                real time.
              </p>
            </div>
            <Link
              href="/profile/seller/orders"
              className="rounded-full px-5 py-2.5 text-sm font-medium text-white shadow-sm"
              style={{ backgroundColor: "#D828A0" }}
            >
              Open fulfillment dashboard →
            </Link>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-4">
            <SellerStat
              label="Action queue"
              value={actionableOrders.length}
              hint="placed · paid · fulfilling"
              accent="#D828A0"
            />
            <SellerStat
              label="In transit"
              value={inFlightOrders.length}
              hint="shipped, awaiting delivery"
              accent="#5070F0"
            />
            <SellerStat
              label="Delivered"
              value={settledOrders.length}
              hint="ready for split"
              accent="#007048"
            />
            <SellerStat
              label="Distributed to you"
              value={`$${Math.round(sellerLifetime).toLocaleString()}`}
              hint="lifetime, after split"
              accent="#5070F0"
            />
          </div>
          {actionableOrders.length > 0 && (
            <p className="mt-4 text-xs text-brand-magenta">
              {actionableOrders.length}{" "}
              {actionableOrders.length === 1 ? "order needs" : "orders need"}{" "}
              your attention.
            </p>
          )}
        </section>
      ) : (
        <Card className="mt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardEyebrow>Marketplace</CardEyebrow>
              <p className="mt-2 text-sm text-ink-muted">
                List goods, services, SaaS or wearables. 85% of every sale
                routes to you; 12% ops, 1.5% Treasury, 1.5% Liquidity Pool.
                Seller applications take 48h in real life.
              </p>
            </div>
            <Link
              href="/profile/seller"
              className="shrink-0 rounded-full bg-ink px-4 py-2 text-xs font-medium text-[var(--surface)] hover:bg-brand-magenta hover:text-brand-white"
            >
              {sellerApp
                ? sellerApp.status === "pending"
                  ? "View application →"
                  : "Re-apply →"
                : "Apply to sell →"}
            </Link>
          </div>
        </Card>
      )}

      <Card className="mt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardEyebrow>Portfolio</CardEyebrow>
            <p className="mt-2 text-sm text-ink-muted">
              Submit work samples — admins scrub PII before pieces appear on your
              public profile or the showcase.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-ink-muted">
                {portfolioPublished} published
              </span>
              {portfolioPending > 0 && (
                <span
                  className="rounded-full px-2 py-0.5 font-medium"
                  style={{
                    backgroundColor: "rgba(80,112,240,0.15)",
                    color: "#5070F0",
                  }}
                >
                  {portfolioPending} pending
                </span>
              )}
              {portfolioRejected > 0 && (
                <span
                  className="rounded-full px-2 py-0.5 font-medium"
                  style={{
                    backgroundColor: "rgba(229,62,62,0.15)",
                    color: "#E53E3E",
                  }}
                >
                  {portfolioRejected} needs revision
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <Link
              href="/profile/portfolio"
              className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-[var(--surface)] hover:bg-brand-magenta hover:text-brand-white"
            >
              Manage portfolio →
            </Link>
            <Link
              href={`/u/${user.handle}`}
              className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-center text-xs hover:border-brand-magenta"
            >
              View public profile
            </Link>
          </div>
        </div>
      </Card>

      <Card className="mt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardEyebrow>Quote sheets</CardEyebrow>
            <p className="mt-2 text-sm text-ink-muted">
              Your responses to open RFPs. Admins scrub direct-contact info
              before any sheet reaches the client.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-ink-muted">
                {quotesApproved} sent
              </span>
              {quotesPending > 0 && (
                <span
                  className="rounded-full px-2 py-0.5 font-medium"
                  style={{
                    backgroundColor: "rgba(80,112,240,0.15)",
                    color: "#5070F0",
                  }}
                >
                  {quotesPending} pending
                </span>
              )}
              {quotesRejected > 0 && (
                <span
                  className="rounded-full px-2 py-0.5 font-medium"
                  style={{
                    backgroundColor: "rgba(229,62,62,0.15)",
                    color: "#E53E3E",
                  }}
                >
                  {quotesRejected} needs revision
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <Link
              href="/profile/quotes"
              className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-[var(--surface)] hover:bg-brand-magenta hover:text-brand-white"
            >
              Track quotes →
            </Link>
            <Link
              href="/contracts"
              className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-center text-xs hover:border-brand-magenta"
            >
              Browse open RFPs
            </Link>
          </div>
        </div>
      </Card>

      <Card className="mt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardEyebrow>Payouts (Stripe Connect)</CardEyebrow>
            <p className="mt-2 text-sm text-ink-muted">
              We never store your bank info — Stripe holds it. We only retain
              your tokenized account reference, so a breach on our side
              can&apos;t expose anything that touches money.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              {user.stripePayoutsEnabled ? (
                <span
                  className="rounded-full px-2.5 py-0.5 font-medium"
                  style={{
                    backgroundColor: "rgba(0,112,72,0.15)",
                    color: "#007048",
                  }}
                >
                  Payouts enabled
                </span>
              ) : user.stripeAccountId ? (
                <span
                  className="rounded-full px-2.5 py-0.5 font-medium"
                  style={{
                    backgroundColor: "rgba(80,112,240,0.15)",
                    color: "#5070F0",
                  }}
                >
                  Onboarding incomplete
                </span>
              ) : (
                <span
                  className="rounded-full px-2.5 py-0.5 font-medium"
                  style={{
                    backgroundColor: "rgba(229,62,62,0.15)",
                    color: "#E53E3E",
                  }}
                >
                  Not connected
                </span>
              )}
              {user.stripeAccountId && (
                <span className="font-mono text-ink-faint">
                  {user.stripeAccountId.slice(0, 16)}…
                </span>
              )}
            </div>
            {lifetimePaid > 0 && (
              <p className="mt-3 text-xs text-ink-faint">
                Lifetime paid through the cooperative:{" "}
                <span className="font-medium text-ink">
                  ${lifetimePaid.toLocaleString()}
                </span>
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <Link
              href="/profile/payouts"
              className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-[var(--surface)] hover:bg-brand-magenta hover:text-brand-white"
            >
              {user.stripeAccountId ? "Manage payouts →" : "Connect payouts →"}
            </Link>
          </div>
        </div>
      </Card>

      <Card className="mt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardEyebrow>Attribution</CardEyebrow>
            <p className="mt-2 text-sm text-ink-muted">
              The ledger of contracts where you&apos;ve been credited.
              Drives your share of the 85% contributor pool when revenue
              settles. Append-only — historical record stays intact.
            </p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-ink-muted">
                {myAttribution.length} ledger{" "}
                {myAttribution.length === 1 ? "entry" : "entries"}
              </span>
              <span className="rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-ink-muted">
                {myPayouts.length} payout{" "}
                {myPayouts.length === 1 ? "row" : "rows"}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <Link
              href="/profile/attribution"
              className="rounded-full bg-ink px-4 py-2 text-xs font-medium text-[var(--surface)] hover:bg-brand-magenta hover:text-brand-white"
            >
              View ledger →
            </Link>
          </div>
        </div>
      </Card>

      <Card className="mt-6">
        <CardEyebrow>Wallet</CardEyebrow>
        <p className="mt-2 text-sm text-ink-muted">ERC-6551 token-bound account</p>
        <p className="mt-2 font-mono text-sm">
          {user.walletAddress ?? "Not yet provisioned"}
        </p>
      </Card>

      <Card className="mt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardEyebrow>Data rights</CardEyebrow>
            <p className="mt-2 text-sm text-ink-muted">
              Request a copy of your data or erasure of your account.
              SOC 2 P5.1 / ISO 27001 A.18.1 / GDPR + CCPA compliant.
            </p>
          </div>
          <div className="flex shrink-0 flex-col gap-2">
            <Link
              href="/profile/data-rights"
              className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-xs text-ink-muted hover:border-brand-magenta hover:text-brand-magenta"
            >
              Manage →
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}

function Field({
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

function SellerStat({
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
