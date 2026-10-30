import { createHash } from "crypto";

export const MAX_LANDING_FILES = 5;
export const MAX_LANDING_FILE_BYTES = 12 * 1024 * 1024;
export const MAX_LANDING_TOTAL_BYTES = 25 * 1024 * 1024;

/** Validate the payload again at the receiving trust boundary. */
export async function validateLandingFiles(files: File[]) {
  if (files.length > MAX_LANDING_FILES) throw new Error("Too many files");
  let total = 0;
  const result: { name: string; type: string; size: number; base64: string }[] = [];
  for (const file of files) {
    total += file.size;
    if (file.size > MAX_LANDING_FILE_BYTES || total > MAX_LANDING_TOTAL_BYTES) {
      throw new Error("Attachments exceed the size limit");
    }
    const bytes = Buffer.from(await file.arrayBuffer());
    if (file.type !== "application/pdf" || bytes.subarray(0, 5).toString() !== "%PDF-") {
      throw new Error("Attachments must be PDF files");
    }
    result.push({ name: file.name.slice(0, 200), type: "application/pdf", size: bytes.length, base64: bytes.toString("base64") });
  }
  return result;
}

/** A retry can reuse its ID only when its content is identical. */
export function landingPayloadDigest(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
