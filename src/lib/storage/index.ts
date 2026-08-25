/**
 * Task #57 — Storage router. One API, three backends.
 *
 *   kind: "doc"   → Google Drive
 *   kind: "image" → Cloudflare R2
 *   kind: "other" → Hetzner local disk
 *
 * Every store call falls back to Hetzner if the intended backend
 * throws — the upload never dies for lack of a bucket. Fallbacks
 * are audit-logged so ops can drain them back to their real home
 * later.
 *
 * Reads route by the `backend` field on the StoredFile record;
 * callers persist StoredFile in their own row (e.g. the RFP
 * attachments jsonb column) and pass it back through readFile.
 */
import type {
  FileKind,
  StorageBackend,
  StorageDriverHealth,
  StoreFileInput,
  StoredFile,
} from "./types";
import { StorageError } from "./types";
import {
  driveDelete,
  driveHealth,
  driveRead,
  driveStore,
} from "./drive-driver";
import {
  r2Delete,
  r2Health,
  r2PresignRead,
  r2Read,
  r2Store,
} from "./r2-driver";
import {
  hetznerDelete,
  hetznerHealth,
  hetznerRead,
  hetznerStore,
} from "./hetzner-driver";
import {
  logAuditEvent,
} from "@/lib/mock-data/audit-log";

export type { FileKind, StorageBackend, StoredFile, StorageDriverHealth };
export { StorageError };

/**
 * Route a file to its preferred backend, falling back to Hetzner
 * on failure. Never throws on backend errors — either lands on the
 * primary, or lands on Hetzner with a fallback log.
 */
export async function storeFile(
  input: StoreFileInput,
): Promise<StoredFile> {
  const primary: StorageBackend =
    input.kind === "doc"
      ? "google_drive"
      : input.kind === "image"
        ? "r2"
        : "hetzner";

  try {
    if (primary === "google_drive") return await driveStore(input);
    if (primary === "r2") return await r2Store(input);
    return await hetznerStore(input);
  } catch (err) {
    if (primary === "hetzner") throw err; // no fallback beyond fallback
    // Fallback path: log + reroute to Hetzner.
    logAuditEvent({
      actorUserId: null,
      actorRoleSnapshot: "system",
      action: "config.setting_changed",
      resourceKind: "config",
      resourceId: `storage_fallback:${primary}`,
      before: null,
      after: {
        primary,
        fileName: input.fileName,
        fallback: "hetzner",
        errorMessage: (err as Error).message,
      },
      reason: `Storage primary ${primary} failed; rerouted to Hetzner. Drain later.`,
    });
    return hetznerStore(input);
  }
}

/**
 * Read a stored file back. `backend` + `key` come from the
 * StoredFile record the caller persisted at store time.
 */
export async function readFile(
  backend: StorageBackend,
  key: string,
): Promise<Buffer> {
  switch (backend) {
    case "google_drive":
      return driveRead(key);
    case "r2":
      return r2Read(key);
    case "hetzner":
      return hetznerRead(key);
  }
}

export async function deleteFile(
  backend: StorageBackend,
  key: string,
): Promise<void> {
  switch (backend) {
    case "google_drive":
      return driveDelete(key);
    case "r2":
      return r2Delete(key);
    case "hetzner":
      return hetznerDelete(key);
  }
}

/**
 * Best-effort signed URL for direct browser download. R2 supports
 * this natively; Drive uses the file's shared webViewLink (already
 * on StoredFile.publicUrl at store time); Hetzner has no native
 * presign — callers proxy through /api/storage/hetzner/[...key].
 */
export async function presignRead(
  backend: StorageBackend,
  key: string,
  ttlSeconds: number = 3600,
): Promise<string> {
  if (backend === "r2") return r2PresignRead(key, ttlSeconds);
  if (backend === "google_drive") {
    // Drive's webViewLink is set at store time and lives on
    // StoredFile.publicUrl. For read-by-key we'd need to file-get
    // the webViewLink — that's a follow-up.
    throw new StorageError(
      "Drive presign requires re-fetching webViewLink. Use StoredFile.publicUrl instead.",
      "google_drive",
    );
  }
  // Hetzner: same-origin URL through the local proxy.
  return `/api/storage/hetzner/${encodeURIComponent(key)}`;
}

export async function storageHealth(): Promise<StorageDriverHealth[]> {
  return Promise.all([driveHealth(), r2Health(), hetznerHealth()]);
}
