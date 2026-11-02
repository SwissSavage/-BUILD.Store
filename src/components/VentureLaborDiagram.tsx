import { useId } from "react";

/** Detailed visual of the existing Venture Labor flows; the page also lists them as text. */
export function VentureLaborDiagram() {
  const id = useId().replace(/:/g, "");
  const colors = {
    cash: "#e597c8",
    platform: "#9aaeff",
    deal: "#7bd2af",
    treasury: "#b3b7c4",
  };
  const nodes = [
    { x: 356, y: 46, width: 248, title: "Contributor", detail: ["Skills · Relationships", "Domain expertise"], accent: colors.deal },
    { x: 686, y: 238, width: 250, title: "Platform", detail: ["Infrastructure · Brand", "Distribution · Leverage"], accent: colors.platform },
    { x: 642, y: 510, width: 294, title: "Client / deal", detail: ["Revenue generated", "85 · 12 · 3 split"], accent: colors.deal },
    { x: 24, y: 510, width: 294, title: "Treasury", detail: ["Collects 3% · 1.5% operations", "1.5% → liquidity pool"], accent: colors.treasury },
    { x: 24, y: 238, width: 250, title: "Liquidity pool / $BUILD", detail: ["Passive equity accrual", "OTC = mobilization"], accent: colors.cash },
  ];
  return (
    <svg viewBox="0 0 960 760" role="img" aria-labelledby={`${id}-title ${id}-description`} className="block h-auto w-full bg-[#0b0c10]" style={{ fontFamily: "var(--font-inter), system-ui, sans-serif" }}>
      <title id={`${id}-title`}>Venture Labor OS system diagram</title>
      <desc id={`${id}-description`}>The Venture Labor OS connects the contributor, platform, client or deal, treasury, and liquidity pool. Green arrows show deal flow, pink arrows show cash or equity, blue arrows show the platform, and gray arrows show treasury flow. Dashed arrows indicate feedback or a two-way platform and client relationship. A full list of flows follows the diagram.</desc>
      <defs>
        <linearGradient id={`${id}-surface`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#101118" />
          <stop offset="100%" stopColor="#0b0c10" />
        </linearGradient>
        <pattern id={`${id}-dots`} width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="12" cy="12" r="0.9" fill="#a1aabe" opacity="0.16" />
        </pattern>
        {Object.entries(colors).map(([name, color]) => (
          <marker key={name} id={`${id}-${name}`} viewBox="0 0 8 8" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto-start-reverse" markerUnits="userSpaceOnUse">
            <path d="M0 0 L8 4 L0 8 Z" fill={color} />
          </marker>
        ))}
      </defs>
      <rect width="960" height="760" fill={`url(#${id}-surface)`} aria-hidden="true" />
      <rect width="960" height="760" fill={`url(#${id}-dots)`} aria-hidden="true" />

      {/* The outer relationships follow the original constellation. */}
      <g fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {/* Contributor → platform; liquidity → contributor */}
        <path d="M604 98 C690 108 765 155 797 231" stroke={colors.platform} markerEnd={`url(#${id}-platform)`} />
        <path d="M163 231 C195 155 270 108 351 98" stroke={colors.cash} markerEnd={`url(#${id}-cash)`} />
        {/* Platform ↔ client; treasury → liquidity */}
        <path d="M811 344 L811 503" stroke={colors.platform} strokeDasharray="6 6" markerStart={`url(#${id}-platform)`} markerEnd={`url(#${id}-platform)`} />
        <path d="M149 503 L149 345" stroke={colors.treasury} markerEnd={`url(#${id}-treasury)`} />
        {/* Client → treasury */}
        <path d="M694 618 C694 649 266 649 266 623" stroke={colors.cash} markerEnd={`url(#${id}-cash)`} />
        {/* Contributor → hub; hub → contributor */}
        <path d="M471 153 L471 291" stroke={colors.deal} markerEnd={`url(#${id}-deal)`} />
        <path d="M489 291 L489 153" stroke={colors.cash} markerEnd={`url(#${id}-cash)`} />
        {/* Hub → platform */}
        <path d="M593 340 L679 292" stroke={colors.platform} markerEnd={`url(#${id}-platform)`} />
        {/* Hub → client; client → hub */}
        <path d="M544 422 L689 503" stroke={colors.deal} markerEnd={`url(#${id}-deal)`} />
        <path d="M669 503 L526 429" stroke={colors.cash} markerEnd={`url(#${id}-cash)`} />
        {/* Hub ↔ treasury; hub ↔ liquidity */}
        <path d="M418 428 L294 503" stroke={colors.cash} strokeDasharray="6 6" markerStart={`url(#${id}-cash)`} markerEnd={`url(#${id}-cash)`} />
        <path d="M367 340 L281 292" stroke={colors.cash} strokeDasharray="6 6" markerStart={`url(#${id}-cash)`} markerEnd={`url(#${id}-cash)`} />
      </g>

      {/* Solid, rounded nodes keep all text and accents inside the shape. */}
      <g>
        <rect x="368" y="294" width="224" height="128" rx="20" fill="#1c1d24" stroke="#a85e91" strokeWidth="1.5" />
        <text x="480" y="344" textAnchor="middle" fill="#f7f7fa" fontSize="20" fontWeight="700">Venture Labor OS</text>
        <text x="480" y="371" textAnchor="middle" fill="#c6a8be" fontSize="13">Future Modern</text>
      </g>
      {nodes.map((node) => (
        <g key={node.title}>
          <rect x={node.x} y={node.y} width={node.width} height="104" rx="16" fill="#191b21" stroke="#4d515e" strokeWidth="1.5" />
          <circle cx={node.x + 22} cy={node.y + 30} r="4" fill={node.accent} />
          <text x={node.x + 36} y={node.y + 35} fill="#f7f7fa" fontSize="16" fontWeight="700">{node.title}</text>
          <text x={node.x + 22} y={node.y + 62} fill="#c4c7d0" fontSize="13">{node.detail[0]}</text>
          <text x={node.x + 22} y={node.y + 83} fill="#c4c7d0" fontSize="13">{node.detail[1]}</text>
        </g>
      ))}

      {/* The legend preserves the original color and dash meanings. */}
      <rect x="48" y="660" width="864" height="92" rx="16" fill="#14151b" stroke="#32343e" strokeWidth="1" />
      <g fontSize="13" fill="#d6d8df">
        <path d="M70 686 H102" stroke={colors.cash} strokeWidth="2" /><text x="112" y="691">Cash / equity</text>
        <path d="M294 686 H326" stroke={colors.platform} strokeWidth="2" /><text x="336" y="691">Platform</text>
        <path d="M480 686 H512" stroke={colors.deal} strokeWidth="2" /><text x="522" y="691">Deal flow</text>
        <path d="M661 686 H693" stroke={colors.treasury} strokeWidth="2" /><text x="703" y="691">Treasury flow</text>
        <path d="M294 724 H326" stroke={colors.cash} strokeWidth="2" strokeDasharray="6 6" /><text x="336" y="729">Feedback loop</text>
        <path d="M535 724 H567" stroke={colors.platform} strokeWidth="2" strokeDasharray="6 6" /><text x="577" y="729">Platform ↔ client</text>
      </g>
    </svg>
  );
}
