/**
 * /invite/[code]/sign — bridge page between the Letter and Documenso.
 *
 * Renders a minimal "carrying you to the signing surface" screen while
 * the server action fires the Documenso generate-document call and
 * redirects the invitee into the signing URL. If the invite has
 * already been consumed or is otherwise invalid, the server action
 * throws and Next.js's error boundary catches it.
 *
 * Design: intentionally plain — this is a transition, not a
 * ceremonial artifact. The Letter is the summons. Documenso is the
 * covenant surface. This page is the doorway between them.
 */
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { inviteLinks } from "@/db/schema";
import { sendInviteLoiForSignature } from "@/lib/invite-actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Preparing your covenant — Future Modern",
  robots: { index: false, follow: false },
};

export default async function InviteSignPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  // Preflight: make sure the invite is real before we spin the action.
  const [invite] = await db
    .select()
    .from(inviteLinks)
    .where(eq(inviteLinks.code, code))
    .limit(1);
  if (!invite) notFound();
  if (invite.revokedAt || invite.consumedAt) notFound();
  if (new Date(invite.expiresAt) < new Date()) notFound();

  // Reconstruct the origin from the incoming request headers so the
  // Documenso redirectUrl points back at the correct host in every
  // environment (localhost dev, Dokploy prod, PR previews).
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : "";

  async function proceed() {
    "use server";
    await sendInviteLoiForSignature(code, origin);
  }

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
        color: "#ecdcb5",
      }}
    >
      <div
        style={{
          maxWidth: "480px",
          textAlign: "center",
          fontFamily: "'Cormorant Garamond', serif",
        }}
      >
        <p
          style={{
            fontSize: "22px",
            fontStyle: "italic",
            color: "#f5d16b",
            marginBottom: "1rem",
          }}
        >
          The covenant awaits.
        </p>
        <p
          style={{
            fontSize: "17px",
            lineHeight: 1.7,
            color: "#c4b28c",
            marginBottom: "2rem",
          }}
        >
          You will be carried to the signing surface. Read the Letter of
          Intent, sign, and you will be returned here to receive the
          Code.
        </p>
        <form action={proceed}>
          <button
            type="submit"
            style={{
              display: "inline-block",
              padding: "14px 32px",
              border: "1px solid #d4a752",
              borderRadius: "999px",
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: "18px",
              letterSpacing: "0.05em",
              color: "#f5d16b",
              background: "transparent",
              cursor: "pointer",
            }}
          >
            Continue to the covenant
          </button>
        </form>
      </div>
    </div>
  );
}
