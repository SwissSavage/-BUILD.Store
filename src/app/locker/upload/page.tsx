/**
 * Member-facing locker upload form. Sandbox: pastes a URL placeholder
 * (production replaces with a Mux direct-upload widget that returns a
 * playback ID). Submits to `submitMediaAsset`.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { submitMediaAsset } from "@/lib/locker-actions";
import {
  INDUSTRY_LABELS,
  TIER_LABELS,
  type Industry,
  type MembershipTier,
} from "@/lib/types";
import { Card, CardEyebrow } from "@/components/Card";

const PILLAR_OPTIONS: Industry[] = [
  "stem",
  "creative-media",
  "professional-services",
];
const GATE_OPTIONS: MembershipTier[] = ["viewer", "prospect", "partner", "member"];

export default async function LockerUploadPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");
  // Prospects can't upload — the locker is a member/partner contribution surface.
  if (user.membershipTier === "viewer" || user.membershipTier === "prospect") {
    redirect("/locker");
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-12">
      <Link
        href="/locker"
        className="text-xs text-ink-muted underline hover:text-ink"
      >
        ← Back to locker
      </Link>
      <CardEyebrow>
        <span className="mt-4 block">Locker upload</span>
      </CardEyebrow>
      <h1 className="mt-2 font-display text-3xl font-semibold">
        Drop something into the locker.
      </h1>
      <p className="mt-2 text-sm text-ink-muted">
        Sandbox accepts a paste-in URL — production swaps for a Mux
        direct-upload. Submits to admin for moderation.
      </p>

      <Card className="mt-8">
        <form action={submitMediaAsset} className="space-y-5">
          <Field label="Title" required>
            <input
              name="title"
              required
              maxLength={120}
              className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-brand-magenta focus:outline-none"
              placeholder="What's this drop called?"
            />
          </Field>

          <Field label="Description" required>
            <textarea
              name="description"
              required
              rows={4}
              minLength={20}
              className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] p-3 text-sm focus:border-brand-magenta focus:outline-none"
              placeholder="What will a viewer get out of this? Be honest."
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Kind">
              <select
                name="kind"
                defaultValue="video"
                className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                <option value="video">Video</option>
                <option value="audio">Audio</option>
              </select>
            </Field>
            <Field label="Pillar">
              <select
                name="industry"
                defaultValue={user.primaryIndustry ?? "creative-media"}
                className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                {PILLAR_OPTIONS.map((p) => (
                  <option key={p} value={p}>
                    {INDUSTRY_LABELS[p]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Tier gate">
              <select
                name="tierGate"
                defaultValue="partner"
                className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
              >
                {GATE_OPTIONS.map((g) => (
                  <option key={g} value={g}>
                    {TIER_LABELS[g]} +
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Playback URL (sandbox placeholder)" required>
            <input
              name="playbackUrl"
              type="url"
              required
              className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-brand-magenta focus:outline-none"
              placeholder="https://… (Mux upload replaces this)"
            />
          </Field>

          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Duration (free-form)">
              <input
                name="duration"
                className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                placeholder="12:04 or 1 hr 14 min"
              />
            </Field>
            <Field label="Poster URL (optional)">
              <input
                name="posterUrl"
                type="url"
                className="w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                placeholder="https://…"
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-[var(--surface-border)] pt-5">
            <button
              type="submit"
              className="rounded-full px-5 py-2 text-xs font-medium text-white"
              style={{ backgroundColor: "#D828A0" }}
            >
              Submit for review
            </button>
            <button
              type="submit"
              name="draft"
              value="1"
              className="rounded-full border border-[var(--surface-border)] px-4 py-2 text-xs hover:bg-[var(--surface-inset)]"
            >
              Save as draft
            </button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wider text-ink-faint">
        {label}
        {required && <span className="ml-1 text-brand-magenta">*</span>}
      </span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}
