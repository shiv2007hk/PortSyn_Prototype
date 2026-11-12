import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  Anchor,
  ArrowRight,
  BarChart3,
  BellRing,
  Boxes,
  Check,
  ChevronDown,
  FlaskConical,
  Gauge,
  LayoutDashboard,
  Map,
  Menu,
  Radio,
  Ship,
  Sparkles,
  Truck,
  Warehouse,
  X,
  Moon,
  Sun,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/format";
import { LogoMark } from "@/components/layout/Logo";
import { ShipScene } from "@/components/landing/ShipScene";
import { FeatureOrbit } from "@/components/landing/FeatureOrbit";
import { CountUp, Reveal, useScrollFlag } from "@/components/landing/Reveal";
import { ThemeProvider, useLandingTheme } from "@/lib/theme";

const NAV = [
  { href: "#platform", label: "Platform" },
  { href: "#solutions", label: "Solutions" },
  { href: "#features", label: "Features" },
  { href: "#digital-twin", label: "Digital Twin" },
  { href: "#operations", label: "Operations" },
];

const FEATURES = [
  { icon: LayoutDashboard, title: "Live port operations", copy: "One control surface for vessel queues, berth occupancy, equipment state and dispatch pressure." },
  { icon: Map, title: "Interactive digital twin", copy: "A shared spatial model of Terminal 2 — ships, docks, cranes, vehicles and container yard in motion." },
  { icon: Ship, title: "Ship & dock management", copy: "Register arrivals, gate berth compatibility, discharge cargo and close departures on one audited timeline." },
  { icon: Sparkles, title: "Intelligent resource optimizer", copy: "Explainable allocation across berths, cranes, trucks, drivers and storage — score every feasible option." },
  { icon: Truck, title: "Fleet & equipment", copy: "Crane and vehicle health, utilisation and maintenance state kept in sync with live operations." },
  { icon: Boxes, title: "Container lifecycle", copy: "Follow every box from vessel manifest through yard, warehouse and final dispatch completion." },
  { icon: Warehouse, title: "Warehouse & dispatch", copy: "Slot storage, stage outbound loads and release containers only when dispatch closes." },
  { icon: FlaskConical, title: "What-if simulation", copy: "Stress the terminal with crane failures and demand spikes in an isolated scenario sandbox." },
  { icon: BellRing, title: "Predictive maintenance", copy: "Surface equipment degradation and convert alerts into tracked maintenance work." },
  { icon: BarChart3, title: "Operational analytics", copy: "Turnaround, utilisation and throughput trends generated from the port's own event ledger." },
];

const WORKFLOW = [
  { icon: Anchor, title: "Ship arrival", copy: "ETA, draft and cargo constraints enter the plan." },
  { icon: Ship, title: "Dock allocation", copy: "Feasible berths are scored on wait time and fit." },
  { icon: Gauge, title: "Crane assignment", copy: "Capacity and health gate the crane shortlist." },
  { icon: Truck, title: "Vehicle assignment", copy: "Trucks and drivers are paired to the discharge plan." },
  { icon: Warehouse, title: "Warehouse routing", copy: "Storage is reserved before boxes leave the quay." },
  { icon: Boxes, title: "Dispatch", copy: "Outbound movements close the container lifecycle." },
];

function SectionLabel({ children, tone = "light" }: { children: React.ReactNode; tone?: "light" | "dark" }) {
  return (
    <div className={cn("flex items-center gap-2.5 font-mono text-[10.5px] font-medium uppercase tracking-[0.22em]", tone === "dark" ? "text-[#7FC4DF]" : "text-marine-600")}>
      <span className={cn("h-px w-8", tone === "dark" ? "bg-[#7FC4DF]/40" : "bg-marine-600/35")} />
      {children}
    </div>
  );
}

function NavBar() {
  const scrolled = useScrollFlag(30);
  const { user } = useAuth();
  const { theme, toggleTheme } = useLandingTheme();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("#platform");

  useEffect(() => {
    const ids = NAV.map((item) => item.href.slice(1));
    const onScroll = () => {
      let current = "#platform";
      ids.forEach((id) => {
        const element = document.getElementById(id);
        if (element && element.getBoundingClientRect().top <= 180) current = `#${id}`;
      });
      setActive(current);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        scrolled ? "glass-nav" : "border-b border-transparent bg-transparent",
      )}
    >
      <div className="landing-wrap flex h-16 items-center justify-between gap-6 px-5 sm:px-8 lg:px-12">
        <a href="#top" className="flex items-center gap-2.5">
          <LogoMark size={30} />
          <span className={cn("font-display text-[15px] font-bold tracking-[0.16em]", scrolled ? "text-slate-50" : "text-white")}>
            PORTSYNC
          </span>
        </a>

        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className={cn(
                "relative rounded-full px-3.5 py-2 text-[12.5px] font-medium transition-colors",
                scrolled
                  ? active === item.href
                    ? "text-slate-50"
                    : "text-slate-400 hover:text-slate-100"
                  : active === item.href
                    ? "text-white"
                    : "text-white/60 hover:text-white",
              )}
            >
              {item.label}
              {active === item.href ? (
                <span className="absolute inset-x-3 -bottom-0.5 h-px bg-signal-cyan" />
              ) : null}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="theme-toggle-btn inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
            aria-label={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
            title={theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode"}
          >
            {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <Link
            to={user ? "/app" : "/login"}
            className={cn(
              "hidden h-8 items-center rounded-full px-3 text-[12.5px] font-medium transition-colors sm:inline-flex",
              scrolled ? "text-slate-500 hover:text-slate-100" : "text-white/70 hover:text-white",
            )}
          >
            {user ? "Workspace" : "Login"}
          </Link>
          <Link
            to={user ? "/app" : "/signup"}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[12.5px] font-semibold transition-all hover:-translate-y-0.5",
              scrolled
                ? "bg-marine-600 text-white shadow-[0_10px_24px_-14px_rgba(37,99,235,0.9)] hover:bg-marine-500"
                : "bg-white text-[#102A43] hover:bg-[#EAF4FA]",
            )}
          >
            {user ? "Open workspace" : "Get started"} <ArrowRight size={13} />
          </Link>
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-white/80 hover:bg-white/10 lg:hidden"
            onClick={() => setOpen((value) => !value)}
            aria-label="Toggle navigation"
          >
            {open ? <X size={17} /> : <Menu size={17} />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="glass-nav border-t border-line px-5 py-3 lg:hidden">
          {NAV.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="block rounded-md px-2 py-2.5 text-[13px] font-medium text-slate-200 hover:bg-ink-800"
            >
              {item.label}
            </a>
          ))}
          <div className="mt-2 flex items-center gap-2 border-t border-line pt-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="theme-toggle-btn flex h-9 items-center justify-center gap-2 rounded-lg border border-line px-3 text-[12.5px] font-medium text-slate-200"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
              <span>{theme === "dark" ? "Light" : "Dark"}</span>
            </button>
            <Link to={user ? "/app" : "/login"} className="flex-1 rounded-lg border border-line px-3 py-2 text-center text-[12.5px] text-slate-200">
              {user ? "Workspace" : "Log in"}
            </Link>
            <Link to={user ? "/app" : "/signup"} className="flex-1 rounded-lg bg-marine-600 px-3 py-2 text-center text-[12.5px] font-medium text-white">
              {user ? "Open" : "Get started"}
            </Link>
          </div>
        </div>
      ) : null}
    </header>
  );
}

