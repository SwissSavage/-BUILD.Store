/**
 * Generic table reader factory.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS EXISTS (2026-08-28)
 *
 * The sandbox shipped with 44 MOCK_* arrays and ~96 pages reading
 * them. Writing a bespoke reader module per domain would mean 44
 * near-identical files. This factory collapses the repetitive 80%
 * — list, byId, byField, count — and leaves domain modules to define
 * only the queries that carry real business rules (which RFPs are
 * public, which users appear on /team, and so on).
 *
 * DELIBERATELY NO MOCK FALLBACK. Earlier readers fell back to the
 * seed array when Postgres was unreachable. That was the wrong
 * default: it silently substituted fake data for real data, which is
 * exactly the failure mode that hid every real signup and every real
 * project for weeks. A reader here either returns live rows or
 * throws, and the caller decides how to degrade.
 * ─────────────────────────────────────────────────────────────
 */
import { asc, desc, eq, getTableColumns, type SQL } from "drizzle-orm";
import type { PgTable, PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db/client";

/**
 * Postgres returns `numeric` as a STRING, and Drizzle keeps it that way
 * (columnType PgNumeric, dataType "string"). Every domain type in
 * types.ts declares these fields as `number`, and the factory casts
 * `rows as Row[]`, so the cast was lying: `weight` was typed number and
 * was "0.500" at runtime.
 *
 * Nothing caught it. Not tsc — the cast silences it. Not the guard
 * scripts — it is a runtime shape, not a call graph. It only surfaced
 * when a page did arithmetic instead of coercing defensively:
 *
 *   /admin/contracts/[id]/attribution — 2026-10-16
 *   entries.reduce((sum, e) => sum + e.weight, 0)  →  "00.500"
 *   totalWeight.toFixed(2)  →  TypeError, route 500
 *
 * The page rendered fine with zero entries and broke the moment the
 * first one existed, so logging an entry appeared to be what failed.
 * The insert had already succeeded.
 *
 * Coercing here rather than at each call site, because there are 40+
 * numeric columns and the alternative is remembering Number() forever
 * at every read. Call sites that already wrap in Number() keep working
 * — Number(0.5) is a no-op.
 *
 * PRECISION CEILING: a JS number carries ~15-16 significant digits.
 * numeric(18,8) token columns can in principle exceed that, which
 * would need a balance above ~90 million tokens to reach. Money
 * columns are numeric(12,2) and nowhere near it. If token balances
 * ever get that large, those columns need a decimal type end to end,
 * not a wider cast here.
 */
function numericColumnNames(table: PgTable): string[] {
  const out: string[] = [];
  for (const [prop, col] of Object.entries(getTableColumns(table))) {
    if ((col as PgColumn).columnType === "PgNumeric") out.push(prop);
  }
  return out;
}

/** Convert this table's numeric columns from string to number, in place. */
function coerceNumerics(rows: unknown[], fields: string[]): unknown[] {
  if (fields.length === 0) return rows;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    for (const f of fields) {
      const v = r[f];
      // null stays null: a nullable numeric means "not set", and 0 is
      // a different claim than nothing. Only strings are converted,
      // so this is idempotent.
      if (typeof v === "string") r[f] = Number(v);
    }
  }
  return rows;
}

export interface ReaderOptions<T extends PgTable> {
  /** Column to order by. Omit for unordered reads. */
  orderBy?: PgColumn;
  /** Sort direction. Defaults to descending (newest first). */
  direction?: "asc" | "desc";
  /** Primary key column, for byId lookups. */
  idColumn?: PgColumn;
  /** Unused at runtime; keeps the table type bound to the reader. */
  _table?: T;
}

export interface TableReader<Row> {
  /** All rows, ordered per the factory options. */
  all(): Promise<Row[]>;
  /** All rows matching a Drizzle predicate. */
  where(predicate: SQL): Promise<Row[]>;
  /** One row by primary key, or null. */
  byId(id: string): Promise<Row | null>;
  /** One row matching a predicate, or null. */
  one(predicate: SQL): Promise<Row | null>;
  /** Row count matching an optional predicate. */
  count(predicate?: SQL): Promise<number>;
}

/**
 * Build a reader for one table.
 *
 * `Row` is the domain interface (User, Project, PeerReview…). The
 * Drizzle row shape maps 1:1 to it by schema design, so the cast is
 * safe as long as schema.ts and types.ts stay aligned — which the
 * seed script and typecheck both enforce.
 */
export function makeReader<Row>(
  table: PgTable,
  options: ReaderOptions<PgTable> = {},
): TableReader<Row> {
  const { orderBy, direction = "desc", idColumn } = options;
  // Computed once per reader, not per query.
  const numericFields = numericColumnNames(table);

  const applyOrder = <Q extends { orderBy: (...args: SQL[]) => unknown }>(
    query: Q,
  ): unknown => {
    if (!orderBy) return query;
    return query.orderBy(direction === "asc" ? asc(orderBy) : desc(orderBy));
  };

  return {
    async all(): Promise<Row[]> {
      const base = db.select().from(table);
      const rows = await (applyOrder(
        base as unknown as { orderBy: (...a: SQL[]) => unknown },
      ) as Promise<unknown[]>);
      return coerceNumerics(rows, numericFields) as Row[];
    },

    async where(predicate: SQL): Promise<Row[]> {
      const base = db.select().from(table).where(predicate);
      const rows = await (applyOrder(
        base as unknown as { orderBy: (...a: SQL[]) => unknown },
      ) as Promise<unknown[]>);
      return coerceNumerics(rows, numericFields) as Row[];
    },

    async byId(id: string): Promise<Row | null> {
      if (!idColumn) {
        throw new Error("byId requires an idColumn in ReaderOptions");
      }
      const rows = (await db
        .select()
        .from(table)
        .where(eq(idColumn, id))
        .limit(1)) as unknown[];
      return (coerceNumerics(rows, numericFields)[0] as Row) ?? null;
    },

    async one(predicate: SQL): Promise<Row | null> {
      const rows = (await db
        .select()
        .from(table)
        .where(predicate)
        .limit(1)) as unknown[];
      return (coerceNumerics(rows, numericFields)[0] as Row) ?? null;
    },

    async count(predicate?: SQL): Promise<number> {
      const base = db.select().from(table);
      const rows = (await (predicate
        ? base.where(predicate)
        : base)) as unknown[];
      return rows.length;
    },
  };
}

/**
 * Wrap a reader call so a page renders empty instead of throwing when
 * the database is unreachable.
 *
 * Use this at PAGE level, never inside a reader. The distinction
 * matters: an empty list is honest ("nothing here / can't reach the
 * database"), whereas seed data silently pretending to be real is the
 * bug this whole refactor exists to kill.
 */
export async function safely<T>(
  read: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await read();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[reader] query failed, rendering empty", err);
    return fallback;
  }
}
