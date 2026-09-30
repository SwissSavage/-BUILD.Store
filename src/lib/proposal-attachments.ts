export const MAX_PROPOSAL_ATTACHMENTS = 3;
const MAX_PROPOSAL_ATTACHMENT_BYTES = 2 * 1024 * 1024;

export interface ProposalAttachment {
  name: string;
  mimeType: string;
  sizeBytes: number;
  base64: string;
}

/** Convert the optional, small proposal documents to the stored JSON shape. */
export async function readProposalAttachments(
  formData: FormData,
): Promise<{ files: ProposalAttachment[]; error?: string }> {
  const raw = formData
    .getAll("attachments")
    .filter((value): value is File => value instanceof File && value.size > 0);

  if (raw.length > MAX_PROPOSAL_ATTACHMENTS) {
    return {
      files: [],
      error: `Attach up to ${MAX_PROPOSAL_ATTACHMENTS} documents. Pick your strongest few.`,
    };
  }

  const files: ProposalAttachment[] = [];
  for (const file of raw) {
    if (file.size > MAX_PROPOSAL_ATTACHMENT_BYTES) {
      return {
        files: [],
        error: `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)} MB. Max per file is 2 MB. Link anything larger.`,
      };
    }
    files.push({
      name: file.name.slice(0, 200),
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      base64: Buffer.from(await file.arrayBuffer()).toString("base64"),
    });
  }
  return { files };
}
