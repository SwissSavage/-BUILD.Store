/**
 * The client-safe half of engagement references.
 *
 * Split out so the composer form and the review card import limits and
 * a formatter without pulling in `readEngagementFiles`, which touches
 * `Buffer`. Tree-shaking would almost certainly have handled that, and
 * "almost certainly" is not worth finding out through a deploy chain
 * that gives no feedback until the Docker build fails.
 *
 * Nothing here touches node builtins, the database or a request.
 */

export const MAX_ENGAGEMENT_LINKS = 10;
export const MAX_ENGAGEMENT_FILES = 6;
export const MAX_ENGAGEMENT_FILE_BYTES = 4 * 1024 * 1024;

export interface EngagementLink {
  /** What renders. Never the URL itself. */
  label: string;
  url: string;
}

export interface EngagementFile {
  name: string;
  mimeType: string;
  sizeBytes: number;
  base64: string;
}

/** "1.4 MB", "22 KB". For the review screen, where size sets expectations. */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}
