import { useEffect, useState } from "react";
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
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/format";
import { LogoMark } from "@/components/layout/Logo";
import { ShipScene } from "@/components/landing/ShipScene";
import { FeatureOrbit } from "@/components/landing/FeatureOrbit";
import { TrackingWidget } from "@/components/landing/TrackingWidget";
import { CountUp, Reveal, useScrollFlag } from "@/components/landing/Reveal";

const NAV = [
  { href: "#top", label: "Home" },
  { href: "#platform", label: "Platform" },
  { href: "#solutions", label: "Solutions" },
  { href: "#features", label: "Features" },
  { href: "#about", label: "About" },
  { href: "#contact", label: "Contact" },
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
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState("#top");

  useEffect(() => {
    const ids = NAV.map((item) => item.href.slice(1));
    const onScroll = () => {
      let current = "#top";
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
          <div className="mt-2 flex gap-2 border-t border-line pt-3">
            <Link to={user ? "/app" : "/login"} className="flex-1 rounded-lg border border-line px-3 py-2 text-center text-[12.5px] text-slate-200">
              {user ? "Workspace" : "Login"}
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
  return (
    <section id="top" className="relative flex min-h-[100svh] flex-col justify-center overflow-hidden bg-[#050f1a] pt-20">
      <ShipScene className="absolute inset-x-0 bottom-0 h-[66%] min-h-[340px]" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(5,15,26,0.96)_0%,rgba(5,15,26,0.72)_30%,rgba(5,15,26,0.38)_52%,rgba(5,15,26,0.08)_74%,transparent_100%)]" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-[#050f1a]/80 to-transparent" />

      <div className="landing-wrap relative z-10 grid items-center gap-12 px-5 pb-24 pt-10 sm:px-8 lg:grid-cols-[1.1fr_0.9fr] lg:px-12 lg:pb-32">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-3 py-1 backdrop-blur-md">
            <span className="status-dot bg-[#26B7D3] animate-pulse-dot" />
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-[#B6DFEE]">Smart port operations platform</span>
          </div>

          <h1 className="editorial-title mt-6 max-w-[16ch] text-[42px] text-white sm:text-[58px] lg:text-[70px]">
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

        <div className="lg:justify-self-end">
          <TrackingWidget />
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
  return (
    <section id="platform" className="landing-section border-b border-line bg-ink-900">
      <div className="landing-wrap">
        <div className="grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <Reveal>
            <SectionLabel>The connected terminal</SectionLabel>
            <h2 className="editorial-title mt-5 text-[34px] text-slate-50 sm:text-[44px]">
              One connected ecosystem.
              <span className="block text-slate-400">Complete port intelligence.</span>
            </h2>
            <p className="mt-5 max-w-[46ch] text-[14px] leading-relaxed text-slate-400">
              Berth planning, cargo discharge, yard storage and road dispatch usually live in separate systems. PortSync keeps
              them in one operational model, so every decision is made against the same state of the port.
            </p>
            <div className="mt-7 grid max-w-md grid-cols-3 gap-3">
              {[
                { value: 1, suffix: "", label: "Shared digital twin" },
                { value: 10, suffix: "", label: "Operational modules" },
                { value: 24, suffix: "/7", label: "Event ledger" },
              ].map((stat) => (
                <div key={stat.label} className="rounded-panel border border-line bg-ink-800/60 px-3 py-3">
                  <div className="font-mono text-[22px] tabular-nums text-slate-50">
                    <CountUp value={stat.value} suffix={stat.suffix} />
                  </div>
                  <div className="mt-1 text-[10.5px] leading-snug text-slate-500">{stat.label}</div>
                </div>
              ))}
            </div>
          </Reveal>

          <Reveal delay={120} className="relative">
            <div className="overflow-hidden rounded-card border border-line shadow-lift">
              <img
                src="/images/port-approach.jpg"
                alt="A container vessel approaching a terminal at blue hour"
                className="h-[300px] w-full object-cover transition-transform duration-[1.6s] ease-out hover:scale-[1.03] sm:h-[400px]"
                loading="lazy"
              />
            </div>
            <div className="absolute -bottom-6 left-6 right-6 rounded-panel border border-line bg-ink-850/95 px-4 py-3 shadow-float backdrop-blur sm:left-10 sm:right-auto sm:w-[300px]">
              <div className="flex items-center justify-between">
                <span className="micro-label">Vessel synchronised</span>
                <span className="status-dot bg-signal-green animate-pulse-dot" />
              </div>
              <div className="mt-1.5 flex items-baseline justify-between">
                <span className="font-mono text-[13px] text-slate-100">SH-104 · MV Konkan Star</span>
                <span className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-cyan-400">Approach</span>
              </div>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-ink-600">
                <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-[#2477B8] to-[#26B7D3]" />
              </div>
              <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.12em] text-slate-600">Demo data · deterministic simulator</p>
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
    <section aria-label="Platform themes" className="overflow-hidden border-y border-white/10 bg-[#071827] py-5">
      <div className="marquee-track items-center gap-8">
        {[...items, ...items, ...items, ...items].map((item, index) => (
          <div key={`${item}-${index}`} className="flex shrink-0 items-center gap-8">
            <span className="font-display text-[13px] font-medium uppercase tracking-[0.24em] text-[#B6DFEE]/80">{item}</span>
            <span className="h-1 w-1 rounded-full bg-[#26B7D3]/70" />
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
      copy: "A vessel, a berth, a crane and a truck are never separate facts. The twin shows how they constrain each other in real time.",
    },
    {
      title: "Intelligent resource coordination",
      copy: "Hard constraints gate every allocation. Weighted scoring then ranks the feasible package and explains the result.",
    },
    {
      title: "Faster operational decisions",
      copy: "Simulation, alerting and a full audit trail shorten the distance between a disruption and a deliberate response.",
    },
  ];
  return (
    <section id="solutions" className="landing-section bg-ink-900">
      <div className="landing-wrap">
        <Reveal className="max-w-2xl">
          <SectionLabel>Why PortSync</SectionLabel>
          <h2 className="editorial-title mt-5 text-[34px] text-slate-50 sm:text-[44px]">Built around how a terminal actually works.</h2>
        </Reveal>

        <div className="mt-12 grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
          <div className="space-y-1">
            {pillars.map((pillar, index) => (
              <Reveal key={pillar.title} delay={index * 90}>
                <div className="group flex gap-5 border-t border-line py-6 transition-colors hover:bg-ink-800/40">
                  <span className="mt-1 font-mono text-[11px] text-marine-500">0{index + 1}</span>
                  <div>
                    <h3 className="font-display text-[18px] font-medium text-slate-100 transition-colors group-hover:text-cyan-400">{pillar.title}</h3>
                    <p className="mt-2 max-w-[48ch] text-[13px] leading-relaxed text-slate-400">{pillar.copy}</p>
                  </div>
                </div>
              </Reveal>
            ))}
            <Reveal delay={280}>
              <div className="border-t border-line pt-6">
                <Link to="/login" className="group inline-flex items-center gap-2 text-[13px] font-medium text-marine-400">
                  See it in the workspace
                  <ArrowRight size={14} className="transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </Reveal>
          </div>

          <Reveal delay={120}>
            <div className="relative overflow-hidden rounded-card border border-line">
              <img
                src="/images/port-terminal.jpg"
                alt="Aerial view of an organised container terminal"
                className="h-[420px] w-full object-cover"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#071827]/85 via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-5">
                <div className="flex flex-wrap gap-2">
                  {["Berths", "Cranes", "Trucks", "Yard", "Warehouse", "Dispatch"].map((chip) => (
                    <span key={chip} className="rounded-full border border-white/20 bg-white/10 px-2.5 py-1 font-mono text-[9px] uppercase tracking-[0.1em] text-white/85 backdrop-blur">
                      {chip}
                    </span>
                  ))}
                </div>
                <p className="mt-3 max-w-[42ch] text-[12px] leading-relaxed text-[#C5D9E6]">
                  Every resource that touches a container is represented in the same operating picture.
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

function Capabilities() {
  const spans = [
    "lg:col-span-2 lg:row-span-2",
    "",
    "",
    "lg:col-span-2",
    "",
    "",
    "",
    "lg:col-span-2",
    "",
    "",
  ];
  return (
    <section id="features" className="landing-section relative bg-ink-850">
      <div className="landing-wrap">
        <Reveal className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div className="max-w-xl">
            <SectionLabel>Core capabilities</SectionLabel>
            <h2 className="editorial-title mt-5 text-[34px] text-slate-50 sm:text-[44px]">
              Ten modules. One operating picture.
            </h2>
          </div>
          <p className="max-w-[34ch] text-[13px] leading-relaxed text-slate-500">
            Each capability shares the same vessels, berths, equipment, containers and audit trail.
          </p>
        </Reveal>

        <div className="mt-12 grid auto-rows-[minmax(150px,auto)] gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature, index) => (
            <Reveal key={feature.title} delay={(index % 3) * 70} className={cn("h-full", spans[index])}>
              <div
                className={cn(
                  "group relative flex h-full flex-col justify-between overflow-hidden rounded-card border border-line bg-ink-800/70 p-5 transition-all duration-300 hover:-translate-y-1 hover:border-marine-500/40 hover:bg-ink-800",
                  index === 0 && "sm:p-7",
                )}
              >
                <div className="flex items-start justify-between">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-ink-900 text-marine-400 transition-colors group-hover:border-cyan-400/40 group-hover:text-cyan-400">
                    <feature.icon size={16} />
                  </span>
                  <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-slate-700">0{index + 1}</span>
                </div>
                <div className="mt-6">
                  <h3 className={cn("font-display font-medium text-slate-100", index === 0 ? "text-[21px]" : "text-[15px]")}>{feature.title}</h3>
                  <p className={cn("mt-2 leading-relaxed text-slate-400", index === 0 ? "max-w-[36ch] text-[13px]" : "text-[12px]")}>{feature.copy}</p>
                </div>
                <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-marine-500/0 blur-2xl transition-colors duration-500 group-hover:bg-marine-500/10" />
              </div>
            </Reveal>
          ))}
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
  return (
    <section className="relative overflow-hidden bg-[#061523] py-24 lg:py-32">
      <div className="absolute inset-0 opacity-[0.16]" style={{ backgroundImage: "radial-gradient(#7FC4DF 0.7px, transparent 0.7px)", backgroundSize: "26px 26px" }} />
      <div className="landing-wrap relative px-5 sm:px-8 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
          <Reveal>
            <SectionLabel tone="dark">Digital twin</SectionLabel>
            <h2 className="editorial-title mt-5 text-[34px] text-white sm:text-[46px]">
              See your port.
              <span className="block text-[#9FD3E8]">Before it happens.</span>
            </h2>
            <p className="mt-5 max-w-[44ch] text-[13.5px] leading-relaxed text-[#A9C6D8]">
              A live spatial model of berths, cranes, vehicles and the container yard. Watch an arrival propagate through the
              terminal before a single truck is dispatched.
            </p>
            <div className="mt-7 flex flex-wrap gap-2">
              {[
                { dot: "bg-[#34D399]", label: "Available" },
                { dot: "bg-[#26B7D3]", label: "In operation" },
                { dot: "bg-[#F59E0B]", label: "Attention" },
                { dot: "bg-[#EF4444]", label: "Fault" },
              ].map((item) => (
                <span key={item.label} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-[#BBD5E4]">
                  <span className={cn("h-1.5 w-1.5 rounded-full", item.dot)} /> {item.label}
                </span>
              ))}
            </div>
            <p className="mt-6 font-mono text-[9px] uppercase tracking-[0.14em] text-[#5E7F94]">Demonstration preview · sample terminal state</p>
          </Reveal>

          <Reveal delay={120}>
            <div className="overflow-hidden rounded-card border border-white/12 bg-[#081B2B]/90 shadow-[0_50px_120px_-50px_rgba(0,0,0,0.9)]">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Map size={12} className="text-[#7FC4DF]" />
                  <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#9DB9CA]">Terminal 2 · twin preview</span>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#26B7D3]/10 px-2 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.1em] text-[#7FC4DF]">
                  <span className="h-1 w-1 rounded-full bg-[#26B7D3] animate-pulse-dot" /> Demo
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

                <div className="border-t border-white/10 p-3 lg:border-l lg:border-t-0">
                  <div className="micro-label text-[#6E93A8]">Berth occupancy</div>
                  <div className="mt-3 space-y-2.5">
                    {[
                      { label: "A · SH-104", value: 86, tone: "#26B7D3" },
                      { label: "B · SH-098", value: 64, tone: "#3979E8" },
                      { label: "C · free", value: 0, tone: "#34D399" },
                    ].map((row) => (
                      <div key={row.label}>
                        <div className="flex justify-between font-mono text-[8.5px] uppercase tracking-[0.06em] text-[#8FAFC2]">
                          <span>{row.label}</span>
                          <span>{row.value}%</span>
                        </div>
                        <div className="mt-1 h-1 rounded-full bg-white/10">
                          <div className="h-full rounded-full transition-all" style={{ width: `${row.value}%`, background: row.tone }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 border-t border-white/10 pt-3">
                    <div className="font-mono text-[8.5px] uppercase tracking-[0.1em] text-[#6E93A8]">Resources</div>
                    <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                      {[
                        { label: "Cranes", value: "4/6" },
                        { label: "Trucks", value: "7/9" },
                        { label: "Drivers", value: "6" },
                        { label: "Boxes", value: "42" },
                      ].map((row) => (
                        <div key={row.label} className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-1">
                          <div className="font-mono text-[7.5px] uppercase tracking-[0.06em] text-[#5E8298]">{row.label}</div>
                          <div className="font-mono text-[11px] text-[#D3E6F0]">{row.value}</div>
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
          <div className="absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-transparent via-marine-500/40 to-transparent lg:block" />
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
  return (
    <section className="landing-section bg-[#071827]">
      <div className="landing-wrap">
        <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <Reveal>
            <SectionLabel tone="dark">What-if simulation</SectionLabel>
            <h2 className="editorial-title mt-5 text-[34px] text-white sm:text-[44px]">
              Prepare for disruptions
              <span className="block text-[#9FD3E8]">before they happen.</span>
            </h2>
            <p className="mt-5 max-w-[46ch] text-[13.5px] leading-relaxed text-[#A9C6D8]">
              Take a crane out of service, spike inbound demand or slow a vessel. The simulator projects the consequences
              without touching the operational database — nothing is applied until you explicitly approve it.
            </p>
            <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-[#F59E0B]/25 bg-[#F59E0B]/10 px-3 py-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[#F5C97A]">
              <FlaskConical size={11} /> Scenario sandbox · isolated from live state
            </p>
          </Reveal>

          <Reveal delay={120}>
            <div className="overflow-hidden rounded-card border border-white/12 bg-[#0A1F30]">
              <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
                <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-[#9DB9CA]">Scenario · crane failure at berth B</span>
                <span className="rounded bg-[#F59E0B]/15 px-1.5 py-0.5 font-mono text-[8.5px] uppercase tracking-[0.08em] text-[#F5C97A]">Simulated</span>
              </div>
              <div className="grid gap-px bg-white/10 sm:grid-cols-2">
                {[
                  { title: "Before", tag: "Current plan", tone: "text-[#8FAFC2]", rows: [["Berth queue", "2 vessels"], ["Crane capacity", "6 of 6"], ["Projected turnaround", "14.2 h"], ["Yard pressure", "68%"]] },
                  { title: "After", tag: "Crane B2 offline", tone: "text-[#F5C97A]", rows: [["Berth queue", "3 vessels"], ["Crane capacity", "5 of 6"], ["Projected turnaround", "16.8 h"], ["Yard pressure", "76%"]] },
                ].map((column, index) => (
                  <div key={column.title} className="bg-[#0A1F30] p-4">
                    <div className="flex items-center justify-between">
                      <span className={cn("font-mono text-[10px] uppercase tracking-[0.16em]", column.tone)}>{column.title}</span>
                      <span className="font-mono text-[8.5px] text-[#5E7F94]">{column.tag}</span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {column.rows.map(([label, value]) => (
                        <div key={label} className="flex items-center justify-between border-b border-white/[0.06] pb-1.5">
                          <span className="text-[11px] text-[#7FA0B4]">{label}</span>
                          <span className={cn("font-mono text-[11px]", index === 1 ? "text-[#F5C97A]" : "text-[#D3E6F0]")}>{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between border-t border-white/10 px-4 py-2.5">
                <span className="font-mono text-[8.5px] uppercase tracking-[0.08em] text-[#5E7F94]">Illustrative figures · no live data modified</span>
                <span className="inline-flex items-center gap-1.5 text-[10px] text-[#7FC4DF]"><Check size={11} /> Draft only</span>
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
  return (
    <section id="about" className="relative overflow-hidden bg-[#061523] py-24 lg:py-32">
      <img src="/images/port-night.jpg" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full object-cover opacity-45" loading="lazy" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#061523] via-[#061523]/80 to-[#061523]/40" />
      <div className="landing-wrap relative px-5 sm:px-8 lg:px-12">
        <Reveal className="max-w-2xl">
          <SectionLabel tone="dark">Start synchronising</SectionLabel>
          <h2 className="editorial-title mt-5 text-[36px] text-white sm:text-[52px]">Ready to build a smarter port?</h2>
          <p className="mt-4 max-w-[48ch] text-[14px] leading-relaxed text-[#BBD5E4]">
            Explore the full operating workspace with the deterministic demonstration terminal, or create a read-only account
            in seconds.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/signup" className="group inline-flex h-11 items-center gap-2 rounded-full bg-white px-5 text-[13px] font-semibold text-[#102A43] transition-transform hover:-translate-y-0.5">
              Get started <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a href="#platform" className="inline-flex h-11 items-center rounded-full border border-white/25 bg-white/[0.05] px-5 text-[13px] font-medium text-white backdrop-blur-md hover:bg-white/10">
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

export function LandingPage() {
  return (
    <div className="min-h-screen bg-ink-900">
      <NavBar />
      <Hero />
      <Intro />
      <Marquee />
      <About />
      <Capabilities />
      <Orbit />
      <TwinShowcase />
      <Allocation />
      <Simulation />
      <Impact />
      <FinalCta />
      <Footer />
    </div>
  );
}
