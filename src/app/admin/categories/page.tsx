/**
 * Admin: store category management.
 *
 * Lists every StoreCategory (active + archived). Inline create form at
 * the top, edit form per row, archive / unarchive actions. The list
 * here drives both the public Store dropdown and the /store filter
 * chips, so this is the source of truth until Payload CMS lands.
 *
 * Production swap: Payload admin UI replaces this surface (preferred
 * per the locked CMS posture). Until then, admins manage categories
 * here without touching code.
 */
import Link from "next/link";
import { requireAdmin } from "@/lib/auth-stub";
import { allCategoriesForAdmin } from "@/lib/mock-data/store-categories";
import {
  archiveStoreCategory,
  createStoreCategory,
  unarchiveStoreCategory,
  updateStoreCategory,
} from "@/lib/store-category-actions";
import {
  MARKETPLACE_CATEGORY_LABELS,
  type MarketplaceCategory,
  type StoreCategory,
} from "@/lib/types";
import { Card, CardEyebrow, CardTitle } from "@/components/Card";

const VERTICAL_OPTIONS: ReadonlyArray<MarketplaceCategory> = [
  "goods",
  "saas",
  "energy",
  "creative-services",
  "clothing",
];

export default async function AdminCategoriesPage() {
  await requireAdmin();
  const categories = allCategoriesForAdmin();
  const active = categories.filter((c) => c.isActive);
  const archived = categories.filter((c) => !c.isActive);

  return (
    <div className="mx-auto max-w-app px-6 py-12">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <CardEyebrow>Store operations</CardEyebrow>
          <h1 className="mt-2 font-display text-4xl font-semibold">
            Store categories
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            User-facing taxonomy for the Store dropdown and filter chips.
            Source of truth until Payload CMS goes live. Active categories
            render in the dropdown ordered by display order; archived rows
            stay on file but don&apos;t render publicly.
          </p>
        </div>
        <Link
          href="/admin"
          className="text-xs text-ink-muted underline hover:text-ink"
        >
          ← Admin home
        </Link>
      </div>

      <Card className="mt-8 border-[#5070F0]/40">
        <CardEyebrow>Add a new category</CardEyebrow>
        <CardTitle className="mt-1 text-xl">New entry</CardTitle>
        <form action={createStoreCategory} className="mt-5 grid gap-3 md:grid-cols-2">
          <Field name="name" label="Name" required placeholder="Hardware" />
          <Field
            name="slug"
            label="Slug (lowercase, hyphens)"
            required
            placeholder="hardware"
            pattern="^[a-z0-9][a-z0-9-]*$"
          />
          <Field
            name="displayOrder"
            label="Display order"
            type="number"
            defaultValue="100"
            min="0"
            max="9999"
          />
          <VerticalSelect />
          <CheckboxField name="isActive" label="Active" defaultChecked />
          <div className="md:col-span-2">
            <TextareaField
              name="description"
              label="Description (optional, surfaces under the dropdown name)"
              rows={2}
              placeholder="Physical tools, gear, components."
            />
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-full px-5 py-2 text-sm font-medium text-white"
              style={{ backgroundColor: "#5070F0" }}
            >
              Create category
            </button>
          </div>
        </form>
      </Card>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">
          Active ({active.length})
        </h2>
        <p className="mt-1 text-xs text-ink-muted">
          These render in the public Store dropdown and filter chips, in
          display-order.
        </p>
        <div className="mt-4 space-y-4">
          {active.length === 0 ? (
            <Card>
              <p className="text-sm text-ink-muted">
                No active categories. Add one above to start populating the
                dropdown.
              </p>
            </Card>
          ) : (
            active.map((c) => <CategoryRow key={c.id} category={c} />)
          )}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-semibold">
          Archived ({archived.length})
        </h2>
        <p className="mt-1 text-xs text-ink-muted">
          Hidden from public surfaces. Products still hold these slugs
          for audit purposes.
        </p>
        <div className="mt-4 space-y-4">
          {archived.length === 0 ? (
            <Card>
              <p className="text-sm text-ink-muted">
                Inbox zero. Nothing archived.
              </p>
            </Card>
          ) : (
            archived.map((c) => <CategoryRow key={c.id} category={c} />)
          )}
        </div>
      </section>
    </div>
  );
}

