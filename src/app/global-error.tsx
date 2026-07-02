/**
 * Root-level error boundary.
 *
 * Required by Next.js App Router — catches errors thrown from the
 * root layout itself (which app/error.tsx cannot catch, since error.tsx
 * lives inside layout.tsx). Must be a Client Component and must render
 * its own html + body since the root layout failed.
 *
 * Kept minimal and self-contained: no dependencies on the theme
 * variables or component library, since those could be the source of
 * the error we're recovering from.
 */
"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("Root layout error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#000",
          color: "#fff",
          fontFamily:
            "'Inter', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
        }}
      >
        <div
          style={{
            maxWidth: 640,
            margin: "80px auto",
            padding: "0 24px",
          }}
        >
          <p
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "#D828A0",
              marginBottom: 12,
            }}
          >
            Something broke
          </p>
          <h1
            style={{
              fontSize: 32,
              fontFamily: "'Playfair Display', Georgia, serif",
              fontWeight: 600,
              marginBottom: 12,
            }}
          >
            The root layout hit an error
          </h1>
          <p
            style={{
              color: "#A3A3A3",
              marginBottom: 16,
              fontSize: 14,
              lineHeight: 1.6,
            }}
          >
            Even the shell couldn&apos;t render. Retry or head back home.
          </p>
          {error.digest && (
            <p
              style={{
                fontSize: 12,
                fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                color: "#666",
                marginBottom: 24,
              }}
            >
              Digest: {error.digest}
            </p>
          )}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={reset}
              style={{
                border: "none",
                borderRadius: 9999,
                background: "#D828A0",
                color: "#fff",
                padding: "10px 20px",
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Retry
            </button>
            <a
              href="/"
              style={{
                borderRadius: 9999,
                border: "1px solid #2A2A2A",
                color: "#A3A3A3",
                padding: "10px 20px",
                textDecoration: "none",
                fontSize: 14,
              }}
            >
              Home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
