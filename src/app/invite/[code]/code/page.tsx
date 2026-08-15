/**
 * /invite/[code]/code — the illuminated codex.
 *
 * Post-signature reveal. Documenso redirects the invitee here after
 * they complete the LOI. Renders the Future Modernist's Code (8
 * principles, v8 canon) in the locked illuminated-codex aesthetic:
 * deep leather-tone background, Tangerine drop-cap numerals in gold
 * gradient, Cormorant Garamond serif body in warm ivory.
 *
 * Below the Code sits the final activation form:
 *   - Terms of Service (required checkbox)
 *   - Data participation (optional checkbox — the labor-value dataset
 *     per Andrea Vogler's play; honest framing, not defaulted-on)
 *
 * Submit → completeInviteSignup → invite consumed + eventual account
 * activation.
 *
 * MVP note: this page does not currently gate on Documenso webhook
 * having confirmed the signature completed. Trust is placed in the
 * Documenso redirectUrl arriving here only after the signer completed
 * the flow. Follow-up: read a `letter_of_intent_signed_at` column on
 * invite_links (populated by the webhook state machine using the
 * `invite:<code>` externalId correlation) and 302 back to /sign if
 * not set.
 */
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { inviteLinks } from "@/db/schema";
import { completeInviteSignup } from "@/lib/invite-actions";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "The Future Modernist's Code — Future Modern",
  robots: { index: false, follow: false },
};

interface Principle {
  n: number;
  name: string;
  tagline: string;
  body: string;
}

const PRINCIPLES: readonly Principle[] = [
  {
    n: 1,
    name: "Discernment",
    tagline: "Skill we will teach. Values we will not.",
    body: "We have learned this the expensive way. World-class skill paired with poor alignment is a costly combination in pooled labor: the work passes review and the relationship hollows out underneath. We vet alignment first because skill compounds where alignment compounds and stalls where it does not.",
  },
  {
    n: 2,
    name: "Reciprocity",
    tagline: "What flows in must flow back.",
    body: "If Future Modern books you work, Future Modern is owed work back. Not always in the same currency. A referral. A vouch. A serious review of someone else's portfolio. An introduction to the right room. Members who only receive are renting the network rather than running it. Renting is fine in other rooms. Future Modern is something different.",
  },
  {
    n: 3,
    name: "Ubuntu",
    tagline: "I am because we are; we are because we show up.",
    body: "A cooperative is a circulation system. It holds because members regularly put work back in. The annual floor is one of three things: a substantive contribution to a Future Modern project, a referral that lands the cooperative a paid contract, or another concrete contribution to operations (governance, mentorship, content, peer review) recognized by admin. Two years below the floor and membership pauses. Returning is not automatic; readmission goes to the community for review. The point is not punishment. It is keeping Ubuntu real.",
  },
  {
    n: 4,
    name: "Stewardship",
    tagline: "The relationship survives the contract.",
    body: "What gets done under a contract is the floor of the relationship, not the ceiling. Future Modern invests in members under the assumption that the relationship continues past the day the money lands: referrals, attribution, second-order help, vouching for the next person who needs to be in the right room. A pattern of finishing the work and disappearing is not the partnership we are building.",
  },
  {
    n: 5,
    name: "Solidarity",
    tagline: "The network is held in common.",
    body: "The relationships that come out of cooperative work belong to Future Modern as much as to any one member. Access flows reciprocally, by the same logic the upside does. Treating those relationships as separately monetizable, by anyone in either direction, is a misread of how Future Modern actually works. The right answer to “do you have someone for this” from another member is yes or no. Not a price.",
  },
  {
    n: 6,
    name: "Provenance",
    tagline: "Authority follows the work.",
    body: "Members who take on equity-shaped responsibility, like governance seats, founding-tier access, or stewardship of tools and contracts, ship the work that responsibility represents. Title without ongoing labor is one of the patterns Future Modern is most carefully designed against.",
  },
  {
    n: 7,
    name: "Allegiance",
    tagline: "Your brand is welcome. Your loyalty is to the work.",
    body: "Members are welcome to have personal brands, and many of the strongest contributors do. What Future Modern is not is a free amplifier for individual visibility, or a vehicle for routing cooperative-built attention into personal funnels that compound only one way. Build your brand alongside the work. Just do not build it out of Future Modern.",
  },
  {
    n: 8,
    name: "Sovereignty",
    tagline: "Membership is ours to curate.",
    body: "Signing a partnership document once does not make anyone a forever-member, and Future Modern is not in the business of pleasing everyone. We are in the business of getting excellent work from a small number of the right people. When a relationship has stopped being reciprocal, we let it end, professionally and without drama.",
  },
];