function Hero() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoFailed, setVideoFailed] = useState(false);
  const [reduceMotion, setReduceMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(preference.matches);
    const onChange = (event: MediaQueryListEvent) => setReduceMotion(event.matches);
    preference.addEventListener?.("change", onChange);
    return () => preference.removeEventListener?.("change", onChange);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const applyPlaybackRate = () => {
      video.playbackRate = 1.75;
    };
    applyPlaybackRate();
    video.addEventListener("play", applyPlaybackRate);
    video.addEventListener("loadedmetadata", applyPlaybackRate);
    return () => {
      video.removeEventListener("play", applyPlaybackRate);
      video.removeEventListener("loadedmetadata", applyPlaybackRate);
    };
  }, [videoFailed]);

  return (
    <section id="top" className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden bg-[#050f1a] pt-20">
      {!videoFailed ? (
        <video
          ref={videoRef}
          className="hero-video pointer-events-none absolute inset-0 z-0 h-full w-full object-cover"
          autoPlay={!reduceMotion}
          loop={!reduceMotion}
          muted
          playsInline
          preload="metadata"
          poster="/images/port-approach.jpg"
          aria-hidden="true"
          onLoadedMetadata={(e) => {
            e.currentTarget.playbackRate = 1.75;
          }}
          onError={() => setVideoFailed(true)}
        >
          <source src="/videos/portsync-cinematic-port.mp4" type="video/mp4" />
        </video>
      ) : (
        <ShipScene className="absolute inset-x-0 bottom-0 z-0 h-[66%] min-h-[340px]" />
      )}
      <div className="pointer-events-none absolute inset-0 z-[1] bg-[linear-gradient(90deg,var(--hero-overlay-start)_0%,var(--hero-overlay-mid)_48%,var(--hero-overlay-end)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-[1] h-48 bg-gradient-to-b from-[var(--hero-top-grad)] to-transparent" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-36 bg-gradient-to-t from-[var(--hero-bottom-grad)] via-[var(--hero-bottom-grad)]/50 to-transparent" />

      <div className="landing-wrap relative z-10 px-5 pb-24 pt-10 sm:px-8 lg:px-12 lg:pb-32">
        <div className="max-w-[760px]">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 backdrop-blur-md">
            <span className="status-dot bg-[#26B7D3] animate-pulse-dot" />
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-[#B6DFEE]">Smart port operations platform</span>
          </div>

          <h1 className="editorial-title mt-6 max-w-[22ch] text-[40px] text-white sm:text-[52px] lg:text-[58px] xl:text-[64px]">
            Your port.
            <span className="block text-[#9FD3E8]">Connected. Intelligent.</span>
            <span className="block">Optimized.</span>
          </h1>

          <p className="mt-6 max-w-[52ch] text-[14.5px] leading-relaxed text-[#C5D9E6] sm:text-[16px]">
            Connect ships, docks, cranes, fleets and cargo operations through one intelligent platform built for the future of
            smart ports.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#platform"
              className="group inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[13px] font-semibold text-[#102A43] transition-all hover:-translate-y-0.5 hover:bg-[#EAF4FA]"
            >
              Explore platform
              <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </a>
            <Link
              to="/signup"
              className="inline-flex h-11 items-center gap-2 rounded-full border border-white/25 bg-white/[0.06] px-5 text-[13px] font-medium text-white backdrop-blur-md transition-colors hover:border-white/50 hover:bg-white/10"
            >
              Get started
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[9.5px] uppercase tracking-[0.16em] text-[#7FA6BC]">
            <span>Digital twin</span>
            <span className="h-1 w-1 rounded-full bg-[#26B7D3]/70" />
            <span>10 connected modules</span>
            <span className="h-1 w-1 rounded-full bg-[#26B7D3]/70" />
            <span>Audited operations</span>
          </div>
        </div>
      </div>

      <a
        href="#platform"
        className="absolute bottom-7 left-1/2 z-10 hidden -translate-x-1/2 flex-col items-center gap-2 text-white/50 transition-colors hover:text-white/90 sm:flex"
        aria-label="Scroll to platform"
      >
        <span className="font-mono text-[9px] uppercase tracking-[0.24em]">Scroll</span>
        <span className="relative h-9 w-px overflow-hidden bg-white/20">
          <span className="absolute inset-x-0 top-0 h-3 animate-[scroll-cue_2.2s_ease-in-out_infinite] bg-[#B6DFEE]" />
        </span>
        <ChevronDown size={13} />
      </a>
    </section>
  );
}

function Intro() {
  const rows = [
    { label: "VESSEL ARRIVAL", value: "2 ready", state: "READY", stateClass: "text-emerald-300 bg-emerald-300/10" },
    { label: "BERTH COMPATIBILITY", value: "6 / 6 eligible", state: "PASS", stateClass: "text-cyan-300 bg-cyan-300/10" },
    { label: "CRANE PRESSURE", value: "Low · 4 available", state: "STABLE", stateClass: "text-emerald-300 bg-emerald-300/10" },
  ];

  return (
    <section id="platform" className="landing-section border-b border-line bg-ink-900">
      <div className="landing-wrap">
        <div className="grid gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center lg:gap-14">
          <Reveal>
            <SectionLabel>The connected terminal</SectionLabel>
            <h2 className="editorial-title mt-5 text-[32px] text-slate-50 sm:text-[40px] lg:text-[42px]">
              One connected ecosystem.
              <span className="block text-slate-400">Complete port intelligence.</span>
            </h2>
            <p className="mt-5 max-w-[46ch] text-[13px] leading-relaxed text-slate-400 sm:text-[13.5px]">
              Berth planning, cargo discharge, yard storage and road dispatch usually live in separate systems. PortSync keeps
              them in one operational model, so every decision is made against the same state of the port.
            </p>
            <div className="mt-7 grid max-w-[420px] grid-cols-3 gap-2.5">
              {[
                { value: 1, suffix: "", label: "Shared digital twin" },
                { value: 10, suffix: "", label: "Operational modules" },
                { value: 24, suffix: "/7", label: "Event ledger" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-panel border border-line bg-ink-800/55 px-3 py-3">
                  <div className="font-mono text-[21px] tabular-nums text-slate-50">
                    <CountUp value={stat.value} suffix={stat.suffix} />
                  </div>
                  <div className="mt-1 text-[9.5px] leading-snug text-slate-500 sm:text-[10px]">{stat.label}</div>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={100} className="relative">
            <div className="operation-model relative overflow-hidden rounded-[18px] border border-white/[0.12] bg-[#0A1D2C] shadow-[0_34px_90px_-48px_rgba(0,0,0,0.95)]">
              <div className="h-[2px] bg-gradient-to-r from-[#26B7D3] via-[#5CD9E8] to-transparent" />
              <div className="flex items-start justify-between gap-4 border-b border-white/[0.08] px-4 py-4 sm:px-5">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-300/15 bg-cyan-300/[0.07] text-[#7FDCEB]">
                    <Ship size={17} />
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-display text-[14px] font-semibold text-slate-100 sm:text-[15px]">TERMINAL 2 · OPERATIONS MODEL</h3>
                    <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-500">Mumbai Port · INBOM-T2</p>
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-2 py-1 font-mono text-[8px] uppercase tracking-[0.1em] text-cyan-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse-dot" /> Synced
                </span>
              </div>

              <div className="px-4 py-4 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-slate-500">Current vessel</p>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className="font-mono text-[13px] font-medium text-slate-100 sm:text-[14px]">SH-104 · MV Konkan Star</span>
                      <span className="rounded bg-cyan-300/10 px-1.5 py-0.5 font-mono text-[7.5px] uppercase tracking-[0.1em] text-cyan-200">Approach</span>
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="font-mono text-[8px] uppercase tracking-[0.14em] text-slate-500">Queue position</p>
                    <p className="mt-1 font-mono text-[19px] leading-none text-slate-50">02<span className="ml-1 text-[10px] text-slate-500">/ 06</span></p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2" aria-label="Berth selection preview">
                  {[
                    { label: "Berth 01", status: "Occupied", active: false },
                    { label: "Berth 03", status: "Available", active: false },
                    { label: "Berth 04", status: "Recommended", active: true },
                  ].map((berth) => (
                    <div key={berth.label} className={cn("rounded-lg border px-2.5 py-2.5", berth.active ? "border-cyan-400/55 bg-cyan-300/[0.09]" : "border-white/[0.08] bg-white/[0.025]")}>
                      <p className={cn("font-mono text-[9px] sm:text-[10px]", berth.active ? "text-cyan-100" : "text-slate-300")}>{berth.label}</p>
                      <p className={cn("mt-1 text-[8px] sm:text-[9px]", berth.active ? "text-cyan-300" : "text-slate-500")}>{berth.status}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 space-y-2.5">
                  {rows.map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-3 border-t border-white/[0.06] pt-2.5">
                      <div className="min-w-0">
                        <p className="font-mono text-[8px] uppercase tracking-[0.11em] text-slate-500">{row.label}</p>
                        <p className="mt-1 text-[11px] text-slate-200">{row.value}</p>
                      </div>
                      <span className={cn("shrink-0 rounded px-2 py-1 font-mono text-[7.5px] uppercase tracking-[0.08em]", row.stateClass)}>{row.state}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between gap-4 border-t border-white/[0.08] pt-3 font-mono text-[8px] uppercase tracking-[0.1em] text-slate-500">
                  <span className="inline-flex items-center gap-1.5"><Activity size={10} className="text-cyan-300" /> Deterministic simulator</span>
                  <span>Sample terminal state</span>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Marquee() {
  const items = ["Smart ports", "Intelligent logistics", "Digital twin", "Resource optimisation", "Connected operations"];
  return (
    <section aria-label="Platform themes" className="overflow-hidden border-y border-[var(--marquee-border)] bg-[var(--marquee-bg)] py-5 transition-colors">
      <div className="marquee-track items-center gap-8">
        {[...items, ...items, ...items, ...items].map((item, index) => (
          <div key={`${item}-${index}`} className="flex shrink-0 items-center gap-8">
            <span className="font-display text-[13px] font-medium uppercase tracking-[0.24em] text-[var(--marquee-text)]">{item}</span>
            <span className="h-1 w-1 rounded-full bg-signal-cyan/70" />
          </div>
        ))}
      </div>
    </section>
  );
}

function About() {
  const pillars = [
    {
      title: "Unified port visibility",
      copy: "A vessel, a berth, a crane and a truck are never separate facts. The twin shows how they constrain each other in the same operating picture.",
    },
    {
      title: "Intelligent resource coordination",
      copy: "Hard constraints gate every allocation. Weighted scoring then ranks feasible options and explains the recommendation.",
    },
    {
      title: "Faster operational decisions",
      copy: "Simulation, alerting and a complete audit trail shorten the distance between a disruption and a deliberate response.",
    },
  ];

  return (
    <section id="solutions" className="landing-section bg-ink-900">
      <div className="landing-wrap">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-12">
          <div>
            <Reveal className="max-w-2xl">
              <SectionLabel>Port systems</SectionLabel>
              <h2 className="editorial-title mt-5 text-[32px] text-slate-50 sm:text-[42px]">
                Built around how a terminal actually works.
              </h2>
            </Reveal>
            <div className="mt-8 space-y-1">
              {pillars.map((pillar, index) => (
                <Reveal key={pillar.title} delay={index * 80}>
                  <div className="group flex gap-4 border-t border-line py-4 transition-colors hover:bg-ink-800/35 sm:gap-5 sm:py-5">
                    <span className="mt-1 font-mono text-[10px] text-marine-400">0{index + 1}</span>
                    <div>
                      <h3 className="font-display text-[15px] font-medium text-slate-100 transition-colors group-hover:text-cyan-300 sm:text-[16px]">{pillar.title}</h3>
                      <p className="mt-1.5 max-w-[45ch] text-[11.5px] leading-relaxed text-slate-400 sm:text-[12px]">{pillar.copy}</p>
                    </div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>

          <Reveal delay={100}>
            <div id="operations" className="port-schematic scroll-mt-24 overflow-hidden rounded-[16px] border border-white/[0.11] bg-[#081B2A] shadow-[0_38px_90px_-54px_rgba(0,0,0,0.95)]">
              <div className="flex items-center justify-between gap-3 border-b border-white/[0.08] px-4 py-3 sm:px-5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <Map size={13} className="shrink-0 text-[#7FC4DF]" />
                  <span className="truncate font-mono text-[8.5px] uppercase tracking-[0.13em] text-[#9DB9CA] sm:text-[9px]">Port terminal · network view</span>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-300/[0.08] px-2 py-1 font-mono text-[7.5px] uppercase tracking-[0.1em] text-emerald-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse-dot" /> Connected
                </span>
              </div>

              <svg viewBox="0 0 620 390" className="port-schematic-canvas block h-auto w-full" role="img" aria-label="Animated port schematic with vessel, berths, cranes, container yard and moving operational routes">
                <defs>
                  <pattern id="port-map-grid" width="24" height="24" patternUnits="userSpaceOnUse">
                    <path d="M24 0H0V24" fill="none" stroke="#16354A" strokeWidth="0.65" />
                  </pattern>
                  <linearGradient id="port-map-water" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#0A354A" />
                    <stop offset="100%" stopColor="#071D2B" />
                  </linearGradient>
                  <linearGradient id="port-map-quay" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#19384A" />
                    <stop offset="50%" stopColor="#294A5B" />
                    <stop offset="100%" stopColor="#173447" />
                  </linearGradient>
                </defs>
                <rect width="620" height="390" fill="#071827" />
                <rect width="620" height="390" fill="url(#port-map-grid)" />
                <rect x="0" y="0" width="620" height="102" fill="url(#port-map-water)" />
                <g className="port-map-water-lines" fill="none" stroke="#2D7088" strokeWidth="0.8" opacity="0.55">
                  <path d="M12 25 C70 18 95 33 148 26 S236 21 288 29 S384 19 438 26 S530 21 610 27" />
                  <path d="M-8 48 C42 41 101 56 154 49 S238 45 296 51 S400 43 452 50 S542 45 628 51" />
                  <path d="M22 76 C78 68 130 82 181 75 S269 70 328 78 S426 68 486 76 S560 70 620 75" />
                </g>
                <text x="20" y="18" fill="#6D95A9" fontFamily="IBM Plex Mono, monospace" fontSize="8" letterSpacing="1.2">APPROACH CHANNEL</text>
                <path d="M0 105 H620 V128 H0 Z" fill="url(#port-map-quay)" stroke="#42657A" strokeWidth="0.8" />
                <path d="M0 131 H620" stroke="#6D92A5" strokeWidth="1" strokeDasharray="2 5" opacity="0.55" />
                <text x="18" y="121" fill="#A8C7D6" fontFamily="IBM Plex Mono, monospace" fontSize="7.5" letterSpacing="1">QUAYSIDE / TERMINAL 2</text>

                {/* Container yard lanes */}
                <rect x="18" y="148" width="268" height="218" rx="4" fill="#0A2232" stroke="#1D4054" />
                <text x="28" y="164" fill="#6E93A8" fontFamily="IBM Plex Mono, monospace" fontSize="8" letterSpacing="1">CONTAINER YARD</text>
                {[0, 1, 2, 3, 4, 5].map((col) => [0, 1, 2, 3, 4, 5].map((row) => {
                  const colors = ["#20506A", "#285E78", "#9A4C3D", "#1B4259", "#2C7187"];
                  const fill = colors[(col * 2 + row * 3) % colors.length];
                  return <rect key={`${col}-${row}`} x={30 + col * 40} y={178 + row * 28} width="32" height="20" rx="1.5" fill={fill} stroke="#6CA3B5" strokeOpacity="0.24" strokeWidth="0.6" />;
                }))}
                <g stroke="#2D6279" strokeWidth="1" fill="none" opacity="0.8">
                  <path d="M30 208H270M30 236H270M30 264H270M30 292H270M30 320H270M70 178V346M110 178V346M150 178V346M190 178V346M230 178V346" strokeDasharray="2 6" />
                </g>

                {/* Berth blocks */}
                <g>
                  {[0, 1, 2].map((index) => (
                    <g key={index}>
                      <rect x="310" y={150 + index * 68} width="292" height="56" rx="3" fill="#0A2637" stroke={index === 0 ? "#267C94" : "#1D4155"} strokeWidth={index === 0 ? "1.2" : "0.8"} />
                      <text x="321" y={164 + index * 68} fill="#668FA4" fontFamily="IBM Plex Mono, monospace" fontSize="7.5" letterSpacing="0.8">BERTH 0{index + 1}</text>
                    </g>
                  ))}
                </g>

                {/* Ship at berth one */}
                <g transform="translate(346 165)">
                  <path d="M0 12 L10 31 H204 L219 12 Z" fill="#173F56" stroke="#58A7C4" strokeWidth="1.1" />
                  <path d="M5 12 H213" stroke="#9FDCE8" strokeWidth="0.8" opacity="0.85" />
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <g key={n}>
                      <rect x={20 + n * 21} y="-1" width="18" height="12" rx="0.8" fill={n % 3 === 0 ? "#B45A43" : n % 2 === 0 ? "#2B7996" : "#28516C"} stroke="#B8DFE6" strokeOpacity="0.26" strokeWidth="0.5" />
                      <rect x={20 + n * 21} y="-13" width="18" height="11" rx="0.8" fill={n % 4 === 0 ? "#3E8197" : "#1F4A63"} stroke="#B8DFE6" strokeOpacity="0.22" strokeWidth="0.5" />
                    </g>
                  ))}
                  <rect x="174" y="-12" width="25" height="24" rx="1" fill="#BDD5DF" />
                  <rect x="180" y="-8" width="9" height="6" fill="#173347" />
                  <circle cx="212" cy="5" r="2.5" fill="#63E2F0" className="landing-signal-pulse" />
                </g>

                {/* Gantry cranes */}
                {[360, 434, 508, 574].map((x, index) => (
                  <g key={x} transform={`translate(${x} 147)`} fill="none" stroke={index === 0 ? "#57C6D8" : "#44748C"} strokeWidth="1.8">
                    <path d="M0 0 V-17 M27 0 V-17 M-4 -17 H31 M0 -17 L27 -35 M27 -17 L0 -35" />
                    <path d="M-5 -29 H32" strokeWidth="1.1" />
                    <path d="M13 -17 V-5" strokeWidth="1" />
                  </g>
                ))}

                {/* Animated operational routes */}
                <g fill="none" stroke="#39C9DF" strokeWidth="1.5" strokeLinecap="round" opacity="0.92">
                  <path className="landing-route-path" d="M176 315 C238 315 260 280 302 280 S345 265 370 246" />
                  <path className="landing-route-path landing-route-path-alt" d="M252 195 C282 195 284 181 312 181 S333 183 350 182" />
                  <path className="landing-route-path landing-route-path-slow" d="M120 346 C218 362 276 330 314 295 S359 270 390 245" />
                </g>
                <circle r="4" fill="#78F1FB" className="landing-route-marker"><animateMotion dur="4.8s" repeatCount="indefinite" path="M176 315 C238 315 260 280 302 280 S345 265 370 246" /></circle>
                <circle r="3" fill="#A8DDF0" className="landing-route-marker landing-route-marker-delayed"><animateMotion dur="6.4s" begin="-2.4s" repeatCount="indefinite" path="M120 346 C218 362 276 330 314 295 S359 270 390 245" /></circle>

                {/* Compact labels and legend */}
                <g fontFamily="IBM Plex Mono, monospace" fontSize="7" letterSpacing="0.7" fill="#6D95A9">
                  <text x="30" y="376">YARD ZONE B</text>
                  <text x="320" y="374">EQUIPMENT ROUTE</text>
                  <text x="512" y="374" fill="#72D9E7">SYNCED</text>
                </g>
                <circle cx="304" cy="360" r="3" fill="#54CFE1" />
                <circle cx="496" cy="360" r="3" fill="#54CFE1" />
              </svg>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.08] px-4 py-3 sm:px-5">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                  {[
                    { color: "bg-cyan-300", label: "Vessel route" },
                    { color: "bg-blue-400", label: "Equipment" },
                    { color: "bg-emerald-300", label: "Available" },
                  ].map((item) => (
                    <span key={item.label} className="inline-flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.08em] text-slate-500">
                      <span className={cn("h-1.5 w-1.5 rounded-full", item.color)} /> {item.label}
                    </span>
                  ))}
                </div>
                <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-slate-600">Illustrative terminal state</span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Capabilities() {
  return (
    <section id="features" className="landing-section relative bg-ink-850">
      <div className="landing-wrap">
        <Reveal className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <SectionLabel>Core capabilities</SectionLabel>
            <h2 className="editorial-title mt-5 text-[32px] text-slate-50 sm:text-[42px]">
              Ten modules. One operating picture.
            </h2>
          </div>
          <p className="max-w-[34ch] text-[11.5px] leading-relaxed text-slate-500 sm:text-[12px]">
            One connected model for vessels, berths, equipment, containers and the full dispatch lifecycle.
          </p>
        </Reveal>

        <div className="mt-9 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          {FEATURES.map((feature, index) => (
            <Reveal key={feature.title} delay={(index % 5) * 45} className="h-full">
              <article className="group relative flex h-full min-h-[142px] flex-col overflow-hidden rounded-[12px] border border-line bg-ink-800/65 p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-400/35 hover:bg-ink-800 sm:min-h-[150px] sm:p-4">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md border border-line bg-ink-900 text-marine-400 transition-colors group-hover:border-cyan-300/30 group-hover:text-cyan-300">
                    <feature.icon size={14} />
                  </span>
                  <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-slate-700">{String(index + 1).padStart(2, "0")}</span>
                </div>
                <div className="mt-4">
                  <h3 className="font-display text-[12px] font-semibold leading-snug text-slate-100 sm:text-[12.5px]">{feature.title}</h3>
                  <p className="mt-1.5 text-[10px] leading-[1.55] text-slate-500 sm:text-[10.5px]">{feature.copy}</p>
                </div>
                <span className="pointer-events-none absolute inset-x-4 bottom-0 h-px origin-left scale-x-0 bg-gradient-to-r from-cyan-300/75 to-transparent transition-transform duration-300 group-hover:scale-x-100" />
              </article>
            </Reveal>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
          <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-slate-600">Connected modules / Shared terminal state / Audited actions</span>
          <Link to="/login" className="group inline-flex items-center gap-1.5 text-[11px] font-medium text-marine-400 transition-colors hover:text-cyan-300">
            Explore the workspace <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function Orbit() {
  return (
    <section className="landing-section bg-ink-900">
      <div className="landing-wrap">
        <Reveal className="max-w-2xl">
          <SectionLabel>One operating picture</SectionLabel>
          <h2 className="editorial-title mt-5 text-[34px] text-slate-50 sm:text-[44px]">
            Every capability,
            <span className="block text-slate-400">one shared core.</span>
          </h2>
          <p className="mt-5 max-w-[48ch] text-[13.5px] leading-relaxed text-slate-400">
            All ten modules read and write the same live model of the terminal. Nothing is duplicated, nothing drifts out of
            sync — each capability orbits the port's single source of truth.
          </p>
        </Reveal>
        <Reveal delay={120} className="mt-12">
          <FeatureOrbit features={FEATURES} />
        </Reveal>
      </div>
    </section>
  );
}

function TwinShowcase() {
  const { theme } = useLandingTheme();
  return (
    <section id="digital-twin" className="relative overflow-hidden bg-[var(--twin-bg)] py-20 transition-colors lg:py-24">
      <div className="absolute inset-0 opacity-[0.16]" style={{ backgroundImage: "radial-gradient(var(--accent-blue) 0.7px, transparent 0.7px)", backgroundSize: "26px 26px" }} />
      <div className="landing-wrap relative px-5 sm:px-8 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <Reveal>
            <SectionLabel tone={theme === "dark" ? "dark" : "light"}>Digital twin</SectionLabel>
            <h2 className="editorial-title mt-5 text-[34px] text-slate-50 sm:text-[46px]">
              See your port.
              <span className="block text-marine-400">Before it happens.</span>
            </h2>
            <p className="mt-5 max-w-[44ch] text-[13.5px] leading-relaxed text-slate-400">
              A live spatial model of berths, cranes, vehicles and the container yard. Watch an arrival propagate through the
              terminal before a single truck is dispatched.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {[
                { dot: "bg-signal-green", label: "Available" },
                { dot: "bg-signal-cyan", label: "In operation" },
                { dot: "bg-signal-amber", label: "Attention" },
                { dot: "bg-signal-red", label: "Fault" },
              ].map((item) => (
                <span key={item.label} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-ink-850 px-2.5 py-1 text-[10px] text-slate-300">
                  <span className={cn("h-1.5 w-1.5 rounded-full", item.dot)} /> {item.label}
                </span>
              ))}
            </div>
            <p className="mt-6 font-mono text-[9px] uppercase tracking-[0.14em] text-slate-500">Demonstration preview · sample terminal state</p>
          </Reveal>

          <Reveal delay={120}>
            <div className="overflow-hidden rounded-card border border-line bg-ink-850 shadow-panel">
              <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Map size={12} className="text-marine-400" />
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-slate-400">Terminal 2 · twin preview</span>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-marine-500/10 px-2 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.1em] text-marine-400">
                  <span className="h-1 w-1 rounded-full bg-signal-cyan animate-pulse-dot" /> Demo
                </span>
              </div>
              <div className="grid gap-0 lg:grid-cols-[1fr_190px]">
                <svg viewBox="0 0 560 360" className="h-[300px] w-full bg-[#071A29] sm:h-[340px]" role="img" aria-label="Illustrated digital twin preview">
                  <defs>
                    <pattern id="tw-grid" width="28" height="28" patternUnits="userSpaceOnUse">
                      <path d="M28 0H0V28" fill="none" stroke="#16374D" strokeWidth="0.7" />
                    </pattern>
                    <linearGradient id="tw-water" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#0E3A52" />
                      <stop offset="100%" stopColor="#061B29" />
                    </linearGradient>
                  </defs>
                  <rect width="560" height="360" fill="url(#tw-grid)" />
                  <rect y="0" width="560" height="120" fill="url(#tw-water)" />
                  <path d="M0 120 H560" stroke="#2A5873" strokeWidth="1.5" />
                  <g fill="#0C2C40" stroke="#27556F" strokeWidth="1">
                    <rect x="300" y="126" width="230" height="46" rx="2" />
                    <rect x="300" y="182" width="230" height="46" rx="2" />
                    <rect x="300" y="238" width="230" height="46" rx="2" />
                  </g>
                  <g fontFamily="IBM Plex Mono, monospace" fontSize="8" fill="#6E93A8">
                    <text x="310" y="138">BERTH A</text>
                    <text x="310" y="194">BERTH B</text>
                    <text x="310" y="250">BERTH C</text>
                  </g>
                  {/* ship alongside berth A */}
                  <g transform="translate(318 138)">
                    <path d="M0 12 L10 26 H196 L206 12 Z" fill="#163B54" stroke="#3979E8" strokeWidth="1" />
                    <g fill="#B4553C"><rect x="20" y="2" width="16" height="10" /><rect x="40" y="2" width="16" height="10" /><rect x="60" y="2" width="16" height="10" /></g>
                    <g fill="#2F6F96"><rect x="20" y="-8" width="16" height="10" /><rect x="40" y="-8" width="16" height="10" /></g>
                    <rect x="160" y="-10" width="34" height="22" fill="#D8E6EF" />
                    <circle cx="210" cy="4" r="2" fill="#26B7D3" />
                  </g>
                  {/* gantry cranes */}
                  {[340, 410, 480].map((x) => (
                    <g key={x} transform={`translate(${x} 118)`} stroke="#3A6C88" strokeWidth="2" fill="none">
                      <path d="M0 0 V-34 M26 0 V-34 M0 -18 H26 M0 -34 L26 -48 M26 -34 L0 -48" />
                      <path d="M-4 -40 H30" stroke="#26B7D3" strokeWidth="1.4" />
                    </g>
                  ))}
                  {/* yard */}
                  <g>
                    {[0, 1, 2, 3, 4].map((col) =>
                      [0, 1, 2, 3, 4, 5].map((row) => (
                        <rect
                          key={`${col}-${row}`}
                          x={40 + col * 42}
                          y={190 + row * 23}
                          width="30"
                          height="16"
                          rx="1"
                          fill={(col + row) % 4 === 0 ? "#2F6F96" : (col + row) % 4 === 1 ? "#B4553C" : "#1B4C6B"}
                          opacity={0.85}
                        />
                      )),
                    )}
                  </g>
                  <g fontFamily="IBM Plex Mono, monospace" fontSize="7.5" fill="#5E8298">
                    <text x="42" y="184">CONTAINER YARD</text>
                    <text x="300" y="306">BERTH QUAY</text>
                    <text x="42" y="330">WAREHOUSE 02</text>
                  </g>
                  {/* trucks */}
                  {[0, 1, 2].map((index) => (
                    <g key={index} className="animate-float" style={{ animationDelay: `${index * 1.4}s` }}>
                      <rect x={70 + index * 94} y={156} width="26" height="12" rx="2" fill="#26B7D3" />
                      <rect x={96 + index * 94} y={158} width="8" height="9" rx="1.5" fill="#0A2A3D" />
                    </g>
                  ))}
                  <g className="flow-line" stroke="#26B7D3" strokeWidth="1.2" fill="none">
                    <path d="M300 172 C 250 172 220 172 180 172" />
                    <path d="M470 306 C 400 306 350 250 300 120" />
                  </g>
                </svg>

                <div className="border-t border-line p-3 lg:border-l lg:border-t-0">
                  <div className="micro-label">Berth occupancy</div>
                  <div className="mt-3 space-y-2.5">
                    {[
                      { label: "A · SH-104", value: 86, tone: "var(--accent-cyan)" },
                      { label: "B · SH-098", value: 64, tone: "var(--accent-blue)" },
                      { label: "C · free", value: 0, tone: "var(--status-success)" },
                    ].map((row) => (
                      <div key={row.label}>
                        <div className="flex justify-between font-mono text-[8.5px] uppercase tracking-[0.06em] text-slate-400">
                          <span>{row.label}</span>
                          <span>{row.value}%</span>
                        </div>
                        <div className="mt-1 h-1 rounded-full bg-ink-700">
                          <div className="h-full rounded-full transition-all" style={{ width: `${row.value}%`, background: row.tone }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 border-t border-line pt-3">
                    <div className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-slate-500">Resources</div>
                    <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                      {[
                        { label: "Cranes", value: "4/6" },
                        { label: "Trucks", value: "7/9" },
                        { label: "Drivers", value: "6" },
                        { label: "Boxes", value: "42" },
                      ].map((row) => (
                        <div key={row.label} className="rounded border border-line bg-ink-800 px-1.5 py-1">
                          <div className="font-mono text-[7.5px] uppercase tracking-[0.06em] text-slate-500">{row.label}</div>
                          <div className="font-mono text-[11px] text-slate-200">{row.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Allocation() {
  return (
    <section className="landing-section bg-ink-900">
      <div className="landing-wrap">
        <Reveal className="max-w-2xl">
          <SectionLabel>Resource optimisation</SectionLabel>
          <h2 className="editorial-title mt-5 text-[34px] text-slate-50 sm:text-[44px]">
            Smarter decisions at every operational step.
          </h2>
          <p className="mt-4 text-[13.5px] leading-relaxed text-slate-400">
            One arrival triggers a chain of constrained choices. PortSync scores the whole package, explains it, and only
            commits when an operator accepts.
          </p>
        </Reveal>

        <div className="relative mt-14">
          <div className="workflow-track absolute left-0 right-0 top-6 hidden h-px lg:block" aria-hidden="true" />
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-6">
            {WORKFLOW.map((step, index) => (
              <Reveal key={step.title} delay={index * 80}>
                <div className="group relative">
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-full border border-line bg-ink-900 text-marine-400 transition-colors group-hover:border-cyan-400/50 group-hover:text-cyan-400">
                    <step.icon size={17} />
                    <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-ink-700 font-mono text-[8px] text-slate-400">
                      {index + 1}
                    </span>
                  </div>
                  <h3 className="mt-4 font-display text-[13.5px] font-medium text-slate-100">{step.title}</h3>
                  <p className="mt-1.5 max-w-[22ch] text-[11.5px] leading-relaxed text-slate-500">{step.copy}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

        <Reveal delay={200} className="mt-12">
          <div className="flex flex-col gap-4 rounded-card border border-line bg-ink-850 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-marine-500/10 text-marine-400">
                <Sparkles size={15} />
              </span>
              <div>
                <p className="text-[12.5px] font-medium text-slate-200">Explainable by default</p>
                <p className="mt-0.5 max-w-[60ch] text-[11.5px] leading-relaxed text-slate-500">
                  Every recommendation carries its hard constraints, weighted scores and rejected alternatives. Overrides are
                  recorded with the operator and reason.
                </p>
              </div>
            </div>
            <Link to="/login" className="inline-flex shrink-0 items-center gap-1.5 text-[12px] font-medium text-marine-400">
              Open the optimizer <ArrowRight size={13} />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Simulation() {
  const { theme } = useLandingTheme();
  return (
    <section className="landing-section bg-[var(--sim-bg)] transition-colors">
      <div className="landing-wrap">
        <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <Reveal>
            <SectionLabel tone={theme === "dark" ? "dark" : "light"}>What-if simulation</SectionLabel>
            <h2 className="editorial-title mt-5 text-[34px] text-slate-50 sm:text-[44px]">
              Prepare for disruptions
              <span className="block text-marine-400">before they happen.</span>
            </h2>
            <p className="mt-5 max-w-[46ch] text-[13.5px] leading-relaxed text-slate-400">
              Take a crane out of service, spike inbound demand or slow a vessel. The simulator projects the consequences
              without touching the operational database — nothing is applied until you explicitly approve it.
            </p>
            <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-signal-amber">
              <FlaskConical size={11} /> Scenario sandbox · isolated from live state
            </p>
          </Reveal>

          <Reveal delay={120}>
            <div className="overflow-hidden rounded-card border border-line bg-ink-850 shadow-panel">
              <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
                <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-slate-400">Scenario · crane failure at berth B</span>
                <span className="rounded bg-amber-400/15 px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.08em] text-signal-amber">Simulated</span>
              </div>
              <div className="grid gap-px bg-line sm:grid-cols-2">
                {[
                  { title: "Before", tag: "Current plan", tone: "text-slate-400", rows: [["Berth queue", "2 vessels"], ["Crane capacity", "6 of 6"], ["Projected turnaround", "14.2 h"], ["Yard pressure", "68%"]] },
                  { title: "After", tag: "Crane B2 offline", tone: "text-signal-amber", rows: [["Berth queue", "3 vessels"], ["Crane capacity", "5 of 6"], ["Projected turnaround", "16.8 h"], ["Yard pressure", "76%"]] },
                ].map((column, index) => (
                  <div key={column.title} className="bg-ink-850 p-4">
                    <div className="flex items-center justify-between">
                      <span className={cn("font-mono text-[10px] uppercase tracking-[0.16em]", column.tone)}>{column.title}</span>
                      <span className="font-mono text-[8.5px] text-slate-500">{column.tag}</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {column.rows.map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between border-b border-line/60 pb-1.5">
                          <span className="text-[11px] text-slate-400">{label}</span>
                          <span className={cn("font-mono text-[11px]", index === 1 ? "text-signal-amber" : "text-slate-200")}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-line px-4 py-2.5">
                <span className="font-mono text-[8.5px] uppercase tracking-[0.08em] text-slate-500">Illustrative figures · no live data modified</span>
                <span className="inline-flex items-center gap-1.5 text-[10px] text-marine-400"><Check size={11} /> Draft only</span>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Impact() {
  const metrics = [
    { value: 14.2, decimals: 1, suffix: " h", label: "Turnaround time", note: "Simulated sample mean" },
    { value: 87, suffix: "%", label: "Resource utilisation", note: "Simulated sample" },
    { value: 2.4, decimals: 1, suffix: " h", label: "Container waiting", note: "Simulated sample" },
    { value: 10, suffix: "", label: "Operational modules", note: "Platform scope" },
  ];
  return (
    <section className="landing-section border-y border-line bg-ink-900">
      <div className="landing-wrap">
        <Reveal className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <SectionLabel>Operational impact</SectionLabel>
            <h2 className="editorial-title mt-5 text-[34px] text-slate-50 sm:text-[42px]">Measure the port, not the dashboard.</h2>
          </div>
          <span className="max-w-[30ch] text-[10.5px] leading-relaxed text-slate-500">
            Figures are taken from the deterministic demonstration dataset and are explicitly sample values — not customer results.
          </span>
        </Reveal>

        <div className="mt-10 grid gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric, index) => (
            <Reveal key={metric.label} delay={index * 70} className="h-full">
              <div className="h-full bg-ink-850 p-5">
                <div className="flex items-center justify-between">
                  <span className="micro-label">{metric.label}</span>
                  <span className="font-mono text-[7.5px] uppercase tracking-[0.1em] text-slate-700">{metric.note}</span>
                </div>
                <div className="mt-4 font-mono text-[32px] tabular-nums leading-none text-slate-50">
                  <CountUp value={metric.value} decimals={metric.decimals ?? 0} suffix={metric.suffix} />
                </div>
                <div className="mt-3 flex items-center gap-1.5 font-mono text-[8.5px] uppercase tracking-[0.1em] text-cyan-500">
                  <Activity size={10} /> Demo dataset
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  const { theme } = useLandingTheme();
  const [reduceMotion, setReduceMotion] = useState(
    () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduceMotion(preference.matches);
    const onChange = (event: MediaQueryListEvent) => setReduceMotion(event.matches);
    preference.addEventListener?.("change", onChange);
    return () => preference.removeEventListener?.("change", onChange);
  }, []);

  return (
    <section id="about" className="relative isolate overflow-hidden bg-[var(--hero-bottom-grad)] py-20 transition-colors sm:py-24 lg:py-28">
      <video
        className="pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover object-[55%_center]"
        autoPlay={!reduceMotion}
        muted
        loop={!reduceMotion}
        playsInline
        preload="none"
        poster="/images/port-night.jpg"
        aria-hidden="true"
      >
        <source src="/videos/portsync-cinematic-port.mp4" type="video/mp4" />
      </video>
      <img src="/images/port-night.jpg" alt="" aria-hidden="true" className="pointer-events-none absolute inset-0 -z-30 h-full w-full object-cover" loading="lazy" />
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(90deg,var(--hero-overlay-start)_0%,var(--hero-overlay-mid)_48%,var(--hero-overlay-end)_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-24 bg-gradient-to-b from-[var(--hero-bottom-grad)] to-transparent" />
      <div className="landing-wrap relative px-5 sm:px-8 lg:px-12">
        <Reveal className="max-w-[620px]">
          <SectionLabel tone={theme === "dark" ? "dark" : "light"}>Start synchronising</SectionLabel>
          <h2 className="editorial-title mt-5 text-[35px] text-slate-50 sm:text-[48px] lg:text-[52px]">
            Ready to build a smarter port?
          </h2>
          <p className="mt-4 max-w-[48ch] text-[13px] leading-relaxed text-slate-300 sm:text-[14px]">
            Explore the full operating workspace with a deterministic demonstration terminal, or create a read-only account in seconds.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link to="/signup" className="group inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-[12px] font-semibold text-[#102A43] shadow-panel transition-transform hover:-translate-y-0.5 sm:h-11 sm:px-5 sm:text-[13px]">
              Get started <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a href="#platform" className="inline-flex h-10 items-center rounded-full border border-line bg-ink-850/60 px-4 text-[12px] font-medium text-slate-50 backdrop-blur-md transition-colors hover:bg-ink-800 sm:h-11 sm:px-5 sm:text-[13px]">
              Explore platform
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer id="contact" className="border-t border-line bg-ink-950">
      <div className="landing-wrap px-5 py-14 sm:px-8 lg:px-12">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <div className="flex items-center gap-2.5">
              <LogoMark size={28} />
              <span className="font-display text-[14px] font-bold tracking-[0.16em] text-slate-50">PORTSYNC</span>
            </div>
            <p className="mt-4 max-w-[36ch] text-[12px] leading-relaxed text-slate-500">
              One port. Every resource. Intelligent operations. An intelligent port operations platform synchronising vessels,
              berths, equipment and cargo.
            </p>
            <div className="mt-5 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-600">
              <Radio size={11} /> Terminal 2 · INBOM-T2 · Demo environment
            </div>
          </div>

          {[
            { title: "Platform", links: [["Overview", "/app"], ["Digital twin", "/app/twin"], ["Ships & docks", "/app/ships"], ["Resource optimizer", "/app/optimizer"]] },
            { title: "Operations", links: [["Fleet & equipment", "/app/fleet"], ["Containers", "/app/containers"], ["Warehouse & dispatch", "/app/warehouse"], ["Analytics", "/app/analytics"]] },
            { title: "Access", links: [["Login", "/login"], ["Create account", "/signup"], ["Alerts & maintenance", "/app/alerts"], ["Simulation centre", "/app/simulations"]] },
          ].map((column) => (
            <div key={column.title}>
              <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-slate-600">{column.title}</div>
              <ul className="mt-3 space-y-2">
                {column.links.map(([label, href]) => (
                  <li key={label}>
                    <Link to={href} className="text-[12px] text-slate-400 transition-colors hover:text-slate-100">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col justify-between gap-3 border-t border-line pt-5 sm:flex-row sm:items-center">
          <p className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-slate-600">© {new Date().getFullYear()} PortSync · Demonstration platform</p>
          <div className="flex flex-wrap items-center gap-5 font-mono text-[9.5px] uppercase tracking-[0.1em] text-slate-600">
            <span>Privacy</span>
            <span>Terms</span>
            <span>Data is simulated and clearly labelled</span>
          </div>
        </div>
      </div>
    </footer>
  );
}

function LandingContent() {
  const { theme } = useLandingTheme();
  return (
    <div className={cn("landing-page min-h-screen bg-ink-900 transition-colors", `theme-${theme}`)}>
      <NavBar />
      <Hero />
      <Intro />
      <About />
      <Capabilities />
      <Orbit />
      <TwinShowcase />
      <Simulation />
      <FinalCta />
      <Footer />
    </div>
  );
}

export function LandingPage() {
  return (
    <ThemeProvider>
      <LandingContent />
    </ThemeProvider>
  );
}
