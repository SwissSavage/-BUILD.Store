import { useId } from "react";

const colors = {
  pink: "#ee65c0",
  blue: "#8da4ff",
  green: "#50cba2",
  gray: "#a0adbf",
};

/** The five labeled nodes are the turtle's head and flippers; the network is its shell. */
export function VentureLaborDiagram() {
  const id = useId().replace(/:/g, "");
  const marker = (color: keyof typeof colors) => `url(#${id}-${color})`;

  return (
    <svg
      viewBox="0 0 960 760"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-labelledby={`${id}-title ${id}-description`}
      style={{ display: "block", width: "100%", height: "auto", background: "#080b11" }}
    >
      <title id={`${id}-title`}>Venture Labor OS turtle constellation</title>
      <desc id={`${id}-description`}>
        The contributor forms the head, with liquidity pool and platform as the upper flippers,
        treasury and client as the lower flippers, and Venture Labor OS at the center of the shell.
        Directed pink lines show cash and equity, blue lines platform leverage, green lines deal
        flow, and gray lines treasury flow. Dashed pink lines are reciprocal feedback; dashed blue
        lines connect platform and client in both directions.
      </desc>
      <defs>
        <pattern id={`${id}-dots`} width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="12" cy="12" r="0.8" fill="#8094b4" opacity="0.21" />
        </pattern>
        {Object.entries(colors).map(([name, color]) => (
          <marker
            key={name}
            id={`${id}-${name}`}
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerUnits="userSpaceOnUse"
            markerWidth="10"
            markerHeight="10"
            orient="auto"
            overflow="visible"
          >
            <path d="M0 0 L10 5 L0 10 L2.5 5 Z" fill={color} />
          </marker>
        ))}
      </defs>
      <rect width="960" height="760" fill={`url(#${id}-dots)`} />

      {/* The quiet shell geometry is a silhouette, never a competing flow. */}
      <g fill="none" stroke="#65748e" strokeWidth="1" strokeOpacity="0.18">
        <ellipse cx="480" cy="376" rx="180" ry="192" />
        <path d="M480 184 L480 246 M300 376 L366 376 M660 376 L594 376 M480 506 L480 568" />
        <path d="M480 246 L572 290 L594 376 L552 466 L480 506 L408 466 L366 376 L388 290 Z" />
        <path d="M388 290 L351 253 M572 290 L609 253 M408 466 L363 519 M552 466 L597 519" />
      </g>

      {/* Matching frames give the head and paired flippers a single visual language. */}
      <g fill="#0c1417" stroke={colors.green} strokeOpacity="0.65" strokeWidth="1.25">
        <path d="M368 64 H580 L592 76 V160 H368 Z" />
        <path d="M616 546 H828 L840 558 V642 H616 Z" />
      </g>
      <path d="M40 260 H252 L264 272 V364 H40 Z" fill="#17101b" stroke={colors.pink} strokeOpacity="0.65" strokeWidth="1.25" />
      <path d="M696 260 H908 L920 272 V364 H696 Z" fill="#101624" stroke={colors.blue} strokeOpacity="0.65" strokeWidth="1.25" />
      <path d="M120 546 H332 L344 558 V642 H120 Z" fill="#11151d" stroke={colors.gray} strokeOpacity="0.65" strokeWidth="1.25" />

      {/* A compact shell cell anchors the network without outweighing its participants. */}
      <circle cx="480" cy="376" r="64" fill="#151019" stroke={colors.pink} strokeWidth="1.5" />
      <path d="M437 329 L480 312 L523 329 M437 423 L480 440 L523 423" fill="none" stroke={colors.pink} strokeOpacity="0.28" strokeWidth="1" />

      {/* Every route starts and ends on a node edge. Markers are drawn over the frames,
          with their tip at the endpoint, so borders cannot hide or sever arrowheads. */}
      <g fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {/* Contributor → Platform; Liquidity → Contributor. */}
        <path d="M592 112 C710 132 778 194 808 260" stroke={colors.blue} markerEnd={marker("blue")} />
        <path d="M152 260 C182 194 250 132 368 112" stroke={colors.pink} markerEnd={marker("pink")} />

        {/* Platform ↔ Client; Treasury → Liquidity; Client → Treasury. */}
        <path d="M808 364 C802 432 772 492 740 546" stroke={colors.blue} strokeDasharray="6 5" markerEnd={marker("blue")} />
        <path d="M754 546 C786 492 816 432 822 364" stroke={colors.blue} strokeDasharray="6 5" markerEnd={marker("blue")} />
        <path d="M232 546 C194 486 158 426 152 364" stroke={colors.gray} markerEnd={marker("gray")} />
        <path d="M616 604 C542 670 418 670 344 604" stroke={colors.pink} markerEnd={marker("pink")} />

        {/* Contributor → OS; OS → Contributor; OS → Platform. */}
        <path d="M488 160 V312.5" stroke={colors.green} markerEnd={marker("green")} />
        <path d="M472 312.5 V160" stroke={colors.pink} markerEnd={marker("pink")} />
        <path d="M541 356 L696 306" stroke={colors.blue} markerEnd={marker("blue")} />

        {/* OS → Client; Client → OS. */}
        <path d="M524 422 L654 546" stroke={colors.green} markerEnd={marker("green")} />
        <path d="M640 546 L514 430" stroke={colors.pink} markerEnd={marker("pink")} />

        {/* OS ↔ Treasury and OS ↔ Liquidity retain the original feedback semantics. */}
        <path d="M436 422 L306 546" stroke={colors.pink} strokeDasharray="6 5" markerEnd={marker("pink")} />
        <path d="M320 546 L446 430" stroke={colors.pink} strokeDasharray="6 5" markerEnd={marker("pink")} />
        <path d="M419 356 L264 306" stroke={colors.pink} strokeDasharray="6 5" markerEnd={marker("pink")} />
        <path d="M264 320 L417 366" stroke={colors.pink} strokeDasharray="6 5" markerEnd={marker("pink")} />
      </g>

      <g textAnchor="middle" fill="#f3f3f6" fontFamily="var(--font-abel), sans-serif" fontWeight="400" fontSize="19" letterSpacing="1.1">
        <text x="480" y="96">CONTRIBUTOR</text>
        <text x="152" y="288">LIQUIDITY POOL</text>
        <text x="808" y="295">PLATFORM</text>
        <text x="232" y="576">TREASURY</text>
        <text x="728" y="576">CLIENT / DEAL</text>
      </g>
      <g textAnchor="middle" fontFamily="var(--font-inter), sans-serif" fontSize="12.5" fill="#bcc9cd">
        <text x="480" y="121">Skills · Relationships</text>
        <text x="480" y="142">Domain Expertise</text>
        <text x="152" y="308" fill={colors.pink} fontWeight="600">= $BUILD TOKEN</text>
        <text x="152" y="332" fill="#cdbfcf">Passive equity accrual</text>
        <text x="152" y="352" fill="#cdbfcf">OTC = mobilization</text>
        <text x="808" y="323" fill="#c1cbe5">Infrastructure · Brand</text>
        <text x="808" y="345" fill="#c1cbe5">Distribution · Leverage</text>
        <text x="232" y="602" fill="#c4cbd7">Collects 3% · 1.5% ops</text>
        <text x="232" y="624" fill="#c4cbd7">1.5% → liquidity pool</text>
        <text x="728" y="602">Revenue Generated</text>
        <text x="728" y="624" fill={colors.pink}>85 · 12 · 3 Split</text>
      </g>
      <g textAnchor="middle">
        <text x="480" y="369" fontFamily="var(--font-abel), sans-serif" fontSize="19" letterSpacing="1" fill="#f3f3f6">VENTURE</text>
        <text x="480" y="391" fontFamily="var(--font-abel), sans-serif" fontSize="19" letterSpacing="1" fill={colors.pink}>LABOR OS</text>
        <text x="480" y="412" fontFamily="var(--font-inter), sans-serif" fontSize="10" fill="#c9b9cb">Future Modern</text>
      </g>

      {/* The legend shares the route colors and dash patterns, including both dashed meanings. */}
      <path d="M64 688 H896" stroke="#52617b" strokeOpacity="0.4" />
      <g fontFamily="var(--font-inter), sans-serif" fontSize="12" fill="#c9cfdb">
        <path d="M80 715 H112" stroke={colors.pink} strokeWidth="1.8" />
        <text x="126" y="719">cash / equity</text>
        <path d="M354 715 H386" stroke={colors.blue} strokeWidth="1.8" />
        <text x="400" y="719">platform</text>
        <path d="M628 715 H660" stroke={colors.green} strokeWidth="1.8" />
        <text x="674" y="719">deal flow</text>
        <path d="M80 748 H112" stroke={colors.gray} strokeWidth="1.8" />
        <text x="126" y="752">treasury flow</text>
        <path d="M354 748 H386" stroke={colors.pink} strokeWidth="1.8" strokeDasharray="6 5" />
        <text x="400" y="752">feedback loop</text>
        <path d="M628 748 H660" stroke={colors.blue} strokeWidth="1.8" strokeDasharray="6 5" />
        <text x="674" y="752">platform ↔ client (dashed)</text>
      </g>
    </svg>
  );
}
