/**
 * /invite/[code]/welcome — landing after signup completes.
 *
 * MVP holding page. Full Auth.js session bootstrap + redirect to
 * /dashboard lands with the Auth.js activation sprint. For now the
 * invitee sees a "welcome, we'll be in touch" confirmation so the
 * flow has a clean terminal state.
 */
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
            marginBottom: "1.25rem",
          }}
        >
          Your covenant is signed. Your seat is held. You are now inside
          the room.
        </p>
        <p
          style={{
            fontSize: "16px",
            lineHeight: 1.7,
            color: "#c4b28c",
            fontStyle: "italic",
          }}
        >
          A member of the cooperative will reach out to complete your
          account and hand you the tools. Watch your inbox.
        </p>
      </div>
    </div>
  );
}
