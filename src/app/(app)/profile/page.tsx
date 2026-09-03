/**
 * /profile — your profile. The actual thing, editable in place.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY THIS SHAPE (2026-09-03), AFTER TWO WRONG ONES
 *
 * Attempt one: this route was a 1,200-line editing form. Clicking your
 * own profile put you in a settings screen. Jamar: "I hate this in
 * page editing layout... this is a whole lot of wasted space." And:
 * "The front page of the profile should be where information is
 * presented, not altered."
 *
 * Attempt two: the form moved to /profile/edit/<section> and this
 * became a page of summary cards with Edit buttons. That fixed the
 * settings-screen problem and introduced a worse one, which he named
 * immediately: "I also still don't like the profile solution. When you
 * get on facebook, you just see your profile and there are fields you
 * can edit. Viewing your profile should be what you see when you click
 * your profile, not a secondary option."
 *
 * He is describing one page that does both. Not a viewer with a link
 * to an editor, and not an editor with a preview. Your profile, as it
 * reads, with the fields on it editable where they sit.
 *
 * So: every block below presents its value. Each carries an Edit
 * control that swaps that value for its form, in place, in the same
 * box (see components/EditableBlock and the .fm-editable rule in
 * globals.css). Opening a field does not navigate. Saving one comes
 * back here with ?saved=<block>, which closes the form and marks the
 * block, so the member is not left staring at a form wondering.
 *
 * THREE THINGS THIS DEPENDS ON, so they do not get undone later:
 *
 * 1. Each form saves ONLY its own fields, via saveProfileSection. The
 *    older full-form saveProfile writes every column on every submit,
 *    so a tagline-only form would have blanked bio, skills and
 *    pillars. Per-block forms and a whole-row writer cannot coexist.
 *
 * 2. This is NOT the public profile. /u/[handle] is what clients see,
 *    with the visibility matrix and admin redactions applied, and it
 *    stays the authority on that. The link to it sits in the header
 *    rather than buried, because the fastest way to catch these two
 *    drifting apart is for the member to look at both.
 *
 * 3. /profile/edit/* still exists and still works. Paperwork, money
 *    and data participation are not fields on a profile, they are
 *    account settings, and they stay on their own routes. The footer
 *    links to them.
 * ─────────────────────────────────────────────────────────────
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-stub";
import { getAgreementsForUser } from "@/lib/readers/agreements";
import { getApplicationsForUser } from "@/lib/readers/project-applications";
import { getPortfolioForUser, safely } from "@/lib/readers";
import { memberLabel } from "@/lib/member-label";
import {
  INDUSTRY_LABELS,
  publicName,
  publicPortfolioView,
  userPillars,
  type Industry,
} from "@/lib/types";
import { saveProfileSection } from "@/lib/profile-field-actions";
import { uploadProfileAvatar } from "@/lib/image-upload-actions";
import { Avatar } from "@/components/Avatar";
import { Card, CardEyebrow } from "@/components/Card";
import { EditableBlock, EmptyValue } from "@/components/EditableBlock";
import { ShareProfileBar } from "@/components/ShareProfileBar";
import { SubmitButton } from "@/components/SubmitButton";
import { TierBadge } from "@/components/TierBadge";

export const dynamic = "force-dynamic";

const ALL_INDUSTRIES: Industry[] = [
  "stem",
  "creative-media",
  "professional-services",
];

const INPUT =
  "w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm";
const LABEL = "block text-xs uppercase tracking-wider text-ink-muted";
const SAVE =
  "rounded-full bg-brand-magenta px-5 py-2 text-sm font-medium text-white hover:opacity-90";

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  // saveProfileSection redirects here with the block it just wrote, so
  // the member gets a "Saved" marker on the thing they changed rather
  // than a page that looks identical to before they clicked.
  const { saved } = await searchParams;

  const [myAgreements, myApplications, myPortfolio] = await Promise.all([
    safely(() => getAgreementsForUser(user.id), []),
    safely(() => getApplicationsForUser(user.id), []),
    safely(() => getPortfolioForUser(user.id), []),
  ]);

  // Shown through the same redaction the public page uses, so a
  // member sees the piece as a client would rather than the raw row.
  const publishedPieces = myPortfolio
    .map(publicPortfolioView)
    .filter(
      (x): x is NonNullable<ReturnType<typeof publicPortfolioView>> =>
        x !== null,
    );
  const pendingCount = myPortfolio.filter(
    (p) => !p.publishedAt && !p.rejectedAt,
  ).length;

  const pillars = userPillars(user);
  const label = memberLabel(user);
  const fallbackName =
    [user.firstName, user.lastName?.[0] ? `${user.lastName[0]}.` : null]
      .filter(Boolean)
      .join(" ") || "your first name";

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      {/* ── Header ────────────────────────────────────────────── */}
      <Card>
        <div className="flex flex-wrap items-start gap-5">
          <Avatar user={user} size="xl" />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-3xl font-semibold">
                {publicName(user)}
              </h1>
              <TierBadge tier={user.membershipTier} />
            </div>
            {label && <p className="mt-1 text-sm text-ink-muted">{label}</p>}
            {user.tagline ? (
              <p className="mt-2 text-ink-muted">{user.tagline}</p>
            ) : (
              <p className="mt-2 text-sm italic text-ink-faint">
                No tagline yet. It is the line clients read first.
              </p>
            )}
          </div>
        </div>

        {/* Photo upload is its own form. Multipart, and it writes the
            URL to the row directly rather than through the field save,
            so it deliberately does not go through
            saveProfileSection. */}
        <form
          action={uploadProfileAvatar}
          encType="multipart/form-data"
          className="mt-5 flex flex-wrap items-center gap-3 border-t border-[var(--surface-border)] pt-4"
        >
          <input
            type="file"
            name="image"
            required
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/tiff"
            className="min-w-0 flex-1 rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-brand-magenta file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-white"
          />
          <SubmitButton className={SAVE} pendingLabel="Uploading…">
            Upload photo
          </SubmitButton>
        </form>

        {user.handle && <ShareProfileBar handle={user.handle} />}

        {user.handle && (
          <p className="mt-3 text-xs text-ink-faint">
            <Link
              href={`/u/${user.handle}`}
              className="text-brand-magentaText hover:underline"
            >
              View as others see it
            </Link>{" "}
            to check what is public before you send the link on.
          </p>
        )}
      </Card>

      <div className="mt-4 space-y-4">
        {/* ── Name ───────────────────────────────────────────── */}
        <EditableBlock
          label="Name"
          saved={saved === "name"}
          form={
            <form action={saveProfileSection} className="space-y-4">
              <input type="hidden" name="section" value="name" />
              <div className="grid gap-4 md:grid-cols-2">
                <label className="block">
                  <span className={LABEL}>First name</span>
                  <input
                    name="firstName"
                    defaultValue={user.firstName ?? ""}
                    className={`mt-1 ${INPUT}`}
                  />
                </label>
                <label className="block">
                  <span className={LABEL}>Last name</span>
                  <input
                    name="lastName"
                    defaultValue={user.lastName ?? ""}
                    className={`mt-1 ${INPUT}`}
                  />
                </label>
              </div>
              <label className="block">
                <span className={LABEL}>Display name</span>
                <input
                  name="displayName"
                  defaultValue={user.displayName ?? ""}
                  placeholder="e.g. Sahtyre"
                  className={`mt-1 ${INPUT}`}
                />
                <span className="mt-1 block text-[11px] text-ink-faint">
                  How your name appears publicly. Leave it empty to use
                  &ldquo;{fallbackName}&rdquo;. Set it if you go by one
                  name, a stage name, or the invite spelled yours wrong.
                </span>
              </label>
              <SubmitButton className={SAVE} pendingLabel="Saving…">
                Save name
              </SubmitButton>
            </form>
          }
        >
          <p className="text-sm">
            {publicName(user)}
            {user.displayName?.trim() && (
              <span className="text-ink-faint"> (display name)</span>
            )}
          </p>
        </EditableBlock>

        {/* ── Tagline ────────────────────────────────────────── */}
        <EditableBlock
          label="Tagline"
          saved={saved === "tagline"}
          hint="One line, in the words you would use with a client. Shows on your card, the roster, and every client-facing surface you appear on."
          form={
            <form action={saveProfileSection} className="space-y-3">
              <input type="hidden" name="section" value="tagline" />
              <input
                name="tagline"
                maxLength={120}
                defaultValue={user.tagline ?? ""}
                placeholder="e.g. RevOps strategist for B2B services orgs"
                className={INPUT}
              />
              <SubmitButton className={SAVE} pendingLabel="Saving…">
                Save tagline
              </SubmitButton>
            </form>
          }
        >
          {user.tagline ? (
            <p className="text-sm">{user.tagline}</p>
          ) : (
            <EmptyValue>Not set. Up to 120 characters.</EmptyValue>
          )}
        </EditableBlock>

        {/* ── Bio ────────────────────────────────────────────── */}
        <EditableBlock
          label="About"
          saved={saved === "bio"}
          form={
            <form action={saveProfileSection} className="space-y-3">
              <input type="hidden" name="section" value="bio" />
              <textarea
                name="bio"
                rows={5}
                defaultValue={user.bio ?? ""}
                className={INPUT}
              />
              <SubmitButton className={SAVE} pendingLabel="Saving…">
                Save about
              </SubmitButton>
            </form>
          }
        >
          {user.bio ? (
            <p className="whitespace-pre-line text-sm text-ink-muted">
              {user.bio}
            </p>
          ) : (
            <EmptyValue>Nothing written yet.</EmptyValue>
          )}
        </EditableBlock>

        {/* ── Pillars ────────────────────────────────────────── */}
        <EditableBlock
          label="Pillars"
          saved={saved === "pillars"}
          hint="Drives which RFPs and jobs get matched to you."
          form={
            <form action={saveProfileSection} className="space-y-4">
              <input type="hidden" name="section" value="pillars" />
              <label className="block">
                <span className={LABEL}>Primary</span>
                <select
                  name="primaryIndustry"
                  defaultValue={user.primaryIndustry ?? "creative-media"}
                  className={`mt-1 ${INPUT}`}
                >
                  {ALL_INDUSTRIES.map((i) => (
                    <option key={i} value={i}>
                      {INDUSTRY_LABELS[i]}
                    </option>
                  ))}
                </select>
              </label>
              <fieldset className="rounded-lg border border-[var(--surface-border)] p-4">
                <legend className={`px-2 ${LABEL}`}>Also contribute to</legend>
                <div className="mt-2 flex flex-wrap gap-4">
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
              <SubmitButton className={SAVE} pendingLabel="Saving…">
                Save pillars
              </SubmitButton>
            </form>
          }
        >
          {pillars.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {pillars.map((p, i) => (
                <span
                  key={p}
                  className="rounded-full border border-[var(--surface-border)] px-3 py-1 text-xs text-ink-muted"
                >
                  {INDUSTRY_LABELS[p]}
                  {i === 0 && (
                    <span className="text-brand-magentaText"> · primary</span>
                  )}
                </span>
              ))}
            </div>
          ) : (
            <EmptyValue>No pillar set, so nothing is matching you.</EmptyValue>
          )}
        </EditableBlock>

        {/* ── Skills ─────────────────────────────────────────── */}
        <EditableBlock
          label="Skills"
          saved={saved === "skills"}
          form={
            <form action={saveProfileSection} className="space-y-3">
              <input type="hidden" name="section" value="skills" />
              <label className="block">
                <span className={LABEL}>Comma separated</span>
                <input
                  name="skills"
                  defaultValue={user.skills.join(", ")}
                  className={`mt-1 ${INPUT}`}
                />
              </label>
              <SubmitButton className={SAVE} pendingLabel="Saving…">
                Save skills
              </SubmitButton>
            </form>
          }
        >
          {user.skills.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {user.skills.map((s) => (
                <span
                  key={s}
                  className="rounded-full bg-[var(--surface-inset)] px-3 py-1 text-xs text-ink-muted"
                >
                  {s}
                </span>
              ))}
            </div>
          ) : (
            <EmptyValue>None listed.</EmptyValue>
          )}
        </EditableBlock>

        {/* ── Link ───────────────────────────────────────────── */}
        <EditableBlock
          label="Portfolio link"
          saved={saved === "links"}
          form={
            <form action={saveProfileSection} className="space-y-3">
              <input type="hidden" name="section" value="links" />
              <input
                name="portfolioUrl"
                type="url"
                defaultValue={user.portfolioUrl ?? ""}
                placeholder="https://…"
                className={INPUT}
              />
              <SubmitButton className={SAVE} pendingLabel="Saving…">
                Save link
              </SubmitButton>
            </form>
          }
        >
          {user.portfolioUrl ? (
            <a
              href={user.portfolioUrl}
              target="_blank"
              rel="noreferrer noopener"
              className="break-all text-sm text-brand-magentaText hover:underline"
            >
              {user.portfolioUrl}
            </a>
          ) : (
            <EmptyValue>None.</EmptyValue>
          )}
        </EditableBlock>
      </div>

      {/* ── Work ─────────────────────────────────────────────── */}
      <Card className="mt-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <CardEyebrow>Work</CardEyebrow>
            <p className="mt-1 text-sm text-ink-muted">
              {publishedPieces.length === 1
                ? "1 piece published"
                : `${publishedPieces.length} pieces published`}
              {pendingCount > 0 && `, ${pendingCount} in review`}.
            </p>
          </div>
          <Link
            href="/profile/portfolio"
            className="shrink-0 rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-sm hover:border-brand-magenta hover:text-brand-magentaText"
          >
            Add a piece
          </Link>
        </div>

        {publishedPieces.length > 0 ? (
          <ul className="mt-4 space-y-3">
            {publishedPieces.map((item) => (
              <li
                key={item.id}
                className="rounded-xl border border-[var(--surface-border)] p-4"
              >
                <p className="text-sm font-medium">{item.title}</p>
                {item.description && (
                  <p className="mt-1 text-sm text-ink-muted">
                    {item.description}
                  </p>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm italic text-ink-faint">
            Nothing published yet. Work samples are what a client reads
            after your tagline.
          </p>
        )}
      </Card>

      {/* ── Record ───────────────────────────────────────────── */}
      <Card className="mt-4">
        <CardEyebrow>Record</CardEyebrow>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="font-display text-2xl font-semibold">
              {myApplications.length}
            </p>
            <p className="text-xs text-ink-muted">
              {myApplications.length === 1
                ? "proposal sent"
                : "proposals sent"}
            </p>
          </div>
          <div>
            <p className="font-display text-2xl font-semibold">
              {myAgreements.length}
            </p>
            <p className="text-xs text-ink-muted">
              {myAgreements.length === 1
                ? "signed agreement"
                : "signed agreements"}
            </p>
          </div>
        </div>
      </Card>

      {/* ── Account settings ─────────────────────────────────── */}
      <div className="mt-6 flex flex-wrap gap-2 text-sm">
        {[
          { href: "/profile/edit/paperwork", label: "Paperwork" },
          { href: "/profile/edit/money", label: "Payouts and wallet" },
          { href: "/profile/edit/talent-tags", label: "Talent tags" },
          { href: "/profile/edit/data", label: "Data participation" },
        ].map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-full border border-[var(--surface-border)] px-4 py-1.5 text-ink-muted hover:border-brand-magenta hover:text-brand-magentaText"
          >
            {l.label}
          </Link>
        ))}
      </div>
      <p className="mt-2 text-xs text-ink-faint">
        Account settings rather than profile fields, so they live on their
        own pages.
      </p>
    </div>
  );
}
