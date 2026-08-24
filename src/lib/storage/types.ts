/**
 * Task #57 — Split-backend file storage shared types.
 *
 * Three backends fan-in behind one API:
 *   - Google Drive for docs (human-organizable, shared with counterparties).
 *   - Cloudflare R2 for images (CDN-served, cheap egress).
 *   - Hetzner local disk as the catch-all + fallback when either
 *     of the above is unhealthy.
 *
 * See docs/storage-runbook.md for cred provisioning + rotation.
 */

/**
 * File-kind routing key. Determines which backend a call to
 * storeFile lands on.
 */
export type FileKind =
  /** LOIs, agreements, SOWs, retroactive receipts. → Drive. */
  | "doc"
  /** Avatars, portfolio media, EPK hero, product photos. → R2. */
  | "image"
  /** RFP attachments, temp uploads, arbitrary. → Hetzner. */
  | "other";

export type StorageBackend = "google_drive" | "r2" | "hetzner";

export interface StoreFileInput {
  kind: FileKind;
  /** Suggested filename (extension included). Used for display + Drive naming. */
  fileName: string;
  mimeType: string;
  bytes: Uint8Array | Buffer;
  /**
   * Optional path prefix within the backend (e.g. "profiles/u_jamar" or
   * "rfps/p_101"). Falls back to a per-kind default when omitted.
   */
  keyPrefix?: string;
}

export interface StoredFile {
  /** Backend key / path — how the driver will read it back. */
  key: string;
  /** Which backend accepted the file. */
  backend: StorageBackend;
  /** Public URL if the backend serves publicly; null if only via presign. */
  publicUrl: string | null;
  /** Original filename (for display + Content-Disposition on download). */
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  /** ISO timestamp the file landed. */
  storedAt: string;
}

export interface StorageDriverHealth {
  backend: StorageBackend;
  status: "ok" | "degraded" | "unhealthy";
  detail: string;
  /** ms round-trip on the probe if applicable. */
  latencyMs: number | null;
}

export class StorageError extends Error {
  constructor(
    message: string,
    public readonly backend: StorageBackend | null,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "StorageError";
  }
}
