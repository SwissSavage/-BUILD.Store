/**
 * Who FM signs as.
 *
 * Lives here rather than in invite-actions because both the LOI invite
 * flow and the NCNDA send need it, and invite-actions is a
 * `"use server"` module: those may only export async functions, so a
 * plain helper cannot be shared out of one.
 */

/** Display name for the FM countersigner on an envelope. */
export function adminSenderName(admin: {
  firstName?: string | null;
  lastName?: string | null;
  handle?: string;
}): string {
  return (
    [admin.firstName, admin.lastName].filter(Boolean).join(" ") ||
    admin.handle ||
    "Future Modern"
  );
}

/**
 * The address FM signs from.
 *
 * `FM_COUNTERSIGNER_EMAIL` wins so paperwork can go out under one
 * cooperative address rather than whichever admin happened to click
 * send. Falls back to the acting admin, then to the shared inbox.
 */
export function countersignerEmail(admin: { email?: string | null }): string {
  return (
    process.env.FM_COUNTERSIGNER_EMAIL ??
    admin.email ??
    "hello@afuturemodern.com"
  );
}
