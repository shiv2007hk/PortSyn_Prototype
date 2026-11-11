import { useEffect, useState } from "react";

const CONTAINER_ROWS = [
  { fill: "#3E88B0", y: 53, xs: [102, 140, 178, 216, 254, 292] },
  { fill: "#BE6249", y: 33, xs: [120, 158, 196, 234, 272] },
  { fill: "#3E88B0", y: 13, xs: [139, 177, 215, 253] },
  { fill: "#E4F0F7", y: -7, xs: [196, 234] },
];

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/**
 * Layered maritime scene: independently animated sky, distant port,
 * a cargo vessel sailing across the water, wake, and three wave bands.
 */
export function ShipScene({ className = "" }: { className?: string }) {
  const reduced = useReducedMotion();
  return (
    <div className={`pointer-events-none overflow-hidden ${className}`} aria-hidden="true">
      <div className="absolute inset-0 hero-sky" />
      <div className="absolute inset-0 hero-grain" />
      <div className="absolute inset-x-0 top-[34%] h-px bg-gradient-to-r from-transparent via-[#B6DFEE]/30 to-transparent" />
      <div className="absolute left-1/2 top-[30%] h-40 w-[42rem] -translate-x-1/2 rounded-full bg-[#B6DFEE]/10 blur-3xl" />

      <svg
        viewBox="0 0 1440 620"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-0 h-full w-full"
      >
        <defs>
          <linearGradient id="hull" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#35648A" />
            <stop offset="58%" stopColor="#1B3D59" />
            <stop offset="100%" stopColor="#9A4535" />
          </linearGradient>
          <linearGradient id="wake" x1="1" y1="0" x2="0" y2="0">
            <stop offset="0%" stopColor="#EAF7FC" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#EAF7FC" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="waveFar" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2C6E95" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#0B2A42" stopOpacity="0.9" />
          </linearGradient>
          <linearGradient id="waveNear" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#123A57" />
            <stop offset="100%" stopColor="#061523" />
          </linearGradient>
          <linearGradient id="foam" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#DFF3FA" stopOpacity="0.05" />
            <stop offset="50%" stopColor="#DFF3FA" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#DFF3FA" stopOpacity="0.05" />
          </linearGradient>
          <path
            id="waveTile"
            d="M0 34 C 88 10 168 48 258 30 C 348 12 420 2 512 26 C 604 50 652 44 720 22 L720 310 L0 310 Z"
          />
          <path
            id="waveTileB"
            d="M0 26 C 96 52 176 10 268 28 C 360 46 428 56 520 30 C 612 6 668 14 720 36 L720 310 L0 310 Z"
          />
          <g id="gantryCrane">
            <path d="M0 150 V32 H6 V150 M58 150 V32 H64 V150 M0 60 H64 M0 32 L64 8 M64 32 L0 8" stroke="#0A2438" strokeWidth="4" fill="none" />
            <path d="M-6 22 H78" stroke="#0A2438" strokeWidth="3" />
            <path d="M30 34 L30 96 H14" stroke="#0A2438" strokeWidth="2.4" />
          </g>
        </defs>

        {/* distant shoreline and port */}
        <g className="port-parallax" opacity="0.85">
          <path d="M0 306 L0 286 L80 286 L96 270 L150 270 L168 286 L420 288 L436 272 L486 272 L502 290 L760 290 L780 276 L820 276 L838 292 L1040 292 L1058 278 L1110 278 L1128 296 L1440 296 L1440 312 L0 312 Z" fill="#071D2D" opacity="0.75" />
          <g transform="translate(118 148) scale(0.78)" opacity="0.55"><use href="#gantryCrane" /></g>
          <g transform="translate(232 156) scale(0.66)" opacity="0.45"><use href="#gantryCrane" /></g>
          <g transform="translate(1128 150) scale(0.8)" opacity="0.55"><use href="#gantryCrane" /></g>
          <g transform="translate(1236 158) scale(0.62)" opacity="0.4"><use href="#gantryCrane" /></g>
          <rect x="330" y="276" width="86" height="10" fill="#071D2D" opacity="0.7" />
          <path d="M560 292 L604 292 L598 276 L566 276 Z" fill="#071D2D" opacity="0.7" />
          <g fill="#102F45" opacity="0.6">
            <rect x="430" y="272" width="10" height="16" />
            <rect x="446" y="266" width="7" height="22" />
            <rect x="880" y="268" width="9" height="20" />
            <rect x="896" y="274" width="6" height="14" />
          </g>
          <g fill="#FFD9A0" opacity="0.35">
            <circle cx="156" cy="300" r="1.4" />
            <circle cx="248" cy="301" r="1.2" />
            <circle cx="1160" cy="300" r="1.4" />
            <circle cx="1252" cy="302" r="1.1" />
          </g>
        </g>

        {/* distant vessel drifting the opposite way on the horizon */}
        <g opacity="0.4" fill="#0A2337">
          <g>
            {!reduced && (
              <animateTransform
                attributeName="transform"
                type="translate"
                from="0 0"
                to="-1900 0"
                dur="95s"
                begin="-58s"
                repeatCount="indefinite"
              />
            )}
            <g transform={reduced ? "translate(990 0)" : undefined}>
              <path d="M964 300 L1044 300 L1036 310 L972 310 Z" />
              <rect x="996" y="288" width="12" height="12" />
              <rect x="1012" y="284" width="7" height="16" />
            </g>
          </g>
        </g>

        {/* hero vessel */}
        <g>
          {!reduced && (
            <animateTransform
              attributeName="transform"
              type="translate"
              from="-500 236"
              to="1760 236"
              dur="52s"
              begin="-30s"
              repeatCount="indefinite"
            />
          )}
          <g transform={reduced ? "translate(760 236)" : undefined}>
            {!reduced && (
              <>
                <animateTransform
                  attributeName="transform"
                  type="translate"
                  values="0 0; 0 -7; 0 0"
                  keyTimes="0;0.5;1"
                  dur="7s"
                  repeatCount="indefinite"
                />
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  values="0 60 100; -0.45 60 100; 0.45 60 100; 0 60 100"
                  keyTimes="0;0.25;0.75;1"
                  dur="7s"
                  repeatCount="indefinite"
                  additive="sum"
                />
              </>
            )}
              {/* wake */}
              <path d="M-238 112 C -170 92 -70 98 16 108 L16 122 C -74 130 -164 130 -238 120 Z" fill="url(#wake)" />
              <g fill="#E8F7FC" opacity="0.22">
                <ellipse cx="-118" cy="116" rx="74" ry="4.5" />
                <ellipse cx="-202" cy="120" rx="42" ry="3" />
                <ellipse cx="-32" cy="114" rx="36" ry="3" />
              </g>
              {/* hull */}
              <path d="M2 72 L22 118 C 108 138 220 138 306 118 L346 72 Z" fill="url(#hull)" />
              <path d="M2 72 L22 118 C 86 131 168 135 240 129 L240 72 Z" fill="#7C2F25" opacity="0.55" />
              <path d="M18 106 C 110 124 226 124 336 102" stroke="#E9F6FB" strokeWidth="2" opacity="0.35" fill="none" />
              <path d="M2 71 H346" stroke="#0A1D2D" strokeWidth="3" />
              {/* stern superstructure */}
              <rect x="26" y="12" width="60" height="60" rx="2" fill="#E4EEF5" />
              <rect x="32" y="6" width="42" height="10" rx="1.5" fill="#D4E3EC" />
              <rect x="76" y="-6" width="15" height="24" rx="1.5" fill="#1B3A52" />
              <rect x="76" y="-1" width="15" height="5" fill="#C77B4A" />
              <path d="M26 72 H86" stroke="#9FB4C4" strokeWidth="1.2" />
              <g fill="#7FB7D6">
                <rect x="33" y="20" width="8" height="4" />
                <rect x="45" y="20" width="8" height="4" />
                <rect x="57" y="20" width="8" height="4" />
                <rect x="69" y="20" width="8" height="4" />
                <rect x="33" y="30" width="8" height="4" />
                <rect x="45" y="30" width="8" height="4" />
                <rect x="57" y="30" width="8" height="4" />
                <rect x="69" y="30" width="8" height="4" />
                <rect x="33" y="45" width="8" height="4" />
                <rect x="45" y="45" width="8" height="4" />
              </g>
              <rect x="26" y="60" width="60" height="3" fill="#A8BFCD" opacity="0.6" />
              <circle cx="98" cy="8" r="1.6" fill="#FFE2B0" />
              {/* deck containers */}
              {CONTAINER_ROWS.map((row) => (
                <g key={row.y} transform={`translate(0 ${row.y})`}>
                  {row.xs.map((x) => (
                    <g key={x} transform={`translate(${x} 0)`}>
                      <rect width="34" height="18" rx="1.5" fill={row.fill} />
                      <path d="M5 1 V17 M11 1 V17 M17 1 V17 M23 1 V17 M29 1 V17" stroke="#061523" strokeOpacity="0.25" strokeWidth="0.8" />
                    </g>
                  ))}
                </g>
              ))}
              {/* deck lighting */}
              <path d="M96 70 H328" stroke="#FFD9A0" strokeWidth="1.1" opacity="0.5" />
              <path d="M26 67.5 H86" stroke="#FFE2B0" strokeWidth="1" opacity="0.35" />
              {/* foredeck crane and mast */}
              <path d="M316 72 V34 M316 42 L332 30 M316 42 L302 30" stroke="#8FA6B6" strokeWidth="2" />
              <path d="M316 34 V20" stroke="#B9CDDA" strokeWidth="1.2" />
              <circle cx="316" cy="18" r="1.6" fill="#FFD9A0" />
              <path d="M340 70 L352 62 L338 78" fill="#D8E6EF" opacity="0.85" />
              {/* bow foam */}
              <path d="M330 112 C 348 116 358 122 362 128 L336 126 Z" fill="#EAF7FC" opacity="0.5" />
              <ellipse cx="322" cy="128" rx="34" ry="3" fill="#EAF7FC" opacity="0.25" />
              {/* mast light */}
              <circle cx="86" cy="-10" r="2" fill="#FFE2B0" opacity="0.9" />
              <path d="M86 -10 V12" stroke="#8FA6B6" strokeWidth="1" />
          </g>
        </g>

        {/* wave bands */}
        <g transform="translate(0 360)">
          <g className="wave-drift">
            <use href="#waveTile" x="0" fill="url(#waveFar)" />
            <use href="#waveTile" x="720" fill="url(#waveFar)" />
            <use href="#waveTile" x="1440" fill="url(#waveFar)" />
            <use href="#waveTile" x="2160" fill="url(#waveFar)" />
          </g>
        </g>
        <g transform="translate(0 414)">
          <g className="wave-drift-slow">
            <use href="#waveTileB" x="0" fill="#0E3550" opacity="0.92" />
            <use href="#waveTileB" x="720" fill="#0E3550" opacity="0.92" />
            <use href="#waveTileB" x="1440" fill="#0E3550" opacity="0.92" />
            <use href="#waveTileB" x="2160" fill="#0E3550" opacity="0.92" />
          </g>
        </g>
        <g transform="translate(0 474)">
          <use href="#waveTile" x="0" fill="url(#waveNear)" />
          <use href="#waveTile" x="720" fill="url(#waveNear)" />
          <use href="#waveTile" x="1440" fill="url(#waveNear)" />
          <rect x="0" y="60" width="1440" height="160" fill="#04111D" />
        </g>
        <g className="wave-drift" opacity="0.5">
          <path d="M0 446 C 120 432 220 456 340 442 C 460 428 560 452 680 440 C 800 428 900 452 1020 440 C 1140 428 1300 450 1440 438" stroke="#CFECF6" strokeWidth="1.4" fill="none" />
        </g>
        <g className="wave-drift-slow" opacity="0.3">
          <path d="M0 500 C 140 486 240 508 380 494 C 520 480 620 504 760 492 C 900 480 1000 504 1140 492 C 1280 480 1380 496 1440 488" stroke="url(#foam)" strokeWidth="2" fill="none" />
        </g>
      </svg>
    </div>
  );
}
