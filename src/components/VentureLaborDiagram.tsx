import { useId } from "react";

/** The labeled nodes form the head and flippers; the central network forms the shell. */
export function VentureLaborDiagram() {
  const id = useId().replace(/:/g, "");
  const marker = (color: string) => `url(#${id}-${color})`;
  return (
    <svg viewBox="0 0 960 760" xmlns="http://www.w3.org/2000/svg" role="img"
      aria-labelledby={`${id}-title ${id}-description`} style={{ display: "block", width: "100%", height: "auto", background: "#080a12" }}>
      <title id={`${id}-title`}>Venture Labor OS turtle constellation</title>
      <desc id={`${id}-description`}>The contributor, platform, client, treasury and liquidity pool surround the Venture Labor OS. Colored, directed lines show cash and equity, platform, deal, treasury and feedback flows.</desc>
      <defs>
        <pattern id={`${id}-dots`} width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r=".7" fill="#7183ae" opacity=".22" /></pattern>
        <radialGradient id={`${id}-shell`}><stop stopColor="#191027" /><stop offset=".7" stopColor="#101323" /><stop offset="1" stopColor="#090d18" /></radialGradient>
        <linearGradient id={`${id}-outline`} x1="0" y1="0" x2="1" y2="1"><stop stopColor="#526bfa" /><stop offset=".5" stopColor="#bd3dae" /><stop offset="1" stopColor="#087f67" /></linearGradient>
        <radialGradient id={`${id}-hub`}><stop stopColor="#32112d" /><stop offset="1" stopColor="#100d1a" /></radialGradient>
        {[["pink", "#ef4bbd"], ["blue", "#708cff"], ["green", "#35bc91"], ["gray", "#9aa7bc"]].map(([name, color]) => (
          <marker key={name} id={`${id}-${name}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 Z" fill={color} /></marker>
        ))}
      </defs>
      <rect width="960" height="760" fill={`url(#${id}-dots)`} />

      {/* The shell is the boundary of the system, not an additional flow. */}
      <ellipse cx="480" cy="378" rx="235" ry="242" fill={`url(#${id}-shell)`} stroke={`url(#${id}-outline)`} strokeWidth="1.5" opacity=".55" />
      <ellipse cx="480" cy="378" rx="222" ry="229" fill="none" stroke="#91a6e8" strokeOpacity=".16" />
      <g fill="none" stroke="#99a4d9" strokeOpacity=".11" strokeWidth="1.2">
        <path d="M480 148 L480 245 M480 510 L480 607 M260 378 H351 M609 378 H700" />
        <path d="M328 205 L399 282 M632 205 L561 282 M328 551 L399 474 M632 551 L561 474" />
        <path d="M395 237 L480 202 L565 237 L600 320 L565 343 M395 237 L360 320 L395 343 M360 436 L395 518 L480 554 L565 518 L600 436" />
      </g>

      {/* Outer routes and spokes retain the original's direction and line styles. */}
      <g fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M569 110 C700 110 805 140 830 250" stroke="#708cff" markerEnd={marker("blue")} />
        <path d="M800 334 C800 420 775 490 732 558" stroke="#708cff" strokeDasharray="6 5" markerEnd={marker("blue")} />
        <path d="M745 558 C788 490 813 420 813 334" stroke="#708cff" strokeDasharray="6 5" markerEnd={marker("blue")} />
        <path d="M740 634 C590 682 370 682 220 634" stroke="#ef4bbd" markerEnd={marker("pink")} />
        <path d="M130 250 C155 140 260 110 391 110" stroke="#ef4bbd" markerEnd={marker("pink")} />
        <path d="M486 156 V316" stroke="#35bc91" markerEnd={marker("green")} />
        <path d="M474 316 V156" stroke="#ef4bbd" markerEnd={marker("pink")} />
        <path d="M539 361 L734 306" stroke="#708cff" markerEnd={marker("blue")} />
        <path d="M526 420 L667 558" stroke="#35bc91" markerEnd={marker("green")} />
        <path d="M654 558 L520 425" stroke="#ef4bbd" markerEnd={marker("pink")} />
        <path d="M220 558 C175 490 145 420 130 334" stroke="#9aa7bc" markerEnd={marker("gray")} />
        <path d="M434 420 L293 558" stroke="#ef4bbd" strokeDasharray="6 5" markerEnd={marker("pink")} />
        <path d="M306 558 L440 425" stroke="#ef4bbd" strokeDasharray="6 5" markerEnd={marker("pink")} />
        <path d="M421 361 L226 306" stroke="#ef4bbd" strokeDasharray="6 5" markerEnd={marker("pink")} />
        <path d="M226 318 L419 371" stroke="#ef4bbd" strokeDasharray="6 5" markerEnd={marker("pink")} />
      </g>

      {/* Placement gives the head and flippers their form; consistent frames keep the labels legible. */}
      <g strokeWidth="1.5">
        <rect x="391" y="80" width="178" height="76" rx="10" fill="#101b1a" stroke="#38b991" />
        <rect x="32" y="250" width="194" height="84" rx="10" fill="#211322" stroke="#d94bb0" />
        <rect x="734" y="250" width="194" height="84" rx="10" fill="#121a30" stroke="#6e88f7" />
        <rect x="125" y="558" width="190" height="76" rx="10" fill="#181b25" stroke="#8994ab" />
        <rect x="645" y="558" width="190" height="76" rx="10" fill="#10211e" stroke="#36ae8b" />
      </g>
      <g textAnchor="middle" fontFamily="Arial, sans-serif" fill="#f6f7ff">
        <text x="480" y="103" fontSize="14" fontWeight="700" letterSpacing="1">CONTRIBUTOR</text>
        <text x="480" y="123" fontSize="11" fill="#c7d4d2">Skills · Relationships</text><text x="480" y="140" fontSize="11" fill="#c7d4d2">Domain Expertise</text>
        <text x="130" y="280" fontSize="13" fontWeight="700" letterSpacing=".5">LIQUIDITY POOL</text><text x="130" y="296" fontSize="11" fontWeight="700" fill="#ff8bd6">= $BUILD TOKEN</text><text x="130" y="312" fontSize="10.5" fill="#d3c5d0">Passive equity accrual</text><text x="130" y="327" fontSize="10.5" fill="#d3c5d0">OTC = mobilization</text>
        <text x="830" y="281" fontSize="13" fontWeight="700" letterSpacing=".5">PLATFORM</text><text x="830" y="302" fontSize="11" fill="#c4cce2">Infrastructure · Brand</text><text x="830" y="319" fontSize="11" fill="#c4cce2">Distribution · Leverage</text>
        <text x="220" y="584" fontSize="13" fontWeight="700" letterSpacing=".5">TREASURY</text><text x="220" y="604" fontSize="11" fill="#c8cbd5">Collects 3% · 1.5% ops</text><text x="220" y="621" fontSize="11" fill="#c8cbd5">1.5% → liquidity pool</text>
        <text x="740" y="584" fontSize="13" fontWeight="700" letterSpacing=".5">CLIENT / DEAL</text><text x="740" y="604" fontSize="11" fill="#c5d5d0">Revenue Generated</text><text x="740" y="621" fontSize="11" fill="#ff8bd6">85 · 12 · 3 Split</text>
      </g>
      <circle cx="480" cy="378" r="62" fill={`url(#${id}-hub)`} stroke="#ef4bbd" strokeWidth="2" />
      <circle cx="480" cy="378" r="54" fill="none" stroke="#f18ad2" strokeOpacity=".25" />
      <g textAnchor="middle" fontFamily="Arial, sans-serif"><text x="480" y="371" fill="#fff" fontWeight="700" fontSize="14">VENTURE</text><text x="480" y="390" fill="#ff8bd6" fontWeight="700" fontSize="14">LABOR OS</text><text x="480" y="407" fill="#c4b9c9" fontSize="10">Future Modern</text></g>

      <g fontFamily="Arial, sans-serif" fontSize="11" fill="#d5d8e7">
        <path d="M103 692 h28" stroke="#ef4bbd" strokeWidth="2" /><text x="138" y="696">cash / equity</text>
        <path d="M275 692 h28" stroke="#708cff" strokeWidth="2" /><text x="310" y="696">platform</text>
        <path d="M425 692 h28" stroke="#35bc91" strokeWidth="2" /><text x="460" y="696">deal flow</text>
        <path d="M580 692 h28" stroke="#9aa7bc" strokeWidth="2" /><text x="615" y="696">treasury flow</text>
        <path d="M275 720 h28" stroke="#ef4bbd" strokeWidth="2" strokeDasharray="6 4" /><text x="310" y="724">feedback loop</text>
        <path d="M487 720 h28" stroke="#708cff" strokeWidth="2" strokeDasharray="6 4" /><text x="522" y="724">platform ↔ client</text>
      </g>
    </svg>
  );
}
