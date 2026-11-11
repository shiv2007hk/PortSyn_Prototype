import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Anchor,
  ArrowRight,
  CalendarClock,
  History,
  Loader2,
  Plus,
  Ship as ShipIcon,
  Sparkles,
  Wrench,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useDocks, useShip, useShips, queryClient, keys } from "@/lib/hooks";
import { cn, fmtAgo, fmtDateTime, fmtNumber, fmtTime, titleCase } from "@/lib/format";
import { DOCK_STATUS_STYLE, PRIORITY_STYLE, SEVERITY_STYLE, SHIP_STATUS_STYLE } from "@/lib/status";
import {
  Badge,
  Button,
  EmptyState,
  InlineNote,
  Input,
  Label,
  Panel,
  PanelHeader,
  Progress,
  Select,
  Skeleton,
} from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownContent, DropdownItem, DropdownMenu, DropdownSeparator, DropdownTrigger } from "@/components/ui/dropdown";
import { PageIntro, ShipStatusBadge } from "@/components/common/Bits";
import { DetailAside, DetailEmpty, WorkspaceSplit } from "@/components/layout/DetailPanel";
import { RecommendationView, type AllocationDecision } from "@/components/operations/RecommendationView";
import type { Recommendation, Ship } from "@/lib/types";

const STATUS_FILTERS = ["all", "approaching", "arrived", "docked", "unloading", "departed"] as const;

function RegisterShipDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [form, setForm] = useState({
    code: "",
    name: "",
    cargo_type: "general",
    cargo_qty: "180",
    priority: "normal",
    eta: "",
    vessel_length_m: "280",
    draft_m: "12.5",
    handling_hours: "6",
  });

  const mutation = useMutation({
    mutationFn: () =>
      api.ships.create({
        code: form.code.trim() || undefined,
        name: form.name.trim(),
        cargo_type: form.cargo_type,
        cargo_qty: Number(form.cargo_qty),
        priority: form.priority,
        eta: form.eta ? new Date(form.eta).toISOString() : undefined,
        vessel_length_m: Number(form.vessel_length_m),
        draft_m: Number(form.draft_m),
        handling_hours: Number(form.handling_hours),
      }),
    onSuccess: (result) => {
      toast.success(`${result.ship.code} registered`, { description: `${result.ship.name} · ${result.ship.cargo_qty} TEU ${result.ship.cargo_type}` });
      queryClient.invalidateQueries({ queryKey: keys.ships() });
      queryClient.invalidateQueries({ queryKey: keys.dashboard });
      onOpenChange(false);
      setForm({ code: "", name: "", cargo_type: "general", cargo_qty: "180", priority: "normal", eta: "", vessel_length_m: "280", draft_m: "12.5", handling_hours: "6" });
    },
    onError: (error) => toast.error("Vessel registration failed", { description: error.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg" title="Register approaching vessel" description="The vessel enters planning as approaching. Berth allocation is proposed separately by the explainable optimizer.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label hint="auto if blank">Vessel code</Label>
            <Input placeholder="SH-105" value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} />
          </div>
          <div>
            <Label>Vessel name</Label>
            <Input placeholder="MV Konkan Pioneer" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          </div>
          <div>
            <Label>Priority</Label>
            <Select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
              {["low", "normal", "high", "critical"].map((value) => (
                <option key={value} value={value}>{titleCase(value)}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Cargo type</Label>
            <Select value={form.cargo_type} onChange={(event) => setForm({ ...form, cargo_type: event.target.value })}>
              {["general", "reefer", "hazardous", "bulk"].map((value) => (
                <option key={value} value={value}>{titleCase(value)}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label hint="TEU">Cargo quantity</Label>
            <Input type="number" min={1} max={4000} value={form.cargo_qty} onChange={(event) => setForm({ ...form, cargo_qty: event.target.value })} />
          </div>
          <div>
            <Label hint="UTC">ETA</Label>
            <Input type="datetime-local" value={form.eta} onChange={(event) => setForm({ ...form, eta: event.target.value })} />
          </div>
          <div>
            <Label hint="metres">Length overall</Label>
            <Input type="number" min={40} max={500} value={form.vessel_length_m} onChange={(event) => setForm({ ...form, vessel_length_m: event.target.value })} />
          </div>
          <div>
            <Label hint="metres">Draft</Label>
            <Input type="number" step="0.1" min={2} max={25} value={form.draft_m} onChange={(event) => setForm({ ...form, draft_m: event.target.value })} />
          </div>
          <div>
            <Label hint="planned">Handling hours</Label>
            <Input type="number" step="0.5" min={0.5} max={72} value={form.handling_hours} onChange={(event) => setForm({ ...form, handling_hours: event.target.value })} />
          </div>
        </div>
        <InlineNote tone="info">
          Berth length, draft and cargo-type compatibility are checked as hard constraints when the allocation engine scores this vessel.
        </InlineNote>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" loading={mutation.isPending} disabled={!form.name.trim() || !form.cargo_qty} onClick={() => mutation.mutate()}>
            Register vessel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BerthMiniMap({ currentDock }: { currentDock?: string | null }) {
  const { data } = useDocks();
  const docks = data?.items ?? [];
  const occupied = docks.filter((dock) => dock.ship).length;

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="micro-label">Berth occupancy</span>
        <span className="font-mono text-3xs uppercase tracking-[0.06em] text-slate-600">{occupied}/{docks.length} alongside</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {docks.length === 0
          ? Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-[54px]" />)
          : docks.slice(0, 4).map((dock) => (
              <div
                key={dock.code}
                className={cn(
                  "rounded border px-1.5 py-1.5",
                  dock.ship
                    ? "border-cyan-400/30 bg-cyan-400/[0.06]"
                    : dock.status === "maintenance"
                      ? "border-amber-500/25 bg-amber-500/[0.06]"
                      : "border-emerald-500/20 bg-emerald-500/[0.04]",
                  dock.code === currentDock && "ring-1 ring-cyan-400/60",
                )}
              >
                <div className="font-mono text-[10px] text-slate-300">{dock.code}</div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-sm bg-white/[0.06]">
                  <div className={cn("h-full rounded-sm", dock.ship ? "w-full bg-cyan-400/70" : "w-1/3 bg-emerald-400/40")} />
                </div>
                <div className="mt-1 truncate font-mono text-[8px] uppercase tracking-[0.04em] text-slate-600">{dock.ship?.code ?? dock.status}</div>
              </div>
            ))}
      </div>
    </div>
  );
}

function ShipDetailPanel({ code, onClose, onAllocate }: { code: string | null; onClose: () => void; onAllocate: (code: string) => void }) {
  const { data, isLoading } = useShip(code);

  const invalidate = () => {
    queryClient.invalidateQueries();
  };

  const action = useMutation({
    mutationFn: async ({ kind, shipCode }: { kind: "arrive" | "unload" | "complete" | "depart"; shipCode: string }) => {
      if (kind === "arrive") return api.ships.arrive(shipCode);
      if (kind === "unload") return api.ships.unload(shipCode);
      if (kind === "complete") return api.ships.completeUnload(shipCode);
      return api.ships.depart(shipCode);
    },
    onSuccess: (result) => {
      toast.success(result?.message ?? "Vessel updated", {
        description: "The vessel state, berth board and digital twin were synchronised.",
      });
      invalidate();
    },
    onError: (error) => toast.error("Vessel action rejected", { description: error.message }),
  });

  const ship = data?.ship;
  const nextActions = useMemo(() => {
    if (!ship) return [];
    if (ship.status === "approaching") return [{ kind: "arrive" as const, label: "Mark arrived at anchorage" }];
    if (ship.status === "docked") return [{ kind: "unload" as const, label: "Start discharge" }, { kind: "depart" as const, label: "Clear for departure" }];
    if (ship.status === "unloading") return [{ kind: "complete" as const, label: "Complete discharge" }];
    return [];
  }, [ship]);

  if (!code) {
    return (
      <DetailEmpty
        icon={<ShipIcon size={18} />}
        title="No vessel selected"
        description="Select a vessel in the register to inspect its berth, resource package, discharge progress and audited timeline."
      />
    );
  }

  if (isLoading || !ship || !data) {
    return (
      <div className="space-y-2 p-3.5">
        <Skeleton className="h-16" />
        <Skeleton className="h-8" />
        <Skeleton className="h-44" />
      </div>
    );
  }

  const facts = [
    { label: "Berth", value: ship.dock_code ?? "unassigned" },
    { label: "ETA", value: fmtDateTime(ship.eta) },
    { label: "Arrived", value: fmtDateTime(ship.arrived_at) },
    { label: "Planned handling", value: `${fmtNumber(ship.handling_hours, 1)} h` },
    { label: "LOA / draft", value: `${ship.vessel_length_m} m · ${ship.draft_m} m` },
    { label: "Delay", value: `${fmtNumber(data.delay_hours, 1)} h` },
    { label: "Tracked boxes", value: fmtNumber(data.containers.length) },
    { label: "Discharge", value: `${fmtNumber(ship.handling_progress)}%` },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line px-3.5 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[13px] text-slate-100">{ship.code}</span>
              <ShipStatusBadge status={ship.status} />
            </div>
            <p className="mt-0.5 truncate text-[11.5px] text-slate-500">
              {ship.name} · {titleCase(ship.cargo_type)} · {ship.cargo_qty} TEU
            </p>
          </div>
          <Badge className={cn("shrink-0 normal-case tracking-[0.04em]", PRIORITY_STYLE[ship.priority])}>{ship.priority}</Badge>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <Button variant="cyan" size="sm" className="h-7 px-2 text-[11px]" onClick={() => onAllocate(ship.code)}>
            <Sparkles size={12} /> Plan berth &amp; resources
          </Button>
          {nextActions.map((row) => (
            <Button
              key={row.kind}
              variant={row.kind === "depart" ? "secondary" : "primary"}
              size="sm"
              className="h-7 px-2 text-[11px]"
              loading={action.isPending}
              onClick={() => action.mutate({ kind: row.kind, shipCode: ship.code })}
            >
              {row.label}
            </Button>
          ))}
        </div>
      </div>

      <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
        <div className="px-3.5 pt-1">
          <TabsList className="w-full">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="manifest" count={data.containers.length}>Manifest</TabsTrigger>
            <TabsTrigger value="timeline" count={data.events.length}>Timeline</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="mt-0 space-y-3 p-3.5">
          <div className="grid grid-cols-2 gap-1.5">
            {facts.map((row) => (
              <div key={row.label} className="rounded border border-line bg-ink-900/40 px-2.5 py-2">
                <div className="micro-label">{row.label}</div>
                <div className="mt-0.5 truncate font-mono text-[11.5px] text-slate-200">{row.value}</div>
              </div>
            ))}
          </div>

          {ship.status === "docked" || ship.status === "unloading" ? (
            <div className="rounded border border-line bg-ink-900/40 px-2.5 py-2">
              <div className="flex items-center justify-between text-[10.5px]">
                <span className="text-slate-500">Discharge progress</span>
                <span className="font-mono tabular-nums text-slate-300">{fmtNumber(ship.handling_progress)}%</span>
              </div>
              <Progress value={ship.handling_progress} barClassName="bg-signal-cyan" className="mt-1.5" />
            </div>
          ) : null}

          <BerthMiniMap currentDock={ship.dock_code} />

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="micro-label">Active assignments</span>
              <span className="font-mono text-3xs text-slate-600">{data.assignments.length}</span>
            </div>
            {data.assignments.length === 0 ? (
              <p className="rounded border border-dashed border-line px-2.5 py-3 text-[11px] leading-relaxed text-slate-600">
                No active allocation. Run the optimizer to produce a berth, crane, truck, driver and storage package.
              </p>
            ) : (
              <div className="space-y-1.5">
                {data.assignments.map((assignment) => (
                  <div key={assignment.id} className="rounded border border-line bg-ink-900/30 px-2.5 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate font-mono text-[11px] text-slate-200">{assignment.resource_code}</span>
                        <Badge className="normal-case">{assignment.kind}</Badge>
                        {assignment.source === "override" ? (
                          <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">override</Badge>
                        ) : null}
                      </div>
                      <span className="shrink-0 font-mono text-2xs tabular-nums text-cyan-300">{assignment.score.toFixed(1)}</span>
                    </div>
                    <p className="mt-0.5 text-[10.5px] leading-relaxed text-slate-500">{assignment.explanation}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="manifest" className="mt-0 space-y-3 p-3.5">
          <div className="grid grid-cols-2 gap-1.5">
            {Object.keys(data.container_counts).length === 0 ? (
              <p className="col-span-2 rounded border border-dashed border-line px-2.5 py-4 text-[11px] leading-relaxed text-slate-600">
                No containers manifested yet. Completing discharge creates tracked boxes from the vessel plan.
              </p>
            ) : (
              Object.entries(data.container_counts).map(([status, count]) => (
                <div key={status} className="rounded border border-line bg-ink-900/40 px-2.5 py-2">
                  <div className="micro-label">{status.replace(/_/g, " ")}</div>
                  <div className="mt-0.5 font-mono text-[16px] text-slate-200">{count}</div>
                </div>
              ))
            )}
          </div>
          {data.containers.length ? (
            <div>
              <div className="micro-label mb-1.5">Tracked containers</div>
              <div className="flex flex-wrap gap-1.5">
                {data.containers.slice(0, 24).map((container) => (
                  <Badge key={container.code} className="normal-case tracking-[0.03em]">
                    {container.code} · {container.status.replace(/_/g, " ")}
                  </Badge>
                ))}
              </div>
            </div>
          ) : null}
          <p className="text-[10.5px] leading-relaxed text-slate-600">Delivered is only reachable through dispatch completion, never from this panel.</p>
        </TabsContent>

        <TabsContent value="timeline" className="mt-0 p-3.5">
          {data.events.length === 0 ? (
            <p className="rounded border border-dashed border-line px-2.5 py-4 text-[11px] text-slate-600">No vessel events recorded yet.</p>
          ) : (
            <ol className="relative space-y-2.5 border-l border-line/70 pl-3">
              {data.events.slice(0, 16).map((event) => {
                const tone = SEVERITY_STYLE[event.severity] ?? SEVERITY_STYLE.info;
                return (
                  <li key={event.id} className="relative">
                    <span className={cn("absolute -left-[16.5px] top-1 h-1.5 w-1.5 rounded-full", tone.dot)} />
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[11.5px] text-slate-200">{event.title}</span>
                      <span className="shrink-0 font-mono text-3xs tabular-nums text-slate-600">{fmtTime(event.ts)}</span>
                    </div>
                    <p className="mt-0.5 text-[10.5px] leading-relaxed text-slate-500">{event.message}</p>
                    <span className="font-mono text-3xs uppercase tracking-[0.06em] text-slate-700">{fmtAgo(event.ts)}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AllocationHistory() {
  const { data, isLoading } = useQuery({
    queryKey: [...keys.allocations, "history"],
    queryFn: () => api.allocations.history({ page_size: 50 }),
  });

  if (isLoading) return <Skeleton className="h-64" />;
  if (!data?.items.length) {
    return <EmptyState title="No allocation decisions yet" description="Accepted and overridden plans are recorded here with their score and explanation." />;
  }

  return (
    <Panel>
      <PanelHeader title="Allocation decision ledger" description="Every accepted or overridden package, with source and score." icon={<History size={15} />} />
      <div className="overflow-x-auto">
        <table className="table-base">
          <thead>
            <tr>
              <th>Resource</th>
              <th>Kind</th>
              <th>Vessel</th>
              <th className="text-right">Score</th>
              <th>Source</th>
              <th>Operator</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((row) => (
              <tr key={row.id}>
                <td className="font-mono text-[11.5px] text-slate-200">{row.resource_code}</td>
                <td className="capitalize">{row.kind}</td>
                <td className="font-mono text-[11px]">{row.ship_code ?? "—"}</td>
                <td className="text-right font-mono tabular-nums text-cyan-300">{row.score.toFixed(1)}</td>
                <td>
                  <Badge className={row.source === "override" ? "border-amber-500/30 bg-amber-500/10 text-amber-300" : "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300"}>
                    {row.source}
                  </Badge>
                </td>
                <td className="text-slate-400">{row.created_by}</td>
                <td className="font-mono text-3xs uppercase tracking-[0.06em] text-slate-500">{fmtDateTime(row.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

export function ShipsDocksPage() {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<string>("all");
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [registerOpen, setRegisterOpen] = useState(false);
  const [detailCode, setDetailCode] = useState<string | null>(null);
  const [recFor, setRecFor] = useState<string | null>(null);
  const [rec, setRec] = useState<Recommendation | null>(null);

  useEffect(() => {
    const query = searchParams.get("q");
    if (query) setSearch(query);
  }, [searchParams]);

  const ships = useShips({ status: status === "all" ? undefined : status, q: search || undefined });
  const docks = useDocks();

  const recommend = useMutation({
    mutationFn: (code: string) => api.allocations.recommend({ ship_code: code, kind: "full" }),
    onSuccess: (result) => setRec(result),
    onError: (error) => toast.error("Allocation engine could not produce a plan", { description: error.message }),
  });

  const decide = useMutation({
    mutationFn: ({ decision, reason }: { decision: AllocationDecision; reason?: string }) =>
      reason
        ? api.allocations.override({ ...decision, reason })
        : api.allocations.accept(decision),
    onSuccess: (result, variables) => {
      toast.success(result.message ?? "Allocation applied", {
        description: variables.reason ? "Manual override recorded in the audit trail." : "Vessel, berth and resources updated.",
      });
      setRecFor(null);
      setRec(null);
      queryClient.invalidateQueries();
    },
    onError: (error) => toast.error("Allocation rejected", { description: error.message }),
  });

  const dockAction = useMutation({
    mutationFn: ({ code, next }: { code: string; next: "available" | "maintenance" }) => api.docks.update(code, { status: next }),
    onSuccess: () => {
      toast.success("Berth availability updated");
      queryClient.invalidateQueries();
    },
    onError: (error) => toast.error("Berth update rejected", { description: error.message }),
  });

  const openAllocation = (code: string) => {
    setDetailCode(null);
    setRecFor(code);
    setRec(null);
    recommend.mutate(code);
  };

  const summary = useMemo(() => {
    const items = ships.data?.items ?? [];
    return {
      total: ships.data?.total ?? 0,
      approaching: items.filter((s) => s.status === "approaching").length,
      alongside: items.filter((s) => ["docked", "unloading"].includes(s.status)).length,
      priority: items.filter((s) => ["high", "critical"].includes(s.priority) && s.status !== "departed").length,
    };
  }, [ships.data]);

  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow="Operations · vessel planning"
        title="Ships & berths"
        description="Register arrivals, run the explainable berth + resource package, then move the vessel through discharge and departure with a full audit trail."
        meta={
          <>
            <Badge className="border-cyan-400/25 bg-cyan-400/[0.07] text-cyan-300">{summary.total} vessels</Badge>
            <span className="font-mono text-3xs uppercase tracking-[0.08em] text-slate-600">{summary.approaching} approaching · {summary.alongside} alongside</span>
          </>
        }
        actions={
          <Button variant="primary" size="sm" onClick={() => setRegisterOpen(true)}>
            <Plus size={13} /> Register vessel
          </Button>
        }
      />

      <WorkspaceSplit
        aside={
          <DetailAside open={Boolean(detailCode)} onClose={() => setDetailCode(null)} label="Vessel detail">
            <ShipDetailPanel code={detailCode} onClose={() => setDetailCode(null)} onAllocate={openAllocation} />
          </DetailAside>
        }
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            { label: "Vessels", value: summary.total, hint: "in register", tone: "bg-marine-500" },
            { label: "Approaching", value: summary.approaching, hint: "awaiting berth", tone: "bg-signal-cyan" },
            { label: "Alongside", value: summary.alongside, hint: "docked or discharging", tone: "bg-emerald-400" },
            { label: "Priority", value: summary.priority, hint: "high or critical", tone: "bg-amber-400" },
          ].map((row) => (
            <div key={row.label} className="relative overflow-hidden rounded-panel border border-line bg-ink-750/70 px-3 py-2.5">
              <span className={cn("absolute left-0 top-0 h-px w-full opacity-70", row.tone)} />
              <div className="micro-label">{row.label}</div>
              <div className="mt-0.5 data-value text-[19px]">{row.value}</div>
              <div className="text-[10px] text-slate-600">{row.hint}</div>
            </div>
          ))}
        </div>

        <Tabs defaultValue="vessels">
          <TabsList>
          <TabsTrigger value="vessels" count={ships.data?.total}>Vessels</TabsTrigger>
          <TabsTrigger value="berths" count={docks.data?.items.length}>Berths</TabsTrigger>
          <TabsTrigger value="history">Allocation history</TabsTrigger>
        </TabsList>

        <TabsContent value="vessels">
          <Panel>
            <PanelHeader
              title="Vessel register"
              description="Status, priority and berth occupancy. Departed vessels remain visible for the audit trail."
              icon={<ShipIcon size={15} />}
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <Input placeholder="Search code or name" value={search} onChange={(event) => setSearch(event.target.value)} className="h-8 w-44" />
                  <Select value={status} onChange={(event) => setStatus(event.target.value)} className="h-8 w-36">
                    {STATUS_FILTERS.map((value) => (
                      <option key={value} value={value}>{value === "all" ? "All statuses" : titleCase(value)}</option>
                    ))}
                  </Select>
                </div>
              }
            />
            {ships.isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-10" />)}
              </div>
            ) : ships.isError ? (
              <div className="p-4">
                <InlineNote tone="critical">Could not load vessels — {ships.error?.message}</InlineNote>
              </div>
            ) : !ships.data?.items.length ? (
              <EmptyState title="No vessels match this view" description="Register an approaching vessel or clear the status filter." action={<Button size="sm" onClick={() => setRegisterOpen(true)}>Register vessel</Button>} />
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr>
                      <th>Vessel &amp; cargo</th>
                      <th>Status</th>
                      <th>Berth &amp; ETA</th>
                      <th className="w-28">Discharge</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ships.data.items.map((ship) => (
                      <tr
                        key={ship.code}
                        className={cn("cursor-pointer", detailCode === ship.code && "bg-cyan-400/[0.05]")}
                        onClick={() => setDetailCode(ship.code)}
                      >
                        <td>
                          <div className="flex items-center gap-2">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-line bg-ink-900/70">
                              <ShipIcon size={13} className="text-slate-500" />
                            </span>
                            <div className="min-w-0">
                              <div className="font-mono text-[11.5px] text-slate-200">{ship.code}</div>
                              <div className="truncate text-[11px] text-slate-500">{ship.name}</div>
                              <div className="mt-0.5 whitespace-nowrap font-mono text-3xs text-slate-600">
                                <span className="capitalize">{ship.cargo_type}</span> · {ship.cargo_qty} TEU · {ship.containers_total} boxes
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="space-y-1">
                            <ShipStatusBadge status={ship.status} />
                            <div className={cn("font-mono text-3xs uppercase tracking-[0.08em]", PRIORITY_STYLE[ship.priority])}>{ship.priority}</div>
                          </div>
                        </td>
                        <td>
                          <div className="font-mono text-[11px] text-slate-300">{ship.dock_code ?? "—"}</div>
                          <div className="mt-0.5 whitespace-nowrap font-mono text-3xs text-slate-500">{fmtDateTime(ship.eta)}</div>
                        </td>
                        <td>
                          {ship.status === "unloading" || ship.status === "docked" ? (
                            <div>
                              <Progress value={ship.handling_progress} barClassName="bg-signal-cyan" />
                              <div className="mt-1 font-mono text-3xs text-slate-600">{ship.handling_progress.toFixed(0)}%</div>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-600">—</span>
                          )}
                        </td>
                        <td className="text-right" onClick={(event) => event.stopPropagation()}>
                          <div className="flex justify-end gap-1.5">
                            {["approaching", "arrived", "waiting"].includes(ship.status) ? (
                              <Button variant="cyan" size="sm" onClick={() => openAllocation(ship.code)}>
                                <Sparkles size={12} /> Allocate
                              </Button>
                            ) : null}
                            <DropdownMenu>
                              <DropdownTrigger asChild>
                                <Button variant="ghost" size="sm">Open</Button>
                              </DropdownTrigger>
                              <DropdownContent>
                                <DropdownItem onSelect={() => setDetailCode(ship.code)}>Vessel detail</DropdownItem>
                                <DropdownItem onSelect={() => openAllocation(ship.code)}>Plan berth &amp; resources</DropdownItem>
                                <DropdownSeparator />
                                {ship.status === "approaching" ? (
                                  <DropdownItem onSelect={() => api.ships.arrive(ship.code).then(() => { toast.success(`${ship.code} marked arrived`); queryClient.invalidateQueries(); }).catch((error) => toast.error("Could not mark arrival", { description: error.message }))}>
                                    Mark arrived
                                  </DropdownItem>
                                ) : null}
                                {ship.status === "docked" ? (
                                  <DropdownItem onSelect={() => api.ships.unload(ship.code).then((result) => { toast.success(result.message); queryClient.invalidateQueries(); }).catch((error) => toast.error("Discharge blocked", { description: error.message }))}>
                                    Start discharge
                                  </DropdownItem>
                                ) : null}
                                {ship.status === "unloading" ? (
                                  <DropdownItem onSelect={() => api.ships.completeUnload(ship.code).then((result) => { toast.success(result.message); queryClient.invalidateQueries(); }).catch((error) => toast.error("Could not complete discharge", { description: error.message }))}>
                                    Complete discharge
                                  </DropdownItem>
                                ) : null}
                              </DropdownContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex items-center justify-between border-t border-line px-4 py-2">
              <p className="text-[10.5px] text-slate-600">Priority affects wait-time scoring. Hard constraints (berth length, draft, cargo compatibility) always gate the recommendation.</p>
              <Button variant="ghost" size="sm" onClick={() => setDetailCode(ships.data?.items[0]?.code ?? null)} disabled={!ships.data?.items.length}>
                Inspect latest <ArrowRight size={12} />
              </Button>
            </div>
          </Panel>
        </TabsContent>

        <TabsContent value="berths">
          {docks.isLoading ? (
            <div className="grid gap-3 lg:grid-cols-2">{[0, 1, 2, 3].map((index) => <Skeleton key={index} className="h-44" />)}</div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {(docks.data?.items ?? []).map((dock) => (
                <Panel key={dock.code}>
                  <PanelHeader
                    title={
                      <span className="flex items-center gap-2">
                        <span className="rounded border border-line bg-ink-900/70 px-1.5 py-0.5 font-mono text-[11px] text-slate-300">{dock.code}</span>
                        {dock.name}
                      </span>
                    }
                    description={`${dock.capacity_teu} TEU · ${dock.max_length_m} m max LOA · ${dock.max_draft_m} m draft`}
                    icon={<Anchor size={15} />}
                    action={<Badge className={cn("normal-case tracking-[0.04em]", DOCK_STATUS_STYLE[dock.status])}>{dock.status}</Badge>}
                  />
                  <div className="space-y-3 px-4 py-3">
                    <div className="flex items-center justify-between gap-3 rounded border border-line bg-ink-900/40 px-3 py-2">
                      <div>
                        <div className="micro-label">Alongside</div>
                        <div className="mt-0.5 text-[12px] text-slate-200">
                          {dock.ship ? `${dock.ship.code} · ${dock.ship.name}` : "No vessel"}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="micro-label">Expected wait</div>
                        <div className="mt-0.5 font-mono text-[12px] text-slate-300">{dock.wait_min != null ? `${fmtNumber(dock.wait_min)} min` : "—"}</div>
                      </div>
                    </div>
                    <div>
                      <div className="micro-label mb-1.5">Assigned cranes</div>
                      <div className="flex flex-wrap gap-1.5">
                        {dock.cranes?.length ? dock.cranes.map((crane) => (
                          <Badge key={crane.code} className={cn("normal-case tracking-[0.03em]", crane.status === "idle" ? "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300" : crane.status === "active" ? "border-cyan-400/25 bg-cyan-400/[0.07] text-cyan-300" : "border-amber-500/25 bg-amber-500/10 text-amber-300")}>
                            {crane.code} · {crane.crane_type} · {crane.health.toFixed(0)}%
                          </Badge>
                        )) : <span className="text-[11px] text-slate-600">No cranes berthed</span>}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 border-t border-line pt-2.5">
                      <div className="flex flex-wrap gap-1">
                        {dock.allowed_cargo.map((cargo) => (
                          <Badge key={cargo} className="normal-case tracking-[0.03em]">{cargo}</Badge>
                        ))}
                      </div>
                      {dock.status === "maintenance" ? (
                        <Button variant="success" size="sm" loading={dockAction.isPending} onClick={() => dockAction.mutate({ code: dock.code, next: "available" })}>
                          Return to service
                        </Button>
                      ) : (
                        <Button variant="secondary" size="sm" disabled={Boolean(dock.ship)} onClick={() => dockAction.mutate({ code: dock.code, next: "maintenance" })}>
                          <Wrench size={12} /> Maintenance
                        </Button>
                      )}
                    </div>
                    {dock.maintenance_until ? (
                      <p className="flex items-center gap-1.5 font-mono text-3xs uppercase tracking-[0.06em] text-amber-300/80">
                        <CalendarClock size={11} /> until {fmtDateTime(dock.maintenance_until)}
                      </p>
                    ) : null}
                  </div>
                </Panel>
              ))}
            </div>
          )}
        </TabsContent>

          <TabsContent value="history">
            <AllocationHistory />
          </TabsContent>
        </Tabs>
      </WorkspaceSplit>

      <RegisterShipDialog open={registerOpen} onOpenChange={setRegisterOpen} />

      <Dialog open={Boolean(recFor)} onOpenChange={(open) => { if (!open) { setRecFor(null); setRec(null); } }}>
        <DialogContent
          size="xl"
          title={rec ? `Allocation plan · ${rec.ship.code}` : `Scoring ${recFor}…`}
          description="Hard constraints gate the shortlist; weighted scores rank the feasible package. Nothing is committed until you accept."
        >
          {recommend.isPending || !rec ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-slate-500">
              <Loader2 size={22} className="animate-spin text-cyan-400" />
              <p className="text-xs">Scoring berths, cranes, trucks, drivers and storage…</p>
            </div>
          ) : (
            <RecommendationView
              recommendation={rec}
              pending={decide.isPending}
              onAccept={(decision) => decide.mutate({ decision })}
              onOverride={(decision, reason) => decide.mutate({ decision, reason })}
              onReject={() => { setRecFor(null); setRec(null); toast.message("Plan rejected", { description: "No operational data was changed." }); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
