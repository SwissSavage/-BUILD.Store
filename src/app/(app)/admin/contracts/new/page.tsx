/**
 * /admin/contracts/new — post a contract straight to the board.
 *
 * Distinct from /contracts/new, which is the client intake form: that
 * one creates an unapproved RFP for vetting. This one publishes
 * immediately, because the admin posting it is the vetting step.
 */
import Link from "next/link";
import { SubmitButton } from "@/components/SubmitButton";
import { requireAdmin } from "@/lib/auth-stub";
import { postContract } from "@/lib/contract-post-actions";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] px-3 py-2 text-sm text-ink";
const labelClass = "block text-xs text-ink-muted";

export default async function AdminNewContractPage() {
  await requireAdmin();

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/admin" className="text-sm text-ink-muted hover:text-ink">
        ← Admin
      </Link>
      <h1 className="mt-3 font-display text-4xl font-semibold">
        Post a contract
      </h1>
      <p className="mt-2 text-ink-muted">
        Goes live immediately — no vetting queue, because you are the
        vetting step. For client-submitted work that still needs
        review, send them to{" "}
        <Link href="/contracts/new" className="text-brand-magenta hover:underline">
          /contracts/new
        </Link>{" "}
        instead.
      </p>

      <Card className="mt-8">
        <CardEyebrow>Contract</CardEyebrow>
        <form action={postContract} className="mt-4 space-y-5">
          <label className={labelClass}>
            Title
            <input
              name="title"
              required
              placeholder="Brand identity system for Acme"
              className={inputClass}
            />
          </label>

          <label className={labelClass}>
            Description
            <textarea
              name="description"
              rows={6}
              required
              placeholder="Scope, deliverables, timeline. This is what people decide to bid on."
              className={inputClass}
            />
          </label>

          <div className="grid gap-3 md:grid-cols-2">
            <label className={labelClass}>
              Type
              <select name="kind" defaultValue="contract" className={inputClass}>
                <option value="contract">
                  Contract — client work, open for bids
                </option>
                <option value="internal">
                  Internal initiative — cooperative project
                </option>
              </select>
            </label>
            <label className={labelClass}>
              Pillar
              <select name="industry" required className={inputClass}>
                <option value="stem">STEM</option>
                <option value="creative-media">Creative + media</option>
                <option value="professional-services">
                  Professional services
                </option>
              </select>
            </label>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <label className={labelClass}>
              Client name (optional)
              <input
                name="clientName"
                placeholder="Acme Inc."
                className={inputClass}
              />
              <span className="mt-1 block text-[10px] text-ink-faint">
                Internal reference. Not shown on the public board.
              </span>
            </label>
            <label className={labelClass}>
              Budget (optional)
              <input name="budget" placeholder="25000" className={inputClass} />
              <span className="mt-1 block text-[10px] text-ink-faint">
                Usually left blank — talent prices the work.
              </span>
            </label>
          </div>

          <label className={labelClass}>
            Skills — one per line, or comma separated
            <textarea name="skillsRequired" rows={3} className={inputClass} />
          </label>

          <SubmitButton pendingLabel="Posting…"
            className="rounded-full bg-brand-magenta px-5 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            Post it
          </SubmitButton>
        </form>
      </Card>

      <Card className="mt-6">
        <CardTitle className="text-lg">What happens next</CardTitle>
        <ol className="mt-3 space-y-1.5 text-sm text-ink-muted">
          <li>1. It appears on the board and you land on its page.</li>
          <li>
            2. Invite people onto it from{" "}
            <Link
              href="/admin/members/invite"
              className="text-brand-magenta hover:underline"
            >
              /admin/members/invite
            </Link>{" "}
            — pick it in the contract dropdown and they land there on
            signup.
          </li>
          <li>
            3. Bids arrive in{" "}
            <Link
              href="/admin/projects/applications"
              className="text-brand-magenta hover:underline"
            >
              the triage queue
            </Link>
            .
          </li>
        </ol>
      </Card>
    </div>
  );
}
