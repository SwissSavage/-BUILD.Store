/**
 * Hetzner local-disk driver.
 *
 * The fallback backend. Handles anything without a natural home in
 * Drive or R2, and catches uploads when either of those is unhealthy.
 * Files land under `HETZNER_UPLOAD_DIR` (Dokploy volume mount), keyed
 * by kind + suggested prefix + a random suffix so collisions are
 * impossible.
 *
 * Reads back through /api/storage/hetzner/[...key] (route handler in
 * a follow-up commit). MVP inline: presign is a same-origin URL,
 * public URL is null since Hetzner isn't a CDN.
 */
import { mkdir, readFile, unlink, stat, writeFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { randomBytes } from "crypto";
import type {
  StorageDriverHealth,
  StoreFileInput,
  StoredFile,
} from "./types";
import { StorageError } from "./types";

const UPLOAD_DIR =
  process.env.HETZNER_UPLOAD_DIR ?? "/var/fm/uploads";

function isConfigured(): boolean {
  return existsSync(UPLOAD_DIR);
}

function safeFileName(name: string): string {
  return name.replace(/[^\w.\- ]/g, "_").slice(0, 200) || "upload";
}

function generateKey(input: StoreFileInput): string {
  const prefix = input.keyPrefix?.replace(/^\/+|\/+$/g, "") || input.kind;
  const suffix = randomBytes(4).toString("hex");
  const base = safeFileName(input.fileName);
  const ext = path.extname(base);
  const stem = path.basename(base, ext);
  return `${prefix}/${stem}-${suffix}${ext}`;
}

export async function hetznerStore(input: StoreFileInput): Promise<StoredFile> {
  if (!isConfigured()) {
    throw new StorageError(
      `HETZNER_UPLOAD_DIR (${UPLOAD_DIR}) does not exist. Create the directory on the VPS and mount it into the container.`,
      "hetzner",
    );
  }
  const key = generateKey(input);
  const full = path.join(UPLOAD_DIR, key);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, Buffer.from(input.bytes));
  return {
    key,
    backend: "hetzner",
    publicUrl: null,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.bytes.byteLength,
    storedAt: new Date().toISOString(),
  };
}

export async function hetznerRead(key: string): Promise<Buffer> {
  const full = path.join(UPLOAD_DIR, key);
  if (!full.startsWith(UPLOAD_DIR)) {
    // Path traversal defense — reject any key that escapes the root.
    throw new StorageError(
      "Invalid storage key (path traversal blocked).",
      "hetzner",
    );
  }
  try {
    return await readFile(full);
  } catch (err) {
    throw new StorageError(
      `Hetzner read failed for ${key}`,
      "hetzner",
      err,
    );
  }
}

export async function hetznerDelete(key: string): Promise<void> {
  const full = path.join(UPLOAD_DIR, key);
  if (!full.startsWith(UPLOAD_DIR)) return;
  try {
    await unlink(full);
  } catch {
    // Idempotent: missing-file is fine.
  }
}

export async function hetznerHealth(): Promise<StorageDriverHealth> {
  if (!isConfigured()) {
    return {
      backend: "hetzner",
      status: "unhealthy",
      detail: `HETZNER_UPLOAD_DIR (${UPLOAD_DIR}) does not exist.`,
      latencyMs: null,
    };
  }
  const t0 = Date.now();
  try {
    const s = await stat(UPLOAD_DIR);
    if (!s.isDirectory()) {
      return {
        backend: "hetzner",
        status: "unhealthy",
        detail: `${UPLOAD_DIR} is not a directory.`,
        latencyMs: Date.now() - t0,
      };
    }
    return {
      backend: "hetzner",
      status: "ok",
      detail: `Writable directory at ${UPLOAD_DIR}.`,
      latencyMs: Date.now() - t0,
    };
  } catch (err) {
    return {
      backend: "hetzner",
      status: "unhealthy",
      detail: `Stat failed: ${(err as Error).message}`,
      latencyMs: Date.now() - t0,
    };
  }
}
