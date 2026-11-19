/**
 * Issue the $BUILD for a settlement that did not generate it.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY A CLIENT COMPONENT (2026-11-19)
 *
 * Same reason as ConfirmManualPayout: Next strips server-action error
 * messages in production, so "this contract already has $BUILD
 * against it" would reach the admin as "An error occurred in the
 * Server Components render."
 *
 * That matters more here than almost anywhere. The action's main job
 * is refusing to issue twice, because issueBuildFromSettlement has no
 * idempotency guard of its own and $BUILD is a balance people spend.
 * A refusal the admin cannot read is a refusal they will try to work
 * around.
 *
 * Presentational only: the contract id arrives as a prop, so this
 * never reaches the database and check-client-boundary stays green.
 * ─────────────────────────────────────────────────────────────
 */
"use client";

import { useActionState } from "react";
import { Button } from "@/components/Button";
import {
  issueVouchersForSettledContract,
  type VoucherBackfillResult,
} from "@/lib/voucher-backfill-actions";

type FormState = VoucherBackfillResult | null;

async function action(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return issueVouchersForSettledContract(formData);
}

export function IssueSettlementVouchers({
  contractId,
}: {
  contractId: string;
}) {
  const [state, formAction, isPending] = useActionState(action, null);

  if (state?.ok) {
    return (
      <p className="shrink-0 text-sm" style={{ color: "#007048" }}>
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className="shrink-0">
      <input type="hidden" name="contractId" value={contractId} />
      <Button
        type="submit"
        disabled={isPending}
        className="rounded-full px-4 py-2 text-xs font-medium text-white disabled:opacity-50"
        style={{ backgroundColor: "#5070F0" }}
      >
        {isPending ? "Issuing…" : "Issue the $BUILD →"}
      </Button>
      {state && !state.ok && (
        <p className="mt-2 max-w-xs text-xs" style={{ color: "#d84343" }}>
          {state.message}
        </p>
      )}
    </form>
  );
}
