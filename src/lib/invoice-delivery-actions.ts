/**
 * Send the invoice to the client, from us.
 *
 * ─────────────────────────────────────────────────────────────
 * WHY (2026-11-03)
 *
 * Jamar: "what I'm hoping for is an invoice request that comes from
 * our app to the client, so they aren't confused about bank terms
 * because the DBA is different."
 *
 * The client invoice page already existed and the magic link already
 * worked, but nothing ever sent it. The only delivery path was pasting
 * a URL into an email by hand, which defeats the point: a link to a
 * payment page, arriving in a message typed by a person, is exactly
 * what a cautious client treats as a phishing attempt. An invoice that
 * arrives from the system, naming the engagement and the payee, is the
 * thing that settles the question.
 *
 * WHY COORDINATES ARE IN THE EMAIL AND NOT ON THE PAGE
 *
 * The client token is a bearer credential in a URL. Showing an amount
 * owed behind it is a reasonable risk; publishing an account number
 * behind it is not, because a forwarded link would carry the account
 * with it. Email goes to one named billing contact on the client
 * record, so the numbers travel to a person rather than to whoever
 * holds the link. This is also what the page has always promised:
 * "Account and routing numbers are sent by email with this invoice."
 *
 * WHY IT REFUSES ON A DRAFT
 *
 * A draft is admin-only and has no client-facing number yet. Sending
 * one would put a document in front of a client that the ledger still
 * considers unissued, and the number in their accounts payable system
 * would not match the one we later mint.
 * ─────────────────────────────────────────────────────────────
 */
"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { clients, invoices, projects } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth-stub";
import { sendTransactionalEmail } from "@/lib/email";
import { remitAccountById } from "@/lib/remit-instructions";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";

export interface InvoiceDeliveryResult {
  ok: boolean;
  message: string;
}

function siteUrl(): string {
  return (process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? "").replace(
    /\/$/,
    "",
  );
}

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD" });

export async function sendInvoiceToClient(
  formData: FormData,
): Promise<InvoiceDeliveryResult> {
  const admin = await getCurrentUser();
  if (!admin?.isAdmin) return { ok: false, message: "Admin only." };

  const invoiceId = String(formData.get("invoiceId") ?? "").trim();
  // An explicit address wins, so a one-off billing contact does not
  // require editing the client record first.
  const overrideEmail = String(formData.get("toEmail") ?? "")
    .trim()
    .toLowerCase();

  if (!invoiceId) return { ok: false, message: "Missing invoice reference." };

  const [row] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);
  if (!row) return { ok: false, message: "That invoice does not exist." };

  if (row.status === "draft") {
    return {
      ok: false,
      message:
        "Issue the invoice first. A draft has no client-facing number, so the one they file would not match ours.",
    };
  }
  if (!row.clientToken) {
    return {
      ok: false,
      message: "This invoice has no client link, so there is nothing to send.",
    };
  }

  // Recipient: the override, else the client record's billing contact.
  let to = overrideEmail;
  let clientName = "there";
  if (row.contractId) {
    const [project] = await db
      .select({ clientRefId: projects.clientRefId, title: projects.title })
      .from(projects)
      .where(eq(projects.id, row.contractId))
      .limit(1);
    if (project?.clientRefId) {
      const [client] = await db
        .select({
          name: clients.primaryContactName,
          email: clients.primaryContactEmail,
          display: clients.displayName,
        })
        .from(clients)
        .where(eq(clients.id, project.clientRefId))
        .limit(1);
      if (client) {
        clientName = client.name?.split(/\s+/)[0] ?? client.display ?? "there";
        if (!to && client.email) to = client.email.toLowerCase();
      }
    }
  }

  if (!/^\S+@\S+\.\S+$/.test(to)) {
    return {
      ok: false,
      message:
        "No billing email on file for this client. Add one to the client record, or type an address here.",
    };
  }

  const remit = remitAccountById(row.remitAccountId);
  const link = `${siteUrl()}/invoices/${row.clientToken}`;
  const total = usd(Number(row.total));

  // The payee sentence is the entire point of sending this from the
  // app rather than by hand. It says the name will differ before the
  // client sees it differ.
  const payeeLines: string[] = [];
  if (remit) {
    payeeLines.push(`Payable to: ${remit.payeeName}`);
    if (remit.bankName) payeeLines.push(`Bank: ${remit.bankName}`);
    if (remit.achRouting) payeeLines.push(`Routing (ACH): ${remit.achRouting}`);
    if (remit.accountNumber) {
      payeeLines.push(`Account number: ${remit.accountNumber}`);
    }
    payeeLines.push(`Reference: ${row.number}`);
  }

  const text = [
    `Hey ${clientName},`,
    "",
    `Invoice ${row.number} from Future Modern is ready, for ${total}.`,
    "",
    `View it here: ${link}`,
    "",
    ...(payeeLines.length > 0
      ? [
          "Payment details:",
          ...payeeLines,
          "",
          remit && remit.payeeName !== "Future Modern Builderberg LLC"
            ? `Payments are received as ${remit.payeeName}, the banking name for Future Modern Builderberg LLC. That is the name that will appear on your statement.`
            : null,
          "",
        ].filter((l): l is string => l !== null)
      : [
          "Payment details follow separately.",
          "",
        ]),
    "Please use the invoice number as the payment reference so it can be matched without a follow-up.",
    "",
    "Future Modern",
  ].join("\n");

  try {
    await sendTransactionalEmail({
      to,
      subject: `Invoice ${row.number} from Future Modern — ${total}`,
      text,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[invoice-delivery] send failed:", err);
    return {
      ok: false,
      message:
        "The email did not send. Check EMAIL_FROM and the mail credentials, then try again.",
    };
  }

  await logAuditEvent({
    actorUserId: admin.id,
    actorRoleSnapshot: snapshotActorRole(admin),
    action: "invoice.sent_to_client",
    resourceKind: "invoice",
    resourceId: row.id,
    before: null,
    // The address is the record of who was billed. The coordinates are
    // not repeated here: the audit log is read by more people than the
    // env var is.
    after: { to, number: row.number, remitAccountId: row.remitAccountId },
    reason: `Invoice ${row.number} sent to the client`,
  });

  return { ok: true, message: `Sent to ${to}.` };
}
