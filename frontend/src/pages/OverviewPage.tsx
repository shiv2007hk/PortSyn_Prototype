import { useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  Anchor,
  ArrowUpRight,
  Boxes,
  ChevronRight,
  Container as ContainerIcon,
  Gauge,
  Layers,
  Settings2,
  Ship,
  Truck,
  UserRound,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useDashboard, queryClient, keys } from "@/lib/hooks";
import { cn, fmtAgo, fmtDay, fmtNumber, fmtTime } from "@/lib/format";
import { CHART_COLORS, DOCK_STATUS_STYLE, SEVERITY_STYLE, SHIP_STATUS_STYLE } from "@/lib/status";
import { Badge, Button, EmptyState, InlineNote, Panel, PanelHeader, Skeleton } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { KpiTile, PageIntro, ScoreRing } from "@/components/common/Bits";
import { ChartLegend, ChartTooltip } from "@/components/charts/ChartBits";
import type { HealthComponent } from "@/lib/types";

const KPI_ICONS: Record<string, ReactNode> = {
  ships_total: <Ship size={14} />,
  ships_arriving: <Anchor size={14} />,
  ships_active: <Activity size={14} />,
  available_docks: <Anchor size={14} />,
  dock_occupancy: <Gauge size={14} />,
  active_cranes: <Layers size={14} />,
  available_trucks: <Truck size={14} />,
  available_drivers: <UserRound size={14} />,
  containers_in_queue: <Boxes size={14} />,
  warehouse_occupancy: <WarehouseIcon size={14} />,
};

const KPI_TONES: Record<string, "default" | "cyan" | "amber" | "red" | "green"> = {
  dock_occupancy: "cyan",
  containers_in_queue: "amber",
  warehouse_occupancy: "red",
  available_docks: "green",
};

