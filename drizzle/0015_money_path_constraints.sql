-- Constraints for the money paths moving off in-memory arrays.
--
-- Voucher issuance, the reserve ledger, the triangulated composites
-- and the recovery pools were all in-memory until now, so none of
-- these guarantees had anywhere to live. They do now.
--
-- Idempotent. Picked up by the auto-migration runner on deploy.

-- One recovery pool per project. The credit path upserts on this — a
-- residual routed to a project that already has a pool must add to the
-- existing balance, not open a second pool alongside it. Two pools for
-- one project is not a visible error; it is money that silently stops
-- being counted.
CREATE UNIQUE INDEX IF NOT EXISTS engagement_recovery_pools_project_unique
  ON engagement_recovery_pools (project_id);

-- One credit per project per credit reason. `creditReserveOnInvoiceCollection`
-- checks for an existing invoice_collection credit before funding the
-- reserve, which is a read-then-write guard that two concurrent
-- invoice-payment webhooks can both pass. Double-funding the reserve
-- inflates every contributor's bonus release downstream.
CREATE UNIQUE INDEX IF NOT EXISTS reserve_pool_credit_once_per_reason
  ON reserve_pool_ledger (project_id, credit_reason)
  WHERE direction = 'credit' AND credit_reason IS NOT NULL;

-- One composite per contributor per project. The composite is the
-- frozen record of the ratings a bonus release was decided on;
-- recomputing must replace it rather than append a second, since a
-- lookup by (project, contributor) returning two rows has no defined
-- winner and the release amount would depend on row order.
CREATE UNIQUE INDEX IF NOT EXISTS triangulated_composites_unique_per_contributor
  ON triangulated_composites (project_id, contributor_user_id);

-- Voucher lookups by recipient, and the supply sum that gates every
-- issuance. The sum scans swap_status, and the admin surfaces page
-- through by user.
CREATE INDEX IF NOT EXISTS build_vouchers_user_issued_idx
  ON build_vouchers (user_id, issued_at DESC);

CREATE INDEX IF NOT EXISTS build_vouchers_swap_status_idx
  ON build_vouchers (swap_status);

-- Token ledger by member, newest first — the wallet and dashboard
-- both read exactly this shape.
CREATE INDEX IF NOT EXISTS token_transactions_user_created_idx
  ON token_transactions (user_id, created_at DESC);

-- Reserve ledger by project. Balance is always SUM(amount) over these
-- rows, so this is on the hot path of every bonus release.
CREATE INDEX IF NOT EXISTS reserve_pool_ledger_project_idx
  ON reserve_pool_ledger (project_id, created_at);

-- Audit log read patterns: the admin viewer is reverse-chron with
-- optional actor and resource filters, and the member-scoped surfaces
-- filter by actor.
CREATE INDEX IF NOT EXISTS audit_log_created_idx
  ON audit_log_entries (created_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_actor_created_idx
  ON audit_log_entries (actor_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS audit_log_resource_idx
  ON audit_log_entries (resource_kind, resource_id);
