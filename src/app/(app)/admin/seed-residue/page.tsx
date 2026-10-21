/**
 * What the September seed left behind, and who it belongs to.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS IS A PAGE (2026-10-20)
 *
 * On 2026-09-22 someone ran `npm run db:seed` against production. It
 * inserts with onConflictDoNothing, so it added every fixture row that
 * was not already there. Thirteen fixture members have been on the
 * live site since, and Jamar keeps finding them: "example accounts are
 * still showing up in app as well."
 *
 * scripts/seed-audit.mjs was written to report on it and
 * scripts/purge-seed.mjs to clean it up. Neither can run anywhere:
 *
 *   from a laptop   ECONNREFUSED — the published Postgres port is
 *                   gone, which closed a real security hole and is the
 *                   right outcome
 *   on the server   the runner image copies public, .next/standalone,
 *                   .next/static, drizzle and scripts/migrate.mjs.
 *                   scripts/ is not in the image.
 *
 * The app has DATABASE_URL on the internal network and already has
 * requireAdmin. So it can do what the scripts cannot, and Jamar should
 * not need a terminal to clean up his own data.
 *
 * WHY IT DOES NOT IMPORT THE FIXTURES
 *
 * check-fixture-usage.mjs is a ratchet on the number of app files
 * importing from mock-data, and it is right: every one of those is a
 * place the app can disagree with itself about what is true. Importing
 * MOCK_USERS here to learn which ids are fixtures would raise that
 * count for a page about fixture contamination, which is funny but
 * still wrong.
 *
 * So it reads the shape instead. Hand-written seed ids look like
 * `u_jamar`; the Auth.js adapter generates UUIDs. Anything matching
 * `u\_%` was written by a human, which is the actual thing being
 * looked for — and it keeps working if the fixture file changes.
 *
 * WHY CLAIMED AND UNCLAIMED
 *
 * Some of those ids are real people. Four were flagged in September —
 * u_jamar, u_rob, u_sunny, u_bayu — and the overlap has grown since:
 * Sahtyre, Jrusalam and Abbas Tolgay are all on the member list now.
 * u_jamar may be the row Jamar signs in as.
 *
 * A row in `accounts` or `sessions` means somebody has signed in as
 * it. That is a person, whatever the id looks like. Those are shown as
 * untouchable rather than as a decision to make, because presenting
 * them as an option is how the wrong one gets clicked.
 *
 * READ-ONLY, DELIBERATELY. The delete comes next, once this has been
 * looked at. A surface that reports and a surface that destroys should
 * not arrive in the same deploy.
 * ─────────────────────────────────────────────────────────────
 */
import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db/client";
import { requireAdmin } from "@/lib/auth-stub";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";
import { SeedPurgeButton } from "@/components/SeedPurgeButton";

export const dynamic = "force-dynamic";

interface SeedRow {
  id: string;
  handle: string | null;
  first_name: string | null;
  last_name: string | null;
  is_admin: boolean;
  membership_tier: string | null;
  accounts: number;
  sessions: number;
  attached: number;
}

export default async function SeedResiduePage() {
  await requireAdmin();

  // One query. Counting sign-ins and the heaviest dependent tables in
  // the same pass, because thirteen rows times a dozen round trips is
  // a page that feels broken.
  const { rows } = (await db.execute(sql`
    SELECT
      u.id,
      u.handle,
      u.first_name,
      u.last_name,
      u.is_admin,
      u.membership_tier,
      (SELECT count(*)::int FROM accounts a WHERE a.user_id = u.id) AS accounts,
      (SELECT count(*)::int FROM sessions s WHERE s.user_id = u.id) AS sessions,
      (
        (SELECT count(*)::int FROM notifications n WHERE n.user_id = u.id)
      + (SELECT count(*)::int FROM portfolio_items p WHERE p.user_id = u.id)
      + (SELECT count(*)::int FROM project_applications pa WHERE pa.user_id = u.id)
      ) AS attached
    FROM users u
    WHERE u.id LIKE 'u\\_%'
    ORDER BY u.id
  `)) as unknown as { rows: SeedRow[] };

  const claimed = rows.filter((r) => r.accounts > 0 || r.sessions > 0);
  const unclaimed = rows.filter((r) => r.accounts === 0 && r.sessions === 0);

  const name = (r: SeedRow) =>
    [r.first_name, r.last_name].filter(Boolean).join(" ") || "(no name)";

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <CardEyebrow>Admin · Governance</CardEyebrow>
      <h1 className="mt-2 font-display text-3xl font-semibold">
        Seed residue
      </h1>
      <p className="mt-2 text-ink-muted">
        Rows with hand-written ids, left by the seed run on 22 September.
        Anyone who has signed in is a real person and is listed as
        untouchable, whatever their id looks like. The rest can be
        removed from here.
      </p>

      {rows.length === 0 && (
        <Card className="mt-8">
          <p className="text-sm text-ink-muted">
            No rows with seed-shaped ids. Nothing to clean up.
          </p>
        </Card>
      )}

      {claimed.length > 0 && (
        <Card className="mt-8">
          <CardTitle>Real people — {claimed.length}</CardTitle>
          <p className="mt-1 text-xs text-ink-faint">
            A linked account or an active session. These are not
            candidates for deletion and never will be from this page.
            If one of them duplicates another account, that is a merge
            and it needs a person to say which row wins.
          </p>
          <ul className="mt-4 divide-y divide-[var(--surface-border)]">
            {claimed.map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">
                    {name(r)}{" "}
                    <span className="text-ink-faint">@{r.handle ?? "—"}</span>
                  </span>
                  <span className="text-[11px] text-[#13A06A]">
                    {r.accounts} account{r.accounts === 1 ? "" : "s"},{" "}
                    {r.sessions} session{r.sessions === 1 ? "" : "s"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-faint">
                  <code>{r.id}</code>
                  {r.is_admin && " · admin"}
                  {r.membership_tier ? ` · ${r.membership_tier}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {unclaimed.length > 0 && (
        <Card className="mt-6">
          <CardTitle>Never claimed — {unclaimed.length}</CardTitle>
          <p className="mt-1 text-xs text-ink-faint">
            No linked account and no session, ever. Nobody has been
            these. Deleting them loses nothing.
          </p>
          <ul className="mt-4 divide-y divide-[var(--surface-border)]">
            {unclaimed.map((r) => (
              <li key={r.id} className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">
                    {name(r)}{" "}
                    <span className="text-ink-faint">@{r.handle ?? "—"}</span>
                  </span>
                  <span className="text-[11px] text-ink-faint">
                    {r.attached === 0
                      ? "nothing attached"
                      : `${r.attached} attached row${r.attached === 1 ? "" : "s"}`}
                  </span>
                </div>
                <p className="mt-1 text-xs text-ink-faint">
                  <code>{r.id}</code>
                  {r.is_admin && " · admin"}
                  {r.membership_tier ? ` · ${r.membership_tier}` : ""}
                </p>
              </li>
            ))}
          </ul>
          <SeedPurgeButton count={unclaimed.length} />
        </Card>
      )}

      <p className="mt-8 text-xs text-ink-faint">
        The same checks exist as{" "}
        <code>scripts/seed-audit.mjs</code> and{" "}
        <code>scripts/purge-seed.mjs</code> for anyone working from a
        machine that can reach the database directly.{" "}
        <Link
          href="/admin/audit-log"
          className="text-brand-magentaText hover:underline"
        >
          Audit log →
        </Link>
      </p>
    </div>
  );
}
