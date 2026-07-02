/**
 * Venture Labor OS Constellation — interactive system map.
 *
 * Renders the cooperative operating system as an actual constellation
 * (Afrofuturist / FM brand-aligned): connected nodes representing the
 * eight structural systems that make FM more than a marketplace. Each
 * node has a short one-line explainer and cross-links to the deeper
 * doc/policy where it's specified.
 *
 * Client component so nodes are hover-highlightable + click-focusable
 * without a full page nav. Falls back to a static image on print.
 *
 * Embedded on /about, /whitelist, /governance — anywhere the "not a
 * marketplace, an operating system" thesis needs to land visually.
 */
"use client";

import Link from "next/link";
import { useState } from "react";

interface ConstellationNode {
  id: string;
  label: string;
  x: number;
  y: number;
  summary: string;
  href: string;
  color: string;
}

interface ConstellationEdge {
  from: string;
  to: string;
  /** Optional descriptive edge label surfaced on hover of either endpoint. */
  meaning?: string;
}

// Layout: 800×540 viewBox, nodes arranged as an actual constellation
// shape — not a hub-and-spoke or hierarchy tree. The COVENANT sits at
// the base as the foundational document; MVP SCORE + RECOGNITION cluster
// central-upper as the day-to-day standing instruments; CANONIZATION +
// COMPENSATION anchor the material outcomes; TIER LADDER + COMPLIANCE
// + REVENUE MODEL orbit as the operational rails.
const NODES: ConstellationNode[] = [
  {
    id: "covenant",
    label: "Covenant",
    x: 400,
    y: 460,
    summary:
      "Deliver. Communicate. Route through the platform. Give honest peer review.",
    href: "/policies/covenant",
    color: "#D4AF37", // gold — foundational
  },
  {
    id: "tier-ladder",
    label: "Tier Ladder",
    x: 130,
    y: 360,
    summary:
      "Viewer → Prospect → Partner → Member. Contribution, not payment. Access not for sale.",
    href: "/governance#tier",
    color: "#5070F0",
  },
  {
    id: "mvp-score",
    label: "MVP Score",
    x: 300,
    y: 220,
    summary:
      "0-99 OVR from seven sub-ratings, 12-month rolling. Real-time compliance + recognition, not a year-end review.",
    href: "/governance#mvp",
    color: "#D828A0",
  },
  {
    id: "recognition",
    label: "Recognition Rails",
    x: 500,
    y: 220,
    summary:
      "Future Modernist of the Month + Constellation of the Year + Champion's Court. Metric shortlist + editorial narrative.",
    href: "/governance#recognition",
    color: "#D828A0",
  },
  {
    id: "compensation",
    label: "Compensation",
    x: 640,
    y: 340,
    summary:
      "Base guaranteed. Ceiling releases on client rating ≥ 4 (or PM + peer composite fallback). Client never sees the gate.",
    href: "/governance#compensation",
    color: "#007048",
  },
  {
    id: "revenue-model",
    label: "Revenue Model",
    x: 670,
    y: 460,
    summary:
      "85 talent · 12 reserve · 3 admin ops. Reserve subdivides for treasury, LP, and cooperative benefits.",
    href: "/governance#revenue",
    color: "#007048",
  },
  {
    id: "canonization",
    label: "Annual Canonization",
    x: 400,
    y: 100,
    summary:
      "Year-end ERC-721 card with ERC-6551 token-bound account. Wallet-native artifact for the year. Canon starts at zero at beta.",
    href: "/governance#canonization",
    color: "#D4AF37",
  },
  {
    id: "compliance",
    label: "Compliance",
    x: 130,
    y: 460,
    summary:
      "−9 OVR per violation, 90 days, stacking. Real-time impact prevents slow decay. Every action audit-logged.",
    href: "/governance#compliance",
    color: "#D828A0",
  },
];

const EDGES: ConstellationEdge[] = [
  // Covenant is the base — connects to the standing instruments
  { from: "covenant", to: "mvp-score", meaning: "sets expected behavior" },
  { from: "covenant", to: "recognition", meaning: "defines what's rewarded" },
  { from: "covenant", to: "compliance", meaning: "defines penalty triggers" },
  { from: "covenant", to: "tier-ladder", meaning: "gates tier progression" },
  // MVP Score feeds recognition + compensation
  { from: "mvp-score", to: "recognition", meaning: "metric shortlist" },
  { from: "mvp-score", to: "canonization", meaning: "year-end tier lock" },
  { from: "mvp-score", to: "compliance", meaning: "OVR impact on penalty" },
  // Recognition feeds canonization
  { from: "recognition", to: "canonization", meaning: "wraps into card metadata" },
  // Compensation + revenue
  { from: "revenue-model", to: "compensation", meaning: "85% pool distribution" },
  { from: "compensation", to: "mvp-score", meaning: "settles with client rating" },
  // Tier ladder gates
  { from: "tier-ladder", to: "recognition", meaning: "Members + recognized Partners" },
  { from: "tier-ladder", to: "compensation", meaning: "gate for base+bonus structure" },
];

