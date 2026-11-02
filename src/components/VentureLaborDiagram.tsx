import { useId } from "react";

/** Detailed view of the Venture Labor system; the accompanying overview provides the same flows as text. */
export function VentureLaborDiagram() {
  const id = useId().replace(/:/g, "");
  const arrows = { pink: `${id}-pink`, blue: `${id}-blue`, green: `${id}-green`, gray: `${id}-gray` };
  const colors: Record<string, string> = { pink: "#c973a9", blue: "#8197e4", green: "#61b99a", gray: "#90939f" };
  const nodes = [
    { x: 350, y: 34, width: 260, title: "CONTRIBUTOR", lines: ["Skills · Relationships", "Domain expertise"], color: "#68c7a4" },
    { x: 690, y: 234, width: 246, title: "PLATFORM", lines: ["Infrastructure · Brand", "Distribution · Leverage"], color: "#91a5ff" },
    { x: 660, y: 524, width: 276, title: "CLIENT / DEAL", lines: ["Revenue generated", "85 · 12 · 3 split"], color: "#68c7a4" },
    { x: 24, y: 524, width: 276, title: "TREASURY", lines: ["Collects 3% · 1.5% operations", "1.5% to liquidity pool"], color: "#b8bac7" },
    { x: 24, y: 234, width: 246, title: "LIQUIDITY POOL / $BUILD", lines: ["Passive equity accrual", "OTC = mobilization"], color: "#e68bc5" },
  ];
  return (
    <svg viewBox="0 0 960 760" role="img" aria-labelledby={`${id}-title ${id}-description`} className="block h-auto w-full bg-[#0b0c10]">
      <title id={`${id}-title`}>Venture Labor OS system diagram</title>
      <desc id={`${id}-description`}>Contributor, platform, client, treasury and liquidity pool connected to Venture Labor OS through deal flow, cash, platform leverage and feedback. The full set of flows is also listed in text below the diagram.</desc>
      <defs>
        <pattern id={`${id}-dots`} width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="12" cy="12" r="1" fill="#8e96ad" opacity="0.22" />
        </pattern>
        {Object.entries(arrows).map(([color, marker]) => (
          <marker key={color} id={marker} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
            <path d="M0 0 L7 3.5 L0 7 Z" fill={colors[color]} />
          </marker>
        ))}
      </defs>
      <rect width="960" height="760" fill={`url(#${id}-dots)`} aria-hidden="true" />
      <g fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M475 130 L475 299" stroke="#61b99a" markerEnd={`url(#${arrows.green})`} />
        <path d="M488 299 L488 130" stroke="#c973a9" markerEnd={`url(#${arrows.pink})`} />
        <path d="M610 88 Q722 122 785 224" stroke="#8197e4" markerEnd={`url(#${arrows.blue})`} />
        <path d="M582 347 L680 292" stroke="#8197e4" markerEnd={`url(#${arrows.blue})`} />
        <path d="M813 338 Q817 433 797 514" stroke="#8197e4" strokeDasharray="6 6" markerStart={`url(#${arrows.blue})`} markerEnd={`url(#${arrows.blue})`} />
        <path d="M550 427 L687 514" stroke="#61b99a" markerEnd={`url(#${arrows.green})`} />
        <path d="M676 514 L538 436" stroke="#c973a9" markerEnd={`url(#${arrows.pink})`} />
        <path d="M650 573 Q480 633 310 573" stroke="#c973a9" markerEnd={`url(#${arrows.pink})`} />
        <path d="M163 514 Q128 426 140 338" stroke="#90939f" markerEnd={`url(#${arrows.gray})`} />
        <path d="M160 224 Q246 116 340 88" stroke="#c973a9" markerEnd={`url(#${arrows.pink})`} />
        <path d="M420 436 L277 514" stroke="#c973a9" strokeDasharray="6 6" markerStart={`url(#${arrows.pink})`} markerEnd={`url(#${arrows.pink})`} />
        <path d="M377 348 L280 292" stroke="#c973a9" strokeDasharray="6 6" markerStart={`url(#${arrows.pink})`} markerEnd={`url(#${arrows.pink})`} />
      </g>
      <g>
        <rect x="379" y="302" width="202" height="132" rx="22" fill="#17181d" stroke="#bd6da3" strokeWidth="1.5" />
        <circle cx="480" cy="331" r="4" fill="#d887bd" />
        <text x="480" y="363" textAnchor="middle" fill="#f3f4f6" fontSize="20" fontWeight="700">Venture Labor</text>
        <text x="480" y="388" textAnchor="middle" fill="#d6a0c4" fontSize="16" fontWeight="600">OS</text>
        <text x="480" y="410" textAnchor="middle" fill="#b7bac5" fontSize="12">Future Modern</text>
      </g>
      {nodes.map((node) => (
        <g key={node.title}>
          <rect x={node.x} y={node.y} width={node.width} height="96" rx="16" fill="#17181d" stroke="#555963" strokeWidth="1.5" />
          <circle cx={node.x + 20} cy={node.y + 25} r="4" fill={node.color} />
          <text x={node.x + 34} y={node.y + 30} fill="#f3f4f6" fontSize="14" fontWeight="700">{node.title}</text>
          <text x={node.x + 20} y={node.y + 57} fill="#c2c4cd" fontSize="13">{node.lines[0]}</text>
          <text x={node.x + 20} y={node.y + 77} fill="#c2c4cd" fontSize="13">{node.lines[1]}</text>
        </g>
      ))}
      <g fontSize="12" fill="#d0d1d8">
        <path d="M110 694 H142" stroke="#c973a9" strokeWidth="2" /><text x="150" y="698">Cash / equity</text>
        <path d="M307 694 H339" stroke="#8197e4" strokeWidth="2" /><text x="347" y="698">Platform</text>
        <path d="M475 694 H507" stroke="#61b99a" strokeWidth="2" /><text x="515" y="698">Deal flow</text>
        <path d="M635 694 H667" stroke="#90939f" strokeWidth="2" /><text x="675" y="698">Treasury flow</text>
        <path d="M307 726 H339" stroke="#c973a9" strokeWidth="2" strokeDasharray="6 6" /><text x="347" y="730">Feedback loop</text>
        <path d="M535 726 H567" stroke="#8197e4" strokeWidth="2" strokeDasharray="6 6" /><text x="575" y="730">Platform ↔ client</text>
      </g>
    </svg>
  );
}
