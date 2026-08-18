/**
 * /invite/[code]/welcome — ceremonial "you're in" landing after signup
 * completes. Session is already minted (see completeInviteSignup); this
 * page is the moment between signing and landing on the dashboard.
 * Auto-redirects to /dashboard after 5 seconds; explicit "Enter" button
 * for anyone who wants to skip the animation.
 */
import Link from "next/link";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Welcome to Future Modern",
  robots: { index: false, follow: false },
};

export default function InviteWelcomePage() {
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
      <meta httpEquiv="refresh" content="5; url=/dashboard" />
      <div style={{ maxWidth: "520px", textAlign: "center" }}>
        <p
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
            marginBottom: "1.5rem",
          }}
        >
          Welcome in.
        </p>
        <p
          style={{
            fontSize: "18px",
            lineHeight: 1.7,
            color: "#ecdcb5",
            marginBottom: "2rem",
          }}
        >
          Your covenant is signed. Your account is live. You are now
          inside the room.
        </p>
        <Link
          href="/dashboard"
          style={{
            display: "inline-block",
            padding: "14px 32px",
            background:
              "linear-gradient(180deg, #f5d16b 0%, #d4a752 50%, #8a5d15 100%)",
            color: "#1a0a04",
            textDecoration: "none",
            borderRadius: "999px",
            fontFamily: "'Cormorant Garamond', serif",
            fontSize: "17px",
            fontWeight: 600,
            letterSpacing: "0.03em",
          }}
        >
          Enter your dashboard
        </Link>
        <p
          style={{
            fontSize: "13px",
            lineHeight: 1.6,
            color: "#8a7a5c",
            fontStyle: "italic",
            marginTop: "1.5rem",
          }}
        >
          Redirecting in a few seconds…
        </p>
      </div>
    </div>
  );
}
