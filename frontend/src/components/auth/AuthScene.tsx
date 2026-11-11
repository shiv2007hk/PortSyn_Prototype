import { LogoMark } from "@/components/layout/Logo";

export function AuthScene({ variant }: { variant: "login" | "signup" }) {
  return (
    <div className="relative hidden overflow-hidden auth-scene-sky lg:block">
      <div className="absolute inset-0 bg-[radial-gradient(90%_60%_at_10%_0%,rgba(255,255,255,0.75),transparent_60%)]" />

      <div className="relative z-10 flex h-full flex-col justify-between p-10 xl:p-14">
        <div className="flex items-center gap-2.5">
          <LogoMark size={34} />
          <div className="leading-none">
            <div className="font-display text-[16px] font-bold tracking-[0.16em] text-[#102A43]">PORTSYNC</div>
            <div className="mt-1.5 font-mono text-[8.5px] uppercase tracking-[0.18em] text-[#4E6C82]">Smart port operations</div>
          </div>
        </div>

        <div className="max-w-[30rem]">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/50 px-3 py-1 backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2477B8]" />
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[#2C5675]">Terminal 2 · INBOM-T2</span>
          </div>
          <h2 className="editorial-title mt-5 text-[38px] text-[#102A43] xl:text-[46px]">
            Your port operations.
            <span className="block text-[#2477B8]">One intelligent workspace.</span>
          </h2>
          <p className="mt-4 max-w-[38ch] text-[13px] leading-relaxed text-[#3F6076]">
            Ships, berths, cranes, fleets and cargo move together inside one connected digital twin.
          </p>
        </div>

        <div className="relative">
          <svg viewBox="0 0 620 430" className="w-full" role="img" aria-label="Illustration of a container terminal with a cargo ship, cranes, stacks and a truck">
            <defs>
              <linearGradient id="authWater" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#8FCBDF" />
                <stop offset="100%" stopColor="#5FA8C9" />
              </linearGradient>
              <linearGradient id="authHull" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1B4A6B" />
                <stop offset="100%" stopColor="#123A56" />
              </linearGradient>
              <linearGradient id="authSkyFade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#EAF7FB" stopOpacity="0.9" />
                <stop offset="100%" stopColor="#EAF7FB" stopOpacity="0" />
              </linearGradient>
              <g id="authCrane">
                <path d="M0 150 V40 H7 V150 M54 150 V40 H61 V150 M0 66 H61 M0 40 L61 18 M61 40 L0 18" stroke="#2C5675" strokeWidth="4.5" fill="none" strokeLinecap="round" />
                <path d="M-10 30 H72" stroke="#2C5675" strokeWidth="3.5" strokeLinecap="round" />
                <path d="M30 44 V98 H16" stroke="#2C5675" strokeWidth="2.5" fill="none" />
                <rect x="8" y="98" width="16" height="11" rx="1.5" fill="#3979E8" />
              </g>
              <g id="authBox">
                <rect width="30" height="15" rx="1.5" fill="currentColor" />
                <path d="M5 1V14M10 1V14M15 1V14M20 1V14M25 1V14" stroke="#0E3550" strokeOpacity="0.18" strokeWidth="0.7" />
              </g>
            </defs>

            <circle cx="520" cy="74" r="34" fill="#FFFFFF" opacity="0.55" />
            <g fill="#FFFFFF" opacity="0.6" className="animate-float">
              <ellipse cx="128" cy="66" rx="46" ry="15" />
              <ellipse cx="160" cy="58" rx="30" ry="12" />
              <ellipse cx="98" cy="58" rx="24" ry="10" />
            </g>
            <g fill="#FFFFFF" opacity="0.4" className="animate-float" style={{ animationDelay: "1.8s" }}>
              <ellipse cx="450" cy="120" rx="40" ry="13" />
              <ellipse cx="480" cy="112" rx="24" ry="10" />
            </g>

            <path d="M0 300 H620 V430 H0 Z" fill="url(#authWater)" />
            <path d="M0 300 H620" stroke="#DDF1F8" strokeWidth="1.5" opacity="0.8" />

            {/* quay */}
            <path d="M372 300 H620 V316 H372 Z" fill="#DCE5ED" />
            <path d="M372 316 H620 V322 H372 Z" fill="#C5D5E2" />

            {/* port cranes */}
            <g transform="translate(408 168)"><use href="#authCrane" /></g>
            <g transform="translate(512 176) scale(0.9)"><use href="#authCrane" /></g>

            {/* container stacks on the quay */}
            <g color="#2F6F96">
              <use href="#authBox" x="396" y="286" />
              <use href="#authBox" x="428" y="286" />
              <use href="#authBox" x="460" y="286" />
              <use href="#authBox" x="492" y="286" />
              <use href="#authBox" x="524" y="286" />
            </g>
            <g color="#B4553C">
              <use href="#authBox" x="412" y="270" />
              <use href="#authBox" x="444" y="270" />
              <use href="#authBox" x="476" y="270" />
              <use href="#authBox" x="508" y="270" />
            </g>
            <g color="#3979E8">
              <use href="#authBox" x="428" y="254" />
              <use href="#authBox" x="460" y="254" />
              <use href="#authBox" x="492" y="254" />
            </g>

            {/* truck */}
            <g transform="translate(556 280)">
              <rect x="0" y="6" width="52" height="16" rx="2" fill="#2477B8" />
              <path d="M6 6V0H30V6" fill="none" stroke="#2477B8" strokeWidth="2" />
              <rect x="40" y="4" width="14" height="18" rx="2" fill="#163A56" />
              <rect x="43" y="8" width="8" height="6" rx="1" fill="#B6DFEE" />
              <circle cx="12" cy="24" r="5" fill="#163A56" />
              <circle cx="42" cy="24" r="5" fill="#163A56" />
              <circle cx="12" cy="24" r="2" fill="#B6DFEE" />
              <circle cx="42" cy="24" r="2" fill="#B6DFEE" />
            </g>

            {/* cargo vessel */}
            <g className="animate-float" style={{ animationDuration: "9s" }}>
              <g transform="translate(58 176)">
                <path d="M0 86 L18 124 C 108 146 214 146 300 124 L336 86 Z" fill="url(#authHull)" />
                <path d="M0 86 L18 124 C 84 136 160 139 232 132 L232 86 Z" fill="#B4553C" opacity="0.9" />
                <path d="M22 120 C 110 138 232 136 330 116" stroke="#EAF7FC" strokeWidth="2.4" opacity="0.55" fill="none" />
                <rect x="22" y="18" width="58" height="68" rx="2" fill="#F4F9FC" />
                <rect x="28" y="10" width="42" height="10" rx="1.5" fill="#DCE5ED" />
                <rect x="68" y="0" width="14" height="22" rx="1.5" fill="#163A56" />
                <rect x="68" y="5" width="14" height="5" fill="#C77B4A" />
                <g fill="#7FB7D6">
                  <rect x="29" y="28" width="7" height="4" /><rect x="40" y="28" width="7" height="4" /><rect x="51" y="28" width="7" height="4" /><rect x="62" y="28" width="7" height="4" />
                  <rect x="29" y="38" width="7" height="4" /><rect x="40" y="38" width="7" height="4" /><rect x="51" y="38" width="7" height="4" /><rect x="62" y="38" width="7" height="4" />
                  <rect x="29" y="54" width="7" height="4" /><rect x="40" y="54" width="7" height="4" /><rect x="51" y="54" width="7" height="4" />
                </g>
                <g color="#2F6F96">
                  <use href="#authBox" x="96" y="71" /><use href="#authBox" x="130" y="71" /><use href="#authBox" x="164" y="71" /><use href="#authBox" x="198" y="71" /><use href="#authBox" x="232" y="71" />
                </g>
                <g color="#B4553C">
                  <use href="#authBox" x="113" y="55" /><use href="#authBox" x="147" y="55" /><use href="#authBox" x="181" y="55" /><use href="#authBox" x="215" y="55" />
                </g>
                <g color="#3979E8">
                  <use href="#authBox" x="130" y="39" /><use href="#authBox" x="164" y="39" /><use href="#authBox" x="198" y="39" />
                </g>
                <path d="M300 86 V52 M300 58 L316 46" stroke="#8FA6B6" strokeWidth="2" />
                <circle cx="300" cy="50" r="1.6" fill="#FFE2B0" />
              </g>
            </g>

            {/* water marks */}
            <g stroke="#EAF7FC" strokeWidth="1.4" opacity="0.55" fill="none">
              <path d="M24 336 C 70 330 110 342 156 336" />
              <path d="M60 362 C 118 354 168 366 226 360" />
              <path d="M340 344 C 390 338 430 348 480 342" />
              <path d="M420 374 C 470 368 520 378 580 370" />
            </g>
            <path d="M0 300 H620 V430 H0 Z" fill="url(#authSkyFade)" opacity="0.18" />
          </svg>

          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3">
            <div className="font-mono text-[8.5px] uppercase tracking-[0.14em] text-[#2C5675]/70">
              {variant === "login" ? "Operations workspace access" : "Read-only workspace access"}
            </div>
            <div className="flex gap-1.5">
              {["Digital twin", "Live sync", "Audited"].map((label) => (
                <span key={label} className="rounded-full border border-white/60 bg-white/40 px-2 py-0.5 font-mono text-[8px] uppercase tracking-[0.08em] text-[#2C5675] backdrop-blur">
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
