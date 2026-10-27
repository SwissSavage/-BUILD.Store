/**
 * Move a finished engagement into the portfolio, and decide whether it
 * ever becomes public.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-10-27)
 *
 * Jamar: "There needs to be a clear pipeline that moves deals into
 * portfolio, with an opt in to make it a case study."
 *
 * What existed was neither a pipeline nor an opt-in. /case-studies
 * filtered live projects on `status = "completed" && rfpApprovedAt`,
 * so settlement published a public page about a client engagement as
 * a side effect of allocating the splits. Nobody wrote it, nobody
 * approved it, and the client never heard about it.
 *
 * THE TWO DECISIONS ARE SEPARATE
 *
 *   portfolio   somebody at Future Modern decided this work is worth
 *               keeping and wrote it up. Internal.
 *   published   the client agreed it can be shown. Public.
 *
 * Collapsing those is the bug that was there before. The first is an
 * editorial judgement and the second is somebody else's permission,
 * and only one of them is ours to make.
 *
 * WHY CONSENT IS RECORDED RATHER THAN ASSERTED
 *
 * Jamar chose: nothing publishes until the client has said yes. A
 * boolean would record that an admin ticked a box in a hurry. What is
 * needed when a client emails in eighteen months asking why their
 * project is on a website is who said yes, when, and how it was
 * captured. So the publish path refuses unless all three exist, and
 * says which one is missing.
 *
 * Being named is a third, narrower decision. A client can be glad for
 * the work to be shown and still not want their name on it, so the
 * default is the depersonalized rendering and naming them is its own
 * explicit flag.
 * ─────────────────────────────────────────────────────────────
 */
"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { portfolioEntries, projects } from "@/db/schema";
import { requireAdmin } from "@/lib/auth-stub";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";

function citedWorksFrom(raw: string) {
  // "Label | URL | note" per line, URL optional. Same shape the quote
  // composer uses for work samples, because an admin who has learned
  // one of these should not have to learn a second.
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [label, second, third] = line.split("|").map((p) => p.trim());
      const looksLikeUrl = /^https?:\/\//i.test(second ?? "");
      return {
        label: label ?? "",
        url: looksLikeUrl ? second : undefined,
        note:
          (looksLikeUrl ? third : [second, third].filter(Boolean).join(" ")) ||
          undefined,
      };
    })
    .filter((w) => w.label.length > 0);
}

/**
 * Create or update the write-up. Never publishes: state is untouched
 * here, so saving an edit on a live case study cannot accidentally
 * take it down or put a draft up.
 */
export async function savePortfolioEntry(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "").trim();
  if (!projectId) throw new Error("Pick a contract.");

  const headline = String(formData.get("headline") ?? "").trim();
  if (headline.length < 4) {
    throw new Error("Give it a headline. It is the only thing most people read.");
  }
  const summary = String(formData.get("summary") ?? "").trim() || null;
  const citedWorks = citedWorksFrom(String(formData.get("citedWorks") ?? ""));

  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1);
  if (!project) throw new Error("Contract not found.");

  const now = new Date().toISOString();
  const [existing] = await db
    .select()
    .from(portfolioEntries)
    .where(eq(portfolioEntries.projectId, projectId))
    .limit(1);

  if (existing) {
    await db
      .update(portfolioEntries)
      .set({ headline, summary, citedWorks, updatedAt: now })
      .where(eq(portfolioEntries.id, existing.id));
  } else {
    await db.insert(portfolioEntries).values({
      id: `pfe_${randomUUID()}`,
      projectId,
      headline,
      summary,
      citedWorks,
      state: "portfolio",
      clientConsentAt: null,
      clientConsentBy: null,
      clientConsentNote: null,
      clientMayBeNamed: false,
      createdByUserId: admin.id,
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  }

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: existing ? "portfolio.entry_updated" : "portfolio.entry_created",
    resourceKind: "project",
    resourceId: projectId,
    before: null,
    after: { headline, citedWorks: citedWorks.length },
    reason: `${existing ? "Updated" : "Added"} the portfolio write-up for ${project.title}`,
  });

  revalidatePath("/admin/portfolio");
  revalidatePath("/case-studies");
}

