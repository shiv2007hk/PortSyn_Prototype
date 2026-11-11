import { useEffect, useState } from "react";
import { cn } from "@/lib/format";
import { LogoMark } from "@/components/layout/Logo";

interface OrbitFeature {
  icon: typeof import("lucide-react").Ship;
  title: string;
  copy: string;
}

const RADIUS = 41;
const SPIN = "animate-[orbit-spin_80s_linear_infinite]";
const SPIN_REVERSE = "animate-[orbit-spin_80s_linear_infinite_reverse]";
const HOLD = "group-hover:[animation-play-state:paused]";

/**
 * Rotating ring of module chips around a shared core. The ring turns
 * continuously, holds still while the visitor inspects a module, and the
 * readout panel mirrors the active module.
 */
export function FeatureOrbit({ features }: { features: OrbitFeature[] }) {
  const [active, setActive] = useState(0);
  const [engaged, setEngaged] = useState(false);

  useEffect(() => {
    if (engaged) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % features.length);
    }, 3200);
    return () => window.clearInterval(timer);
  }, [engaged, features.length]);

  const current = features[active];

  return (
    <div className="grid items-center gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
      <div>
        <div className="rounded-card border border-line bg-ink-850 p-5 shadow-panel">
          <div className="flex items-center justify-between">
            <span className="micro-label">
              Module {String(active + 1).padStart(2, "0")} / {features.length}
            </span>
            <span className="status-dot bg-signal-cyan animate-pulse-dot" />
          </div>
          <div key={current.title} className="mt-4 flex items-start gap-3.5 animate-slide-in">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line bg-ink-900 text-marine-400">
              <current.icon size={17} />
            </span>
            <div>
              <h3 className="font-display text-[16.5px] font-medium text-slate-100">{current.title}</h3>
              <p className="mt-1.5 max-w-[44ch] text-[12.5px] leading-relaxed text-slate-400">{current.copy}</p>
            </div>
          </div>
        </div>
        <p className="mt-4 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-600">
          The ring turns on its own · hover a module to hold it still
        </p>
      </div>

      <div
        className="group relative mx-auto aspect-square w-full max-w-[620px]"
        onMouseEnter={() => setEngaged(true)}
        onMouseLeave={() => setEngaged(false)}
      >
        <div className="absolute inset-[3.5%] rounded-full border border-line" />
        <div className={cn("absolute inset-[9%] rounded-full border border-dashed border-line-strong", SPIN, HOLD)}>
          <span className="absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-marine-400/70" />
          <span className="absolute bottom-0 left-1/2 h-1 w-1 -translate-x-1/2 translate-y-1/2 rounded-full bg-marine-400/40" />
        </div>
        <div className="absolute inset-[30%] rounded-full border border-line bg-ink-900/40" />

        <div className={cn("absolute inset-0", SPIN, HOLD)}>
          {features.map((feature, index) => {
            const angle = (index * (360 / features.length) - 90) * (Math.PI / 180);
            const left = 50 + RADIUS * Math.cos(angle);
            const top = 50 + RADIUS * Math.sin(angle);
            const isActive = index === active;
            return (
              <div key={feature.title} className="absolute h-0 w-0" style={{ left: `${left}%`, top: `${top}%` }}>
                <div className={cn(SPIN_REVERSE, HOLD)}>
                  <div className="relative -translate-x-1/2 -translate-y-1/2">
                    <button
                      type="button"
                      onMouseEnter={() => setActive(index)}
                      onFocus={() => {
                        setActive(index);
                        setEngaged(true);
                      }}
                      onBlur={() => setEngaged(false)}
                      aria-label={feature.title}
                      className={cn(
                        "flex h-11 w-11 items-center justify-center rounded-full border bg-ink-850 text-marine-400 transition-all duration-200",
                        isActive
                          ? "scale-110 border-cyan-400/60 text-cyan-500 shadow-[0_10px_26px_-12px_rgba(36,119,184,0.55)]"
                          : "border-line shadow-panel hover:border-marine-500/50 hover:text-cyan-500",
                      )}
                    >
                      <feature.icon size={16} />
                    </button>
                    <span
                      className={cn(
                        "absolute left-1/2 top-full mt-1.5 hidden -translate-x-1/2 whitespace-nowrap font-mono text-3xs uppercase tracking-[0.08em] transition-colors sm:block",
                        isActive ? "text-slate-600" : "text-slate-500/80",
                      )}
                    >
                      {feature.title}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="absolute left-1/2 top-1/2 z-10 flex h-[27%] w-[27%] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-line bg-ink-850 text-center shadow-float">
          <LogoMark size={30} />
          <span className="mt-1.5 font-display text-[10px] font-bold tracking-[0.16em] text-slate-50">PORTSYNC</span>
          <span className="mt-0.5 font-mono text-3xs uppercase tracking-[0.1em] text-slate-500">One core</span>
        </div>
      </div>
    </div>
  );
}
