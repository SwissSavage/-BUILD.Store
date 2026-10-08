/**
 * The single list of admin destinations.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-05)
 *
 * There were three hand-maintained lists of admin links and no shared
 * source of truth: a `tiles` array on the admin home page, hardcoded
 * <AdminLink> JSX in the nav dropdown, and nothing at all in the mobile
 * menu. 61 admin pages existed. 26 were on the home tiles, 24 were in
 * the dropdown, 0 were on mobile, and 35 were reachable only by typing
 * the URL.
 *
 * /admin/inbound was one of the missing ones, which meant every signup
 * on the site landed in a queue with no link pointing at it.
 *
 * Every surface that renders admin navigation now renders from this
 * file. `scripts/check-admin-nav.mjs` fails the build when an admin
 * page exists that is neither listed here nor declared below as a
 * detail route, so the lists cannot drift apart again.
 *
 * Adding an admin page? Add it here. That is the whole process.
 * ─────────────────────────────────────────────────────────────
 */

export type AdminNavGroup =
  | "queues"
  | "people"
  | "deals"
  | "money"
  | "content"
  | "governance"
  | "create";

export type AdminNavEntry = {
  /** Route. Must match an existing page under src/app/(app)/admin. */
  href: string;
  /** Shown identically in the dropdown, the mobile menu and the home tile. */
  label: string;
  group: AdminNavGroup;
};

/** Section order, top to bottom. Queues first: that is what is waiting on you. */
export const ADMIN_GROUP_ORDER: AdminNavGroup[] = [
  "queues",
  "people",
  "deals",
  "money",
  "content",
  "governance",
  "create",
];

export const ADMIN_GROUP_LABELS: Record<AdminNavGroup, string> = {
  queues: "Waiting on you",
  people: "People",
  deals: "Deals & projects",
  money: "Money & agreements",
  content: "Content & moderation",
  governance: "Governance & audit",
  create: "Create",
};

export const ADMIN_NAV: AdminNavEntry[] = [
  // ── Waiting on you ───────────────────────────────────────────
  { href: "/admin/inbound", label: "Inbound", group: "queues" },
  { href: "/admin/applications", label: "Applications", group: "queues" },
  { href: "/admin/projects/applications", label: "Project applications", group: "queues" },
  { href: "/admin/jobs/applications", label: "Job applications", group: "queues" },
  { href: "/admin/projects/contributions", label: "Outside contributors", group: "queues" },
  { href: "/admin/rfps", label: "RFP intake", group: "queues" },
  { href: "/admin/quotes", label: "Quote sheets", group: "queues" },
  { href: "/admin/marketplace", label: "Marketplace", group: "queues" },
  { href: "/admin/whitelist", label: "Whitelist", group: "queues" },
  { href: "/admin/portfolios", label: "Portfolio review", group: "queues" },
  { href: "/admin/portfolios/fraud-review", label: "Portfolio fraud review", group: "queues" },
  { href: "/admin/epk", label: "EPK approvals", group: "queues" },
  { href: "/admin/disclosure", label: "Circumvention review", group: "queues" },
  { href: "/admin/peer-reviews", label: "Peer reviews", group: "queues" },
  { href: "/admin/testimonials", label: "Testimonials", group: "queues" },
  { href: "/admin/feedback", label: "Beta feedback", group: "queues" },

  // ── People ───────────────────────────────────────────────────
  { href: "/admin/members", label: "Members", group: "people" },
  { href: "/admin/team", label: "Team", group: "people" },
  { href: "/admin/team-meetings", label: "Team meetings", group: "people" },
  { href: "/admin/mvp", label: "MVP Score", group: "people" },
  { href: "/admin/mvp/recognition", label: "Recognition", group: "people" },
  { href: "/admin/mvp/canonization", label: "Canonization", group: "people" },

  // ── Deals & projects ─────────────────────────────────────────
  { href: "/admin/projects", label: "Projects", group: "deals" },
  { href: "/admin/contracts", label: "Contract operations", group: "deals" },
  { href: "/admin/cooperative-quotes", label: "Cooperative quotes", group: "deals" },
  { href: "/admin/jobs", label: "Jobs", group: "deals" },
  { href: "/admin/clients", label: "Client patterns", group: "deals" },
  { href: "/admin/partners", label: "Partners", group: "deals" },
  { href: "/admin/referrals", label: "Partner referrals", group: "deals" },

  // ── Money & agreements ───────────────────────────────────────
  { href: "/admin/payments", label: "Payments", group: "money" },
  { href: "/admin/agreements", label: "Agreements", group: "money" },
  { href: "/admin/invoices", label: "Invoices + receipts", group: "money" },
  { href: "/admin/receipts", label: "Cooperative receipts", group: "money" },
  { href: "/admin/reserve", label: "Contract reserves", group: "money" },
  { href: "/admin/vouchers", label: "$BUILD vouchers", group: "money" },
  { href: "/admin/pools", label: "Structural pools", group: "money" },
  { href: "/admin/tokens", label: "$BUILD distributed", group: "money" },

  // ── Content & moderation ─────────────────────────────────────
  { href: "/admin/chat", label: "Live chat", group: "content" },
  { href: "/admin/cohort", label: "Cohort spotlights", group: "content" },
  { href: "/admin/categories", label: "Store categories", group: "content" },
  { href: "/admin/locker", label: "Locker moderation", group: "content" },

  // ── Governance & audit ───────────────────────────────────────
  { href: "/admin/compliance", label: "Compliance", group: "governance" },
  { href: "/admin/audit-log", label: "Audit log", group: "governance" },
  { href: "/admin/access-review", label: "Access review", group: "governance" },
  { href: "/admin/trash", label: "Trash", group: "governance" },
  { href: "/admin/walkthrough", label: "Walkthrough / stress test", group: "governance" },

  // ── Create ───────────────────────────────────────────────────
  { href: "/admin/engagements/new", label: "Start an engagement", group: "create" },
  { href: "/admin/contracts/new", label: "Post a contract", group: "create" },
  { href: "/admin/members/invite", label: "Invite someone", group: "create" },
  { href: "/admin/inbound/import", label: "Import contacts", group: "create" },
];

/**
 * Admin pages that are deliberately not nav destinations: detail routes
 * you reach by clicking a row, not by picking from a menu. Listed
 * explicitly rather than inferred from the presence of a [param]
 * segment, so that adding a real page under a dynamic route cannot
 * slip past the guard script unnoticed.
 */
export const ADMIN_DETAIL_ROUTES: string[] = [
  "/admin/contracts/[id]/attribution",
  "/admin/contracts/[id]/ledger",
  "/admin/contracts/[id]/settle",
  "/admin/contracts/[id]/tracker",
  "/admin/members/[id]",
  "/admin/members/[id]/tags",
  "/admin/mvp/[userId]",
  "/admin/portfolios/[userId]",
  "/admin/projects/[id]/edit",
  "/admin/rfps/[id]/bids",
  "/admin/rfps/[id]/dispatch",
];

/** Entries of one group, in declaration order. */
export function adminNavByGroup(group: AdminNavGroup): AdminNavEntry[] {
  return ADMIN_NAV.filter((entry) => entry.group === group);
}

/** Every group that has at least one entry, in display order. */
export function adminNavGroups(): { group: AdminNavGroup; label: string; entries: AdminNavEntry[] }[] {
  return ADMIN_GROUP_ORDER.map((group) => ({
    group,
    label: ADMIN_GROUP_LABELS[group],
    entries: adminNavByGroup(group),
  })).filter((section) => section.entries.length > 0);
}
