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
 * Load + parse the service account credentials.
 *
 * Auto-detects the format of each source: any value can be either
 * raw JSON or base64-encoded JSON, and the driver tries both. This
 * removes the "did Dokploy save the b64 var correctly" guessing —
 * paste the base64 blob (or the raw JSON) into whichever env var
 * name Dokploy is willing to persist.
 *
 * Preference order across sources:
 *   1. GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_B64
 *   2. GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY_PATH (mounted file)
 *   3. GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON
 * For each source: try JSON.parse, then base64-decode + JSON.parse.
 */
function tryParseJson(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function tryParseBase64Json(raw: string): Record<string, unknown> | null {
  try {
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    if (!decoded.trim().startsWith("{")) return null;
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function loadCredentials(): Record<string, unknown> {
  const attempts: Array<{
    name: string;
    value: string;
    isPath: boolean;
  }> = [
    {
      name: "GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON_B64",
      value: SERVICE_ACCOUNT_JSON_B64,
      isPath: false,
    },
    {
      name: "GOOGLE_DRIVE_SERVICE_ACCOUNT_KEY_PATH",
      value: SERVICE_ACCOUNT_KEY_PATH,
      isPath: true,
    },
    {
      name: "GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON",
      value: SERVICE_ACCOUNT_JSON,
      isPath: false,
    },
  ];

  const failures: string[] = [];
  for (const attempt of attempts) {
    if (!attempt.value) {
      failures.push(`${attempt.name}: unset`);
      continue;
    }
    let raw = attempt.value;
    if (attempt.isPath) {
      try {
        raw = readFileSync(attempt.value, "utf8");
      } catch (err) {
        failures.push(
          `${attempt.name}: read failed (${(err as Error).message})`,
        );
        continue;
      }
    }
    const asJson = tryParseJson(raw);
    if (asJson) return asJson;
    const asBase64Json = tryParseBase64Json(raw);
    if (asBase64Json) return asBase64Json;
    failures.push(
      `${attempt.name}: value present (${raw.length} chars) but neither valid JSON nor base64-encoded JSON`,
    );
  }
  throw new StorageError(
    `No valid Drive credentials found. Attempts: ${failures.join(" | ")}. Paste either the raw JSON keyfile OR its base64 encoding into any of the three env vars — the driver will auto-detect.`,
    "google_drive",
  );
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
  // Diagnostic env-var summary so the health payload itself tells
  // operators what the container has (lengths + presence, not values).
  // Cheap; safe to expose to admin.
  const envSummary =
    `env: ROOT_FOLDER_ID=${ROOT_FOLDER_ID ? `set(${ROOT_FOLDER_ID.length})` : "MISSING"}, ` +
    `JSON_B64=${SERVICE_ACCOUNT_JSON_B64 ? `set(${SERVICE_ACCOUNT_JSON_B64.length})` : "MISSING"}, ` +
    `KEY_PATH=${SERVICE_ACCOUNT_KEY_PATH ? `set(${SERVICE_ACCOUNT_KEY_PATH.length})` : "MISSING"}, ` +
    `JSON=${SERVICE_ACCOUNT_JSON ? `set(${SERVICE_ACCOUNT_JSON.length})` : "MISSING"}`;

  if (!isConfigured()) {
    return {
      backend: "google_drive",
      status: "unhealthy",
      detail:
        `Missing GOOGLE_DRIVE_ROOT_FOLDER_ID or credentials. ${envSummary}`,
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
      detail: `Root folder ${ROOT_FOLDER_ID} accessible. ${envSummary}`,
      latencyMs: Date.now() - t0,
    };
  } catch (err) {
    return {
      backend: "google_drive",
      status: "unhealthy",
      detail: `Drive probe failed: ${(err as Error).message} | ${envSummary}`,
      latencyMs: Date.now() - t0,
    };
  }
}
