import { useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Bell, Boxes, ChevronDown, LogOut, Menu, RefreshCw, Search, ShieldCheck, Ship, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAlertSummary, useAlerts, useSystemInfo } from "@/lib/hooks";
import { useClock, utcClock } from "@/lib/use-clock";
import { useRealtime } from "@/lib/realtime";
import { useAuth } from "@/lib/auth";
import { cn, fmtAgo } from "@/lib/format";
import { SEVERITY_STYLE } from "@/lib/status";
import { Badge, Button } from "@/components/ui/primitives";
import { DropdownContent, DropdownItem, DropdownLabel, DropdownMenu, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";

const PAGE_TITLES: Record<string, { section: string; title: string }> = {
  "/app": { section: "Command", title: "Port overview" },
  "/app/twin": { section: "Command", title: "Digital twin" },
  "/app/ships": { section: "Operations", title: "Ships & docks" },
  "/app/optimizer": { section: "Operations", title: "Resource optimizer" },
  "/app/fleet": { section: "Operations", title: "Fleet & equipment" },
  "/app/containers": { section: "Operations", title: "Container tracking" },
  "/app/warehouse": { section: "Operations", title: "Warehouse & dispatch" },
  "/app/simulations": { section: "Intelligence", title: "Simulation centre" },
  "/app/alerts": { section: "Intelligence", title: "Alerts & maintenance" },
  "/app/analytics": { section: "Intelligence", title: "Operational analytics" },
};

function GlobalSearch() {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const trimmed = term.trim();

  const ships = useQuery({
    queryKey: ["global-search", "ships", trimmed],
    queryFn: () => api.ships.list({ q: trimmed, page_size: 4 }),
    enabled: trimmed.length >= 2,
  });
  const containers = useQuery({
    queryKey: ["global-search", "containers", trimmed],
    queryFn: () => api.containers.list({ q: trimmed, page_size: 4 }),
    enabled: trimmed.length >= 2,
  });

  const go = (path: string) => {
    setOpen(false);
    setTerm("");
    navigate(path);
  };

  return (
    <div ref={boxRef} className="relative hidden md:block">
      <div className="relative">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          value={term}
          onChange={(event) => {
            setTerm(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 140)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && trimmed) go(`/app/ships?q=${encodeURIComponent(trimmed)}`);
            if (event.key === "Escape") setOpen(false);
          }}
          placeholder="Search vessels or containers"
          aria-label="Global search"
          className="h-8 w-52 rounded-lg border border-line bg-ink-800/70 pl-8 pr-2 text-[11.5px] text-slate-200 placeholder:text-slate-600 transition-all focus:w-64 focus:border-marine-500 focus:outline-none focus:ring-2 focus:ring-marine-500/15"
        />
      </div>
      {open && trimmed.length >= 2 ? (
        <div className="absolute right-0 top-10 z-50 w-[320px] overflow-hidden rounded-panel border border-line bg-ink-850 shadow-float">
          <div className="flex items-center justify-between border-b border-line px-3 py-1.5">
            <span className="micro-label">Search results</span>
            <span className="font-mono text-[8.5px] uppercase tracking-[0.08em] text-slate-600">Demo terminal</span>
          </div>
          {ships.isLoading || containers.isLoading ? (
            <div className="px-3 py-3 text-[11px] text-slate-500">Searching…</div>
          ) : (
            <>
              {(ships.data?.items ?? []).map((ship) => (
                <button key={ship.code} type="button" onMouseDown={() => go(`/app/ships?q=${encodeURIComponent(ship.code)}`)} className="flex w-full items-center gap-2.5 border-b border-line/60 px-3 py-2 text-left hover:bg-ink-800">
                  <Ship size={13} className="text-slate-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[11px] text-slate-200">{ship.code} · {ship.name}</span>
                    <span className="block font-mono text-[9px] uppercase tracking-[0.08em] text-slate-600">{ship.status} · {ship.dock_code ?? "no berth"}</span>
                  </span>
                </button>
              ))}
              {(containers.data?.items ?? []).map((container) => (
                <button key={container.code} type="button" onMouseDown={() => go(`/app/containers?q=${encodeURIComponent(container.code)}`)} className="flex w-full items-center gap-2.5 border-b border-line/60 px-3 py-2 text-left hover:bg-ink-800">
                  <Boxes size={13} className="text-slate-500" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-mono text-[11px] text-slate-200">{container.code}</span>
                    <span className="block font-mono text-[9px] uppercase tracking-[0.08em] text-slate-600">{container.status} · {container.location}</span>
                  </span>
                </button>
              ))}
              {!ships.data?.items.length && !containers.data?.items.length ? (
                <div className="px-3 py-4 text-center text-[11px] text-slate-500">No matching vessels or containers</div>
              ) : null}
            </>
          )}
          <button type="button" onMouseDown={() => go(`/app/ships?q=${encodeURIComponent(trimmed)}`)} className="flex w-full items-center justify-between px-3 py-2 text-[10.5px] text-slate-500 hover:bg-ink-800 hover:text-slate-300">
            Open full vessel search <span className="kbd">↵</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const now = useClock();
  const clock = utcClock(now);
  const { status } = useRealtime();
  const { user, readOnly, logout } = useAuth();
  const { data: summary } = useAlertSummary();
  const { data: alerts } = useAlerts({ status: "active", page_size: 6 });
  const { data: info } = useSystemInfo();
  const queryClient = useQueryClient();
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const page = PAGE_TITLES[location.pathname] ?? { section: "PortSync", title: "Operations" };
  const activeAlerts = summary?.active ?? 0;
  const initials = (user?.name ?? "Port Operator")
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const resetDemo = async () => {
    setResetting(true);
    try {
      const result = await api.system.resetDemo();
      await queryClient.invalidateQueries();
      toast.success(result.message, { description: `Deterministic seed ${result.seed} restored.` });
      setResetOpen(false);
    } catch (error) {
      toast.error("Reset failed", { description: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setResetting(false);
    }
  };

  const signOut = async () => {
    setSigningOut(true);
    try {
      await logout();
      toast.success("Signed out", { description: "Your server session was revoked." });
      navigate("/login", { replace: true });
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <header className="sticky top-0 z-20 flex h-[60px] items-center justify-between gap-3 border-b border-line bg-ink-900/85 px-4 backdrop-blur-md lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <button
          type="button"
          onClick={onMenu}
          className="rounded-md p-1.5 text-slate-400 hover:bg-ink-800 hover:text-slate-100 lg:hidden"
          aria-label="Open navigation"
        >
          <Menu size={18} />
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 font-mono text-3xs uppercase tracking-[0.14em] text-slate-600">
            <span>{page.section}</span>
            <span className="text-slate-700">/</span>
            <span className="text-slate-500">Terminal 2</span>
          </div>
          <h1 className="truncate font-display text-[15px] font-semibold tracking-tight text-slate-100">{page.title}</h1>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2.5">
        <GlobalSearch />

        <div className="hidden items-center gap-2 rounded-lg border border-line bg-ink-900/60 px-2.5 py-1.5 lg:flex">
          <span className={cn("status-dot", status === "live" ? "bg-emerald-400 animate-pulse-dot" : status === "offline" ? "bg-red-400" : "bg-amber-400")} />
          <span className="font-mono text-3xs uppercase tracking-[0.1em] text-slate-400">
            {status === "live" ? "Live" : status === "offline" ? "Polling" : "Linking"}
          </span>
          <span className="h-3 w-px bg-line-strong" />
          <span className="font-mono text-2xs tabular-nums text-slate-300">{clock.time}</span>
          <span className="font-mono text-3xs uppercase text-slate-600">UTC</span>
        </div>

        <DropdownMenu>
          <DropdownTrigger asChild>
            <button
              type="button"
              className="relative rounded-lg border border-line bg-ink-900/60 p-2 text-slate-400 transition-colors hover:text-slate-100"
              aria-label="Notifications"
            >
              <Bell size={15} />
              {activeAlerts > 0 ? (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 font-mono text-[9px] font-semibold text-white">
                  {activeAlerts > 99 ? "99" : activeAlerts}
                </span>
              ) : null}
            </button>
          </DropdownTrigger>
          <DropdownContent className="w-[340px] p-0">
            <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
              <span className="micro-label text-slate-400">Active alerts</span>
              <Badge className="border-red-500/25 bg-red-500/10 text-red-300">{activeAlerts} open</Badge>
            </div>
            <div className="max-h-[320px] overflow-y-auto scroll-thin">
              {(alerts?.items ?? []).length === 0 ? (
                <div className="px-3 py-6 text-center text-xs text-slate-500">No active alerts</div>
              ) : (
                (alerts?.items ?? []).map((alert) => {
                  const tone = SEVERITY_STYLE[alert.severity] ?? SEVERITY_STYLE.info;
                  return (
                    <button
                      key={alert.id}
                      type="button"
                      onClick={() => navigate("/app/alerts")}
                      className="flex w-full items-start gap-2.5 border-b border-line/60 px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-ink-800"
                    >
                      <span className={cn("mt-1.5 status-dot", tone.dot)} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-slate-200">{alert.title}</span>
                        <span className="mt-0.5 block truncate text-[11px] text-slate-500">{alert.entity_code ?? alert.category}</span>
                      </span>
                      <span className="shrink-0 font-mono text-3xs text-slate-600">{fmtAgo(alert.created_at)}</span>
                    </button>
                  );
                })
              )}
            </div>
            <div className="border-t border-line p-1">
              <DropdownItem onSelect={() => navigate("/app/alerts")}>Open alert centre</DropdownItem>
            </div>
          </DropdownContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownTrigger asChild>
            <button type="button" className="flex items-center gap-2 rounded-lg border border-line bg-ink-900/60 py-1 pl-1 pr-2 text-left transition-colors hover:border-line-strong">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-marine-600/15 font-mono text-[10px] font-semibold text-marine-400">
                {initials}
              </span>
              <span className="hidden leading-tight sm:block">
                <span className="block text-[11.5px] font-medium text-slate-200">{user?.name ?? info?.current_user?.name ?? "Operator"}</span>
                <span className="block font-mono text-3xs uppercase tracking-[0.08em] text-slate-500">
                  {readOnly ? "Read-only viewer" : user?.role ?? "supervisor"}
                </span>
              </span>
              <ChevronDown size={12} className="text-slate-500" />
            </button>
          </DropdownTrigger>
          <DropdownContent>
            <DropdownLabel>Signed-in session</DropdownLabel>
            <div className="px-2.5 pb-2">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <UserRound size={13} className="text-slate-500" />
                {user?.email ?? info?.current_user?.email ?? "—"}
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-500">
                <ShieldCheck size={12} />
                {readOnly ? "Read-only viewer · server enforced" : "Operator access · audited"}
              </div>
            </div>
            <DropdownSeparator />
            <DropdownItem onSelect={() => navigate("/app/analytics")}>Open analytics</DropdownItem>
            {!readOnly ? (
              <DropdownItem onSelect={() => setResetOpen(true)} danger>
                <RefreshCw size={13} />
                Reset demo dataset
              </DropdownItem>
            ) : null}
            <DropdownSeparator />
            <DropdownItem onSelect={() => void signOut()} danger disabled={signingOut}>
              <LogOut size={13} />
              {signingOut ? "Signing out…" : "Sign out"}
            </DropdownItem>
          </DropdownContent>
        </DropdownMenu>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent
          size="sm"
          title="Reset the demo dataset?"
          description="This is a destructive operator action. It deletes every vessel, container, dispatch, alert and audit record, then reseeds the deterministic demo snapshot."
        >
          <div className="space-y-3 text-[12.5px] leading-relaxed text-slate-400">
            <p>
              The reset is backed by seed <span className="font-mono text-slate-200">{info?.simulation.seed ?? 20261}</span>, so
              every metric returns to the same reproducible baseline.
            </p>
            <p className="rounded border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-amber-300">
              Any allocation, dispatch or simulation you applied during this session will be lost. User accounts and sessions are
              preserved.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={resetting} onClick={resetDemo}>
              Reset and reseed
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </header>
  );
}
