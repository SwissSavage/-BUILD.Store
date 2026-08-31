/**
 * Task #58 — Image upload server actions.
 *
 * Two public entry points:
 *   - uploadImage(formData) — generic upload. Returns the three
 *     variant records (StoredFile shape from storage layer). Caller
 *     decides which URL to persist against their row.
 *   - uploadProfileAvatar(formData) — profile-specific wrapper. Runs
 *     uploadImage, then persists the medium variant URL onto
 *     users.profileImageUrl for the current user.
 *
 * Both actions live server-side; sharp is a native module and can't
 * cross the client boundary.
 */
"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth-stub";
import { storeFile, type StoredFile } from "@/lib/storage";
import {
  isSupportedImageMime,
  processImage,
  type ImageVariantName,
} from "@/lib/image-processing";
import { logAuditEvent, snapshotActorRole } from "@/lib/writers/audit-log";

export type UploadedImage = Record<ImageVariantName, StoredFile>;

/**
 * Core upload — resize into three variants, push each to R2 via the
 * storage router. Returns the StoredFile record per variant so the
 * caller can persist whichever URL / key it needs.
 *
 * FormData contract:
 *   image     — File (required)
 *   keyPrefix — string (optional, e.g. "profiles/u_jamar" or
 *               "portfolios/u_sunny/mood-board"). Falls back to
 *               "images" when omitted.
 */
export async function uploadImage(
  formData: FormData,
): Promise<UploadedImage> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required to upload.");

  const file = formData.get("image");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("No image file supplied.");
  }
  if (!isSupportedImageMime(file.type)) {
    throw new Error(
      `Unsupported image type "${file.type}". Use JPEG, PNG, WebP, GIF, AVIF, HEIC, or TIFF.`,
    );
  }

  const rawKeyPrefix = String(formData.get("keyPrefix") ?? "").trim();
  const keyPrefix = rawKeyPrefix || "images";

  const buf = Buffer.from(await file.arrayBuffer());
  const variants = await processImage(buf);

  const stored: Partial<UploadedImage> = {};
  const baseName = file.name.replace(/\.[^.]+$/, "") || "upload";
  for (const v of variants) {
    const record = await storeFile({
      kind: "image",
      fileName: `${baseName}-${v.name}.${v.ext}`,
      mimeType: v.mimeType,
      bytes: v.bytes,
      keyPrefix,
    });
    stored[v.name] = record;
  }

  await logAuditEvent({
    actorUserId: user.id,
    actorRoleSnapshot: snapshotActorRole(user),
    action: "config.setting_changed",
    resourceKind: "config",
    resourceId: `image_upload:${keyPrefix}`,
    before: null,
    after: {
      keyPrefix,
      originalName: file.name,
      originalSize: file.size,
      variants: variants.map((v) => ({
        name: v.name,
        width: v.width,
        height: v.height,
        sizeBytes: v.sizeBytes,
        backend: stored[v.name]?.backend,
      })),
    },
    reason: `Image uploaded to ${keyPrefix} — 3 variants stored.`,
  });

  return stored as UploadedImage;
}

/**
 * Profile avatar shortcut. Runs uploadImage with a per-user
 * keyPrefix and writes the medium variant URL to
 * users.profileImageUrl. Avatar renders don't need the full 2000px
 * variant — medium hits the design system's max-avatar-size (144px)
 * comfortably even on retina.
 */
export async function uploadProfileAvatar(formData: FormData) {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in required.");

  formData.set("keyPrefix", `profiles/${user.id}`);
  const uploaded = await uploadImage(formData);
  const preferredUrl =
    uploaded.medium.publicUrl ??
    `/api/media/r2/${encodeURIComponent(uploaded.medium.key)}`;

  await db
    .update(users)
    .set({
      profileImageUrl: preferredUrl,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(users.id, user.id));

  revalidatePath("/profile");
  revalidatePath(`/u/${user.handle}`);
}
