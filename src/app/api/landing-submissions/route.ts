import { randomUUID, timingSafeEqual } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { inboundSubmissions, landingSubmissionDocuments, notifications, users } from "@/db/schema";
import { landingPayloadDigest, validateLandingFiles } from "@/lib/landing-inbound-validation";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const secret = process.env.LANDING_SUBMISSION_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!secret) return Response.json({ error: "Service unavailable" }, { status: 503 });
  const a = Buffer.from(secret), b = Buffer.from(supplied);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const length = Number(request.headers.get("content-length"));
  if (!Number.isSafeInteger(length) || length <= 0 || length > 27 * 1024 * 1024) {
    return Response.json({ error: "Invalid request size" }, { status: 413 });
  }
  try {
    const form = await request.formData();
    const id = String(form.get("submissionId") ?? "");
    const type = String(form.get("submissionType") ?? "");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id) || !["talent", "project"].includes(type)) {
      return Response.json({ error: "Invalid submission" }, { status: 400 });
    }
    const fields: Record<string, string | string[]> = {};
    for (const [key, value] of form.entries()) {
      if (["files", "submissionId", "submissionType", "honeypot"].includes(key)) continue;
      if (typeof value !== "string" || key.length > 80 || value.length > 4000 || Object.keys(fields).length > 40) throw new Error("Invalid field");
      const previous = fields[key];
      fields[key] = previous === undefined ? value : Array.isArray(previous) ? [...previous, value] : [previous, value];
    }
    const firstName = typeof fields.firstName === "string" ? fields.firstName.trim() : "";
    const lastName = typeof fields.lastName === "string" ? fields.lastName.trim() : "";
    const email = typeof fields.email === "string" ? fields.email.trim() : "";
    if (!firstName || !lastName || !/^\S+@\S+\.\S+$/.test(email) || fields.termsAccepted !== "true") throw new Error("Required fields missing");
    if (type === "talent" && (typeof fields.contributionSummary !== "string" || !fields.contributionSummary.trim())) throw new Error("Contribution summary required");
    if (type === "project") {
      const path = fields.path;
      if (path !== "find-talent" && path !== "build-team") throw new Error("Invalid project path");
      const summary = path === "find-talent" ? fields.requestSummary : fields.projectSummary;
      if (typeof summary !== "string" || !summary.trim() || typeof fields.company !== "string" || !fields.company.trim()) throw new Error("Project details required");
    }
    const files = form.getAll("files");
    if (files.some((file) => !(file instanceof File))) throw new Error("Invalid file");
    const attachments = await validateLandingFiles(files as File[]);
    const digest = landingPayloadDigest({ type, fields, attachments });
    const rowId = `landing_${id}`;
    const now = new Date().toISOString();
    const name = `${firstName} ${lastName}`;
    const title = `Landing-page ${type === "talent" ? "talent application" : "project request"} · ${name}`;
    const body = Object.entries(fields).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : value}`).join("\n");
    const result = await db.transaction(async (tx) => {
      const metadata = attachments.map(({ name, size, type }) => ({ name, size, type }));
      const inserted = await tx.insert(inboundSubmissions).values({ id: rowId, kind: "other", status: "new", title, submitter: name, submitterEmail: email, submitterCompany: typeof fields.company === "string" ? fields.company : null, pillarTags: [], keywordTags: [], body, attachments: metadata, linkedResourceId: digest, derived: false, createdAt: now, updatedAt: now }).onConflictDoNothing().returning({ id: inboundSubmissions.id });
      if (!inserted.length) {
        const [existing] = await tx.select({ digest: inboundSubmissions.linkedResourceId }).from(inboundSubmissions).where(eq(inboundSubmissions.id, rowId));
        return existing?.digest === digest ? "duplicate" : "conflict";
      }
      if (attachments.length) await tx.insert(landingSubmissionDocuments).values(attachments.map((file, index) => ({ submissionId: rowId, documentIndex: index, contentBase64: file.base64 })));
      const admins = await tx.select({ id: users.id }).from(users).where(eq(users.isAdmin, true));
      if (admins.length) await tx.insert(notifications).values(admins.map((admin) => ({ id: `n_${randomUUID()}`, userId: admin.id, kind: "direct_message", title, body: "A new Future Modern landing-page submission is ready for review.", href: `/admin/inbound#${rowId}`, createdAt: now, readAt: null })));
      return "created";
    });
    if (result === "conflict") return Response.json({ error: "Submission ID already used" }, { status: 409 });
    return Response.json({ success: true, id: rowId, duplicate: result === "duplicate" });
  } catch (error) {
    console.error("LANDING_SUBMISSION_FAILED", error instanceof Error ? error.name : "unknown");
    return Response.json({ error: "Submission could not be saved" }, { status: 400 });
  }
}
