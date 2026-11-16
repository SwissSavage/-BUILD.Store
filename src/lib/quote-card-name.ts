import { publicName, type User } from "@/lib/types";

type CardNameUser = Pick<User, "firstName" | "lastName" | "handle" | "displayName" | "profileMode">;

/** Keep short first names whole; shorten longer first names predictably. */
export function quoteCardName(user: CardNameUser): string {
  const name = publicName(user);
  if (user.profileMode === "epk" && user.displayName?.trim()) return name;

  const first = user.firstName?.trim();
  if (!first) return name;
  const characters = Array.from(first);
  if (characters.length < 7) return name;

  const initial = user.lastName?.trim()[0];
  return `${characters.slice(0, 6).join("")}…${initial ? ` ${initial}.` : ""}`;
}
