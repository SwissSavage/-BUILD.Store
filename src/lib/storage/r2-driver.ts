/**
 * Cloudflare R2 driver.
 *
 * R2 speaks the S3 API, so we use @aws-sdk/client-s3 pointed at the
 * R2 account endpoint. Presigned URLs come from @aws-sdk/s3-request-
 * presigner. Public URL uses `R2_PUBLIC_URL_BASE` when a custom
 * domain is wired (media.afuturemodern.com); falls back to a signed
 * 1-hour URL when not.
 *
 * Config:
 *   R2_ACCOUNT_ID
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME
 *   R2_PUBLIC_URL_BASE (optional; enables public URL vs presigned)
 */
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import path from "path";
import { randomBytes } from "crypto";
import type {
  StorageDriverHealth,
  StoreFileInput,
  StoredFile,
} from "./types";
import { StorageError } from "./types";

const ACCOUNT_ID = process.env.R2_ACCOUNT_ID ?? "";
const ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID ?? "";
const SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY ?? "";
const BUCKET_NAME = process.env.R2_BUCKET_NAME ?? "";
const PUBLIC_URL_BASE = process.env.R2_PUBLIC_URL_BASE ?? "";

function isConfigured(): boolean {
  return Boolean(ACCOUNT_ID && ACCESS_KEY_ID && SECRET_ACCESS_KEY && BUCKET_NAME);
}

let _client: S3Client | null = null;
function getClient(): S3Client {
  if (!isConfigured()) {
    throw new StorageError(
      "R2 is not configured. Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME in Dokploy.",
      "r2",
    );
  }
  if (!_client) {
    _client = new S3Client({
      region: "auto",
      endpoint: `https://${ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: ACCESS_KEY_ID,
        secretAccessKey: SECRET_ACCESS_KEY,
      },
    });
  }
  return _client;
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

export async function r2Store(input: StoreFileInput): Promise<StoredFile> {
  const client = getClient();
  const key = generateKey(input);
  try {
    await client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: Buffer.from(input.bytes),
        ContentType: input.mimeType,
        ContentDisposition: `inline; filename="${safeFileName(input.fileName)}"`,
      }),
    );
  } catch (err) {
    throw new StorageError("R2 PutObject failed", "r2", err);
  }
  const publicUrl = PUBLIC_URL_BASE
    ? `${PUBLIC_URL_BASE.replace(/\/$/, "")}/${key}`
    : null;
  return {
    key,
    backend: "r2",
    publicUrl,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.bytes.byteLength,
    storedAt: new Date().toISOString(),
  };
}

/** 1-hour signed read URL. Use when R2_PUBLIC_URL_BASE is not set. */
export async function r2PresignRead(
  key: string,
  ttlSeconds: number = 3600,
): Promise<string> {
  const client = getClient();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
    { expiresIn: ttlSeconds },
  );
}

export async function r2Read(key: string): Promise<Buffer> {
  const client = getClient();
  try {
    const res = await client.send(
      new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
    );
    if (!res.Body) {
      throw new StorageError("R2 GetObject returned empty body", "r2");
    }
    // Body is a Readable in node runtime; drain it into a Buffer.
    const chunks: Buffer[] = [];
    for await (const chunk of res.Body as AsyncIterable<Uint8Array>) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  } catch (err) {
    if (err instanceof StorageError) throw err;
    throw new StorageError(`R2 read failed for ${key}`, "r2", err);
  }
}

export async function r2Delete(key: string): Promise<void> {
  const client = getClient();
  try {
    await client.send(
      new DeleteObjectCommand({ Bucket: BUCKET_NAME, Key: key }),
    );
  } catch (err) {
    throw new StorageError(`R2 delete failed for ${key}`, "r2", err);
  }
}

export async function r2Health(): Promise<StorageDriverHealth> {
  if (!isConfigured()) {
    return {
      backend: "r2",
      status: "unhealthy",
      detail:
        "Missing one or more of R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME.",
      latencyMs: null,
    };
  }
  const t0 = Date.now();
  try {
    await getClient().send(
      new HeadBucketCommand({ Bucket: BUCKET_NAME }),
    );
    return {
      backend: "r2",
      status: "ok",
      detail: `Bucket ${BUCKET_NAME} reachable via ${ACCOUNT_ID}.r2.cloudflarestorage.com.`,
      latencyMs: Date.now() - t0,
    };
  } catch (err) {
    return {
      backend: "r2",
      status: "unhealthy",
      detail: `HeadBucket failed: ${(err as Error).message}`,
      latencyMs: Date.now() - t0,
    };
  }
}