export default async function InviteCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const [invite] = await db
    .select()
    .from(inviteLinks)
    .where(eq(inviteLinks.code, code))
    .limit(1);
  if (!invite) notFound();
  if (invite.revokedAt) notFound();
  if (invite.consumedAt) {
    // Already completed. Send to the welcome page.
    return (
      <ConsumedNote />
    );
  }
  if (new Date(invite.expiresAt) < new Date()) notFound();

  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse at center, #1a0a04 0%, #0a0402 100%)",
        padding: "3rem 1.5rem",
      }}
    >
      <CodexArtifact />
      <ActivationForm code={code} />
    </div>
  );
}

function CodexArtifact() {
  return (
    <div
      style={{
        maxWidth: "640px",
        margin: "0 auto",
        padding: "4rem 3rem",
        background:
          "radial-gradient(ellipse at center, #3a1a10 0%, #2a1208 55%, #1a0a04 100%)",
        borderRadius: "6px",
        boxShadow:
          "0 0 60px rgba(20,8,4,0.7), inset 0 0 100px rgba(60,30,15,0.35)",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: "1.25rem",
          left: "1.25rem",
          right: "1.25rem",
          bottom: "1.25rem",
          border: "1px solid rgba(212,167,82,0.45)",
          borderRadius: "3px",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: "1.75rem",
          left: "1.75rem",
          right: "1.75rem",
          bottom: "1.75rem",
          border: "1px solid rgba(212,167,82,0.22)",
          borderRadius: "2px",
          pointerEvents: "none",
        }}
      />

      <div style={{ textAlign: "center", marginBottom: "2rem" }}>
        <div
          style={{
            fontFamily: "'Tangerine', cursive",
            fontSize: "56px",
            lineHeight: 1,
            background:
              "linear-gradient(180deg, #f5d16b 0%, #d4a752 50%, #8a5d15 100%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            WebkitTextFillColor: "transparent",
            color: "transparent",
          }}
        >
          The Future Modernist&apos;s Code
        </div>
        <TitleDivider />
      </div>

      <p
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "17px",
          lineHeight: 1.75,
          color: "#ecdcb5",
          fontStyle: "italic",
          textAlign: "center",
          margin: "0 0 2.5rem",
        }}
      >
        Future Modern is a cooperative grounded in three values:
        Provenance, Discernment, Equity. The Code is the ideological
        floor of membership. Membership is earned, not sold. What gets
        earned is access to people who do excellent work for excellent
        reasons. We teach craft. We do not teach values. If any of the
        lines below read as restrictions rather than how you already
        work, Future Modern is probably not your room.
      </p>

      <div
        style={{
          borderTop: "1px solid rgba(212,167,82,0.3)",
          margin: "0 2rem 2rem",
        }}
      />

      {PRINCIPLES.map((p) => (
        <PrincipleBlock key={p.n} principle={p} />
      ))}

      <div
        style={{
          borderTop: "1px solid rgba(212,167,82,0.3)",
          margin: "2rem 2rem 1.5rem",
        }}
      />
      <p
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "17px",
          lineHeight: 1.75,
          color: "#ecdcb5",
          fontStyle: "italic",
          textAlign: "center",
          margin: 0,
        }}
      >
        Read these once. If they sound like the operating system you
        would have written for yourself, the door is open. If not, we
        wish you well.
      </p>
    </div>
  );
}

