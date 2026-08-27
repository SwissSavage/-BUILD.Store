/**
 * Task #58 — Image processing pipeline.
 *
 * Server-side resize + optimization pass that runs on every image
 * upload before it hits R2. Three variants land per upload:
 *   - thumbnail (200px longest edge, WebP, quality 75)
 *   - medium    (800px, WebP, quality 82)
 *   - full      (2000px, WebP, quality 85)
 *
 * WebP everywhere — better compression than JPEG, universal browser
 * support since 2020. Original format is discarded once resized;
 * we don't need the raw bytes and they'd bloat R2.
 *
 * Sharp is a native module; Next.js standalone output bundles it
 * correctly. If the process runtime differs (edge, etc.), those
 * routes should not import this module.
 */
import sharp from "sharp";

export type ImageVariantName = "thumbnail" | "medium" | "full";

export interface ImageVariant {
  name: ImageVariantName;
  bytes: Buffer;
  width: number;
  height: number;
  sizeBytes: number;
  mimeType: string;
  ext: string;
}

const VARIANT_LONGEST_EDGE: Record<ImageVariantName, number> = {
  thumbnail: 200,
  medium: 800,
  full: 2000,
};

const VARIANT_QUALITY: Record<ImageVariantName, number> = {
  thumbnail: 75,
  medium: 82,
  full: 85,
};

const VARIANTS: ImageVariantName[] = ["thumbnail", "medium", "full"];

/**
 * Resize a single uploaded image into the three canonical variants.
 * Rejects images we can't decode or that are absurdly large (>25 MB
 * source or >50 MP, cheap DoS guard before sharp does heavy work).
 */
export async function processImage(
  input: Uint8Array | Buffer,
): Promise<ImageVariant[]> {
  if (input.byteLength > 25 * 1024 * 1024) {
    throw new Error("Image too large (max 25 MB before processing).");
  }
  const source = sharp(Buffer.from(input), { failOn: "error" });
  const meta = await source.metadata();
  if (!meta.width || !meta.height) {
    throw new Error("Could not read image dimensions — is this a valid image?");
  }
  if (meta.width * meta.height > 50_000_000) {
    throw new Error("Image resolution too large (max 50 megapixels).");
  }

  // EXIF orientation gets baked in via .rotate() so downstream
  // consumers don't have to think about it.
  const rotated = source.rotate();

  const results = await Promise.all(
    VARIANTS.map(async (name): Promise<ImageVariant> => {
      const longestEdge = VARIANT_LONGEST_EDGE[name];
      // Only downscale; never upscale (withoutEnlargement).
      const buf = await rotated
        .clone()
        .resize({
          width: longestEdge,
          height: longestEdge,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: VARIANT_QUALITY[name] })
        .toBuffer({ resolveWithObject: true });
      return {
        name,
        bytes: buf.data,
        width: buf.info.width,
        height: buf.info.height,
        sizeBytes: buf.info.size,
        mimeType: "image/webp",
        ext: "webp",
      };
    }),
  );
  return results;
}

/**
 * Content-type sanity check the caller runs before handing bytes to
 * processImage. Rejects obvious non-images before we pay for sharp
 * decoding attempts.
 */
export function isSupportedImageMime(mimeType: string): boolean {
  const t = mimeType.toLowerCase();
  return (
    t.startsWith("image/") &&
    (t === "image/jpeg" ||
      t === "image/png" ||
      t === "image/webp" ||
      t === "image/gif" ||
      t === "image/avif" ||
      t === "image/heic" ||
      t === "image/tiff")
  );
}
