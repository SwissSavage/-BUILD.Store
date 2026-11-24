/**
 * Read a listing's featured image off a submitted form.
 *
 * An uploaded file wins: it goes through the existing sharp → storage
 * pipeline (uploadImage) and the full variant's URL comes back, since the
 * same URL also fills the wide detail-page header. Otherwise the optional
 * pasted URL is validated and kept. Returns null when neither is given.
 *
 * Deliberately not a "use server" module, so this does not become a
 * client-callable endpoint of its own.
 */
import { uploadImage } from "@/lib/image-upload-actions";

export async function featuredImageFromForm(
  formData: FormData,
  keyPrefix: string,
): Promise<string | null> {
  const file = formData.get("featuredImage");
  if (file instanceof File && file.size > 0) {
    const upload = new FormData();
    upload.set("image", file);
    upload.set("keyPrefix", keyPrefix);
    const stored = await uploadImage(upload);
    return (
      stored.full.publicUrl ??
      `/api/media/r2/${encodeURIComponent(stored.full.key)}`
    );
  }

  const raw = String(formData.get("featuredImageUrl") ?? "").trim();
  if (!raw) return null;
  // A previously uploaded image round-trips through the edit form as its
  // own served path.
  if (raw.startsWith("/api/media/")) return raw;
  try {
    const url = new URL(raw);
    if (url.protocol === "https:" || url.protocol === "http:") return raw;
  } catch {
    // fall through
  }
  throw new Error("Featured image must be a valid http(s) URL.");
}
