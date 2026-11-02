/**
 * Venture Labor OS — Turtle Constellation.
 *
 * EXACT PORT of the reference `FM_Sankey_Waterfalls.html` SVG. This is
 * the settled framing that took a long time to land — do not rework,
 * refactor, or "improve" this diagram. If a change is needed, the
 * reference HTML in `Future Modern/reference/` is the source of truth;
 * update there first, then port back here verbatim.
 *
 * Server component — pure SVG, no interactivity, no client state.
 * Every stroke width, opacity, curve, and label reflects the reference
 * exactly. Fonts (Syne, DM Mono) referenced from the original; browsers
 * fall back to sans-serif / monospace when not loaded, which reads
 * cleanly in the diagram context.
 */
export function VentureLaborConstellation() {
  return (
    <div
      style={{
        background: "#060a10",
        border: "1px solid #1a3060",
        borderRadius: 5,
        overflow: "hidden",
      }}
    >
      <svg
        viewBox="0 0 960 760"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: "100%", height: "auto", background: "#060a10" }}
        role="img"
        aria-label="Venture Labor OS Turtle Constellation diagram"
      >
        <defs>
          <marker
            id="am"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L6,3 z" fill="#D828A0" opacity="0.9" />
          </marker>
          <marker
            id="ab"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L6,3 z" fill="#5070F0" opacity="0.9" />
          </marker>
          <marker
            id="ag"
            markerWidth="6"
            markerHeight="6"
            refX="5"
            refY="3"
            orient="auto"
          >
            <path d="M0,0 L0,6 L6,3 z" fill="#007048" opacity="0.9" />
          </marker>
          <marker
            id="ad"
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

        <rect width="960" height="760" fill="#060a10" />
        <rect width="960" height="760" fill="url(#dots)" />

        {/* TURTLE SILHOUETTE (ghost) */}
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
        <line x1="308" y1="330" x2="652" y2="330" stroke="#0d1f30" strokeWidth="0.9" opacity="0.4" />
        <line x1="298" y1="400" x2="662" y2="400" stroke="#0d1f30" strokeWidth="0.9" opacity="0.4" />
        <line x1="308" y1="470" x2="652" y2="470" stroke="#0d1f30" strokeWidth="0.9" opacity="0.4" />
        <line x1="354" y1="210" x2="298" y2="590" stroke="#5070F0" strokeWidth="0.7" opacity="0.12" />
        <line x1="480" y1="200" x2="302" y2="600" stroke="#5070F0" strokeWidth="0.7" opacity="0.12" />
        <line x1="606" y1="210" x2="662" y2="590" stroke="#D828A0" strokeWidth="0.7" opacity="0.12" />
        <line x1="480" y1="200" x2="658" y2="600" stroke="#D828A0" strokeWidth="0.7" opacity="0.12" />
        <line x1="480" y1="200" x2="480" y2="600" stroke="#D828A0" strokeWidth="0.6" opacity="0.1" />
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
        <ellipse cx="480" cy="126" rx="38" ry="30" fill="none" stroke="#007048" strokeWidth="0.9" opacity="0.12" />

        {/* PENTAGON OUTER EDGES */}

        {/* Contributor → Platform (blue — platform leverage) */}
        <path d="M510,132 Q660,200 718,292" stroke="#5070F0" strokeWidth="1.4" fill="none" markerEnd="url(#ab)" opacity="0.7" />

        {/* Platform ↔ Client/Deal (dashed blue bidirectional) */}
        <path d="M726,332 Q706,470 644,590" stroke="#5070F0" strokeWidth="1.2" fill="none" strokeDasharray="5,3" markerEnd="url(#ab)" opacity="0.7" />
        <path d="M654,586 Q718,462 734,324" stroke="#5070F0" strokeWidth="1.2" fill="none" strokeDasharray="5,3" markerEnd="url(#ab)" opacity="0.7" />

        {/* Client/Deal → Treasury (pink — cash payment) */}
        <path d="M622,612 Q480,644 358,612" stroke="#D828A0" strokeWidth="1.4" fill="none" markerEnd="url(#am)" opacity="0.8" />

        {/* Liquidity/$BUILD → Contributor (pink — cash/equity out) */}
        <path d="M242,290 Q330,196 450,132" stroke="#D828A0" strokeWidth="1.4" fill="none" markerEnd="url(#am)" opacity="0.7" />

        {/* HUB SPOKES */}

        {/* Contributor → Hub (green — deal flow in) */}
        <path d="M484,144 L484,342" stroke="#007048" strokeWidth="1.8" fill="none" markerEnd="url(#ag)" opacity="0.85" />

        {/* Hub → Contributor (pink — cash out, reciprocal) */}
        <path d="M472,342 L472,148" stroke="#D828A0" strokeWidth="1.6" fill="none" markerEnd="url(#am)" opacity="0.85" />

        {/* Hub → Platform (blue — amplifies leverage) */}
        <path d="M528,364 L714,314" stroke="#5070F0" strokeWidth="1.8" fill="none" markerEnd="url(#ab)" opacity="0.85" />

        {/* Hub → Client/Deal (green — deal flow out) */}
        <path d="M518,420 L638,576" stroke="#007048" strokeWidth="1.6" fill="none" markerEnd="url(#ag)" opacity="0.85" />
        {/* Client/Deal → Hub (pink — cash in, parallel offset) */}
        <path d="M628,572 L508,416" stroke="#D828A0" strokeWidth="1.6" fill="none" markerEnd="url(#am)" opacity="0.85" />

        {/* Treasury → Liquidity/$BUILD (grey straight) */}
        <path d="M310,592 Q248,468 232,326" stroke="#556" strokeWidth="1.4" fill="none" markerEnd="url(#ad)" opacity="0.8" />

        {/* Hub ↔ Treasury (pink dashed — reinvestment feedback) */}
        <path d="M450,422 L340,574" stroke="#D828A0" strokeWidth="1.2" fill="none" strokeDasharray="5,3" markerEnd="url(#am)" opacity="0.65" />
        <path d="M336,570 L446,418" stroke="#D828A0" strokeWidth="1.2" fill="none" strokeDasharray="5,3" markerEnd="url(#am)" opacity="0.65" />

        {/* Hub ↔ Liquidity/$BUILD (pink dashed reciprocal feedback) */}
        <path d="M432,358 L248,308" stroke="#D828A0" strokeWidth="1.4" fill="none" strokeDasharray="5,3" markerEnd="url(#am)" opacity="0.7" />
        <path d="M244,318 L428,366" stroke="#D828A0" strokeWidth="1.4" fill="none" strokeDasharray="5,3" markerEnd="url(#am)" opacity="0.7" />

        {/* HUB */}
        <circle cx="480" cy="380" r="68" fill="#D828A0" opacity="0.03" filter="url(#glow-hub)" />
        <circle cx="480" cy="380" r="56" fill="url(#hub-grad)" stroke="#D828A0" strokeWidth="1.5" />
        <path d="M480,324 A56,56 0 0,0 480,436" fill="#5070F0" opacity="0.07" />
        <path d="M480,324 A56,56 0 0,1 480,436" fill="#D828A0" opacity="0.07" />
        <line x1="480" y1="328" x2="480" y2="432" stroke="#D828A0" strokeWidth="1" opacity="0.4" />
        <line x1="430" y1="350" x2="530" y2="350" stroke="#1a2a3a" strokeWidth="0.7" opacity="0.5" />
        <line x1="424" y1="380" x2="536" y2="380" stroke="#1a2a3a" strokeWidth="0.7" opacity="0.5" />
        <line x1="430" y1="410" x2="530" y2="410" stroke="#1a2a3a" strokeWidth="0.7" opacity="0.5" />
        <line x1="454" y1="326" x2="440" y2="434" stroke="#5070F0" strokeWidth="0.6" opacity="0.25" />
        <line x1="506" y1="326" x2="520" y2="434" stroke="#D828A0" strokeWidth="0.6" opacity="0.25" />
        <text
          x="480"
          y="372"
          textAnchor="middle"
          fontFamily="Syne, sans-serif"
          fontSize="11"
          fontWeight="800"
          fill="#F5F5F5"
        >
          VENTURE
        </text>
        <text
          x="480"
          y="387"
          textAnchor="middle"
          fontFamily="Syne, sans-serif"
          fontSize="11"
          fontWeight="800"
          fill="#D828A0"
        >
          LABOR OS
        </text>
        <text
          x="480"
          y="401"
          textAnchor="middle"
          fontFamily="DM Mono, monospace"
          fontSize="7.5"
          fill="#444"
        >
          Future Modern
        </text>

        {/* NODE 1: CONTRIBUTOR — head */}
        <circle cx="480" cy="120" r="5" fill="#007048" filter="url(#glow-g)" />
        <rect x="372" y="130" width="216" height="58" rx="2" fill="#050e08" stroke="#007048" strokeWidth="1.4" />
        <rect x="372" y="130" width="216" height="2.5" fill="#007048" opacity="0.9" />
        <text x="480" y="150" textAnchor="middle" fontFamily="Syne, sans-serif" fontSize="10" fontWeight="700" fill="#F5F5F5">
          CONTRIBUTOR
        </text>
        <text x="480" y="164" textAnchor="middle" fontFamily="DM Mono, monospace" fontSize="8" fill="#406050">
          Skills · Relationships
        </text>
        <text x="480" y="177" textAnchor="middle" fontFamily="DM Mono, monospace" fontSize="8" fill="#406050">
          Domain Expertise
        </text>

        {/* NODE 2: PLATFORM — top right flipper */}
        <circle cx="737" cy="307" r="5" fill="#5070F0" filter="url(#glow-b)" />
        <rect x="740" y="280" width="196" height="58" rx="2" fill="#060810" stroke="#5070F0" strokeWidth="1.4" />
        <rect x="740" y="280" width="196" height="2.5" fill="#5070F0" opacity="0.9" />
        <text x="838" y="300" textAnchor="middle" fontFamily="Syne, sans-serif" fontSize="10" fontWeight="700" fill="#F5F5F5">
          PLATFORM
        </text>
        <text x="838" y="314" textAnchor="middle" fontFamily="DM Mono, monospace" fontSize="8" fill="#405060">
          Infrastructure · Brand
        </text>
        <text x="838" y="327" textAnchor="middle" fontFamily="DM Mono, monospace" fontSize="8" fill="#405060">
          Distribution · Leverage
        </text>

        {/* NODE 3: CLIENT/DEAL — bottom right flipper (GREEN) */}
        <circle cx="639" cy="608" r="5" fill="#007048" filter="url(#glow-g)" />
        <rect x="642" y="614" width="210" height="66" rx="2" fill="#050e08" stroke="#007048" strokeWidth="1.4" />
        <rect x="642" y="614" width="210" height="2.5" fill="#007048" opacity="0.9" />
        <text x="747" y="634" textAnchor="middle" fontFamily="Syne, sans-serif" fontSize="10" fontWeight="700" fill="#F5F5F5">
          CLIENT / DEAL
        </text>
        <text x="747" y="648" textAnchor="middle" fontFamily="DM Mono, monospace" fontSize="8" fill="#406050">
          Revenue Generated
        </text>
        <text x="747" y="662" textAnchor="middle" fontFamily="DM Mono, monospace" fontSize="8" fill="#D828A0">
          85 · 12 · 3 Split
        </text>

        {/* NODE 4: TREASURY — bottom left flipper */}
        <circle cx="321" cy="608" r="5" fill="#556" filter="url(#glow-b)" />
        <rect x="108" y="614" width="210" height="66" rx="2" fill="#090909" stroke="#445" strokeWidth="1.4" />
        <rect x="108" y="614" width="210" height="2.5" fill="#556" opacity="0.9" />
        <text x="213" y="634" textAnchor="middle" fontFamily="Syne, sans-serif" fontSize="10" fontWeight="700" fill="#F5F5F5">
          TREASURY
        </text>
        <text x="213" y="648" textAnchor="middle" fontFamily="DM Mono, monospace" fontSize="8" fill="#505060">
          Collects 3% · 1.5% ops
        </text>
        <text x="213" y="662" textAnchor="middle" fontFamily="DM Mono, monospace" fontSize="8" fill="#505060">
          1.5% → liquidity pool
        </text>

        {/* NODE 5: LIQUIDITY POOL / $BUILD — top left flipper */}
        <circle cx="223" cy="307" r="5" fill="#D828A0" filter="url(#glow-m)" />
        <rect x="24" y="278" width="196" height="70" rx="2" fill="#0e060e" stroke="#D828A0" strokeWidth="1.4" />
        <rect x="24" y="278" width="196" height="2.5" fill="#D828A0" opacity="0.9" />
        <text x="122" y="298" textAnchor="middle" fontFamily="Syne, sans-serif" fontSize="10" fontWeight="700" fill="#F5F5F5">
          LIQUIDITY POOL
        </text>
        <text x="122" y="312" textAnchor="middle" fontFamily="Syne, sans-serif" fontSize="9" fontWeight="700" fill="#D828A0">
          = $BUILD TOKEN
        </text>
        <text x="122" y="326" textAnchor="middle" fontFamily="DM Mono, monospace" fontSize="7.5" fill="#604060">
          Passive equity accrual
        </text>
        <text x="122" y="338" textAnchor="middle" fontFamily="DM Mono, monospace" fontSize="7.5" fill="#604060">
          OTC = mobilization
        </text>

        {/* LEGEND */}
        <rect x="268" y="700" width="560" height="46" rx="2" fill="#080a10" stroke="#1a2535" strokeWidth="1" />
        <line x1="284" y1="716" x2="306" y2="716" stroke="#D828A0" strokeWidth="1.5" />
        <text x="310" y="719" fontFamily="DM Mono, monospace" fontSize="8" fill="#D828A0">
          cash / equity
        </text>
        <line x1="390" y1="716" x2="412" y2="716" stroke="#5070F0" strokeWidth="1.5" />
        <text x="416" y="719" fontFamily="DM Mono, monospace" fontSize="8" fill="#5070F0">
          platform
        </text>
        <line x1="470" y1="716" x2="492" y2="716" stroke="#007048" strokeWidth="1.5" />
        <text x="496" y="719" fontFamily="DM Mono, monospace" fontSize="8" fill="#007048">
          deal flow
        </text>
        <line x1="608" y1="716" x2="630" y2="716" stroke="#556" strokeWidth="1.5" />
        <text x="634" y="719" fontFamily="DM Mono, monospace" fontSize="8" fill="#556">
          treasury flow
        </text>
        <line x1="284" y1="736" x2="306" y2="736" stroke="#D828A0" strokeWidth="1.2" strokeDasharray="4,3" />
        <text x="310" y="739" fontFamily="DM Mono, monospace" fontSize="8" fill="#D828A0">
          feedback loop
        </text>
        <line x1="390" y1="736" x2="412" y2="736" stroke="#5070F0" strokeWidth="1.2" strokeDasharray="4,3" />
        <text x="416" y="739" fontFamily="DM Mono, monospace" fontSize="8" fill="#5070F0">
          platform ↔ client (dashed)
        </text>
      </svg>
    </div>
  );
}
