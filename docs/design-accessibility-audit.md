# Design and accessibility review

Source review against `main`: dashboard (`/dashboard`), project proposal queue
(`/admin/projects/applications`), and public profile (`/u/[handle]`).

- The dashboard uses shared card, typography, and trading-card components. Its
  Submit an RFP action now uses the shared primary button link. Other locally
  styled dashboard actions still need a visual and keyboard review.
- The proposal queue already groups applications by project and uses the shared
  typography. Its interactive rows now have a visible control border; the
  pending badge uses black text for 4.92:1 contrast against its blue background.
- The public profile retains its existing trading-card tiers. Its artist booking
  fields now use the control border. Other profile sections still need a visual
  and keyboard review with representative member and artist accounts.
- Faint text, the shared secondary button, and keyboard focus on shared buttons
  were updated. Token measurements and the accent rule are in
  `docs/design-system.md`.

This is a source and solid-color contrast review, not a completed visual QA of
signed-in pages. Check dashboard, proposal queue, public profile, and their
empty, populated, error, hover, selected and focus states at desktop and mobile
sizes with representative accounts. Other forms and locally styled controls
have not all been migrated to the new control-border token. Contrast over
images, translucent colors, and other unlisted backgrounds also needs individual
measurement before closing the broader contrast issue.
