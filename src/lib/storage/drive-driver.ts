/**
 * Google Drive driver.
 *
 * Uses a service account (JSON key) with domain-narrow scope. All
 * files land in a single root folder (`GOOGLE_DRIVE_ROOT_FOLDER_ID`)
 * shared with the service account email. Per-kind subfolders are
 * created lazily on first write.
 *
 * Config (pick ONE of the credential sources, in preference order):
 *   GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_B64 — base64-encoded JSON
 *     keyfile as a single env var. Preferred for platforms whose env
 *     var handling mangles escape sequences (Dokploy does this to
 *     the `\n` in private_key). Base64 has no special chars so it
 *     survives all escape processing.
 *   GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY_PATH — path to a file containing
 *     the JSON keyfile. Also robust; use when a file mount is easier
 *     than a base64 env var.
 *   GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON — full JSON keyfile contents
 *     as a single env var. Fallback only; works if the platform
 *     passes env vars verbatim without escape processing.
 *
 *   GOOGLE_DRIVE_ROOT_FOLDER_ID — the shared root folder.
 */
import { google, type drive_v3 } from "googleapis";
import { Readable } from "stream";
import { readFileSync } from "fs";
import path from "path";
import { randomBytes } from "crypto";
import type {
  StorageDriverHealth,
  StoreFileInput,
  StoredFile,
} from "./types";
import { StorageError } from "./types";

const SERVICE_ACCOUNT_JSON =
  process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON ?? "";
const SERVICE_ACCOUNT_JSON_B64 =
  process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_B64 ?? "";
const SERVICE_ACCOUNT_KEY_PATH =
  process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY_PATH ?? "";
const ROOT_FOLDER_ID = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID ?? "";

function isConfigured(): boolean {
  return Boolean(
    ROOT_FOLDER_ID &&
      (SERVICE_ACCOUNT_JSON_B64 ||
        SERVICE_ACCOUNT_KEY_PATH ||
        SERVICE_ACCOUNT_JSON),
  );
}

/**
 * Load + parse the service account credentials. Preference order:
 *   1. Base64-encoded env var — no escape-mangling risk (base64 chars
 *      are all safe for env var passthrough).
 *   2. File mount — content lives in a real file, escapes preserved.
 *   3. Raw JSON env var — only reliable on platforms that don't touch
 *      escape sequences.
 */
function loadCredentials(): Record<string, unknown> {
  if (SERVICE_ACCOUNT_JSON_B64) {
    let decoded: string;
    try {
      decoded = Buffer.from(SERVICE_ACCOUNT_JSON_B64, "base64").toString("utf8");
    } catch (err) {
      throw new StorageError(
        "GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_B64 is not valid base64. Re-encode the keyfile with `base64 -w 0 keyfile.json` and paste the single-line output.",
        "google_drive",
        err,
      );
    }
    try {
      return JSON.parse(decoded);
    } catch (err) {
      throw new StorageError(
        "GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_B64 decoded but the result is not valid JSON. Verify the source file is the original service account keyfile.",
        "google_drive",
        err,
      );
    }
  }
  if (SERVICE_ACCOUNT_KEY_PATH) {
    let raw: string;
    try {
      raw = readFileSync(SERVICE_ACCOUNT_KEY_PATH, "utf8");
    } catch (err) {
      throw new StorageError(
        `Could not read GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY_PATH at ${SERVICE_ACCOUNT_KEY_PATH}. Verify the file mount is in place and the container has read access.`,
        "google_drive",
        err,
      );
    }
    try {
      return JSON.parse(raw);
    } catch (err) {
      throw new StorageError(
        `File at GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY_PATH is not valid JSON. Re-mount the original keyfile contents unmodified.`,
        "google_drive",
        err,
      );
    }
  }
  try {
    return JSON.parse(SERVICE_ACCOUNT_JSON);
  } catch (err) {
    throw new StorageError(
      "GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON is not valid JSON. Env var passthrough mangles the private_key escape sequences on many platforms; recommend switching to GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_B64 (base64) or GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY_PATH (file mount).",
      "google_drive",
      err,
    );
  }
}

