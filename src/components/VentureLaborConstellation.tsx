/**
 * Venture Labor OS Constellation — value-flow turtle diagram.
 *
 * Ported verbatim from the reference FM_Sankey_Waterfalls governance-
 * doc HTML. Five outer nodes at head + four flippers describe the
 * network's value flow — who brings what, where the money and equity
 * move, who accrues over time. The visible labels stay terse so the
 * diagram explains the model at a glance.
 *
 * Hover any outer node to reveal a short value-forward explanation +
 * link into /governance for the deeper spec. This is where the
 * governance mechanics (MVP score, recognition, canonization, covenant,
 * comp structure) live — not on the visible chart. The chart shows the
 * network; the hover shows how the network is run.
 */
"use client";

import Link from "next/link";
import { useState } from "react";

interface ConstellationNode {
  id: string;
  label: string;
  subLabel1: string;
  subLabel2: string;
  x: number;
  y: number;
  cardX: number;
  cardY: number;
  cardW: number;
  cardH: number;
  color: string;
  /** Value-forward one-liner surfaced on hover. Not a feature list. */
  summary: string;
  href: string;
}

interface ConstellationEdge {
  color: "magenta" | "blue" | "green" | "gray";
  dashed?: boolean;
  path: string;
}

// Node positions match the reference turtle anatomy (viewBox 960×760).
const NODES: ConstellationNode[] = [
  {
    id: "contributor",
    label: "CONTRIBUTOR",
    subLabel1: "Skills · Relationships",
    subLabel2: "Domain Expertise",
    x: 480,
    y: 120,
    cardX: 372,
    cardY: 130,
    cardW: 216,
    cardH: 58,
    color: "#007048",
    summary:
      "The people who ship the work. Bring skill, network, and taste. Get paid directly and accrue equity in what they build.",
    href: "/governance#tier",
  },
  {
    id: "platform",
    label: "PLATFORM",
    subLabel1: "Infrastructure · Brand",
    subLabel2: "Distribution · Leverage",
    x: 737,
    y: 307,
    cardX: 740,
    cardY: 280,
    cardW: 196,
    cardH: 58,
    color: "#5070F0",
    summary:
      "The shared surface that turns individual work into cooperative reach. Infrastructure, brand, distribution — cooperatively owned, never rented from.",
    href: "/governance#covenant",
  },
  {
    id: "client",
    label: "CLIENT / DEAL",
    subLabel1: "Revenue Generated",
    subLabel2: "85 · 12 · 3 Split",
    x: 639,
    y: 608,
    cardX: 642,
    cardY: 614,
    cardW: 210,
    cardH: 66,
    color: "#007048",
    summary:
      "Every dollar the cooperative collects. Disclosed on every contract — 85 to the shippers, 12 to reserve, 3 to admin ops. No silent skim.",
    href: "/governance#revenue",
  },
  {
    id: "treasury",
    label: "TREASURY",
    subLabel1: "Collects 3% · 1.5% ops",
    subLabel2: "1.5% → liquidity pool",
    x: 321,
    y: 608,
    cardX: 108,
    cardY: 614,
    cardW: 210,
    cardH: 66,
    color: "#556",
    summary:
      "Cooperative-owned reserve. Half funds operations. Half seeds the liquidity pool so contributors' passive equity has a market.",
    href: "/governance#revenue",
  },
  {
    id: "liquidity",
    label: "LIQUIDITY POOL",
    subLabel1: "= $BUILD TOKEN",
    subLabel2: "Passive equity · OTC mobilization",
    x: 223,
    y: 307,
    cardX: 24,
    cardY: 278,
    cardW: 196,
    cardH: 70,
    color: "#D828A0",
    summary:
      "$BUILD accrues with every contribution and compounds across years. The pool gives it a real market — sit on it, spend it, or mobilize it.",
    href: "/governance#canonization",
  },
];

