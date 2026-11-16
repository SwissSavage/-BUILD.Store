/** The same share image used by the Future Modern homepage. */
export const DEFAULT_SOCIAL_IMAGE = "https://afuturemodern.com/images/brand/og-image.png";

export function socialImage(featuredImageUrl?: string | null): string {
  return featuredImageUrl?.trim() || DEFAULT_SOCIAL_IMAGE;
}
