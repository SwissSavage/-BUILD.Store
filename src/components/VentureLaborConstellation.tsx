/**
 * Venture Labor OS Constellation — Turtle-pentagon system map.
 *
 * Visual language ported from Future Modern's governance-doc reference
 * (FM_Sankey_Waterfalls turtle-anatomy constellation). The turtle mark
 * is FM's brand identity, so the diagram lives inside it — 5 outer
 * nodes at head + 4 flippers, central hub with "Venture Labor OS" as
 * brand identity, directed flow arrows showing how the systems feed
 * each other. Legend at the bottom explains edge colors.
 *
 * 8 governance systems compressed to 5 outer nodes + hub:
 *   - Head (top center)   → Recognition & Canon (year-end pinnacle;
 *                            Canonization folds into Recognition as the
 *                            annual freeze)
 *   - Top-right flipper   → Compensation
 *   - Bottom-right flipper → Revenue Model
 *   - Bottom-left flipper → Compliance
 *   - Top-left flipper    → MVP Score
 *   - Central hub         → Venture Labor OS (Covenant as sub-label;
 *                            the covenant is the foundational document
 *                            that everything else references)
 *   - Tier Ladder         → folded into the hub as concentric
 *                            progression rings (Viewer → Prospect →
 *                            Partner → Member)
 *
 * Hover any outer node to reveal a detail card below with the section
 * anchor link into /governance.
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
  summary: string;
  href: string;
}

interface ConstellationEdge {
  from: string; // node id, or "hub"
  to: string;
  color: "green" | "blue" | "magenta" | "gray";
  dashed?: boolean;
  path: string;
}

// Node positions match the reference turtle anatomy layout (viewBox 960×760).
// Card rectangles are anchored to leave room for the outer glow ring
// on the anchor dot. Colors use the FM brand palette.
const NODES: ConstellationNode[] = [
  {
    id: "recognition",
    label: "RECOGNITION & CANON",
    subLabel1: "Monthly · Annual · Year-End",
    subLabel2: "Champion's Court",
    x: 480,
    y: 120,
    cardX: 316,
    cardY: 130,
    cardW: 328,
    cardH: 66,
    color: "#007048",
    summary:
      "Future Modernist of the Month, Constellation of the Year, Champion's Court, and the annual canonization card that freezes the year into an ERC-721 with an ERC-6551 wallet.",
    href: "/governance#recognition",
  },
  {
    id: "compensation",
    label: "COMPENSATION",
    subLabel1: "Base + Ceiling",
    subLabel2: "Client rating ≥ 4 gate",
    x: 737,
    y: 307,
    cardX: 740,
    cardY: 280,
    cardW: 196,
    cardH: 66,
    color: "#5070F0",
    summary:
      "Every quote carries base and ceiling. Base pays. Ceiling releases on client rating ≥ 4, or PM 60% + peer 40% composite fallback. Reclaimed ceilings feed the Engagement Recovery Pool.",
    href: "/governance#compensation",
  },
  {
    id: "revenue",
    label: "REVENUE MODEL",
    subLabel1: "85 · 12 · 3",
    subLabel2: "Talent · Reserve · Ops",
    x: 639,
    y: 608,
    cardX: 528,
    cardY: 614,
    cardW: 220,
    cardH: 66,
    color: "#5070F0",
    summary:
      "85 to the contributor pool, 12 to cooperative reserve (treasury + LP + benefits), 3 to admin operations. Disclosed on every contract.",
    href: "/governance#revenue",
  },
  {
    id: "compliance",
    label: "COMPLIANCE",
    subLabel1: "−9 OVR · 90 days",
    subLabel2: "Stacking · Rescinded when appealed",
    x: 321,
    y: 608,
    cardX: 212,
    cardY: 614,
    cardW: 220,
    cardH: 66,
    color: "#D828A0",
    summary:
      "Each covenant violation: −9 OVR for 90 days, stacking. Real-time impact prevents slow decay. Every action audit-logged. Arbitration available on disputed penalties.",
    href: "/governance#compliance",
  },
  {
    id: "mvp",
    label: "MVP SCORE",
    subLabel1: "0–99 OVR",
    subLabel2: "Seven sub-ratings · Rolling 12mo",
    x: 223,
    y: 307,
    cardX: 24,
    cardY: 280,
    cardW: 196,
    cardH: 66,
    color: "#D828A0",
    summary:
      "Seven sub-ratings on a twelve-month rolling window, weighted recent. Feeds recognition shortlist, year-end canonization tier, and the compliance penalty math. Provisional until promotion.",
    href: "/governance#mvp",
  },
];

// Directed flows. Edges paths were sketched to sit alongside the
// reference layout — same pentagon shape, adjusted arrow endpoints.
// "green" = covenant defines rule. "blue" = measurement feeds
// downstream. "magenta" = economic effect. "gray" = enforcement.
// Dashed = feedback loop.
const EDGES: ConstellationEdge[] = [
  // Hub → each outer node (green — covenant defines behavior)
  {
    from: "hub",
    to: "recognition",
    color: "green",
    path: "M480,326 L480,196",
  },
  {
    from: "hub",
    to: "compensation",
    color: "green",
    path: "M528,364 L714,314",
  },
  {
    from: "hub",
    to: "revenue",
    color: "green",
    path: "M516,420 L620,580",
  },
  {
    from: "hub",
    to: "compliance",
    color: "green",
    path: "M444,420 L340,580",
  },
  {
    from: "hub",
    to: "mvp",
    color: "green",
    path: "M432,358 L244,314",
  },

  // MVP → Recognition (blue — data feeds shortlist + year-end tier)
  {
    from: "mvp",
    to: "recognition",
    color: "blue",
    path: "M244,290 Q332,196 452,138",
  },

  // MVP ↔ Compliance (feedback loop, magenta dashed — penalty affects
  // OVR; OVR context informs whether penalty is appropriate)
  {
    from: "mvp",
    to: "compliance",
    color: "magenta",
    dashed: true,
    path: "M232,336 L310,580",
  },
  {
    from: "compliance",
    to: "mvp",
    color: "magenta",
    dashed: true,
    path: "M320,576 L242,340",
  },

  // Revenue ↔ Compensation (magenta — pay flows from revenue split)
  {
    from: "revenue",
    to: "compensation",
    color: "magenta",
    path: "M660,580 Q726,466 738,340",
  },
  {
    from: "compensation",
    to: "revenue",
    color: "magenta",
    dashed: true,
    path: "M720,340 Q694,466 634,580",
  },

  // Compliance → Recognition (gray — active penalties delay
  // recognition eligibility)
  {
    from: "compliance",
    to: "recognition",
    color: "gray",
    dashed: true,
    path: "M336,580 Q400,340 452,138",
  },
];

const EDGE_COLOR: Record<ConstellationEdge["color"], string> = {
  green: "#007048",
  blue: "#5070F0",
  magenta: "#D828A0",
  gray: "#556",
};

const MARKER_ID: Record<ConstellationEdge["color"], string> = {
  green: "am-g",
  blue: "am-b",
  magenta: "am-m",
  gray: "am-d",
};

export function VentureLaborConstellation() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeNode = activeId
    ? NODES.find((n) => n.id === activeId) ?? null
    : null;

  const isEdgeActive = (edge: ConstellationEdge): boolean => {
    if (activeId === null) return false;
    return edge.from === activeId || edge.to === activeId;
  };

  return (
    <div className="w-full">
      <div className="relative overflow-hidden rounded-3xl border border-[var(--surface-border)] bg-[#060a10]">
        <svg
          viewBox="0 0 960 760"
          className="h-auto w-full"
          role="img"
          aria-label="Venture Labor OS turtle constellation — governance systems map"
        >
          <defs>
            {/* Arrow markers, one per edge color */}
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

          {/* Turtle silhouette (ghost) */}
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
          {/* Flipper suggestions (green) */}
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
          {/* Head */}
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
          {EDGES.map((edge, i) => {
            const active = isEdgeActive(edge);
            return (
              <path
                key={`edge-${i}`}
                d={edge.path}
                stroke={EDGE_COLOR[edge.color]}
                strokeWidth={active ? 2.2 : 1.4}
                fill="none"
                strokeDasharray={edge.dashed ? "5,3" : "none"}
                markerEnd={`url(#${MARKER_ID[edge.color]})`}
                opacity={
                  activeId === null ? 0.7 : active ? 0.95 : 0.2
                }
                style={{ transition: "all 0.25s ease" }}
              />
            );
          })}

          {/* Central hub — "Venture Labor OS" (Covenant as foundation) */}
          <circle
            cx="480"
            cy="380"
            r="68"
            fill="#D828A0"
            opacity="0.04"
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

          {/* Tier ladder concentric rings inside hub — 4 rings for 4 tiers */}
          <circle
            cx="480"
            cy="380"
            r="18"
            fill="none"
            stroke="#5070F0"
            strokeWidth="0.4"
            opacity="0.3"
          />
          <circle
            cx="480"
            cy="380"
            r="28"
            fill="none"
            stroke="#5070F0"
            strokeWidth="0.4"
            opacity="0.3"
          />
          <circle
            cx="480"
            cy="380"
            r="38"
            fill="none"
            stroke="#5070F0"
            strokeWidth="0.4"
            opacity="0.3"
          />
          <circle
            cx="480"
            cy="380"
            r="48"
            fill="none"
            stroke="#5070F0"
            strokeWidth="0.4"
            opacity="0.3"
          />

          <text
            x="480"
            y="370"
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
            y="386"
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
            y="400"
            textAnchor="middle"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fontSize="7"
            fill="#666"
          >
            Covenant · Tier Ladder
          </text>

          {/* Outer nodes — cards with anchor circles */}
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
                {/* Anchor dot with glow */}
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

                {/* Card */}
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
                        : "#050e08"
                  }
                  stroke={node.color}
                  strokeWidth={isFocus ? 2 : 1.4}
                  opacity={activeId === null || isFocus ? 1 : 0.4}
                  style={{ transition: "all 0.2s ease" }}
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
                  y={node.cardY + 22}
                  textAnchor="middle"
                  fontFamily="'Playfair Display', Georgia, serif"
                  fontSize="11"
                  fontWeight="700"
                  fill="#F5F5F5"
                >
                  {node.label}
                </text>
                <text
                  x={node.cardX + node.cardW / 2}
                  y={node.cardY + 40}
                  textAnchor="middle"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  fontSize="8"
                  fill={
                    node.color === "#D828A0"
                      ? "#604060"
                      : node.color === "#5070F0"
                        ? "#405060"
                        : "#406050"
                  }
                >
                  {node.subLabel1}
                </text>
                <text
                  x={node.cardX + node.cardW / 2}
                  y={node.cardY + 54}
                  textAnchor="middle"
                  fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
                  fontSize="8"
                  fill={
                    node.color === "#D828A0"
                      ? "#604060"
                      : node.color === "#5070F0"
                        ? "#405060"
                        : "#406050"
                  }
                >
                  {node.subLabel2}
                </text>
              </g>
            );
          })}

          {/* Legend */}
          <rect
            x="220"
            y="702"
            width="520"
            height="44"
            rx="2"
            fill="#080a10"
            stroke="#1a2535"
            strokeWidth="1"
          />
          <line
            x1="236"
            y1="716"
            x2="258"
            y2="716"
            stroke="#007048"
            strokeWidth="1.5"
          />
          <text
            x="262"
            y="719"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fontSize="8"
            fill="#007048"
          >
            covenant defines
          </text>
          <line
            x1="360"
            y1="716"
            x2="382"
            y2="716"
            stroke="#5070F0"
            strokeWidth="1.5"
          />
          <text
            x="386"
            y="719"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fontSize="8"
            fill="#5070F0"
          >
            measurement feeds
          </text>
          <line
            x1="500"
            y1="716"
            x2="522"
            y2="716"
            stroke="#D828A0"
            strokeWidth="1.5"
          />
          <text
            x="526"
            y="719"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fontSize="8"
            fill="#D828A0"
          >
            economic effect
          </text>
          <line
            x1="640"
            y1="716"
            x2="662"
            y2="716"
            stroke="#556"
            strokeWidth="1.5"
          />
          <text
            x="666"
            y="719"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fontSize="8"
            fill="#889"
          >
            enforcement
          </text>
          <line
            x1="236"
            y1="736"
            x2="258"
            y2="736"
            stroke="#D828A0"
            strokeWidth="1.2"
            strokeDasharray="4,3"
          />
          <text
            x="262"
            y="739"
            fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
            fontSize="8"
            fill="#D828A0"
          >
            feedback loop (dashed)
          </text>
        </svg>

        {/* Detail card below the SVG — hover any node to expand */}
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
                Read the specification →
              </Link>
            </div>
          ) : (
            <div>
              <p className="text-[11px] uppercase tracking-wider text-ink-muted">
                Venture Labor OS · Turtle constellation
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                Eight interlocking systems, mapped to FM&apos;s turtle
                brand mark. Hover or tap any point.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
