/**
 * Care package layout — lives OUTSIDE the (public) and (app) route
 * groups so the invite ceremony pages don't inherit PublicNav, Footer,
 * or the app chrome. The point is that each page in this flow feels
 * like a self-contained artifact, not a marketing surface.
 *
 * Sequence handled by pages beneath:
 *   1. /invite/[code]/letter   — the parchment scroll (summons)
 *   2. /invite/[code]/sign     — kicks off Documenso LOI signature
 *   3. Documenso signing on sign.afuturemodern.com (external)
 *   4. Redirect back into /invite/[code]/code — the illuminated codex
 *      (post-signature reveal of the 8 principles + Terms + Data opt-in)
 *   5. Form submit → account activation
 *
 * Fonts are Google-hosted; loaded via <link> here so both letter and
 * codex pages get them without per-page imports. Cormorant Garamond is
 * the body serif for the codex; Pinyon Script and Tangerine carry the
 * ceremonial script surfaces (Letter poem + Codex drop-caps).
 */
import type { ReactNode } from "react";

export default function InviteLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <link
        rel="preconnect"
        href="https://fonts.googleapis.com"
      />
      <link
        rel="preconnect"
        href="https://fonts.gstatic.com"
        crossOrigin="anonymous"
      />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Pinyon+Script&family=Tangerine:wght@700&display=swap"
      />
      {children}
    </>
  );
}