let _client: drive_v3.Drive | null = null;
function getDrive(): drive_v3.Drive {
  if (!isConfigured()) {
    throw new StorageError(
      "Google Drive is not configured. Set GOOGLE_DRIVE_ROOT_FOLDER_ID and ONE of: GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_B64 (preferred), GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY_PATH, or GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON.",
      "google_drive",
    );
  }
  if (!_client) {
    const creds = loadCredentials();
    const auth = new google.auth.GoogleAuth({
      credentials: creds,
      scopes: ["https://www.googleapis.com/auth/drive.file"],
    });
    _client = google.drive({ version: "v3", auth });
  }
  return _client;
}

// Lazy per-kind subfolder resolution — cached in-process.
const folderCache = new Map<string, string>();

async function resolveSubfolder(
  drive: drive_v3.Drive,
  name: string,
): Promise<string> {
  if (folderCache.has(name)) return folderCache.get(name)!;
  // Look for existing folder by name under root.
  const q =
    `'${ROOT_FOLDER_ID}' in parents and ` +
    `mimeType = 'application/vnd.google-apps.folder' and ` +
    `name = '${name.replace(/'/g, "\\'")}' and trashed = false`;
  const listed = await drive.files.list({
    q,
    fields: "files(id, name)",
    pageSize: 1,
  });
  if (listed.data.files && listed.data.files.length > 0) {
    const id = listed.data.files[0].id!;
    folderCache.set(name, id);
    return id;
  }
  const created = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [ROOT_FOLDER_ID],
    },
    fields: "id",
  });
  const id = created.data.id!;
  folderCache.set(name, id);
  return id;
}

function safeFileName(name: string): string {
  return name.replace(/[^\w.\- ]/g, "_").slice(0, 200) || "upload";
}

export async function driveStore(input: StoreFileInput): Promise<StoredFile> {
  const drive = getDrive();
  // Subfolder = keyPrefix (if given, first segment) or the kind name.
  const subfolderName =
    input.keyPrefix?.split("/")[0] || input.kind;
  const parentId = await resolveSubfolder(drive, subfolderName);

  const fileName = safeFileName(input.fileName);
  const suffix = randomBytes(3).toString("hex");
  const ext = path.extname(fileName);
  const stem = path.basename(fileName, ext);
  const uploadName = `${stem}-${suffix}${ext}`;

  try {
    const res = await drive.files.create({
      requestBody: {
        name: uploadName,
        parents: [parentId],
      },
      media: {
        mimeType: input.mimeType,
        body: Readable.from(Buffer.from(input.bytes)),
      },
      fields: "id, webViewLink",
    });
    const id = res.data.id!;
    return {
      key: id,
      backend: "google_drive",
      publicUrl: res.data.webViewLink ?? null,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.bytes.byteLength,
      storedAt: new Date().toISOString(),
    };
  } catch (err) {
    throw new StorageError("Drive files.create failed", "google_drive", err);
  }
}

export async function driveRead(fileId: string): Promise<Buffer> {
  const drive = getDrive();
  try {
    const res = await drive.files.get(
      { fileId, alt: "media" },
      { responseType: "arraybuffer" },
    );
    return Buffer.from(res.data as ArrayBuffer);
  } catch (err) {
    throw new StorageError(
      `Drive read failed for ${fileId}`,
      "google_drive",
      err,
    );
  }
}

export async function driveDelete(fileId: string): Promise<void> {
  const drive = getDrive();
  try {
    await drive.files.delete({ fileId });
  } catch (err) {
    // Idempotent on 404.
    const msg = String((err as Error).message ?? "");
    if (msg.includes("404")) return;
    throw new StorageError(
      `Drive delete failed for ${fileId}`,
      "google_drive",
      err,
    );
  }
}

export async function driveHealth(): Promise<StorageDriverHealth> {
  if (!isConfigured()) {
    return {
      backend: "google_drive",
      status: "unhealthy",
      detail:
        "Missing GOOGLE_DRIVE_ROOT_FOLDER_ID or credentials. Set GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_B64 (preferred), GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY_PATH, or GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON.",
      latencyMs: null,
    };
  }
  const t0 = Date.now();
  try {
    const drive = getDrive();
    await drive.files.get({ fileId: ROOT_FOLDER_ID, fields: "id, name" });
    return {
      backend: "google_drive",
      status: "ok",
      detail: `Root folder ${ROOT_FOLDER_ID} accessible.`,
      latencyMs: Date.now() - t0,
    };
  } catch (err) {
    return {
      backend: "google_drive",
      status: "unhealthy",
      detail: `Drive probe failed: ${(err as Error).message}`,
      latencyMs: Date.now() - t0,
    };
  }
}
