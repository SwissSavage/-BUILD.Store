/**
 * Member quote-sheet intake — the contributor's structured response to an RFP.
 *
 * Mirrors the per-row fields in URL Media's "service provider proposal"
 * template: price, timeline, work samples (with captions), strengths,
 * weaknesses. A `memberNote` field stays internal for member↔admin only.
 *
 * Sandbox: appends/updates MOCK_QUOTES in memory.
 * REPLACE WITH: Drizzle insert/update + transactional email to the admin
 * queue on submit, attribution-ledger entry on admin approval.
 */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth-stub";
import { MOCK_PROJECTS } from "@/lib/mock-data/projects";
import { MOCK_QUOTES } from "@/lib/mock-data/quotes";
import { INDUSTRY_LABELS, type QuoteSheetSample } from "@/lib/types";
import { Card, CardEyebrow } from "@/components/Card";

async function submitQuote(formData: FormData) {
  "use server";
  const user = await getCurrentUser();
  if (!user) throw new Error("Not signed in");

  const projectId = String(formData.get("projectId") ?? "");
  const project = MOCK_PROJECTS.find((p) => p.id === projectId);
  if (!project) throw new Error("RFP not found");

  const price = String(formData.get("price") ?? "").trim();
  const timeline = String(formData.get("timeline") ?? "").trim();
  const memberNote = String(formData.get("memberNote") ?? "").trim() || null;

  if (!price || !timeline) {
    throw new Error("Price and timeline are required.");
  }

  // Work-sample rows arrive as parallel arrays — pair them up, drop empties.
  const sampleUrls = formData.getAll("sampleUrl").map(String);
  const sampleCaptions = formData.getAll("sampleCaption").map(String);
  const workSamples: QuoteSheetSample[] = sampleUrls
    .map((url, i) => ({ url: url.trim(), caption: (sampleCaptions[i] ?? "").trim() }))
    .filter((s) => s.url);

  MOCK_QUOTES.push({
    id: `q_${Date.now()}`,
    projectId,
    userId: user.id,
    price,
    timeline,
    workSamples,
    memberNote,
    createdAt: new Date().toISOString(),
    approvedAt: null,
    approvedPrice: null,
    approvedTimeline: null,
    // Strengths / weaknesses are admin-authored during review, not submitted.
    strengths: null,
    weaknesses: null,
    rejectedAt: null,
    rejectionNote: null,
  });

  revalidatePath(`/contracts/${projectId}/quote`);
  revalidatePath("/admin/quotes");
  revalidatePath("/profile/quotes");
}

function statusLabel(q: { approvedAt: string | null; rejectedAt: string | null }) {
  if (q.rejectedAt) return { text: "Rejected", color: "#E53E3E" };
  if (q.approvedAt) return { text: "Sent to client", color: "#007048" };
  return { text: "Pending review", color: "#5070F0" };
}

