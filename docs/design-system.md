# $BUILD.Store design language

The authenticated app uses the Future Modern landing page as its visual
language reference. It remains an operations product: this document governs
shared primitives, not page topology or the existing card tiers.

## Typography

- **Display:** Abel. Use for headings and short, high-priority figures.
- **Body:** Inter. Use for prose, controls, descriptions, tables, and form
  content.
- **Data:** JetBrains Mono. Use for IDs, timestamps, rates, hashes, and other
  values where character alignment helps scanning.

Headings use balanced wrapping; prose uses pretty wrapping where supported.
Normal body copy stays at or above 16px unless it is a clearly secondary,
compact operational label.

## Surfaces and geometry

| Token | Purpose |
| --- | --- |
| `--surface` | Page background |
| `--surface-inset` | Recessed fields and code-like areas |
| `--surface-elevated` | Existing card surface — do not change card tiers |
| `--surface-border` | Quiet structural boundary |
| `--control-radius` | Inputs and standard buttons (8px) |
| `--panel-radius` | Compact panels and grouped controls (12px) |

Existing feature and trading cards retain their current component, tier,
spacing, and radius rules. Pills remain for tags, filters, statuses, and
counts—not general-purpose buttons.

## Interaction

- All action controls use `Button` from `@/components/Button`; do not create
  bespoke button class strings for new work.
- `primary`, `secondary`, and `ghost` are the only standard button variants.
  `compact`, `default`, `large`, and `icon` are sizes, not additional styles.
- Primary actions use the existing accessible magenta-to-blue gradient.
- Primary buttons use a short brightness hover and 1px press response.
- Keyboard focus is a visible, high-contrast outline with a 3px offset.
- Selection, focus, and status must not rely on color alone; pair meaningful
  status color with text, an icon, or a glyph.
- Animated conic outlines are reserved for rare, high-commitment actions. They
  must respect `prefers-reduced-motion` and should not appear on routine Save
  or Edit actions.

Status pills, filter chips, counts, progress indicators, and avatars are not
buttons and may remain rounded. Button geometry is consistently 8px.
