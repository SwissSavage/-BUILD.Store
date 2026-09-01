/**
 * Trash retention window.
 *
 * Lives outside `project-trash-actions.ts` because that file carries
 * a `"use server"` directive, and Next.js only allows async function
 * exports from those. A plain constant there fails the production
 * build — and `tsc --noEmit` does not catch it, since the rule is the
 * Next compiler's rather than TypeScript's.
 */
export const RETENTION_DAYS = 30;