function HealthWeightsDialog({
  open,
  onOpenChange,
  components,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  components: HealthComponent[];
}) {
  const [values, setValues] = useState<Record<string, number>>(() =>
    Object.fromEntries(components.map((component) => [component.key, Math.round(component.weight * 100)])),
  );

  const total = Object.values(values).reduce((sum, value) => sum + value, 0);

  const mutation = useMutation({
    mutationFn: () => api.system.updateHealthWeights(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value / 100]))),
    onSuccess: (result) => {
      toast.success("Health formula updated", { description: result.note });
      queryClient.invalidateQueries({ queryKey: keys.dashboard });
      queryClient.invalidateQueries({ queryKey: keys.analytics(7, "day") });
      queryClient.invalidateQueries({ queryKey: keys.settings });
      onOpenChange(false);
    },
    onError: (error) => toast.error("Could not update weights", { description: error.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        size="sm"
        title="Port health formula"
        description="Every component is scored 0–100. Weights are normalised to sum to 100% before the backend persists them."
      >
        <div className="space-y-3">
          {components.map((component) => (
            <div key={component.key}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[12px] text-slate-300">{component.label}</span>
                <span className="font-mono text-2xs tabular-nums text-slate-400">{values[component.key] ?? 0}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={60}
                step={1}
                value={values[component.key] ?? 0}
                onChange={(event) => setValues((current) => ({ ...current, [component.key]: Number(event.target.value) }))}
                className="h-1 w-full cursor-pointer appearance-none rounded-full bg-ink-600 accent-cyan-400"
              />
              <div className="mt-1 flex items-center justify-between font-mono text-3xs uppercase tracking-[0.08em] text-slate-600">
                <span>Score {component.value}/100</span>
                <span>Contributes {component.contribution.toFixed(1)} pts</span>
              </div>
            </div>
          ))}
        </div>
        <InlineNote tone={Math.abs(total - 100) > 2 ? "warning" : "info"}>
          Raw total {total}% — the backend normalises the weights and recalibrates the score immediately.
        </InlineNote>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" loading={mutation.isPending} onClick={() => mutation.mutate()}>
            Save formula
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OverviewPage() {
  const { data, isLoading, isError, error, refetch } = useDashboard();
  const [weightsOpen, setWeightsOpen] = useState(false);

  const chartData = useMemo(() => data?.charts.arrivals_7d ?? [], [data]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <Skeleton key={index} className="h-[92px]" />
          ))}
        </div>
        <div className="grid gap-3 xl:grid-cols-12">
          <Skeleton className="h-[360px] xl:col-span-8" />
          <Skeleton className="h-[360px] xl:col-span-4" />
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-4">
        <PageIntro
          eyebrow="Command centre"
          title="Terminal overview"
          description="The operations API did not answer. PortSync falls back to polling, but this view needs a first successful load."
        />
        <InlineNote tone="critical">
          {error instanceof Error ? error.message : "Unknown API error"} — ensure the backend is running on port 8010.
        </InlineNote>
        <Button variant="primary" onClick={() => refetch()}>
          Retry connection
        </Button>
      </div>
    );
  }

  const health = data.health;
  const utilization = data.charts.utilization;
  const pendingDispatches = data.charts.pending_dispatches;
  const warehouses = data.charts.warehouses;

  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow="Command centre · live"
        title="One port. Every resource. One operational picture."
        description="Ten live KPIs, a transparent port health score and the event stream that ties vessels, berths, cranes, trucks, containers, storage and dispatch together."
        meta={
          <>
            <Badge className="border-cyan-400/25 bg-cyan-400/[0.07] text-cyan-300">Synthetic simulator</Badge>
            <span className="font-mono text-3xs uppercase tracking-[0.08em] text-slate-600">
              Snapshot {fmtTime(data.generated_at, true)} UTC
            </span>
            <span className="font-mono text-3xs uppercase tracking-[0.08em] text-slate-600">Health {health.score}/100</span>
          </>
        }
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={() => refetch()}>
              Refresh
            </Button>
            <Link to="/app/twin">
              <Button variant="secondary" size="sm">
                <Anchor size={13} /> Open digital twin
              </Button>
            </Link>
            <Link to="/app/optimizer">
              <Button variant="primary" size="sm">
                <Gauge size={13} /> Allocate resources
              </Button>
            </Link>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">
        {data.kpis.map((kpi) => (
          <KpiTile
            key={kpi.key}
            label={kpi.label}
            value={fmtNumber(kpi.value)}
            unit={kpi.unit}
            hint={kpi.hint}
            icon={KPI_ICONS[kpi.key]}
            tone={KPI_TONES[kpi.key]}
          />
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <div className="space-y-3 xl:col-span-8">
          <div className="grid gap-3 lg:grid-cols-12">
            <Panel className="lg:col-span-5">
              <PanelHeader
                title="Port health"
                description="Weighted composite of congestion, availability, equipment, backlog and dispatch."
                icon={<Gauge size={15} />}
                action={
                  <Button variant="ghost" size="icon" onClick={() => setWeightsOpen(true)} aria-label="Configure health weights">
                    <Settings2 size={14} />
                  </Button>
                }
              />
              <div className="flex flex-col items-center gap-4 px-4 py-4 sm:flex-row">
                <ScoreRing score={health.score} grade={health.grade} />
                <div className="w-full flex-1 space-y-2.5">
                  {health.components.map((component) => (
                    <div key={component.key}>
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">{component.label}</span>
                        <span className="font-mono tabular-nums text-slate-300">
                          {component.value.toFixed(1)}
                          <span className="ml-1 text-slate-600">×{(component.weight * 100).toFixed(0)}%</span>
                        </span>
                      </div>
                      <div className="mt-1 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            component.value >= 80 ? "bg-emerald-400" : component.value >= 60 ? "bg-cyan-400" : component.value >= 45 ? "bg-amber-400" : "bg-red-400",
                          )}
                          style={{ width: `${Math.max(2, Math.min(100, component.value))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="pt-1 font-mono text-3xs uppercase tracking-[0.06em] text-slate-600">
                    Σ component × weight · configurable
                  </div>
                </div>
              </div>
            </Panel>

            <Panel className="lg:col-span-7">
              <PanelHeader
                title="Arrival, throughput & dispatch"
                description="Seven-day operational pulse from the live event ledger."
                icon={<Activity size={15} />}
                action={<ChartLegend items={[{ label: "Arrivals", color: CHART_COLORS.cyan }, { label: "Throughput", color: CHART_COLORS.blue }, { label: "Dispatches", color: CHART_COLORS.violet }]} />}
              />
              <div className="h-[214px] px-2 pb-3 pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 4, right: 12, left: -14, bottom: 0 }}>
                    <defs>
                      <linearGradient id="arrivalsFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_COLORS.cyan} stopOpacity={0.22} />
                        <stop offset="100%" stopColor={CHART_COLORS.cyan} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="throughputFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CHART_COLORS.blue} stopOpacity={0.16} />
                        <stop offset="100%" stopColor={CHART_COLORS.blue} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
                    <XAxis dataKey="date" tickFormatter={fmtDay} tickLine={false} axisLine={false} dy={6} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={34} />
                    <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(148,163,184,0.25)" }} />
                    <Area type="monotone" dataKey="arrivals" name="Arrivals" stroke={CHART_COLORS.cyan} strokeWidth={1.8} fill="url(#arrivalsFill)" />
                    <Area type="monotone" dataKey="throughput" name="Throughput" stroke={CHART_COLORS.blue} strokeWidth={1.8} fill="url(#throughputFill)" />
                    <Area type="monotone" dataKey="dispatches" name="Dispatches" stroke={CHART_COLORS.violet} strokeWidth={1.4} fill="transparent" strokeDasharray="4 4" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Panel>
          </div>

          <Panel>
            <PanelHeader
              title="Operational activity"
              description="Live ledger of vessel, resource, container and dispatch events."
              icon={<Activity size={15} />}
              action={
                <Link to="/app/analytics" className="flex items-center gap-1 font-mono text-3xs uppercase tracking-[0.08em] text-slate-500 hover:text-slate-300">
                  Full history <ChevronRight size={12} />
                </Link>
              }
            />
            <div className="divide-y divide-line/60">
              {data.activity.map((event) => {
                const tone = SEVERITY_STYLE[event.severity] ?? SEVERITY_STYLE.info;
                return (
                  <div key={event.id} className="flex items-start gap-3 px-4 py-2.5">
                    <span className="mt-1.5 flex w-14 shrink-0 items-center gap-1.5">
                      <span className={cn("status-dot", tone.dot)} />
                      <span className="font-mono text-3xs tabular-nums text-slate-600">{fmtTime(event.ts)}</span>
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[12.5px] font-medium text-slate-200">{event.title}</span>
                        {event.entity_code ? (
                          <span className="shrink-0 rounded border border-line bg-white/[0.03] px-1 py-px font-mono text-3xs text-slate-500">
                            {event.entity_code}
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-0.5 truncate text-[11px] text-slate-500">{event.message}</p>
                    </div>
                    <span className="shrink-0 font-mono text-3xs uppercase tracking-[0.06em] text-slate-700">{fmtAgo(event.ts)}</span>
                  </div>
                );
              })}
            </div>
          </Panel>
        </div>

        <div className="space-y-3 xl:col-span-4">
          <Panel>
            <PanelHeader title="Resource utilisation" description="Crane · truck · driver · dock · storage (live)." icon={<Gauge size={15} />} />
            <div className="space-y-3 px-4 py-3.5">
              {utilization.map((row) => (
                <div key={row.name}>
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="text-slate-400">{row.name}</span>
                    <span className="font-mono tabular-nums text-slate-200">{row.value.toFixed(1)}%</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        row.value >= 90 ? "bg-red-400" : row.value >= 75 ? "bg-amber-400" : "bg-signal-cyan",
                      )}
                      style={{ width: `${Math.max(2, row.value)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHeader
              title="Berth board"
              description="Usable berths and their current vessel."
              icon={<Anchor size={15} />}
              action={
                <Link to="/app/ships" className="font-mono text-3xs uppercase tracking-[0.08em] text-slate-500 hover:text-slate-300">
                  Manage
                </Link>
              }
            />
            <div className="divide-y divide-line/60">
              {data.charts.dock_status.map((dock) => (
                <div key={dock.code} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="flex h-7 w-9 items-center justify-center rounded border border-line bg-ink-900/60 font-mono text-[10px] text-slate-300">
                    {dock.code}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] text-slate-300">{dock.name}</div>
                    <div className="truncate font-mono text-3xs text-slate-600">
                      {dock.ship ? `${dock.ship.code} · ${dock.ship.name}` : "No vessel assigned"}
                    </div>
                  </div>
                  <Badge className={cn("normal-case tracking-[0.04em]", DOCK_STATUS_STYLE[dock.status])}>{dock.status}</Badge>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Pending dispatch" description="Outbound moves awaiting completion." icon={<Truck size={15} />} />
            {pendingDispatches.length === 0 ? (
              <EmptyState title="No open dispatches" description="Every outbound manifest has cleared the gate." />
            ) : (
              <div className="divide-y divide-line/60">
                {pendingDispatches.map((dispatch) => (
                  <div key={dispatch.code} className="flex items-center gap-3 px-4 py-2.5">
                    <span className="flex h-7 w-7 items-center justify-center rounded border border-line bg-ink-900/60">
                      <Truck size={12} className="text-slate-500" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[12px] text-slate-300">
                        <span className="font-mono text-[11px] text-slate-400">{dispatch.code}</span>
                        <span className="uppercase text-slate-600">·</span>
                        <span className="truncate">{dispatch.destination}</span>
                      </div>
                      <div className="font-mono text-3xs uppercase tracking-[0.06em] text-slate-600">
                        {dispatch.mode} · {dispatch.container_count} box{dispatch.container_count === 1 ? "" : "es"} · {fmtTime(dispatch.scheduled_departure)}
                      </div>
                    </div>
                    <Badge className={cn("normal-case tracking-[0.04em]", SEVERITY_STYLE.info.bg, SEVERITY_STYLE.info.border, SEVERITY_STYLE.info.text)}>
                      {dispatch.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
            <div className="border-t border-line px-4 py-2">
              <Link to="/app/warehouse" className="flex items-center justify-between font-mono text-3xs uppercase tracking-[0.08em] text-slate-500 hover:text-slate-300">
                Warehouse & dispatch <ArrowUpRight size={12} />
              </Link>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Storage occupancy" description="Legacy stock plus tracked receipts." icon={<WarehouseIcon size={15} />} />
            <div className="space-y-3.5 px-4 py-3.5">
              {warehouses.map((warehouse) => (
                <div key={warehouse.code}>
                  <div className="flex items-center justify-between text-[11.5px]">
                    <span className="flex items-center gap-1.5 text-slate-300">
                      <ContainerIcon size={12} className="text-slate-500" />
                      {warehouse.code} · {warehouse.zone}
                    </span>
                    <span className="font-mono tabular-nums text-slate-400">
                      {warehouse.occupancy}/{warehouse.capacity_teu}
                      <span className={cn("ml-1.5", warehouse.above_threshold ? "text-amber-300" : "text-slate-600")}>{warehouse.utilization}%</span>
                    </span>
                  </div>
                  <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className={cn("h-full rounded-full", warehouse.utilization >= 95 ? "bg-red-400" : warehouse.above_threshold ? "bg-amber-400" : "bg-emerald-400")}
                      style={{ width: `${warehouse.utilization}%` }}
                    />
                    <span className="absolute inset-y-0 w-px bg-white/40" style={{ left: `${warehouse.threshold}%` }} />
                  </div>
                  <div className="mt-1 font-mono text-3xs uppercase tracking-[0.06em] text-slate-600">
                    {warehouse.available} TEU free · alert at {warehouse.threshold}%
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Vessel mix" description="Current port state by vessel status." icon={<Ship size={15} />} />
            <div className="flex flex-wrap gap-1.5 px-4 py-3.5">
              {Object.entries(data.charts.ships_by_status).map(([status, count]) => (
                <Badge key={status} className={cn("normal-case tracking-[0.04em]", SHIP_STATUS_STYLE[status])}>
                  {status} · {count}
                </Badge>
              ))}
            </div>
            <div className="border-t border-line px-4 py-2.5">
              <p className="text-[10.5px] leading-relaxed text-slate-600">{data.data_note}</p>
            </div>
          </Panel>
        </div>
      </div>

      <HealthWeightsDialog open={weightsOpen} onOpenChange={setWeightsOpen} components={health.components} />
    </div>
  );
}