export function VentureLaborConstellation() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeNode = activeId
    ? NODES.find((n) => n.id === activeId) ?? null
    : null;

  const isEdgeActive = (edge: ConstellationEdge): boolean => {
    if (activeId === null) return false;
    return edge.from === activeId || edge.to === activeId;
  };

  const isNodeActive = (id: string): boolean => {
    if (activeId === null) return false;
    if (activeId === id) return true;
    // A node is "adjacent-active" if it's on the other end of an active edge.
    return EDGES.some(
      (e) =>
        (e.from === activeId && e.to === id) ||
        (e.to === activeId && e.from === id),
    );
  };

  return (
    <div className="w-full">
      <div className="relative overflow-hidden rounded-3xl border border-[var(--surface-border)] bg-black">
        {/* Starfield backdrop — very subtle so nodes read */}
        <svg
          viewBox="0 0 800 540"
          className="h-auto w-full"
          role="img"
          aria-label="Venture Labor OS constellation — interactive system map"
        >
          <defs>
            <radialGradient id="starGlow" cx="50%" cy="50%">
              <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0)" />
            </radialGradient>
            <radialGradient id="nodeGlow" cx="50%" cy="50%">
              <stop offset="0%" stopColor="rgba(216,40,160,0.6)" />
              <stop offset="60%" stopColor="rgba(216,40,160,0.15)" />
              <stop offset="100%" stopColor="rgba(216,40,160,0)" />
            </radialGradient>
          </defs>

          {/* Scattered starfield — decorative */}
          {[...Array(48)].map((_, i) => {
            // Deterministic pseudo-random so hydration stays stable
            const seed = i * 137.5;
            const x = (seed * 7.13) % 800;
            const y = (seed * 5.71) % 540;
            const r = ((seed % 3) + 1) * 0.4;
            return (
              <circle
                key={`star-${i}`}
                cx={x}
                cy={y}
                r={r}
                fill="white"
                opacity={0.25}
              />
            );
          })}

          {/* Edges */}
          {EDGES.map((edge, i) => {
            const from = NODES.find((n) => n.id === edge.from);
            const to = NODES.find((n) => n.id === edge.to);
            if (!from || !to) return null;
            const active = isEdgeActive(edge);
            return (
              <line
                key={`edge-${i}`}
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={active ? "#D828A0" : "rgba(255,255,255,0.15)"}
                strokeWidth={active ? 1.5 : 0.75}
                strokeDasharray={active ? "none" : "3 4"}
                style={{ transition: "all 0.25s ease" }}
              />
            );
          })}

          {/* Node glows for the active node */}
          {activeNode && (
            <circle
              cx={activeNode.x}
              cy={activeNode.y}
              r={60}
              fill="url(#nodeGlow)"
            />
          )}

          {/* Nodes */}
          {NODES.map((node) => {
            const isActive = isNodeActive(node.id);
            const isFocus = activeId === node.id;
            return (
              <g
                key={node.id}
                onMouseEnter={() => setActiveId(node.id)}
                onMouseLeave={() => setActiveId(null)}
                onFocus={() => setActiveId(node.id)}
                onBlur={() => setActiveId(null)}
                onClick={() => setActiveId(isFocus ? null : node.id)}
                tabIndex={0}
                role="button"
                aria-label={`${node.label} — ${node.summary}`}
                style={{ cursor: "pointer" }}
              >
                {/* Outer ring on active */}
                {isFocus && (
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={22}
                    fill="none"
                    stroke={node.color}
                    strokeWidth={1}
                    opacity={0.6}
                  />
                )}
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isFocus ? 10 : 7}
                  fill={node.color}
                  opacity={isActive || activeId === null ? 1 : 0.35}
                  style={{ transition: "all 0.2s ease" }}
                />
                <text
                  x={node.x}
                  y={node.y + 26}
                  textAnchor="middle"
                  fill={isActive || activeId === null ? "white" : "rgba(255,255,255,0.4)"}
                  fontSize={13}
                  fontFamily="'Playfair Display', Georgia, serif"
                  style={{ transition: "all 0.2s ease" }}
                >
                  {node.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Detail card overlay */}
        <div className="border-t border-[var(--surface-border)] px-6 py-5">
          {activeNode ? (
            <div>
              <div className="flex items-baseline gap-3">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: activeNode.color }}
                />
                <p className="text-[11px] uppercase tracking-wider text-ink-muted">
                  Venture Labor OS
                </p>
              </div>
              <h3 className="mt-1 font-display text-xl font-semibold text-ink">
                {activeNode.label}
              </h3>
              <p className="mt-2 text-sm text-ink-muted">{activeNode.summary}</p>
              <Link
                href={activeNode.href}
                className="mt-2 inline-block text-xs text-brand-magenta hover:underline"
              >
                Read the specification →
              </Link>
            </div>
          ) : (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-ink-muted">
                Venture Labor OS
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                Eight interlocking systems. Hover or tap any point.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 grid gap-2 text-xs md:grid-cols-3">
        <LegendRow color="#D4AF37" label="Foundational — covenant + canonization" />
        <LegendRow color="#D828A0" label="Standing instruments — MVP, recognition, compliance" />
        <LegendRow color="#007048" label="Material rails — compensation + revenue" />
        <LegendRow color="#5070F0" label="Tier progression" />
      </div>
    </div>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2 text-ink-muted">
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
    </div>
  );
}
