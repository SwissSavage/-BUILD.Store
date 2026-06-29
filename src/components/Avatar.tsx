/**
 * Avatar — renders a user's profile image, or falls back to initials in a
 * deterministic brand-colored circle. Deterministic hashing of the user id
 * means the same member always gets the same fallback color.
 *
 * Server component safe — uses a plain <img> so we can point at arbitrary
 * URLs without pre-configuring `next.config` image domains.
 */
import type { User } from "@/lib/types";

type Size = "xs" | "sm" | "md" | "lg" | "xl";

const SIZE_CLASSES: Record<Size, string> = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-base",
  xl: "h-24 w-24 text-2xl",
};

// Deterministic palette draw from the Future Modern hex set.
const FALLBACK_COLORS = [
  "#D828A0", // magenta
  "#5070F0", // blue
  "#007048", // green
];

function pickColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return FALLBACK_COLORS[Math.abs(h) % FALLBACK_COLORS.length];
}

function initials(u: Pick<User, "firstName" | "lastName">): string {
  const f = (u.firstName ?? "").trim();
  const l = (u.lastName ?? "").trim();
  const fi = f ? f[0] : "";
  const li = l && l !== "—" ? l[0] : "";
  const combined = `${fi}${li}`.toUpperCase();
  return combined || "?";
}

export function Avatar({
  user,
  size = "md",
  className = "",
}: {
  user: Pick<User, "id" | "firstName" | "lastName" | "profileImageUrl">;
  size?: Size;
  className?: string;
}) {
  const sizeClass = SIZE_CLASSES[size];

  if (user.profileImageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={user.profileImageUrl}
        alt=""
        aria-hidden="true"
        className={`${sizeClass} rounded-full object-cover ${className}`}
      />
    );
  }

  const bg = pickColor(user.id);
  return (
    <span
      aria-hidden="true"
      className={`inline-flex ${sizeClass} items-center justify-center rounded-full font-medium text-white ${className}`}
      style={{ backgroundColor: bg }}
    >
      {initials(user)}
    </span>
  );
}
