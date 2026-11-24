/**
 * Featured image input for listing forms. Pairs with
 * featuredImageFromForm() in src/lib/featured-image.ts.
 *
 * Listings are public and depersonalized (they always read as Future
 * Modern), so the warning against client-identifying images sits at the
 * upload itself, not in a placeholder.
 */
export function FeaturedImageField({
  currentUrl,
  labelClass,
  inputClass,
}: {
  /** Set on edit forms: shows the current image and keeps a URL field. */
  currentUrl?: string | null;
  labelClass: string;
  inputClass: string;
}) {
  const isEdit = currentUrl !== undefined;
  return (
    <div className={labelClass}>
      <span>
        Featured image <span className="text-ink-faint">(optional)</span>
      </span>
      {currentUrl && (
        <img
          src={currentUrl}
          alt="Current featured image"
          className="mt-2 aspect-[16/9] w-48 rounded-lg object-cover"
        />
      )}
      <input
        type="file"
        name="featuredImage"
        accept="image/jpeg,image/png,image/webp,image/gif,image/avif,image/heic,image/tiff"
        className={`${inputClass} file:mr-3 file:rounded-full file:border-0 file:bg-[var(--surface-elevated)] file:px-3 file:py-1 file:text-xs file:text-ink`}
      />
      {isEdit && (
        <input
          name="featuredImageUrl"
          type="text"
          defaultValue={currentUrl ?? ""}
          placeholder="Or paste an image URL: https://…"
          className={`${inputClass} mt-2`}
        />
      )}
      <span className="mt-1 block text-xs text-ink-faint">
        Up to 8 MB. Shown on the listing card and at the top of the listing. Use a
        neutral image: no client logos, names or anything that identifies
        the client. {isEdit ? "Uploading a file replaces the URL; clear the URL to remove the image." : ""}
      </span>
    </div>
  );
}