export default async function QuoteSubmitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/signin");

  const { id } = await params;
  const project = MOCK_PROJECTS.find((p) => p.id === id);
  if (!project || project.kind !== "contract") notFound();

  const myQuotes = MOCK_QUOTES.filter(
    (q) => q.projectId === id && q.userId === user.id,
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link
        href="/contracts"
        className="text-sm text-ink-muted hover:text-ink"
      >
        ← All contracts
      </Link>

      <header className="mt-4">
        <CardEyebrow>{INDUSTRY_LABELS[project.industry]} · RFP</CardEyebrow>
        <h1 className="mt-2 font-display text-3xl font-semibold">
          {project.title}
        </h1>
        <p className="mt-3 text-ink-muted">{project.description}</p>
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
          <span className="text-ink-faint">Budget:</span>
          <span className="font-medium">
            ${Number(project.budget).toLocaleString()}
          </span>
          <span className="text-ink-faint">·</span>
          <div className="flex flex-wrap gap-1.5">
            {project.skillsRequired.map((s) => (
              <span
                key={s}
                className="rounded-full border border-[var(--surface-border)] px-2 py-0.5 text-xs text-ink-muted"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
      </header>

      {myQuotes.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-semibold">
            Your previous submissions
          </h2>
          <div className="mt-4 space-y-3">
            {myQuotes.map((q) => {
              const status = statusLabel(q);
              return (
                <Card key={q.id}>
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium">
                        {q.price} · {q.timeline}
                      </div>
                      {q.workSamples.length > 0 && (
                        <p className="mt-2 text-xs text-ink-faint">
                          {q.workSamples.length} work sample
                          {q.workSamples.length === 1 ? "" : "s"} attached
                        </p>
                      )}
                      {q.rejectionNote && (
                        <div className="mt-3 rounded-lg border border-[var(--surface-border)] bg-[var(--surface-inset)] p-3 text-xs">
                          <div className="font-medium" style={{ color: "#E53E3E" }}>
                            Admin note
                          </div>
                          <div className="mt-1 text-ink-muted">
                            {q.rejectionNote}
                          </div>
                        </div>
                      )}
                    </div>
                    <span
                      className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium"
                      style={{
                        backgroundColor: `${status.color}26`,
                        color: status.color,
                      }}
                    >
                      {status.text}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-ink-faint">
            You can submit more than one — useful when scoping a fixed-fee
            option alongside an hourly one.
          </p>
        </section>
      )}

      <Card className="mt-6 border-[#5070F0]/40">
        <CardEyebrow>How comp works on this engagement</CardEyebrow>
        <p className="mt-2 text-sm text-ink-muted">
          Future Modern engagements pay in two parts: a guaranteed{" "}
          <strong>base</strong> (low end of your asking) and an earnable{" "}
          <strong>ceiling</strong> (delta to the upper end) released at
          engagement close on a quality gate (client rating, peer
          review, PM rating). Median outcome on quality engagements is
          above asking; minimum outcome is the low end. Encourage
          range-shaped quotes — &quot;$8,000 to $10,000&quot; is more
          useful to admin than a single number.
        </p>
        <p className="mt-2 text-[11px] text-ink-faint">
          Client never sees the gate — it&apos;s cooperative-internal.
          The structure is for you to know what&apos;s guaranteed vs
          earned before you accept the contract.
        </p>
      </Card>

      <Card className="mt-6">
        <CardEyebrow>Submit a quote</CardEyebrow>
        <p className="mt-1 text-xs text-ink-faint">
          Keep it simple: price (range welcome), timeline, and work
          samples. Positioning narrative (strengths / weaknesses) gets
          written by admins during review so we pitch you consistently.
          Any direct-contact info you include gets stripped — never a
          reason for rejection.
        </p>

        <form action={submitQuote} className="mt-5 space-y-5">
          <input type="hidden" name="projectId" value={project.id} />

          <div className="grid gap-4 md:grid-cols-2">
            <Field
              name="price"
              label="Price"
              required
              placeholder="$25,000 fixed · or hourly range"
            />
            <Field
              name="timeline"
              label="Timeline"
              required
              placeholder="8 weeks · or 6–10 wks"
            />
          </div>

          <fieldset className="rounded-lg border border-[var(--surface-border)] p-4">
            <legend className="px-2 text-xs uppercase tracking-wider text-ink-muted">
              Work samples
            </legend>
            <p className="text-xs text-ink-faint">
              Up to three. URL + a caption explaining why this sample is
              relevant to <em>this</em> RFP.
            </p>
            <div className="mt-4 space-y-4">
              {[0, 1, 2].map((i) => (
                <div key={i} className="grid gap-2 md:grid-cols-[1fr,1.5fr]">
                  <input
                    name="sampleUrl"
                    placeholder="https://…"
                    className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                  />
                  <input
                    name="sampleCaption"
                    placeholder="Why this matters here"
                    className="rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>
          </fieldset>

          <label className="block">
            <span className="text-xs uppercase tracking-wider text-ink-muted">
              Internal note to admin (client never sees)
            </span>
            <textarea
              name="memberNote"
              rows={2}
              className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
              placeholder="Conflicts, prior relationships, anything we should know."
            />
          </label>

          <button
            type="submit"
            className="rounded-full px-6 py-2.5 text-sm font-medium text-white"
            style={{ backgroundColor: "#5070F0" }}
          >
            Submit for review
          </button>
        </form>
      </Card>

      <p className="mt-6 text-xs text-ink-faint">
        Track the status of all your quote sheets at{" "}
        <Link href="/profile/quotes" className="underline hover:text-ink">
          /profile/quotes
        </Link>
        .
      </p>
    </div>
  );
}

function Field({
  name,
  label,
  required = false,
  placeholder,
}: {
  name: string;
  label: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs uppercase tracking-wider text-ink-muted">{label}</span>
      <input
        name={name}
        required={required}
        placeholder={placeholder}
        className="mt-2 w-full rounded-lg border border-[var(--surface-border)] bg-[var(--surface)] px-3 py-2"
      />
    </label>
  );
}