// Directed edges from the reference — same colors, same routing, same
// meaning. Magenta = cash/equity, blue = platform, green = deal flow,
// gray = treasury flow, dashed = feedback loop.
const EDGES: ConstellationEdge[] = [
  // Contributor → Platform (blue — platform leverage)
  {
    color: "blue",
    path: "M510,132 Q660,200 718,292",
  },
  // Platform ↔ Client/Deal (dashed blue bidirectional)
  {
    color: "blue",
    dashed: true,
    path: "M726,332 Q706,470 644,590",
  },
  {
    color: "blue",
    dashed: true,
    path: "M654,586 Q718,462 734,324",
  },
  // Client/Deal → Treasury (magenta — cash payment)
  {
    color: "magenta",
    path: "M622,612 Q480,644 358,612",
  },
  // Liquidity → Contributor (magenta — cash/equity out)
  {
    color: "magenta",
    path: "M242,290 Q330,196 450,132",
  },
  // Contributor → Hub (green — deal flow in)
  { color: "green", path: "M484,144 L484,342" },
  // Hub → Contributor (magenta — cash out, reciprocal)
  { color: "magenta", path: "M472,342 L472,148" },
  // Hub → Platform (blue — amplifies leverage)
  { color: "blue", path: "M528,364 L714,314" },
  // Hub → Client/Deal (green — deal flow out)
  { color: "green", path: "M518,420 L638,576" },
  // Client/Deal → Hub (magenta — cash in, parallel offset)
  { color: "magenta", path: "M628,572 L508,416" },
  // Treasury → Liquidity (gray)
  { color: "gray", path: "M310,592 Q248,468 232,326" },
  // Hub ↔ Treasury (magenta dashed feedback)
  {
    color: "magenta",
    dashed: true,
    path: "M450,422 L340,574",
  },
  {
    color: "magenta",
    dashed: true,
    path: "M336,570 L446,418",
  },
  // Hub ↔ Liquidity (magenta dashed feedback)
  {
    color: "magenta",
    dashed: true,
    path: "M432,358 L248,308",
  },
  {
    color: "magenta",
    dashed: true,
    path: "M244,318 L428,366",
  },
];

const EDGE_COLOR: Record<ConstellationEdge["color"], string> = {
  magenta: "#D828A0",
  blue: "#5070F0",
  green: "#007048",
  gray: "#556",
};

const MARKER_ID: Record<ConstellationEdge["color"], string> = {
  magenta: "am-m",
  blue: "am-b",
  green: "am-g",
  gray: "am-d",
};

