/**
 * Task #63 — Contributor payout method registry UI.
 *
 * Server component. Renders the contributor's registered rails and a
 * form to add another, driven entirely off RAIL_SPECS so the form and
 * the server-side validation can't drift apart.
 *
 * Stripe and Plaid are deliberately absent from the "add" picker —
 * both are set up through the provider's own hosted flow, which lives
 * elsewhere on the page. Only rails that can be configured from a
 * plain form appear here.
 */
import {
  PAYOUT_RAIL_LABELS,
  RAIL_DISPATCH_MODE,
  RAIL_SPECS,
  type PayoutMethod,
  type PayoutRail,
} from "@/lib/payments";
import {
  addPayoutMethod,
  removePayoutMethod,
  setDefaultPayoutMethod,
  verifyMyPayoutMethod,
} from "@/lib/payout-method-actions";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

/** Rails a contributor can add from a form (not provider-hosted). */
const FORM_RAILS: PayoutRail[] = ["zelle", "crypto_wallet", "manual_check"];

function RailBadge({ rail }: { rail: PayoutRail }) {
  const assisted = RAIL_DISPATCH_MODE[rail] === "assisted";
  return (
    <span
      className="rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        background: assisted ? "#FDF0D5" : "#E6F4EC",
        color: assisted ? "#8A5A00" : "#007048",
      }}
    >
      {assisted ? "Sent by hand" : "Automatic"}
    </span>
  );
}

function MethodRow({ method }: { method: PayoutMethod }) {
  const verified = method.verifiedAt !== null;

  return (
    <li className="flex flex-col gap-3 border-t border-[var(--surface-border)] py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{method.displayLabel}</span>
          <RailBadge rail={method.rail} />
          {method.isDefault && (
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ background: "#F0E6F5", color: "#7B1FA2" }}
            >
              Default
            </span>
          )}
        </div>

        <p className="mt-1 truncate text-sm text-ink-muted">
          {PAYOUT_RAIL_LABELS[method.rail]} · {method.externalRef}
        </p>

        {!verified && method.lastError && (
          <p className="mt-1 text-sm" style={{ color: "#8A5A00" }}>
            {method.lastError}
          </p>
        )}
        {!verified && !method.lastError && (
          <p className="mt-1 text-sm text-ink-muted">
            Not verified yet. Verify before this can become your default.
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {!verified && (
          <form action={verifyMyPayoutMethod}>
            <input type="hidden" name="methodId" value={method.id} />
            <button
              type="submit"
              className="rounded-lg border border-[var(--surface-border)] px-3 py-1.5 text-sm hover:bg-[var(--surface-muted)]"
            >
              Verify
            </button>
          </form>
        )}
        {verified && !method.isDefault && (
          <form action={setDefaultPayoutMethod}>
            <input type="hidden" name="methodId" value={method.id} />
            <button
              type="submit"
              className="rounded-lg border border-[var(--surface-border)] px-3 py-1.5 text-sm hover:bg-[var(--surface-muted)]"
            >
              Make default
            </button>
          </form>
        )}
        <form action={removePayoutMethod}>
          <input type="hidden" name="methodId" value={method.id} />
          <button
            type="submit"
            className="rounded-lg px-3 py-1.5 text-sm text-ink-muted hover:text-ink"
          >
            Remove
          </button>
        </form>
      </div>
    </li>
  );
}

function AddRailForm({ rail }: { rail: PayoutRail }) {
  const spec = RAIL_SPECS[rail];

  return (
    <details className="rounded-xl border border-[var(--surface-border)] p-4">
      <summary className="flex cursor-pointer items-center gap-2 font-medium">
        {PAYOUT_RAIL_LABELS[rail]}
        <RailBadge rail={rail} />
      </summary>

      {spec.notice && (
        <p className="mt-3 text-sm text-ink-muted">{spec.notice}</p>
      )}

      <form action={addPayoutMethod} className="mt-4 space-y-4">
        <input type="hidden" name="rail" value={rail} />

        <div>
          <label
            htmlFor={`${rail}-label`}
            className="block text-sm font-medium"
          >
            Label for this method
          </label>
          <input
            id={`${rail}-label`}
            name="displayLabel"
            type="text"
            placeholder={`My ${PAYOUT_RAIL_LABELS[rail]}`}
            className="mt-1 w-full rounded-lg border border-[var(--surface-border)] px-3 py-2"
          />
        </div>

        {spec.fields.map((field) => (
          <div key={field.key}>
            <label
              htmlFor={`${rail}-${field.key}`}
              className="block text-sm font-medium"
            >
              {field.label}
              {field.required && <span aria-hidden> *</span>}
            </label>
            <input
              id={`${rail}-${field.key}`}
              name={field.key}
              type={
                field.type === "email"
                  ? "email"
                  : field.type === "tel"
                    ? "tel"
                    : "text"
              }
              placeholder={field.placeholder}
              required={field.required}
              className="mt-1 w-full rounded-lg border border-[var(--surface-border)] px-3 py-2"
            />
            {field.help && (
              <p className="mt-1 text-xs text-ink-muted">{field.help}</p>
            )}
          </div>
        ))}

        {rail === "crypto_wallet" && (
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="ackIrreversible"
              required
              className="mt-1"
            />
            <span>
              I understand on-chain transfers are final. If this address is
              wrong, the payout cannot be recovered.
            </span>
          </label>
        )}

        <button
          type="submit"
          className="rounded-lg bg-[var(--brand-magenta)] px-4 py-2 text-sm font-medium text-white"
        >
          Add {PAYOUT_RAIL_LABELS[rail]}
        </button>
      </form>
    </details>
  );
}

export function PayoutMethodsCard({ methods }: { methods: PayoutMethod[] }) {
  const hasDefault = methods.some((m) => m.isDefault && m.verifiedAt);

  return (
    <Card className="mt-6">
      <CardEyebrow>Where your money goes</CardEyebrow>
      <CardTitle className="mt-2">Payout methods</CardTitle>

      <p className="mt-2 text-sm text-ink-muted">
        Register one or more destinations. The cooperative sends your
        settlements to whichever you mark default.
      </p>

      {!hasDefault && methods.length > 0 && (
        <p
          className="mt-3 rounded-lg px-3 py-2 text-sm"
          style={{ background: "#FDF0D5", color: "#8A5A00" }}
        >
          You have no verified default. Settlements will hold until you set
          one.
        </p>
      )}

      {methods.length > 0 ? (
        <ul className="mt-4">
          {methods.map((m) => (
            <MethodRow key={m.id} method={m} />
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-ink-muted">
          No payout methods yet. Add one below, or connect Stripe above for
          the fully automated path.
        </p>
      )}

      <div className="mt-6">
        <h3 className="text-sm font-semibold">Add a method</h3>
        <div className="mt-3 space-y-3">
          {FORM_RAILS.map((rail) => (
            <AddRailForm key={rail} rail={rail} />
          ))}
        </div>
      </div>
    </Card>
  );
}
