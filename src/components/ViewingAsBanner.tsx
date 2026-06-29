/**
 * Sticky banner shown whenever an admin is previewing the site as
 * another user (or as a signed-out viewer). Always-visible escape
 * hatch — when you're "viewing as Viewer" the Admin nav is hidden, so
 * this banner is the only way back. Placed above <Nav> in layout.
 */
import { getCurrentUser, getOriginalAdminUser } from "@/lib/auth-stub";
import { returnToOriginalUser } from "@/lib/auth-actions";
import { adminName } from "@/lib/types";

export async function ViewingAsBanner() {
  const realAdmin = await getOriginalAdminUser();
  if (!realAdmin) return null;

  const previewing = await getCurrentUser();
  const previewingLabel = previewing
    ? `${adminName(previewing)} (${previewing.membershipTier})`
    : "a signed-out viewer";

  return (
    <div
      className="w-full border-b text-sm"
      style={{
        backgroundColor: "rgba(216, 40, 160, 0.08)",
        borderColor: "rgba(216, 40, 160, 0.35)",
      }}
    >
      <div className="mx-auto flex max-w-app flex-wrap items-center justify-between gap-3 px-6 py-2.5">
        <span>
          You&apos;re previewing the site as{" "}
          <strong>{previewingLabel}</strong>. Logged in as{" "}
          {adminName(realAdmin)}.
        </span>
        <form action={returnToOriginalUser}>
          <button
            type="submit"
            className="rounded-full px-3 py-1 text-xs font-medium text-white"
            style={{ backgroundColor: "#D828A0" }}
          >
            Return to your admin account
          </button>
        </form>
      </div>
    </div>
  );
}
