/**
 * Tailwind config for the $BUILD.Store unified app.
 *
 * Brand palette is the single source of truth — mirrors
 * `Future Modern/brand/palette.json`. Use the named tokens
 * (brand.magenta, brand.blue, etc.) NOT ad-hoc hex literals.
 *
 * Dark-only — light mode was retired 2026-04-27. The semantic
 * tokens below match the values in globals.css `:root`.
 */
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // Future Modern brand palette — canonical.
        // Hex codes sampled directly from brand/turtle.png and brand/wordmark.png
        // (2026-04-21) so code matches what's on the actual logos.
        brand: {
          dark: "#000000",
          magenta: "#D828A0", // right half of turtle shell, "FUTURE" type
          blue: "#5070F0",    // left half of turtle shell, "modern" type
          green: "#007048",   // turtle body + flippers
          light: "#F5F5F5",
          mid: "#1A1A1A",
          white: "#FFFFFF",
          muted: "#666666",
        },
        // Semantic tokens — dark-only; mirrored in globals.css `:root`.
        // Use these in components instead of raw brand.* so the layer
        // remains swappable if the palette ever shifts.
        surface: {
          DEFAULT: "#000000",
          elevated: "#1A1A1A",
          inset: "#0A0A0A",
          border: "#2A2A2A",
        },
        ink: {
          DEFAULT: "#FFFFFF",
          muted: "#A3A3A3",
          faint: "#666666",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["'Playfair Display'", "Georgia", "serif"],
      },
      maxWidth: {
        app: "1280px",
      },
    },
  },
  plugins: [],
};

export default config;
