/**
 * /invite/[code]/letter — the Letter.
 *
 * First page in the care package sequence. Renders the parchment scroll
 * with the canonical invocation poem. This is the summons: no marketing
 * copy, no logos above the fold, no CTA fatigue. One artifact, one call
 * to continue. Locked design per 2026-08-15 review:
 *   - Parchment radial gradient with burnt edges (radial mask)
 *   - Ornate gold double-border + corner filigree + dividers above/below
 *   - Pinyon Script invocation in gold gradient
 *   - Wax seal at the bottom with the FM turtle
 *
 * Invite validation:
 *   - Reads the invite row by code
 *   - notFound() on missing / revoked / expired / consumed rows
 *   - Personalizes the greeting with targetName when present
 *
 * Server-rendered — no client JS needed on this page.
 */
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { inviteLinks } from "@/db/schema";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "You have been summoned — Future Modern",
  robots: { index: false, follow: false },
};

async function loadInvite(code: string) {
  const [row] = await db
    .select()
    .from(inviteLinks)
    .where(eq(inviteLinks.code, code))
    .limit(1);
  if (!row) return null;
  const now = new Date();
  if (row.revokedAt) return null;
  if (row.consumedAt) return null;
  if (new Date(row.expiresAt) < now) return null;
  return row;
}

export default async function InviteLetterPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const invite = await loadInvite(code);
  if (!invite) notFound();

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse at center, #1a0a04 0%, #0a0402 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "3rem 1.5rem",
      }}
    >
      <ScrollArtifact recipientName={invite.targetName} />

      <div style={{ marginTop: "4rem", textAlign: "center" }}>
        <Link
          href={`/invite/${code}/sign`}
          style={{
            display: "inline-block",
            padding: "14px 32px",
            border: "1px solid #d4a752",
            borderRadius: "999px",
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "18px",
            letterSpacing: "0.05em",
            color: "#f5d16b",
            textDecoration: "none",
            background: "transparent",
            transition: "background 200ms, color 200ms",
          }}
        >
          Accept and continue
        </Link>
        <p
          style={{
            marginTop: "1rem",
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "13px",
            fontStyle: "italic",
            color: "#8a7b5a",
          }}
        >
          {invite.targetName ? `For ${invite.targetName}. ` : ""}
          This invitation is yours alone.
        </p>
      </div>
    </div>
  );
}

function ScrollArtifact({ recipientName }: { recipientName: string | null }) {
  return (
    <div
      style={{
        position: "relative",
        maxWidth: "640px",
        width: "100%",
        padding: "5rem 3.5rem 6.5rem",
        background:
          "radial-gradient(ellipse at center, #f7ebca 0%, #eedaa4 40%, #c9a25c 80%, #7a4d1c 98%, #2d1806 100%)",
        borderRadius: "6px",
        boxShadow:
          "0 0 50px rgba(50,25,5,0.55), inset 0 0 80px rgba(80,45,10,0.35)",
        WebkitMaskImage:
          "radial-gradient(ellipse at 50% 50%, black 55%, rgba(0,0,0,0.92) 75%, rgba(0,0,0,0.78) 88%, rgba(0,0,0,0.55) 95%, transparent 100%)",
        maskImage:
          "radial-gradient(ellipse at 50% 50%, black 55%, rgba(0,0,0,0.92) 75%, rgba(0,0,0,0.78) 88%, rgba(0,0,0,0.55) 95%, transparent 100%)",
      }}
    >
      {/* Ornate double border */}
      <div
        style={{
          position: "absolute",
          top: "1.5rem",
          left: "1.5rem",
          right: "1.5rem",
          bottom: "1.5rem",
          border: "1px solid rgba(122,79,15,0.55)",
          borderRadius: "3px",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "2rem",
          left: "2rem",
          right: "2rem",
          bottom: "2rem",
          border: "1px solid rgba(122,79,15,0.35)",
          borderRadius: "2px",
          pointerEvents: "none",
        }}
      />

      {/* Corner flourishes */}
      <CornerFlourish position="top-left" />
      <CornerFlourish position="top-right" />
      <CornerFlourish position="bottom-left" />
      <CornerFlourish position="bottom-right" />

      {/* Divider above the invocation */}
      <Divider />

      {/* The invocation */}
      <div
        style={{
          textAlign: "center",
          fontFamily: "'Pinyon Script', cursive",
          fontSize: "44px",
          lineHeight: 1.55,
          background:
            "linear-gradient(180deg, #f5d16b 0%, #b8862a 50%, #7a4f0f 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextFillColor: "transparent",
          color: "transparent",
        }}
      >
        You have been summoned.
        <br />
        Where work remains sovereign.
        <br />
        You&apos;ve been called to world $BUILD
        <br />
        with A Future Modern.
      </div>

      {/* Divider below (mirrored) */}
      <Divider mirrored />

      {/* Wax seal with turtle */}
      <div
        style={{
          position: "absolute",
          bottom: "-22px",
          left: "50%",
          transform: "translateX(-50%) rotate(-6deg)",
          width: "128px",
          height: "128px",
          borderRadius: "50%",
          background:
            "radial-gradient(circle at 35% 30%, #c94848 0%, #a02525 40%, #6b1010 80%, #3d0808 100%)",
          boxShadow:
            "0 8px 18px rgba(20,5,5,0.6), inset 0 3px 8px rgba(255,180,180,0.28), inset 0 -6px 12px rgba(30,5,5,0.65)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: "6px",
            borderRadius: "50%",
            border: "1.5px dashed rgba(255,190,190,0.35)",
          }}
        />
        <div
          style={{
            filter:
              "drop-shadow(0 1px 0 rgba(30,5,5,0.55)) grayscale(1) brightness(0.3) sepia(1) hue-rotate(-40deg) saturate(4)",
            opacity: 0.92,
          }}
        >
          <Image
            src="/brand/turtle.png"
            width={80}
            height={80}
            alt=""
            aria-hidden="true"
            priority
          />
        </div>
      </div>

      {/* Personalization mark, if we have a name */}
      {recipientName ? (
        <div
          style={{
            position: "absolute",
            top: "3rem",
            left: 0,
            right: 0,
            textAlign: "center",
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "14px",
            fontStyle: "italic",
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: "#8a5d15",
            opacity: 0.75,
          }}
        >
          For {recipientName}
        </div>
      ) : null}
    </div>
  );
}

