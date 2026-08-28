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
import { asc, desc, eq, type SQL } from "drizzle-orm";
import type { PgTable, PgColumn } from "drizzle-orm/pg-core";
import { db } from "@/db/client";

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
      return rows as Row[];
    },

    async where(predicate: SQL): Promise<Row[]> {
      const base = db.select().from(table).where(predicate);
      const rows = await (applyOrder(
        base as unknown as { orderBy: (...a: SQL[]) => unknown },
      ) as Promise<unknown[]>);
      return rows as Row[];
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
      return (rows[0] as Row) ?? null;
    },

    async one(predicate: SQL): Promise<Row | null> {
      const rows = (await db
        .select()
        .from(table)
        .where(predicate)
        .limit(1)) as unknown[];
      return (rows[0] as Row) ?? null;
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