function PrincipleBlock({ principle }: { principle: Principle }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "1.5rem",
        marginBottom: "2.5rem",
      }}
    >
      <div
        style={{
          fontFamily: "'Tangerine', cursive",
          fontSize: "92px",
          lineHeight: 0.8,
          background:
            "linear-gradient(180deg, #f5d16b 0%, #b8862a 50%, #7a4f0f 100%)",
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextFillColor: "transparent",
          color: "transparent",
          flexShrink: 0,
          minWidth: "60px",
          textAlign: "center",
          paddingTop: "8px",
        }}
      >
        {principle.n}
      </div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "26px",
            fontWeight: 600,
            color: "#f5d16b",
            marginBottom: "4px",
          }}
        >
          {principle.name}
        </div>
        <div
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "17px",
            fontStyle: "italic",
            color: "#d4a752",
            marginBottom: "12px",
          }}
        >
          {principle.tagline}
        </div>
        <p
          style={{
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "17px",
            lineHeight: 1.7,
            color: "#ecdcb5",
            margin: 0,
          }}
        >
          {principle.body}
        </p>
      </div>
    </div>
  );
}

function TitleDivider() {
  return (
    <svg
      style={{ display: "block", margin: "1rem auto 0" }}
      width="220"
      height="20"
      viewBox="0 0 220 20"
      aria-hidden="true"
    >
      <g fill="none" stroke="#d4a752" strokeWidth="1" strokeLinecap="round">
        <path d="M 20 10 Q 60 3, 110 10 T 200 10" />
        <circle cx="110" cy="10" r="2.5" fill="#f5d16b" stroke="none" />
        <circle cx="60" cy="10" r="1.2" fill="#d4a752" stroke="none" />
        <circle cx="160" cy="10" r="1.2" fill="#d4a752" stroke="none" />
      </g>
    </svg>
  );
}

function ActivationForm({ code }: { code: string }) {
  return (
    <form
      action={completeInviteSignup}
      style={{
        maxWidth: "640px",
        margin: "2rem auto 0",
        padding: "2rem",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(212,167,82,0.25)",
        borderRadius: "8px",
        color: "#ecdcb5",
        fontFamily: "'Cormorant Garamond', serif",
      }}
    >
      <input type="hidden" name="code" value={code} />

      <h2
        style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "22px",
          fontWeight: 500,
          color: "#f5d16b",
          margin: "0 0 1.5rem",
        }}
      >
        Complete your account
      </h2>

      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          marginBottom: "1.25rem",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          name="termsAccepted"
          required
          style={{
            marginTop: "4px",
            accentColor: "#D828A0",
            width: "18px",
            height: "18px",
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: "16px", lineHeight: 1.6 }}>
          I agree to the{" "}
          <a
            href="/policies"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#f5d16b", textDecoration: "underline" }}
          >
            Terms of Service
          </a>
          . <span style={{ opacity: 0.7 }}>Required.</span>
        </span>
      </label>

      <label
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "12px",
          marginBottom: "1.75rem",
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          name="dataOptIn"
          style={{
            marginTop: "4px",
            accentColor: "#D828A0",
            width: "18px",
            height: "18px",
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: "16px", lineHeight: 1.6 }}>
          I opt in to contribute anonymized project data to the
          cooperative labor-value dataset. Helps Future Modern build
          honest, data-driven pricing benchmarks for labor. Optional.
          You can opt out later from your account settings.
        </span>
      </label>

      <button
        type="submit"
        style={{
          display: "inline-block",
          padding: "12px 28px",
          background: "#D828A0",
          border: "none",
          borderRadius: "999px",
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: "17px",
          fontWeight: 500,
          letterSpacing: "0.03em",
          color: "#ffffff",
          cursor: "pointer",
        }}
      >
        Enter the room
      </button>
    </form>
  );
}

function ConsumedNote() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse at center, #1a0a04 0%, #0a0402 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "3rem 1.5rem",
        color: "#ecdcb5",
        fontFamily: "'Cormorant Garamond', serif",
      }}
    >
      <div style={{ maxWidth: "480px", textAlign: "center" }}>
        <p
          style={{
            fontSize: "22px",
            fontStyle: "italic",
            color: "#f5d16b",
            marginBottom: "1rem",
          }}
        >
          This invitation has already been accepted.
        </p>
        <p style={{ fontSize: "17px", lineHeight: 1.7, color: "#c4b28c" }}>
          If that was you, sign in from your regular account. If not,
          reach out to the admin who sent your invitation.
        </p>
      </div>
    </div>
  );
}