/**
 * Record that the client agreed. Does not publish on its own —
 * consent and the decision to show the work stay two actions, so
 * logging a conversation cannot put a page live by itself.
 */
export async function recordClientConsent(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const consentBy = String(formData.get("clientConsentBy") ?? "").trim();
  const note = String(formData.get("clientConsentNote") ?? "").trim();
  const mayBeNamed = formData.get("clientMayBeNamed") === "on";

  if (!consentBy) {
    throw new Error("Who at the client agreed? A name, not the company.");
  }
  if (note.length < 10) {
    throw new Error(
      "Say how consent was captured — the email, the call, the date. That is the part that matters later.",
    );
  }

  const now = new Date().toISOString();
  const updated = await db
    .update(portfolioEntries)
    .set({
      clientConsentAt: now,
      clientConsentBy: consentBy,
      clientConsentNote: note,
      clientMayBeNamed: mayBeNamed,
      updatedAt: now,
    })
    .where(eq(portfolioEntries.projectId, projectId))
    .returning({ id: portfolioEntries.id });
  if (updated.length === 0) {
    throw new Error("Write the portfolio entry first, then record consent.");
  }

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "portfolio.client_consent_recorded",
    resourceKind: "project",
    resourceId: projectId,
    before: null,
    after: { clientConsentBy: consentBy, clientMayBeNamed: mayBeNamed, note },
    reason: `${consentBy} agreed this engagement can be shown publicly`,
  });

  revalidatePath("/admin/portfolio");
}

/** Withdraw consent. Takes the page down with it, deliberately. */
export async function revokeClientConsent(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const now = new Date().toISOString();

  // Unpublishes in the same statement. A client who withdraws consent
  // has withdrawn it now, and leaving the page up until somebody
  // remembers to click a second button is the wrong default.
  await db
    .update(portfolioEntries)
    .set({
      clientConsentAt: null,
      clientConsentBy: null,
      clientConsentNote: null,
      clientMayBeNamed: false,
      state: "portfolio",
      publishedAt: null,
      updatedAt: now,
    })
    .where(eq(portfolioEntries.projectId, projectId));

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "portfolio.client_consent_revoked",
    resourceKind: "project",
    resourceId: projectId,
    before: null,
    after: { unpublished: true },
    reason: "Client consent withdrawn; the case study was taken down with it",
  });

  revalidatePath("/admin/portfolio");
  revalidatePath("/case-studies");
}

/**
 * Publish, or take it back down.
 *
 * The refusal is the whole point of this function. Everything else
 * here is bookkeeping.
 */
export async function setPortfolioPublished(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const projectId = String(formData.get("projectId") ?? "").trim();
  const publish = formData.get("publish") === "1";

  const [entry] = await db
    .select()
    .from(portfolioEntries)
    .where(eq(portfolioEntries.projectId, projectId))
    .limit(1);
  if (!entry) throw new Error("No portfolio entry for this contract.");

  if (publish) {
    if (!entry.clientConsentAt || !entry.clientConsentBy) {
      throw new Error(
        "The client has not agreed to this being public. Record who said yes and how, then publish.",
      );
    }
    if (!entry.summary || entry.summary.trim().length < 40) {
      throw new Error(
        "Write the summary before publishing. A public page with a headline and nothing under it is worse than no page.",
      );
    }
  }

  const now = new Date().toISOString();
  await db
    .update(portfolioEntries)
    .set({
      state: publish ? "published" : "portfolio",
      publishedAt: publish ? (entry.publishedAt ?? now) : null,
      updatedAt: now,
    })
    .where(eq(portfolioEntries.id, entry.id));

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: publish ? "portfolio.published" : "portfolio.unpublished",
    resourceKind: "project",
    resourceId: projectId,
    before: { state: entry.state },
    after: {
      state: publish ? "published" : "portfolio",
      clientNamed: entry.clientMayBeNamed,
      consentBy: entry.clientConsentBy,
    },
    reason: publish
      ? `Published as a case study with consent from ${entry.clientConsentBy}`
      : "Taken down from the public case studies",
  });

  revalidatePath("/admin/portfolio");
  revalidatePath("/case-studies");
  revalidatePath(`/case-studies/${projectId}`);
}
