/**
 * /profile/edit — send people to a section.
 *
 * The editor used to be this one page: 1,200 lines, seven anchors, one
 * enormous scrolling column. Jamar: "these should not be taking people
 * to different areas of a massive vertical column. If the menu is
 * going to be there, each piece of the menu should have its own
 * field."
 *
 * Each section is now its own route. This route only exists so an old
 * link, or someone typing the path, lands somewhere sensible.
 */
import { redirect } from "next/navigation";

export default function ProfileEditIndex() {
  redirect("/profile/edit/identity");
}