function CategoryRow({ category }: { category: StoreCategory }) {
  return (
    <Card>
      <form action={updateStoreCategory} className="grid gap-3 md:grid-cols-2">
        <input type="hidden" name="id" value={category.id} />
        <Field name="name" label="Name" required defaultValue={category.name} />
        <Field
          name="slug"
          label="Slug"
          required
          defaultValue={category.slug}
          pattern="^[a-z0-9][a-z0-9-]*$"
        />
        <Field
          name="displayOrder"
          label="Display order"
          type="number"
          defaultValue={String(category.displayOrder)}
          min="0"
          max="9999"
        />
        <VerticalSelect defaultValue={category.vertical ?? ""} />
        <CheckboxField
          name="isActive"
          label="Active"
          defaultChecked={category.isActive}
        />
        <div className="md:col-span-2">
          <TextareaField
            name="description"
            label="Description"
            rows={2}
            defaultValue={category.description ?? ""}
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 md:col-span-2">
          <button
            type="submit"
            className="rounded-full px-4 py-1.5 text-xs font-medium text-white"
            style={{ backgroundColor: "#007048" }}
          >
            Save changes
          </button>
          <span className="text-[11px] text-ink-faint">
            Updated {new Date(category.updatedAt).toLocaleDateString()}
          </span>
        </div>
      </form>
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--surface-border)] pt-3">
        {category.isActive ? (
          <form action={archiveStoreCategory}>
            <input type="hidden" name="id" value={category.id} />
            <button
              type="submit"
              className="rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-[11px] hover:border-brand-magenta hover:text-brand-magenta"
            >
              Archive
            </button>
          </form>
        ) : (
          <form action={unarchiveStoreCategory}>
            <input type="hidden" name="id" value={category.id} />
            <button
              type="submit"
              className="rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-[11px] hover:border-brand-magenta hover:text-brand-magenta"
            >
              Unarchive
            </button>
          </form>
        )}
        <Link
          href={`/store?category=${category.slug}`}
          className="text-[11px] text-ink-muted underline hover:text-ink"
        >
          Preview filter ↗
        </Link>
      </div>
    </Card>
  );
}

function VerticalSelect({ defaultValue }: { defaultValue?: string }) {
  return (
    <div>
      <label
        htmlFor="vertical"
        className="block text-[11px] uppercase tracking-wider text-ink-muted"
      >
        Internal vertical (optional, for subdomain routing hint)
      </label>
      <select
        id="vertical"
        name="vertical"
        defaultValue={defaultValue ?? ""}
        className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
      >
        <option value="">None</option>
        {VERTICAL_OPTIONS.map((v) => (
          <option key={v} value={v}>
            {MARKETPLACE_CATEGORY_LABELS[v]}
          </option>
        ))}
      </select>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  defaultValue,
  placeholder,
  required,
  pattern,
  min,
  max,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
  pattern?: string;
  min?: string;
  max?: string;
}) {
  return (
    <div>
      <label
        htmlFor={`cat-${name}`}
        className="block text-[11px] uppercase tracking-wider text-ink-muted"
      >
        {label}
      </label>
      <input
        id={`cat-${name}`}
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        required={required}
        pattern={pattern}
        min={min}
        max={max}
        className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
      />
    </div>
  );
}

function TextareaField({
  name,
  label,
  defaultValue,
  placeholder,
  rows = 3,
}: {
  name: string;
  label: string;
  defaultValue?: string;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div>
      <label
        htmlFor={`cat-${name}`}
        className="block text-[11px] uppercase tracking-wider text-ink-muted"
      >
        {label}
      </label>
      <textarea
        id={`cat-${name}`}
        name={name}
        rows={rows}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
      />
    </div>
  );
}

function CheckboxField({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 self-end pb-2 text-sm">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4"
      />
      {label}
    </label>
  );
}
