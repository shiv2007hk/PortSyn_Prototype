import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CheckCircle2,
  FlaskConical,
  Play,
  RotateCcw,
  Ship as ShipIcon,
  TrendingDown,
  TrendingUp,
  Truck,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useResources, useScenarios, useWarehouses, queryClient } from "@/lib/hooks";
import { cn, fmtDateTime, fmtNumber, titleCase } from "@/lib/format";
import { Badge, Button, EmptyState, InlineNote, Input, Label, Panel, PanelHeader, Select, Skeleton } from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { PageIntro } from "@/components/common/Bits";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import type { Scenario } from "@/lib/types";

const SCENARIOS = [
  {
    key: "crane_failure",
    title: "Crane failure",
    icon: TrendingDown,
    description: "Take a crane offline and model the discharge delay, backlog and replacement options.",
    tone: "border-red-500/25",
  },
  {
    key: "sudden_ship",
    title: "Sudden vessel arrival",
    icon: ShipIcon,
    description: "Insert an unplanned high-priority vessel and see berth contention and queue impact.",
    tone: "border-amber-500/25",
  },
  {
    key: "truck_breakdown",
    title: "Truck breakdown",
    icon: Truck,
    description: "Lose a terminal truck mid-shift and model throughput loss and replacement capacity.",
    tone: "border-cyan-400/25",
  },
  {
    key: "warehouse_shortage",
    title: "Warehouse shortage",
    icon: WarehouseIcon,
    description: "Remove storage capacity and find diversions, dispatch releases and inbound holds.",
    tone: "border-violet-400/25",
  },
] as const;

type ScenarioKey = (typeof SCENARIOS)[number]["key"];