function CornerFlourish({
  position,
}: {
  position: "top-left" | "top-right" | "bottom-left" | "bottom-right";
}) {
  const transforms: Record<typeof position, string> = {
    "top-left": "none",
    "top-right": "scaleX(-1)",
    "bottom-left": "scaleY(-1)",
    "bottom-right": "scale(-1,-1)",
  };
  const [vertical, horizontal] = position.split("-") as [
    "top" | "bottom",
    "left" | "right",
  ];
  return (
    <svg
      style={{
        position: "absolute",
        [vertical]: "1rem",
        [horizontal]: "1rem",
        transform: transforms[position],
      }}
      width="60"
      height="60"
      viewBox="0 0 60 60"
      aria-hidden="true"
    >
      <g
        fill="none"
        stroke="#8a5d15"
        strokeWidth="1.2"
        strokeLinecap="round"
      >
        <path d="M 8 30 C 8 18, 18 8, 30 8" />
        <path d="M 12 30 C 12 20, 20 12, 30 12" />
        <path d="M 8 30 Q 14 26, 20 30 T 32 30" opacity="0.7" />
        <path d="M 30 8 Q 26 14, 30 20 T 30 32" opacity="0.7" />
        <circle cx="20" cy="20" r="2" fill="#b8862a" stroke="none" />
        <circle cx="14" cy="26" r="1.2" fill="#8a5d15" stroke="none" />
        <circle cx="26" cy="14" r="1.2" fill="#8a5d15" stroke="none" />
      </g>
    </svg>
  );
}

function Divider({ mirrored = false }: { mirrored?: boolean }) {
  return (
    <svg
      style={{
        display: "block",
        margin: mirrored ? "1rem auto 0" : "0 auto 1rem",
        transform: mirrored ? "rotate(180deg)" : undefined,
      }}
      width="200"
      height="24"
      viewBox="0 0 200 24"
      aria-hidden="true"
    >
      <g
        fill="none"
        stroke="#8a5d15"
        strokeWidth="1.2"
        strokeLinecap="round"
      >
        <path d="M 20 12 Q 60 4, 100 12 T 180 12" />
        <path d="M 20 12 Q 60 20, 100 12 T 180 12" opacity="0.6" />
        <circle cx="100" cy="12" r="3" fill="#b8862a" stroke="none" />
        <circle cx="60" cy="12" r="1.6" fill="#8a5d15" stroke="none" />
        <circle cx="140" cy="12" r="1.6" fill="#8a5d15" stroke="none" />
        <path d="M 12 12 L 4 12 M 188 12 L 196 12" />
      </g>
    </svg>
  );
}
