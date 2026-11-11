import { NavLink } from "react-router-dom";
import {
  Activity,
  BarChart3,
  BellRing,
  Boxes,
  ChevronsLeft,
  ChevronsRight,
  FlaskConical,
  LayoutDashboard,
  Map,
  Radio,
  Ship,
  Sparkles,
  Truck,
  Warehouse,
  Wifi,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/format";
import { useRealtime } from "@/lib/realtime";
import { useAlertSummary, useSystemInfo } from "@/lib/hooks";
import { LogoMark } from "./Logo";

const GROUPS = [
  {
    label: "Command",
    items: [
      { to: "/app", end: true, label: "Overview", icon: LayoutDashboard },
      { to: "/app/twin", label: "Digital Twin", icon: Map },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/app/ships", label: "Ships & Docks", icon: Ship },
      { to: "/app/optimizer", label: "Resource Optimizer", icon: Sparkles },
      { to: "/app/fleet", label: "Fleet & Equipment", icon: Truck },
      { to: "/app/containers", label: "Container Tracking", icon: Boxes },
      { to: "/app/warehouse", label: "Warehouse & Dispatch", icon: Warehouse },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { to: "/app/simulations", label: "Simulation Centre", icon: FlaskConical },
      { to: "/app/alerts", label: "Alerts & Maintenance", icon: BellRing },
      { to: "/app/analytics", label: "Analytics", icon: BarChart3 },
    ],
  },
];

function ConnectionChip({ collapsed }: { collapsed: boolean }) {
  const { status } = useRealtime();
  const config = {
    live: { label: "Live operations", dot: "bg-emerald-400", text: "text-emerald-500", Icon: Wifi },
    connecting: { label: "Connecting", dot: "bg-amber-400", text: "text-amber-500", Icon: Radio },
    offline: { label: "Polling fallback", dot: "bg-red-400", text: "text-red-500", Icon: WifiOff },
  }[status];

  if (collapsed) {
    return (
      <div className="flex justify-center py-1" title={config.label}>
        <span className={cn("status-dot", config.dot, status === "live" && "animate-pulse-dot")} />
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-line bg-ink-800/70 px-2.5 py-2">
      <div className="flex items-center gap-2">
        <span className={cn("status-dot", config.dot, status === "live" && "animate-pulse-dot")} />
        <span className={cn("font-mono text-3xs uppercase tracking-[0.1em]", config.text)}>{config.label}</span>
      </div>
      <config.Icon size={12} className="text-slate-600" />
    </div>
  );
}

export function Sidebar({
  open,
  collapsed,
  onClose,
  onToggleCollapse,
}: {
  open: boolean;
  collapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}) {
  const { data: summary } = useAlertSummary();
  const { data: info } = useSystemInfo();
  const activeAlerts = summary?.active ?? 0;

  return (
    <>
      {open ? (
        <div className="fixed inset-0 z-30 bg-ink-950/70 backdrop-blur-sm lg:hidden" onClick={onClose} aria-hidden="true" />
      ) : null}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex shrink-0 flex-col border-r border-line bg-ink-850/95 transition-all duration-200",
          collapsed ? "w-[76px]" : "w-[256px]",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className={cn("flex h-[60px] items-center border-b border-line", collapsed ? "justify-center px-2" : "justify-between px-4")}>
          <NavLink to="/app" className="flex items-center gap-2.5" onClick={onClose}>
            <LogoMark size={collapsed ? 28 : 32} />
            {!collapsed ? <span className="font-display text-[14px] font-bold tracking-[0.16em] text-slate-50">PORTSYNC</span> : null}
          </NavLink>
          {!collapsed ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="hidden rounded-md p-1.5 text-slate-500 transition-colors hover:bg-ink-800 hover:text-slate-200 lg:inline-flex"
              aria-label="Collapse sidebar"
            >
              <ChevronsLeft size={15} />
            </button>
          ) : null}
        </div>

        {!collapsed ? (
          <div className="border-b border-line px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="micro-label text-slate-500">Current port</span>
              <span className="rounded border border-cyan-400/25 bg-cyan-400/[0.07] px-1.5 py-0.5 font-mono text-3xs uppercase tracking-[0.08em] text-cyan-500">
                Simulated
              </span>
            </div>
            <div className="mt-1.5 font-display text-[13px] font-semibold text-slate-200">Mumbai Port · Terminal 2</div>
            <div className="mt-0.5 flex items-center gap-2 font-mono text-3xs uppercase tracking-[0.1em] text-slate-600">
              <span>INBOM-T2</span>
              <span className="text-slate-700">/</span>
              <span>UTC</span>
              <span className="text-slate-700">/</span>
              <span>Seed {info?.simulation.seed ?? "20261"}</span>
            </div>
          </div>
        ) : (
          <div className="border-b border-line py-2" aria-hidden="true" />
        )}

        <nav className={cn("flex-1 overflow-y-auto scroll-thin py-4", collapsed ? "px-2" : "px-3")}>
          {GROUPS.map((group) => (
            <div key={group.label} className={collapsed ? "mb-3" : "mb-5"}>
              {!collapsed ? (
                <div className="mb-1.5 px-3 font-mono text-3xs uppercase tracking-[0.16em] text-slate-600">{group.label}</div>
              ) : (
                <div className="mx-auto mb-1.5 h-px w-6 bg-line" />
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.end}
                    onClick={onClose}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        "sidebar-link",
                        collapsed && "justify-center px-0 py-2.5",
                        isActive &&
                          "bg-marine-600/[0.12] before:absolute before:left-0 before:top-1/2 before:h-5 before:w-[2px] before:-translate-y-1/2 before:rounded-full before:bg-signal-cyan",
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <item.icon size={15} className={cn("shrink-0", isActive ? "text-cyan-400" : "text-slate-500")} />
                        {!collapsed ? <span className={cn("flex-1 truncate", isActive && "text-slate-50")}>{item.label}</span> : null}
                        {!collapsed && item.to === "/app/alerts" && activeAlerts > 0 ? (
                          <span className="rounded bg-red-500/15 px-1.5 py-0.5 font-mono text-3xs tabular-nums text-red-500">{activeAlerts}</span>
                        ) : null}
                        {collapsed && item.to === "/app/alerts" && activeAlerts > 0 ? (
                          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500" />
                        ) : null}
                      </>
                    )}
                  </NavLink>
                ))}
              </div>
            </div>
          ))}
        </nav>

        <div className={cn("space-y-2 border-t border-line", collapsed ? "px-2 py-3" : "px-3 py-3")}>
          <ConnectionChip collapsed={collapsed} />
          {!collapsed ? (
            <div className="flex items-center gap-2 px-1 font-mono text-3xs uppercase tracking-[0.1em] text-slate-600">
              <Activity size={11} />
              <span>Tick {info?.simulation.tick ?? 0}</span>
              <span className="text-slate-700">·</span>
              <span>{info?.simulation.tick_seconds ?? 4}s</span>
              <span className="text-slate-700">·</span>
              <span>v{info?.version ?? "1.0.0"}</span>
            </div>
          ) : (
            <div className="text-center font-mono text-[8px] uppercase tracking-[0.08em] text-slate-600" title={`Tick ${info?.simulation.tick ?? 0}`}>
              {info?.simulation.tick ?? 0}
            </div>
          )}
          {collapsed ? (
            <button
              type="button"
              onClick={onToggleCollapse}
              className="mx-auto hidden rounded-md p-1.5 text-slate-500 transition-colors hover:bg-ink-800 hover:text-slate-200 lg:flex"
              aria-label="Expand sidebar"
            >
              <ChevronsRight size={15} />
            </button>
          ) : null}
        </div>
      </aside>
    </>
  );
}