export function SimulationsPage() {
  const resources = useResources();
  const warehouses = useWarehouses();
  const scenarios = useScenarios();
  const [type, setType] = useState<ScenarioKey>("crane_failure");
  const [params, setParams] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Scenario | null>(null);
  const [applyOpen, setApplyOpen] = useState(false);

  const set = (key: string, value: string) => setParams((current) => ({ ...current, [key]: value }));

  const run = useMutation({
    mutationFn: () => {
      const body: Record<string, unknown> = {};
      if (type === "crane_failure" && params.crane_code) body.crane_code = params.crane_code;
      if (type === "truck_breakdown" && params.truck_code) body.truck_code = params.truck_code;
      if (type === "warehouse_shortage") {
        if (params.warehouse_code) body.warehouse_code = params.warehouse_code;
        if (params.reduction_teu) body.reduction_teu = Number(params.reduction_teu);
      }
      if (type === "sudden_ship") {
        if (params.ship_name) body.ship_name = params.ship_name;
        if (params.cargo_qty) body.cargo_qty = Number(params.cargo_qty);
        if (params.priority) body.priority = params.priority;
        if (params.cargo_type) body.cargo_type = params.cargo_type;
      }
      return api.simulations.run(type, body);
    },
    onSuccess: (scenario) => {
      setResult(scenario);
      toast.success("What-if complete", { description: "Nothing has been committed. Review the comparison, then apply or discard." });
      queryClient.invalidateQueries({ queryKey: ["simulations"] });
    },
    onError: (error) => toast.error("Simulation failed", { description: error.message }),
  });

  const apply = useMutation({
    mutationFn: () => api.simulations.apply(result?.id as number),
    onSuccess: (payload) => {
      toast.success("Scenario applied to live operations", { description: payload.summary });
      setApplyOpen(false);
      setResult(payload.scenario);
      queryClient.invalidateQueries();
    },
    onError: (error) => toast.error("Scenario could not be applied", { description: error.message }),
  });

  const reset = useMutation({
    mutationFn: () => api.simulations.reset(),
    onSuccess: (payload) => {
      toast.success(payload.message, { description: "Applied scenario snapshots were removed from the board." });
      setResult(null);
      queryClient.invalidateQueries();
    },
    onError: (error) => toast.error("Reset failed", { description: error.message }),
  });

  const active = result ?? scenarios.data?.items[0] ?? null;
  const comparison = active?.result?.comparison ?? [];
  const worst = useMemo(() => comparison.filter((row) => row.delta !== 0).slice(0, 4), [comparison]);

  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow="Intelligence · what-if lab"
        title="Simulation centre"
        description="Four operational shock scenarios run against an in-memory snapshot. The live database is untouched until you explicitly apply a result — every card says so."
        meta={
          <>
            <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">Snapshot only</Badge>
            <span className="font-mono text-3xs uppercase tracking-[0.08em] text-slate-600">Deterministic · sourced from synthetic dataset</span>
          </>
        }
        actions={
          <Button variant="secondary" size="sm" loading={reset.isPending} onClick={() => reset.mutate()}>
            <RotateCcw size={13} /> Reset scenarios
          </Button>
        }
      />

      <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
        {SCENARIOS.map((scenario) => {
          const Icon = scenario.icon;
          const selected = type === scenario.key;
          return (
            <button
              key={scenario.key}
              type="button"
              onClick={() => { setType(scenario.key); setParams({}); }}
              className={cn(
                "rounded-panel border bg-ink-750/70 p-3.5 text-left transition-colors",
                selected ? "border-cyan-400/50 bg-ink-700/80 shadow-[0_0_0_1px_rgba(34,211,238,0.12)]" : cn(scenario.tone, "hover:border-line-strong"),
              )}
            >
              <div className="flex items-center justify-between">
                <span className={cn("flex h-8 w-8 items-center justify-center rounded border", selected ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-300" : "border-line bg-ink-900/60 text-slate-400")}>
                  <Icon size={15} />
                </span>
                {selected ? <Badge className="border-cyan-400/30 bg-cyan-400/10 text-cyan-300">selected</Badge> : <span className="font-mono text-3xs uppercase tracking-[0.08em] text-slate-700">what-if</span>}
              </div>
              <div className="mt-2 font-display text-[13px] font-medium text-slate-100">{scenario.title}</div>
              <p className="mt-1 text-[10.5px] leading-relaxed text-slate-500">{scenario.description}</p>
            </button>
          );
        })}
      </div>

      <Panel>
        <PanelHeader
          title={`Parameters · ${SCENARIOS.find((scenario) => scenario.key === type)?.title}`}
          description="Tune the shock, then simulate. Outputs are modelled from the synthetic snapshot, not measured performance."
          icon={<FlaskConical size={15} />}
          action={<Badge className="border-line-strong text-slate-400">read-only run</Badge>}
        />
        <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 lg:grid-cols-4">
          {type === "crane_failure" ? (
            <div className="sm:col-span-2">
              <Label hint="defaults to busiest crane">Crane</Label>
              <Select value={params.crane_code ?? ""} onChange={(event) => set("crane_code", event.target.value)}>
                <option value="">Busiest crane</option>
                {(resources.data?.cranes ?? []).map((crane) => <option key={crane.code} value={crane.code}>{crane.code} · {crane.status} · health {crane.health.toFixed(0)}%</option>)}
              </Select>
            </div>
          ) : null}

          {type === "sudden_ship" ? (
            <>
              <div>
                <Label>Vessel name</Label>
                <Input placeholder="MV Meridian Star" value={params.ship_name ?? ""} onChange={(event) => set("ship_name", event.target.value)} />
              </div>
              <div>
                <Label hint="TEU">Cargo quantity</Label>
                <Input type="number" min={10} max={2000} placeholder="200" value={params.cargo_qty ?? ""} onChange={(event) => set("cargo_qty", event.target.value)} />
              </div>
              <div>
                <Label>Priority</Label>
                <Select value={params.priority ?? "critical"} onChange={(event) => set("priority", event.target.value)}>
                  {["critical", "high", "normal", "low"].map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
                </Select>
              </div>
              <div>
                <Label>Cargo type</Label>
                <Select value={params.cargo_type ?? "general"} onChange={(event) => set("cargo_type", event.target.value)}>
                  {["general", "reefer", "hazardous", "bulk"].map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
                </Select>
              </div>
            </>
          ) : null}

          {type === "truck_breakdown" ? (
            <div className="sm:col-span-2">
              <Label hint="defaults to busiest truck">Truck</Label>
              <Select value={params.truck_code ?? ""} onChange={(event) => set("truck_code", event.target.value)}>
                <option value="">Busiest truck</option>
                {(resources.data?.vehicles ?? []).map((vehicle) => <option key={vehicle.code} value={vehicle.code}>{vehicle.code} · {vehicle.status} · fuel {vehicle.fuel.toFixed(0)}%</option>)}
              </Select>
            </div>
          ) : null}

          {type === "warehouse_shortage" ? (
            <>
              <div className="sm:col-span-2">
                <Label hint="defaults to fullest zone">Warehouse</Label>
                <Select value={params.warehouse_code ?? ""} onChange={(event) => set("warehouse_code", event.target.value)}>
                  <option value="">Fullest warehouse</option>
                  {(warehouses.data?.items ?? []).map((warehouse) => <option key={warehouse.code} value={warehouse.code}>{warehouse.code} · {warehouse.utilization}% · {warehouse.available} TEU free</option>)}
                </Select>
              </div>
              <div>
                <Label hint="TEU">Capacity reduction</Label>
                <Input type="number" min={10} max={2000} placeholder="200" value={params.reduction_teu ?? ""} onChange={(event) => set("reduction_teu", event.target.value)} />
              </div>
            </>
          ) : null}

          <div className="flex items-end sm:col-span-2">
            <Button variant="primary" loading={run.isPending} onClick={() => run.mutate()}>
              <Play size={13} /> Run what-if
            </Button>
          </div>
        </div>
        <div className="border-t border-line px-4 py-2.5">
          <p className="text-[10.5px] leading-relaxed text-slate-600">
            The engine recomputes health, backlog, turnaround, throughput and storage against a copy of current state. No vessel, truck, crane, warehouse or container row is written until <span className="text-slate-400">Apply to live operations</span>.
          </p>
        </div>
      </Panel>

      {active ? (
        <>
          <Panel>
            <PanelHeader
              title={
                <span className="flex items-center gap-2">
                  {active.name}
                  <Badge className={active.status === "applied" ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300" : "border-line-strong text-slate-400"}>{active.status}</Badge>
                </span>
              }
              description={`${fmtDateTime(active.created_at)} · scenario #${active.id}${active.applied_at ? ` · applied ${fmtDateTime(active.applied_at)}` : ""}`}
              icon={<FlaskConical size={15} />}
              action={
                active.status === "applied" ? null : (
                  <Button variant="success" size="sm" disabled={!active.result} onClick={() => setApplyOpen(true)}>
                    <CheckCircle2 size={13} /> Apply to live operations
                  </Button>
                )
              }
            />
            <div className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
              <div>
                <div className="micro-label mb-2">Before → after comparison</div>
                <div className="space-y-2">
                  {comparison.map((row) => {
                    const worse = row.lower_is_better ? row.after > row.before : row.after < row.before;
                    const improved = row.delta !== 0 && !worse;
                    return (
                      <div key={row.key} className="rounded border border-line bg-ink-900/40 px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2 text-[11.5px]">
                          <span className="text-slate-400">{row.label}</span>
                          <span className="flex items-baseline gap-1.5 font-mono tabular-nums">
                            <span className="text-slate-500">{fmtNumber(row.before, 1)}</span>
                            <span className="text-slate-700">→</span>
                            <span className={worse ? "text-red-300" : improved ? "text-emerald-300" : "text-slate-200"}>{fmtNumber(row.after, 1)}</span>
                            <span className="text-3xs text-slate-600">{row.unit}</span>
                            {row.delta !== 0 ? (
                              <span className={cn("flex items-center text-3xs", worse ? "text-red-400/80" : "text-emerald-400/80")}>
                                {worse ? <TrendingDown size={10} /> : <TrendingUp size={10} />}
                                {row.delta > 0 ? "+" : ""}{fmtNumber(row.delta, 1)}
                              </span>
                            ) : null}
                          </span>
                        </div>
                        <div className="mt-1 flex h-1 gap-1">
                          <div className="h-full rounded-full bg-slate-600/70" style={{ width: `${Math.min(100, (row.before / Math.max(row.before, row.after, 1)) * 100)}%` }} />
                          <div className={cn("h-full rounded-full", worse ? "bg-red-400/80" : "bg-cyan-400/80")} style={{ width: `${Math.min(100, (row.after / Math.max(row.before, row.after, 1)) * 100)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-2 flex items-center gap-3 font-mono text-3xs uppercase tracking-[0.06em] text-slate-600">
                  <span className="flex items-center gap-1"><span className="h-1 w-3 rounded bg-slate-600" /> before</span>
                  <span className="flex items-center gap-1"><span className="h-1 w-3 rounded bg-cyan-400" /> after</span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded border border-line bg-ink-900/40 px-3 py-2">
                    <div className="micro-label">Health before</div>
                    <div className="mt-0.5 data-value text-[20px]">{fmtNumber(active.result?.before.health, 1)}</div>
                  </div>
                  <div className="rounded border border-line bg-ink-900/40 px-3 py-2">
                    <div className="micro-label">Health after</div>
                    <div className={cn("mt-0.5 data-value text-[20px]", (active.result?.after.health ?? 0) < (active.result?.before.health ?? 0) ? "text-red-300" : "text-emerald-300")}>
                      {fmtNumber(active.result?.after.health, 1)}
                    </div>
                  </div>
                </div>
                <div className="rounded border border-line bg-ink-900/40 px-3 py-2.5">
                  <div className="micro-label">Affected resources</div>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {(active.result?.affected.resources ?? []).map((row) => (
                      <Badge key={`${row.type}-${row.code}`} className="normal-case tracking-[0.03em]">{row.type} {row.code}</Badge>
                    ))}
                    {(active.result?.affected.ships ?? []).map((row) => (
                      <Badge key={`ship-${row.code}`} className="normal-case tracking-[0.03em]">vessel {row.code}</Badge>
                    ))}
                    {!active.result?.affected.resources.length ? <span className="text-[11px] text-slate-600">No direct resource impact.</span> : null}
                  </div>
                  {(active.result?.affected.containers ?? []).length ? (
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {active.result?.affected.containers.slice(0, 8).map((code) => <span key={code} className="font-mono text-3xs text-slate-500">{code}</span>)}
                    </div>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  {(active.result?.narrative ?? []).map((line) => (
                    <p key={line} className="flex gap-2 text-[11px] leading-relaxed text-slate-400">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-400/70" />{line}
                    </p>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3 border-t border-line px-4 py-3 lg:grid-cols-2">
              <div>
                <div className="micro-label mb-1.5">Recommended response</div>
                <div className="space-y-1.5">
                  {(active.result?.recommendations ?? []).map((row) => (
                    <div key={`${row.action}-${row.target ?? ""}`} className="rounded border border-line bg-ink-900/40 px-2.5 py-2">
                      <div className="flex items-center justify-between gap-2 text-[11.5px] text-slate-200">
                        <span>{row.action}</span>
                        {row.target ? <Badge className="normal-case">{row.target}</Badge> : null}
                      </div>
                      <p className="mt-0.5 text-[10.5px] leading-relaxed text-slate-500">{row.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="micro-label mb-1.5">Modelled delays</div>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(active.result?.delays ?? {}).map(([key, value]) => (
                    <Badge key={key} className="normal-case tracking-[0.03em]">{key.replace(/_/g, " ")}: {String(value)}</Badge>
                  ))}
                </div>
                <p className="mt-2 text-[10.5px] leading-relaxed text-slate-600">{active.result?.disclaimer}</p>
                <p className="mt-1 flex items-center gap-1.5 text-[10.5px] text-amber-300/80">
                  <AlertTriangle size={11} /> Simulation output is synthetic and advisory.
                </p>
              </div>
            </div>
          </Panel>

          <div className="grid gap-3 lg:grid-cols-12">
            <Panel className="lg:col-span-8">
              <PanelHeader title="Scenario history" description="Last 20 completed and applied what-ifs." icon={<Boxes size={15} />} />
              {scenarios.isLoading ? (
                <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-9" />)}</div>
              ) : !scenarios.data?.items.length ? (
                <EmptyState title="No scenarios yet" description="Run a what-if to populate the history." />
              ) : (
                <div className="divide-y divide-line/60">
                  {scenarios.data.items.map((scenario) => (
                    <button
                      key={scenario.id}
                      type="button"
                      onClick={() => setResult(scenario)}
                      className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-ink-800", result?.id === scenario.id ? "bg-ink-800" : "")}
                    >
                      <span className="flex h-7 w-7 items-center justify-center rounded border border-line bg-ink-900/60">
                        {scenario.scenario_type === "sudden_ship" ? <ShipIcon size={12} className="text-slate-500" /> : scenario.scenario_type === "warehouse_shortage" ? <WarehouseIcon size={12} className="text-slate-500" /> : scenario.scenario_type === "truck_breakdown" ? <Truck size={12} className="text-slate-500" /> : <FlaskConical size={12} className="text-slate-500" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[12px] text-slate-200">{scenario.name}</div>
                        <div className="font-mono text-3xs text-slate-600">
                          #{scenario.id} · {Object.entries(scenario.params).map(([key, value]) => `${key}=${value}`).join(" · ") || "default parameters"}
                        </div>
                      </div>
                      <span className="font-mono text-3xs uppercase tracking-[0.06em] text-slate-600">{fmtDateTime(scenario.created_at)}</span>
                      <Badge className={scenario.status === "applied" ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-300" : "border-line-strong text-slate-400"}>{scenario.status}</Badge>
                    </button>
                  ))}
                </div>
              )}
            </Panel>
            <div className="space-y-3 lg:col-span-4">
              <InlineNote tone="warning">
                A scenario changes live operations only after explicit apply. Applying a sudden-vessel scenario creates a real synthetic vessel record; applying a crane or truck failure withdraws the resource and raises an alert.
              </InlineNote>
              <InlineNote tone="info">
                Simulation parameters and results are labelled synthetic. They are never presented as measured port performance.
              </InlineNote>
            </div>
          </div>
        </>
      ) : (
        <Panel>
          <EmptyState
            icon={<FlaskConical size={26} />}
            title="No scenario selected"
            description="Choose a shock above and run it against the current snapshot. Results appear here side-by-side with the live baseline."
          />
        </Panel>
      )}

      <ConfirmDialog
        open={applyOpen}
        onOpenChange={setApplyOpen}
        title="Apply this scenario to live operations?"
        description="This is the only action that writes simulation effects into the operational database."
        confirmLabel="Apply to live operations"
        tone="primary"
        pending={apply.isPending}
        onConfirm={() => apply.mutate()}
      >
        <div className="space-y-2">
          <p>{active ? active.result?.narrative[0] : "The scenario result will be committed."}</p>
          <p className="rounded border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-amber-200/90">
            An audit record is written with your operator identity. Resources may be withdrawn and alerts raised immediately. This is not a reversible simulation once applied.
          </p>
        </div>
      </ConfirmDialog>
    </div>
  );
}