export function VentureLaborConstellation() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeNode = activeId
    ? NODES.find((n) => n.id === activeId) ?? null
    : null;

  return (
    <div className="w-full">
      <div className="relative overflow-hidden rounded-3xl border border-[var(--surface-border)] bg-[#060a10]">
        <svg
          viewBox="0 0 960 760"
          className="h-auto w-full"
          role="img"
          aria-label="Venture Labor OS — value-flow turtle constellation"
        >
          <defs>
            <marker
              id="am-m"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L6,3 z" fill="#D828A0" opacity="0.9" />
            </marker>
            <marker
              id="am-b"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L6,3 z" fill="#5070F0" opacity="0.9" />
            </marker>
            <marker
              id="am-g"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L6,3 z" fill="#007048" opacity="0.9" />
            </marker>
            <marker
              id="am-d"
              markerWidth="6"
              markerHeight="6"
              refX="5"
              refY="3"
              orient="auto"
            >
              <path d="M0,0 L0,6 L6,3 z" fill="#556" opacity="0.9" />
            </marker>

            <filter id="glow-m">
              <feGaussianBlur stdDeviation="6" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-b">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-g">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="glow-hub">
              <feGaussianBlur stdDeviation="14" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            <radialGradient id="hub-grad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1a0818" />
              <stop offset="100%" stopColor="#06080f" />
            </radialGradient>
            <pattern
              id="dots"
              x="0"
              y="0"
              width="36"
              height="36"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="18" cy="18" r="0.7" fill="#1a2535" opacity="0.5" />
            </pattern>
          </defs>

          {/* Background */}
          <rect width="960" height="760" fill="#060a10" />
          <rect width="960" height="760" fill="url(#dots)" />

          {/* Turtle silhouette (ghost) — ported verbatim from reference */}
          <ellipse
            cx="480"
            cy="400"
            rx="182"
            ry="200"
            fill="none"
            stroke="#0d1f30"
            strokeWidth="1.2"
            opacity="0.5"
          />
          <line
            x1="308"
            y1="330"
            x2="652"
            y2="330"
            stroke="#0d1f30"
            strokeWidth="0.9"
            opacity="0.4"
          />
          <line
            x1="298"
            y1="400"
            x2="662"
            y2="400"
            stroke="#0d1f30"
            strokeWidth="0.9"
            opacity="0.4"
          />
          <line
            x1="308"
            y1="470"
            x2="652"
            y2="470"
            stroke="#0d1f30"
            strokeWidth="0.9"
            opacity="0.4"
          />
          <line
            x1="354"
            y1="210"
            x2="298"
            y2="590"
            stroke="#5070F0"
            strokeWidth="0.7"
            opacity="0.12"
          />
          <line
            x1="480"
            y1="200"
            x2="302"
            y2="600"
            stroke="#5070F0"
            strokeWidth="0.7"
            opacity="0.12"
          />
          <line
            x1="606"
            y1="210"
            x2="662"
            y2="590"
            stroke="#D828A0"
            strokeWidth="0.7"
            opacity="0.12"
          />
          <line
            x1="480"
            y1="200"
            x2="658"
            y2="600"
            stroke="#D828A0"
            strokeWidth="0.7"
            opacity="0.12"
          />
          <line
            x1="480"
            y1="200"
            x2="480"
            y2="600"
            stroke="#D828A0"
            strokeWidth="0.6"
            opacity="0.1"
          />
          <ellipse
            cx="737"
            cy="307"
            rx="72"
            ry="40"
            fill="none"
            stroke="#007048"
            strokeWidth="0.9"
            opacity="0.1"
            transform="rotate(30 737 307)"
          />
          <ellipse
            cx="223"
            cy="307"
            rx="72"
            ry="40"
            fill="none"
            stroke="#007048"
            strokeWidth="0.9"
            opacity="0.1"
            transform="rotate(-30 223 307)"
          />
          <ellipse
            cx="639"
            cy="608"
            rx="72"
            ry="40"
            fill="none"
            stroke="#007048"
            strokeWidth="0.9"
            opacity="0.1"
            transform="rotate(-20 639 608)"
          />
          <ellipse
            cx="321"
            cy="608"
            rx="72"
            ry="40"
            fill="none"
            stroke="#007048"
            strokeWidth="0.9"
            opacity="0.1"
            transform="rotate(20 321 608)"
          />
          <ellipse
            cx="480"
            cy="126"
            rx="38"
            ry="30"
            fill="none"
            stroke="#007048"
            strokeWidth="0.9"
            opacity="0.12"
          />

          {/* Directed edges */}
          {EDGES.map((edge, i) => (
            <path
              key={`edge-${i}`}
              d={edge.path}
              stroke={EDGE_COLOR[edge.color]}
              strokeWidth={
                edge.color === "magenta" && !edge.dashed
                  ? 1.6
                  : edge.color === "gray"
                    ? 1.4
                    : 1.4
              }
              fill="none"
              strokeDasharray={edge.dashed ? "5,3" : "none"}
              markerEnd={`url(#${MARKER_ID[edge.color]})`}
              opacity={
                edge.dashed ? 0.65 : edge.color === "gray" ? 0.8 : 0.75
              }
            />
          ))}

          {/* Central hub — "Venture Labor OS" */}
          <circle
            cx="480"
            cy="380"
            r="68"
            fill="#D828A0"
            opacity="0.03"
            filter="url(#glow-hub)"
          />
          <circle
            cx="480"
            cy="380"
            r="56"
            fill="url(#hub-grad)"
            stroke="#D828A0"
            strokeWidth="1.5"
          />
          <path
            d="M480,324 A56,56 0 0,0 480,436"
            fill="#5070F0"
            opacity="0.07"
          />
          <path
            d="M480,324 A56,56 0 0,1 480,436"
            fill="#D828A0"
            opacity="0.07"
          />
          <line
            x1="480"
            y1="328"
            x2="480"
            y2="432"
            stroke="#D828A0"
            strokeWidth="1"
            opacity="0.4"
          />
          <line
            x1="430"
            y1="350"
            x2="530"
            y2="350"
            stroke="#1a2a3a"
            strokeWidth="0.7"
            opacity="0.5"
          />
          <line
            x1="424"
            y1="380"
            x2="536"
            y2="380"
            stroke="#1a2a3a"
            strokeWidth="0.7"
            opacity="0.5"
          />
          <line
            x1="430"
            y1="410"
            x2="530"
            y2="410"
            stroke="#1a2a3a"
            strokeWidth="0.7"
            opacity="0.5"
          />
          <line
            x1="454"
            y1="326"
            x2="440"
            y2="434"
            stroke="#5070F0"
            strokeWidth="0.6"
            opacity="0.25"
          />
          <line
            x1="506"
            y1="326"
            x2="520"
            y2="434"
            stroke="#D828A0"
            strokeWidth="0.6"
            opacity="0.25"
          />
          <text
            x="480"
            y="372"
            textAnchor="middle"
            fontFamily="'Playfair Display', Georgia, serif"
            fontSize="12"
            fontWeight="700"
            fill="#F5F5F5"
          >
            VENTURE
          </text>
          <text
            x="480"
            y="388"
            textAnchor="middle"
            fontFamily="'Playfair Display', Georgia, serif"
            fontSize="12"
            fontWeight="700"
            fill="#D828A0"
          >
            LABOR OS
          </text>
          <text
            x="480"
            y="402"
            textAnchor="middle"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fontSize="7.5"
            fill="#444"
          >
            Future Modern
          </text>

          {/* Outer nodes — cards + anchor dots + labels */}
          {NODES.map((node) => {
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
                <circle
                  cx={node.x}
                  cy={node.y}
                  r={isFocus ? 7 : 5}
                  fill={node.color}
                  filter={
                    node.color === "#D828A0"
                      ? "url(#glow-m)"
                      : node.color === "#5070F0"
                        ? "url(#glow-b)"
                        : "url(#glow-g)"
                  }
                />
                <rect
                  x={node.cardX}
                  y={node.cardY}
                  width={node.cardW}
                  height={node.cardH}
                  rx="2"
                  fill={
                    node.color === "#D828A0"
                      ? "#0e060e"
                      : node.color === "#5070F0"
                        ? "#060810"
                        : node.color === "#556"
                          ? "#090909"
                          : "#050e08"
                  }
                  stroke={node.color === "#556" ? "#445" : node.color}
                  strokeWidth={isFocus ? 2 : 1.4}
                />
                <rect
                  x={node.cardX}
                  y={node.cardY}
                  width={node.cardW}
                  height="2.5"
                  fill={node.color}
                  opacity="0.9"
                />
                <text
                  x={node.cardX + node.cardW / 2}
                  y={node.cardY + 20}
                  textAnchor="middle"
                  fontFamily="'Playfair Display', Georgia, serif"
                  fontSize="10"
                  fontWeight="700"
                  fill="#F5F5F5"
                >
                  {node.label}
                </text>
                <text
                  x={node.cardX + node.cardW / 2}
                  y={node.cardY + 34}
                  textAnchor="middle"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  fontSize="8"
                  fill={
                    node.color === "#D828A0"
                      ? "#604060"
                      : node.color === "#5070F0"
                        ? "#405060"
                        : node.color === "#556"
                          ? "#505060"
                          : "#406050"
                  }
                >
                  {node.subLabel1}
                </text>
                <text
                  x={node.cardX + node.cardW / 2}
                  y={node.cardY + 47}
                  textAnchor="middle"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  fontSize="8"
                  fill={
                    node.color === "#D828A0"
                      ? "#604060"
                      : node.color === "#5070F0"
                        ? "#405060"
                        : node.color === "#556"
                          ? "#505060"
                          : "#406050"
                  }
                >
                  {node.subLabel2}
                </text>
              </g>
            );
          })}

          {/* Legend — verbatim from reference */}
          <rect
            x="268"
            y="700"
            width="560"
            height="46"
            rx="2"
            fill="#080a10"
            stroke="#1a2535"
            strokeWidth="1"
          />
          <line
            x1="284"
            y1="716"
            x2="306"
            y2="716"
            stroke="#D828A0"
            strokeWidth="1.5"
          />
          <text
            x="310"
            y="719"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fontSize="8"
            fill="#D828A0"
          >
            cash / equity
          </text>
          <line
            x1="390"
            y1="716"
            x2="412"
            y2="716"
            stroke="#5070F0"
            strokeWidth="1.5"
          />
          <text
            x="416"
            y="719"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fontSize="8"
            fill="#5070F0"
          >
            platform
          </text>
          <line
            x1="470"
            y1="716"
            x2="492"
            y2="716"
            stroke="#007048"
            strokeWidth="1.5"
          />
          <text
            x="496"
            y="719"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fontSize="8"
            fill="#007048"
          >
            deal flow
          </text>
          <line
            x1="608"
            y1="716"
            x2="630"
            y2="716"
            stroke="#556"
            strokeWidth="1.5"
          />
          <text
            x="634"
            y="719"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fontSize="8"
            fill="#889"
          >
            treasury flow
          </text>
          <line
            x1="284"
            y1="736"
            x2="306"
            y2="736"
            stroke="#D828A0"
            strokeWidth="1.2"
            strokeDasharray="4,3"
          />
          <text
            x="310"
            y="739"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fontSize="8"
            fill="#D828A0"
          >
            feedback loop
          </text>
          <line
            x1="416"
            y1="736"
            x2="438"
            y2="736"
            stroke="#5070F0"
            strokeWidth="1.2"
            strokeDasharray="4,3"
          />
          <text
            x="442"
            y="739"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fontSize="8"
            fill="#5070F0"
          >
            platform ↔ client (dashed)
          </text>
        </svg>

        {/* Value-forward hover reveal below the SVG */}
        <div className="border-t border-[var(--surface-border)] px-6 py-5">
          {activeNode ? (
            <div>
              <div className="flex items-baseline gap-3">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: activeNode.color }}
                />
                <p className="text-[11px] uppercase tracking-wider text-ink-muted">
                  {activeNode.label}
                </p>
              </div>
              <p className="mt-2 text-sm text-ink-muted">
                {activeNode.summary}
              </p>
              <Link
                href={activeNode.href}
                className="mt-2 inline-block text-xs text-brand-magenta hover:underline"
              >
                See how it&apos;s run →
              </Link>
            </div>
          ) : (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-ink-muted">
                The network
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                Contributors ship the work. The platform amplifies it.
                Clients pay for it. Treasury and $BUILD keep the value
                circulating back to the people who built it. Hover a
                point to see how each piece pulls its weight.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
