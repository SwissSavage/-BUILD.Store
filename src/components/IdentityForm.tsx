"use client";

/**
 * The identity editor's save form.
 *
 * A client component for one reason: saveProfile can now refuse, and
 * the member has to be told why without losing what they typed. A
 * plain server form action gives no way to render the refusal, and a
 * thrown error is stripped to a blank page in production. useActionState
 * keeps the draft in the inputs and puts the findings above the button.
 *
 * Same pattern as ApplyToJobForm.
 */

import { useActionState } from "react";
import { saveProfile, type SaveProfileResult } from "@/lib/profile-actions";
import { INDUSTRY_LABELS, type Industry } from "@/lib/types";

const ALL_INDUSTRIES: Industry[] = [
  "stem",
  "creative-media",
  "professional-services",
];

type FormState = SaveProfileResult | null;

async function action(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  return saveProfile(formData);
}

/** Local copy of the shared Field. Importing the server one would pull
 *  the profile loader, and Postgres with it, into this bundle. */
function Field({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-ink-muted">
        {label}
      </span>
      <input
        name={name}
        defaultValue={defaultValue}
        className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
      />
    </label>
  );
}

export interface IdentityFormUser {
  id: string;
  handle: string | null;
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  tagline: string | null;
  bio: string | null;
  portfolioUrl: string | null;
  profileImageUrl: string | null;
  primaryIndustry: Industry | null;
  secondaryIndustries: string[];
  skills: string[];
  isArtist: boolean;
}

export function IdentityForm({ user }: { user: IdentityFormUser }) {
  const [state, formAction, isPending] = useActionState(action, null);

  const conventionName =
    [user.firstName, user.lastName?.[0] ? `${user.lastName[0]}.` : null]
      .filter(Boolean)
      .join(" ") || "your first name";

  const blockedIn = (field: "bio" | "tagline") =>
    (state?.blocked ?? []).filter((b) => b.field === field);

  return (
    <form action={formAction} className="mt-4 space-y-5">
      <input type="hidden" name="uid" value={user.id} />

      {/* Avatar preview + upload lives in its own Card above. Keep the
          current URL as a hidden field so saveProfile doesn't clobber
          it back to empty on the next save. */}
      <input
        type="hidden"
        name="profileImageUrl"
        value={user.profileImageUrl ?? ""}
      />

      {state && !state.ok && (
        <div
          role="alert"
          className="rounded-lg border border-brand-magenta/40 bg-[var(--surface-inset)] p-4"
        >
          <p className="text-sm text-ink">{state.message}</p>
          {state.blocked.length > 0 && (
            <ul className="mt-3 space-y-2">
              {state.blocked.map((b, i) => (
                <li key={`${b.field}-${b.code}-${i}`} className="text-xs text-ink-muted">
                  <span className="uppercase tracking-wider text-brand-magentaText">
                    {b.field}
                  </span>{" "}
                  {b.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {state?.ok && (
        <p className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] px-3 py-2 text-sm text-ink">
          {state.message}
        </p>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          name="firstName"
          label="First name"
          defaultValue={user.firstName ?? ""}
        />
        <Field
          name="lastName"
          label="Last name"
          defaultValue={user.lastName ?? ""}
        />
      </div>

      {user.isArtist ? (
        <label className="block">
          <span className="text-xs uppercase tracking-wider text-brand-magentaText">
            Alias
          </span>
          <input
            name="displayName"
            defaultValue={user.displayName ?? ""}
            placeholder="e.g. Sahtyre"
            className="mt-1 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] px-3 py-2 text-sm text-ink"
          />
          <span className="mt-1 block text-[11px] text-ink-faint">
            The name you work under. It replaces your name everywhere
            public: your profile, your press kit, the portfolio, credits
            on work you ship. Leave it empty to use &ldquo;
            {conventionName}&rdquo; instead.
          </span>
        </label>
      ) : (
        <p className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] px-3 py-2 text-[11px] text-ink-faint">
          You appear publicly as{" "}
          <span className="text-ink">&ldquo;{conventionName}&rdquo;</span>.
          Aliases are for artists. If you work under a different name, ask
          an admin.
        </p>
      )}

      <label className="block">
        <span className="text-xs uppercase tracking-wider text-ink-muted">
          Tagline
        </span>
        <input
          name="tagline"
          defaultValue={user.tagline ?? ""}
          maxLength={120}
          placeholder="e.g. RevOps strategist for B2B services orgs"
          aria-invalid={blockedIn("tagline").length > 0 || undefined}
          className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
        />
        <p className="mt-1.5 text-xs text-ink-faint">
          One line, in the words you&apos;d use with a client. Shows on
          your card, the roster, client-facing bid cards, and anywhere
          you&apos;re listed. Up to 120 characters.
        </p>
      </label>

      <label className="block">
        <span className="text-xs uppercase tracking-wider text-ink-muted">
          Primary pillar
        </span>
        <select
          name="primaryIndustry"
          defaultValue={user.primaryIndustry ?? "creative-media"}
          className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
        >
          {ALL_INDUSTRIES.map((i) => (
            <option key={i} value={i}>
              {INDUSTRY_LABELS[i]}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-xs text-ink-faint">
          Where you spend most of your time. Drives default RFP and job
          matching.
        </p>
      </label>

      <fieldset className="rounded-lg border border-[var(--surface-border)] p-4">
        <legend className="px-2 text-xs uppercase tracking-wider text-ink-muted">
          Secondary pillars
        </legend>
        <p className="text-xs text-ink-faint">
          Additional areas you contribute to. Expands matching beyond your
          primary.
        </p>
        <div className="mt-3 flex flex-wrap gap-4">
          {ALL_INDUSTRIES.map((i) => (
            <label key={i} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="secondaryIndustries"
                value={i}
                defaultChecked={user.secondaryIndustries.includes(i)}
                className="h-4 w-4 rounded border-[var(--surface-border)]"
              />
              {INDUSTRY_LABELS[i]}
            </label>
          ))}
        </div>
      </fieldset>

      <Field
        name="skills"
        label="Skills (comma separated)"
        defaultValue={user.skills.join(", ")}
      />

      <Field
        name="portfolioUrl"
        label="Portfolio URL"
        defaultValue={user.portfolioUrl ?? ""}
      />

      <label className="block">
        <span className="text-xs uppercase tracking-wider text-ink-muted">
          Bio
        </span>
        <textarea
          name="bio"
          rows={4}
          defaultValue={user.bio ?? ""}
          aria-invalid={blockedIn("bio").length > 0 || undefined}
          className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
        />
        <p className="mt-1.5 text-xs text-ink-faint">
          Written for a client who has not met you. Leave out your full
          name, your own company, and any way to reach you directly:
          engagements route through the cooperative, and that is what
          protects the rate.
        </p>
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="rounded-full bg-ink px-6 py-2.5 text-sm font-medium text-[var(--surface)] hover:bg-brand-magenta hover:text-black disabled:opacity-60"
      >
        {isPending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
