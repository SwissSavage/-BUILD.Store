/**
 * Transactional email — thin wrapper around Nodemailer + Resend SMTP.
 *
 * Uses the same SMTP creds Auth.js's Nodemailer provider uses (see
 * src/lib/auth.ts and Dokploy env vars EMAIL_SERVER_*). Kept as its
 * own module so non-auth surfaces (invite dispatch, later: agreement
 * countersign notifications, etc.) can send FM-branded email without
 * pulling the Auth.js chain into their bundle.
 *
 * Every send returns the Nodemailer info object; failures throw so
 * the caller can decide whether to surface to the user or swallow.
 */
import nodemailer from "nodemailer";

let cachedTransporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter {
  if (cachedTransporter) return cachedTransporter;
  const host = process.env.EMAIL_SERVER_HOST;
  const port = Number(process.env.EMAIL_SERVER_PORT ?? 587);
  const user = process.env.EMAIL_SERVER_USER;
  const pass = process.env.EMAIL_SERVER_PASSWORD;
  if (!host || !user || !pass) {
    throw new Error(
      "Email SMTP not configured. Missing EMAIL_SERVER_HOST / EMAIL_SERVER_USER / EMAIL_SERVER_PASSWORD.",
    );
  }
  cachedTransporter = nodemailer.createTransport({
    host,
    port,
    auth: { user, pass },
  });
  return cachedTransporter;
}

export interface SendEmailInput {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export async function sendTransactionalEmail(input: SendEmailInput) {
  const from = process.env.EMAIL_FROM;
  if (!from) throw new Error("EMAIL_FROM not configured.");
  const transporter = getTransporter();
  return transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}
