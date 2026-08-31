/**
 * /admin/partners — manage the three public partner directories.
 *
 * These rows render on the homepage and /partners as statements about
 * who Future Modern works with. Until this page existed they were
 * seed-only, so correcting a wrong claim on the marketing front door
 * took a code change and a deploy.
 *
 * Each section is add / edit / remove against its own table. Removal
 * is immediate and hard — a partner list is not the place for soft
 * deletes, because the wrong answer is sitting on a public page while
 * you decide.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-stub";
import {
  ecosystemPartnerReader,
  productAffiliateReader,
  safely,
  servicePartnerReader,
} from "@/lib/readers";
import {
  removeEcosystemPartner,
  removeProductAffiliate,
  removeServicePartner,
  upsertEcosystemPartner,
  upsertProductAffiliate,
  upsertServicePartner,
} from "@/lib/partner-directory-actions";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

export const dynamic = "force-dynamic";

const inputClass =
  "mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] px-3 py-2 text-sm text-ink";
const labelClass = "block text-xs text-ink-muted";
const primaryButton =
  "rounded-full bg-brand-magenta px-4 py-2 text-xs font-medium text-white hover:opacity-90";
const removeButton =
  "rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-[11px] text-ink-muted hover:border-brand-magenta hover:text-brand-magenta";

export default async function AdminPartnersPage() {
  await requireAdmin();

  const [service, ecosystem, affiliates] = await Promise.all([
    safely(() => servicePartnerReader.all(), []),
    safely(() => ecosystemPartnerReader.all(), []),
    safely(() => productAffiliateReader.all(), []),
  ]);

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <Link href="/admin" className="text-sm text-ink-muted hover:text-ink">
        ← Admin
      </Link>
      <h1 className="mt-3 font-display text-4xl font-semibold">Partners</h1>
      <p className="mt-2 max-w-2xl text-ink-muted">
        Everything here is public. Service partners render on the
        homepage under &ldquo;orgs FM has signed letters of intent
        with&rdquo;; SaaS partners and affiliates render on{" "}
        <Link href="/partners" className="text-brand-magenta hover:underline">
          /partners
        </Link>
        . An entry is a claim the cooperative is making — add only what
        you can stand behind, and every change here is recorded on the
        audit log.
      </p>

      {/* ── Service partners ─────────────────────────────────── */}
      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">
          Service partners ({service.length})
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Signed letters of intent for service co-delivery. Renders on
          the homepage. The section hides entirely when this list is
          empty.
        </p>

        <div className="mt-4 space-y-3">
          {service.map((p) => (
            <Card key={p.id}>
              <form action={upsertServicePartner} className="space-y-3">
                <input type="hidden" name="id" value={p.id} />
                <div className="grid gap-3 md:grid-cols-2">
                  <label className={labelClass}>
                    Name
                    <input
                      name="name"
                      defaultValue={p.name}
                      required
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Pillar
                    <select
                      name="pillarHint"
                      defaultValue={p.pillarHint ?? ""}
                      className={inputClass}
                    >
                      <option value="">None</option>
                      <option value="stem">STEM</option>
                      <option value="creative-media">Creative + media</option>
                      <option value="professional-services">
                        Professional services
                      </option>
                    </select>
                  </label>
                </div>
                <label className={labelClass}>
                  Capabilities — one per line, or comma separated
                  <textarea
                    name="capabilities"
                    defaultValue={(p.capabilities ?? []).join("\n")}
                    rows={3}
                    className={inputClass}
                  />
                </label>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className={labelClass}>
                    Website
                    <input
                      name="websiteUrl"
                      defaultValue={p.websiteUrl ?? ""}
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Referral link
                    <input
                      name="affiliateUrl"
                      defaultValue={p.affiliateUrl ?? ""}
                      className={inputClass}
                    />
                  </label>
                </div>
                <label className="flex items-center gap-2 text-xs text-ink-muted">
                  <input
                    type="checkbox"
                    name="shippedTogether"
                    defaultChecked={p.shippedTogether}
                  />
                  Shipped together — we&apos;ve delivered work with them
                </label>
                <div className="flex items-center gap-2">
                  <button type="submit" className={primaryButton}>
                    Save
                  </button>
                </div>
              </form>
              <form action={removeServicePartner} className="mt-2">
                <input type="hidden" name="id" value={p.id} />
                <button type="submit" className={removeButton}>
                  Remove from public list
                </button>
              </form>
            </Card>
          ))}
        </div>

        <Card className="mt-4 border-brand-magenta/30">
          <CardEyebrow>Add a service partner</CardEyebrow>
          <form action={upsertServicePartner} className="mt-3 space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <label className={labelClass}>
                Name
                <input name="name" required className={inputClass} />
              </label>
              <label className={labelClass}>
                Pillar
                <select name="pillarHint" className={inputClass}>
                  <option value="">None</option>
                  <option value="stem">STEM</option>
                  <option value="creative-media">Creative + media</option>
                  <option value="professional-services">
                    Professional services
                  </option>
                </select>
              </label>
            </div>
            <label className={labelClass}>
              Capabilities — one per line
              <textarea name="capabilities" rows={3} className={inputClass} />
            </label>
            <div className="grid gap-3 md:grid-cols-2">
              <label className={labelClass}>
                Website
                <input name="websiteUrl" className={inputClass} />
              </label>
              <label className={labelClass}>
                Referral link
                <input name="affiliateUrl" className={inputClass} />
              </label>
            </div>
            <label className="flex items-center gap-2 text-xs text-ink-muted">
              <input type="checkbox" name="shippedTogether" />
              Shipped together
            </label>
            <button type="submit" className={primaryButton}>
              Add partner
            </button>
          </form>
        </Card>
      </section>

      {/* ── SaaS partners ────────────────────────────────────── */}
      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold">
          SaaS partners ({ecosystem.length})
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Software products the cooperative endorses. Products only —
          a talent group belongs on the roster, not here.
        </p>

        <div className="mt-4 space-y-3">
          {ecosystem.map((p) => (
            <Card key={p.id}>
              <form action={upsertEcosystemPartner} className="space-y-3">
                <input type="hidden" name="id" value={p.id} />
                <div className="grid gap-3 md:grid-cols-2">
                  <label className={labelClass}>
                    Name
                    <input
                      name="name"
                      defaultValue={p.name}
                      required
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Role — renders under the name
                    <input
                      name="role"
                      defaultValue={p.role}
                      required
                      className={inputClass}
                    />
                  </label>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className={labelClass}>
                    Website
                    <input
                      name="websiteUrl"
                      defaultValue={p.websiteUrl ?? ""}
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Referral link
                    <input
                      name="affiliateUrl"
                      defaultValue={p.affiliateUrl ?? ""}
                      className={inputClass}
                    />
                  </label>
                </div>
                <button type="submit" className={primaryButton}>
                  Save
                </button>
              </form>
              <form action={removeEcosystemPartner} className="mt-2">
                <input type="hidden" name="id" value={p.id} />
                <button type="submit" className={removeButton}>
                  Remove from public list
                </button>
              </form>
            </Card>
          ))}
        </div>

        <Card className="mt-4 border-brand-magenta/30">
          <CardEyebrow>Add a SaaS partner</CardEyebrow>
          <form action={upsertEcosystemPartner} className="mt-3 space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <label className={labelClass}>
                Name
                <input name="name" required className={inputClass} />
              </label>
              <label className={labelClass}>
                Role
                <input name="role" required className={inputClass} />
              </label>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className={labelClass}>
                Website
                <input name="websiteUrl" className={inputClass} />
              </label>
              <label className={labelClass}>
                Referral link
                <input name="affiliateUrl" className={inputClass} />
              </label>
            </div>
            <button type="submit" className={primaryButton}>
              Add partner
            </button>
          </form>
        </Card>
      </section>

      {/* ── Affiliates ───────────────────────────────────────── */}
      <section className="mt-16">
        <h2 className="font-display text-2xl font-semibold">
          Product affiliates ({affiliates.length})
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          Referral relationships with a disclosed kickback. Links carry{" "}
          <code className="text-brand-magenta">rel=&quot;sponsored&quot;</code>{" "}
          on the public page.
        </p>

        <div className="mt-4 space-y-3">
          {affiliates.map((p) => (
            <Card key={p.id}>
              <form action={upsertProductAffiliate} className="space-y-3">
                <input type="hidden" name="id" value={p.id} />
                <div className="grid gap-3 md:grid-cols-3">
                  <label className={labelClass}>
                    Name
                    <input
                      name="name"
                      defaultValue={p.name}
                      required
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Website
                    <input
                      name="websiteUrl"
                      defaultValue={p.websiteUrl ?? ""}
                      className={inputClass}
                    />
                  </label>
                  <label className={labelClass}>
                    Referral link
                    <input
                      name="affiliateUrl"
                      defaultValue={p.affiliateUrl ?? ""}
                      className={inputClass}
                    />
                  </label>
                </div>
                <button type="submit" className={primaryButton}>
                  Save
                </button>
              </form>
              <form action={removeProductAffiliate} className="mt-2">
                <input type="hidden" name="id" value={p.id} />
                <button type="submit" className={removeButton}>
                  Remove from public list
                </button>
              </form>
            </Card>
          ))}
        </div>

        <Card className="mt-4 border-brand-magenta/30">
          <CardEyebrow>Add an affiliate</CardEyebrow>
          <form action={upsertProductAffiliate} className="mt-3 space-y-3">
            <div className="grid gap-3 md:grid-cols-3">
              <label className={labelClass}>
                Name
                <input name="name" required className={inputClass} />
              </label>
              <label className={labelClass}>
                Website
                <input name="websiteUrl" className={inputClass} />
              </label>
              <label className={labelClass}>
                Referral link
                <input name="affiliateUrl" className={inputClass} />
              </label>
            </div>
            <button type="submit" className={primaryButton}>
              Add affiliate
            </button>
          </form>
        </Card>
      </section>

      <Card className="mt-16">
        <CardTitle className="text-lg">Where these appear</CardTitle>
        <ul className="mt-3 space-y-1.5 text-sm text-ink-muted">
          <li>
            <strong className="text-ink">Service partners</strong> — homepage,
            below the roster. Hidden when empty.
          </li>
          <li>
            <strong className="text-ink">SaaS partners</strong> and{" "}
            <strong className="text-ink">affiliates</strong> — /partners. Each
            section hides when its own list is empty.
          </li>
          <li>
            Referral links also feed the attribution rail on{" "}
            <Link
              href="/admin/referrals"
              className="text-brand-magenta hover:underline"
            >
              /admin/referrals
            </Link>
            .
          </li>
        </ul>
      </Card>
    </div>
  );
}
