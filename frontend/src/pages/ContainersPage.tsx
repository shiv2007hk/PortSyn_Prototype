import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowRight, Boxes, Container as ContainerIcon, ExternalLink, Search, Ship as ShipIcon, Warehouse as WarehouseIcon } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useBoard, useContainer, useResources, useShips, useWarehouses, queryClient, keys } from "@/lib/hooks";
import { cn, fmtDateTime, fmtNumber, fmtTime } from "@/lib/format";
import { CONTAINER_COLUMNS, CONTAINER_STATUS_STYLE, PRIORITY_STYLE } from "@/lib/status";
import {
  Badge,
  Button,
  InlineNote,
  Input,
  Label,
  Select,
  Skeleton,
} from "@/components/ui/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageIntro } from "@/components/common/Bits";
import { DetailAside, DetailEmpty, WorkspaceSplit } from "@/components/layout/DetailPanel";
import type { Container } from "@/lib/types";

const TRANSITIONS: Record<string, string[]> = {
  waiting: ["allocated"],
  allocated: ["loading", "waiting"],
  loading: ["in_transit"],
  in_transit: ["at_yard"],
  at_yard: ["ready_for_dispatch"],
  ready_for_dispatch: ["delivered"],
  delivered: [],
};

const TARGET_HINT: Record<string, string> = {
  allocated: "A crane is optional here; assignment to the quay records the intended crane.",
  loading: "An available crane is required before loading can start.",
  in_transit: "An on-duty truck with at least 15% fuel and sufficient payload is required.",
  at_yard: "Select a warehouse with free capacity; the backend enforces the hard limit.",
  ready_for_dispatch: "Move the box to the outbound lane. Dispatch completion is the only path to delivered.",
};

function ContainerDetailPanel({ code, onClose }: { code: string | null; onClose: () => void }) {
  const detail = useContainer(code);
  const resources = useResources();
  const warehouses = useWarehouses();
  const [target, setTarget] = useState("");
  const [craneCode, setCraneCode] = useState("");
  const [vehicleCode, setVehicleCode] = useState("");
  const [warehouseCode, setWarehouseCode] = useState("");
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      api.containers.updateStatus(code as string, {
        target_status: target,
        crane_code: craneCode || undefined,
        vehicle_code: vehicleCode || undefined,
        warehouse_code: warehouseCode || undefined,
        note: note || undefined,
      }),
    onSuccess: (result) => {
      toast.success(`${result.container.code} → ${result.container.status.replace(/_/g, " ")}`, {
        description: result.event.message,
      });
      setTarget("");
      setCraneCode("");
      setVehicleCode("");
      setWarehouseCode("");
      setNote("");
      queryClient.invalidateQueries();
    },
    onError: (error) => toast.error("Transition rejected", { description: error.message }),
  });

  const container = detail.data?.container;

  if (!code) {
    return (
      <DetailEmpty
        icon={<ContainerIcon size={18} />}
        title="No container selected"
        description="Select a box on the board to review its lifecycle, apply the next validated status and print its QR label."
      />
    );
  }

  if (detail.isLoading || !container || !detail.data) {
    return (
      <div className="space-y-2 p-3.5">
        <Skeleton className="h-16" />
        <Skeleton className="h-8" />
        <Skeleton className="h-44" />
      </div>
    );
  }

  const data = detail.data;
  const facts = [
    { label: "Vessel", value: container.ship_code ?? "—" },
    { label: "Warehouse", value: container.warehouse_code ?? "—" },
    { label: "Crane", value: container.crane_code ?? "—" },
    { label: "Truck", value: container.vehicle_code ?? "—" },
    { label: "Waiting", value: container.waiting_hours != null ? `${fmtNumber(container.waiting_hours, 1)} h` : "—" },
    { label: "Dispatched", value: fmtDateTime(container.dispatched_at) },
    { label: "Updated", value: fmtDateTime(container.updated_at) },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line px-3.5 py-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[13px] text-slate-100">{container.code}</span>
              <Badge className={cn("normal-case tracking-[0.03em]", CONTAINER_STATUS_STYLE[container.status])}>
                {container.status.replace(/_/g, " ")}
              </Badge>
            </div>
            <p className="mt-0.5 truncate text-[11.5px] text-slate-500">
              <span className="capitalize">{container.cargo_type}</span> · {container.weight_t} t · {container.priority} priority
            </p>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge className="normal-case tracking-[0.03em]">{container.location}</Badge>
          <Badge className="normal-case tracking-[0.03em]">→ {container.destination}</Badge>
        </div>
      </div>

      <Tabs defaultValue="details" className="flex min-h-0 flex-1 flex-col">
        <div className="px-3.5 pt-1">
          <TabsList className="w-full">
            <TabsTrigger value="details">Details</TabsTrigger>
            <TabsTrigger value="timeline" count={data.history.length}>Timeline</TabsTrigger>
            <TabsTrigger value="label">Label</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="details" className="mt-0 space-y-3 p-3.5">
          <div className="grid grid-cols-2 gap-1.5">
            {facts.map((row) => (
              <div key={row.label} className="rounded border border-line bg-ink-900/40 px-2.5 py-2">
                <div className="micro-label">{row.label}</div>
                <div className="mt-0.5 truncate font-mono text-[11.5px] text-slate-200">{row.value}</div>
              </div>
            ))}
          </div>

          <div className="rounded border border-line bg-ink-900/30 px-2.5 py-2.5">
            <div className="micro-label">Next validated transition</div>
            <p className="mt-1 text-[10.5px] leading-relaxed text-slate-500">
              {TARGET_HINT[target] ?? "Choose the next lifecycle step. Invalid transitions are rejected by the backend."}
            </p>
            <div className="mt-2.5 space-y-2">
              <div>
                <Label>Target status</Label>
                <Select value={target} onChange={(event) => { setTarget(event.target.value); setCraneCode(""); setVehicleCode(""); setWarehouseCode(""); }}>
                  <option value="">Select next status</option>
                  {TRANSITIONS[container.status]?.filter((value) => value !== "delivered").map((value) => (
                    <option key={value} value={value}>{value.replace(/_/g, " ")}</option>
                  ))}
                </Select>
              </div>
              {target === "allocated" || target === "loading" ? (
                <div>
                  <Label hint={target === "loading" ? "required" : "optional"}>Crane</Label>
                  <Select value={craneCode} onChange={(event) => setCraneCode(event.target.value)}>
                    <option value="">{target === "loading" ? "Select crane" : "No crane change"}</option>
                    {(resources.data?.cranes ?? []).filter((crane) => !["maintenance", "fault"].includes(crane.status)).map((crane) => (
                      <option key={crane.code} value={crane.code}>{crane.code} · {crane.crane_type} · {crane.health.toFixed(0)}%</option>
                    ))}
                  </Select>
                </div>
              ) : null}
              {target === "in_transit" ? (
                <div>
                  <Label hint="required">Truck</Label>
                  <Select value={vehicleCode} onChange={(event) => setVehicleCode(event.target.value)}>
                    <option value="">Select truck</option>
                    {(resources.data?.vehicles ?? []).filter((vehicle) => !["maintenance", "fault"].includes(vehicle.status) && vehicle.fuel >= 15).map((vehicle) => (
                      <option key={vehicle.code} value={vehicle.code}>{vehicle.code} · {vehicle.capacity_t} t · fuel {vehicle.fuel.toFixed(0)}%</option>
                    ))}
                  </Select>
                </div>
              ) : null}
              {target === "at_yard" ? (
                <div>
                  <Label hint="required">Warehouse</Label>
                  <Select value={warehouseCode} onChange={(event) => setWarehouseCode(event.target.value)}>
                    <option value="">Select storage</option>
                    {(warehouses.data?.items ?? []).filter((warehouse) => warehouse.status === "operational" && warehouse.available > 0).map((warehouse) => (
                      <option key={warehouse.code} value={warehouse.code}>{warehouse.code} · {warehouse.available} TEU free</option>
                    ))}
                  </Select>
                </div>
              ) : null}
              <div>
                <Label hint="optional">Note</Label>
                <Input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Recorded on the container timeline" />
              </div>
            </div>
            {container.status === "ready_for_dispatch" ? (
              <div className="mt-2.5">
                <InlineNote tone="warning">Delivered is only reachable by completing a dispatch under Warehouse &amp; dispatch.</InlineNote>
              </div>
            ) : null}
            <div className="mt-2.5 flex items-center justify-between gap-2">
              <p className="flex min-w-0 items-center gap-1 truncate text-[10px] text-slate-600">
                <ArrowRight size={10} /> {TRANSITIONS[container.status]?.join(" → ") || "none"}
              </p>
              <Button variant="primary" size="sm" className="h-7 shrink-0 px-2 text-[11px]" loading={mutation.isPending} disabled={!target} onClick={() => mutation.mutate()}>
                Apply transition
              </Button>
            </div>
          </div>

          <div className="rounded border border-line bg-ink-900/30 px-2.5 py-2">
            <div className="micro-label flex items-center gap-1.5"><Boxes size={11} /> Dispatch link</div>
            {data.dispatch ? (
              <div className="mt-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-slate-200">{data.dispatch.code}</span>
                  <Badge className="normal-case">{data.dispatch.status}</Badge>
                </div>
                <p className="mt-0.5 text-[10.5px] text-slate-500">{data.dispatch.mode} · {data.dispatch.destination}</p>
                <p className="font-mono text-3xs text-slate-600">Departure {fmtDateTime(data.dispatch.scheduled_departure)}</p>
              </div>
            ) : (
              <p className="mt-1 text-[10.5px] leading-relaxed text-slate-600">No dispatch linked yet. Ready-for-dispatch boxes can join an outbound manifest.</p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="mt-0 p-3.5">
          {data.history.length === 0 ? (
            <p className="rounded border border-dashed border-line px-2.5 py-4 text-[11px] text-slate-600">No transitions recorded yet.</p>
          ) : (
            <ol className="relative space-y-2.5 border-l border-line/70 pl-3">
              {data.history.map((row, index) => (
                <li key={`${row.ts}-${index}`} className="relative">
                  <span className="absolute -left-[16.5px] top-1.5 h-1.5 w-1.5 rounded-full bg-cyan-400/70" />
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[11.5px] text-slate-300">
                      {row.from_status ? `${row.from_status.replace(/_/g, " ")} → ` : "created as "}
                      <span className="text-slate-100">{row.to_status.replace(/_/g, " ")}</span>
                    </span>
                    <span className="shrink-0 font-mono text-3xs text-slate-600">{fmtTime(row.ts)}</span>
                  </div>
                  {row.note ? <p className="mt-0.5 text-[10.5px] leading-relaxed text-slate-500">{row.note}</p> : null}
                  <span className="font-mono text-3xs uppercase tracking-[0.06em] text-slate-700">{row.actor}</span>
                </li>
              ))}
            </ol>
          )}
        </TabsContent>

        <TabsContent value="label" className="mt-0 space-y-3 p-3.5">
          <div className="flex flex-col items-center gap-2 rounded border border-line bg-ink-900/30 px-3 py-4">
            <div className="rounded border border-line bg-white p-2">
              <img src={api.containers.qrUrl(container.code)} alt={`QR label for ${container.code}`} className="h-40 w-40" />
            </div>
            <p className="font-mono text-3xs uppercase tracking-[0.1em] text-slate-600">PORTSYNC · {container.code}</p>
            <a href={api.containers.qrUrl(container.code)} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-[10.5px] text-cyan-300 hover:text-cyan-200">
              Open SVG <ExternalLink size={11} />
            </a>
          </div>

          <div className="rounded border border-line bg-ink-900/30 px-2.5 py-2">
            <div className="micro-label flex items-center gap-1.5"><ShipIcon size={11} /> Vessel source</div>
            {data.ship.code ? (
              <div className="mt-1 text-[11.5px]">
                <div className="font-mono text-slate-200">{data.ship.code}</div>
                <div className="text-slate-500">{data.ship.name}</div>
              </div>
            ) : (
              <p className="mt-1 text-[10.5px] text-slate-600">No vessel source recorded.</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

export function ContainersPage() {
  const [searchParams] = useSearchParams();
  const [priority, setPriority] = useState("");
  const [shipCode, setShipCode] = useState("");
  const [search, setSearch] = useState(() => searchParams.get("q") ?? "");
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const query = searchParams.get("q");
    if (query) setSearch(query);
  }, [searchParams]);

  const ships = useShips({ page_size: 100 });
  const board = useBoard({ priority: priority || undefined, ship_code: shipCode || undefined, q: search || undefined });

  const totals = useMemo(() => {
    const columns = board.data?.columns ?? [];
    const count = (status: string) => columns.find((column) => column.status === status)?.count ?? 0;
    return {
      total: board.data?.total ?? 0,
      yard: count("at_yard"),
      ready: count("ready_for_dispatch"),
      moving: count("in_transit"),
      critical: columns.reduce((sum, column) => sum + (column.priority_counts.critical ?? 0), 0),
    };
  }, [board.data]);

  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow="Operations · container lifecycle"
        title="Container tracking"
        description="A validated Kanban from vessel discharge to delivery. Every move is gated by the backend lifecycle graph, resource availability and storage capacity — with a QR label per box."
        meta={
          <>
            <Badge className="border-cyan-400/25 bg-cyan-400/[0.07] text-cyan-300">{fmtNumber(totals.total)} tracked boxes</Badge>
            <span className="font-mono text-3xs uppercase tracking-[0.08em] text-slate-600">{totals.moving} in transit · {totals.yard} stored · {totals.critical} critical</span>
          </>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-600" />
              <Input placeholder="Search code or destination" value={search} onChange={(event) => setSearch(event.target.value)} className="h-8 w-52 pl-8" />
            </div>
            <Select value={priority} onChange={(event) => setPriority(event.target.value)} className="h-8 w-32">
              <option value="">All priority</option>
              {["critical", "high", "normal", "low"].map((value) => <option key={value} value={value}>{value}</option>)}
            </Select>
            <Select value={shipCode} onChange={(event) => setShipCode(event.target.value)} className="h-8 w-36">
              <option value="">All vessels</option>
              {(ships.data?.items ?? []).map((ship) => <option key={ship.code} value={ship.code}>{ship.code}</option>)}
            </Select>
          </div>
        }
      />

      <WorkspaceSplit
        aside={
          <DetailAside open={Boolean(selected)} onClose={() => setSelected(null)} label="Container detail">
            <ContainerDetailPanel code={selected} onClose={() => setSelected(null)} />
          </DetailAside>
        }
      >
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {[
          { label: "In transit", value: totals.moving, hint: "on terminal trucks", tone: "bg-signal-cyan" },
          { label: "Stored", value: totals.yard, hint: "yard / warehouse", tone: "bg-amber-400" },
          { label: "Ready to dispatch", value: totals.ready, hint: "staged outbound", tone: "bg-violet-400" },
          { label: "Critical priority", value: totals.critical, hint: "across the board", tone: "bg-red-400" },
        ].map((row) => (
          <div key={row.label} className="relative overflow-hidden rounded-panel border border-line bg-ink-750/70 px-3.5 py-3">
            <span className={cn("absolute left-0 top-0 h-px w-full opacity-70", row.tone)} />
            <div className="micro-label">{row.label}</div>
            <div className="mt-1 data-value text-[22px]">{fmtNumber(row.value)}</div>
            <div className="text-[10.5px] text-slate-600">{row.hint}</div>
          </div>
        ))}
        </div>

        {board.isLoading ? (
        <div className="flex gap-3 overflow-hidden">
          {CONTAINER_COLUMNS.map((column) => <Skeleton key={column.status} className="h-[420px] min-w-[240px] flex-1" />)}
        </div>
      ) : board.isError ? (
        <InlineNote tone="critical">Could not load the container board — {board.error?.message}</InlineNote>
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-2 scroll-thin">
          {CONTAINER_COLUMNS.map((column) => {
            const data = board.data?.columns.find((row) => row.status === column.status);
            return (
              <div key={column.status} className="flex w-[248px] shrink-0 flex-col rounded-panel border border-line bg-ink-800/50">
                <div className="border-b border-line px-3 py-2.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <span className={cn("h-1.5 w-1.5 rounded-full", column.accent)} />
                      <span className="font-display text-[12px] font-medium text-slate-200">{column.label}</span>
                    </span>
                    <span className="rounded bg-white/[0.05] px-1.5 py-px font-mono text-3xs tabular-nums text-slate-400">{data?.count ?? 0}</span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-600">{column.hint}</p>
                </div>
                <div className="flex-1 space-y-1.5 p-1.5">
                  {!data?.items.length ? (
                    <div className="flex h-24 items-center justify-center rounded border border-dashed border-line/70 text-[10.5px] text-slate-600">Empty</div>
                  ) : (
                    data.items.map((container) => (
                      <ContainerCard
                        key={container.code}
                        container={container}
                        active={selected === container.code}
                        onOpen={() => setSelected(container.code)}
                      />
                    ))
                  )}
                </div>
                {data && data.count > data.items.length ? (
                  <div className="border-t border-line px-3 py-1.5 text-center font-mono text-3xs text-slate-600">+{data.count - data.items.length} more in column</div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-3xs uppercase tracking-[0.06em] text-slate-600">
          {board.data?.truncated ? "Board truncated at 500 containers — use filters to narrow." : "Showing all matching containers."}
        </p>
        <p className="flex items-center gap-1.5 text-[10.5px] text-slate-600">
          <WarehouseIcon size={12} /> Delivered requires a completed dispatch manifest.
        </p>
        </div>
      </WorkspaceSplit>
    </div>
  );
}

function ContainerCard({ container, active, onOpen }: { container: Container; active: boolean; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group w-full rounded border px-2.5 py-2 text-left transition-colors",
        active
          ? "border-cyan-400/40 bg-cyan-400/[0.06] ring-1 ring-cyan-400/25"
          : "border-line bg-ink-850/80 hover:border-line-strong hover:bg-ink-750",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-slate-200">{container.code}</span>
        <span className={cn("font-mono text-3xs uppercase tracking-[0.06em]", PRIORITY_STYLE[container.priority])}>{container.priority}</span>
      </div>
      <div className="mt-1 flex items-center gap-1.5 text-[10.5px] text-slate-500">
        <ContainerIcon size={10} />
        <span className="capitalize">{container.cargo_type}</span>
        <span className="text-slate-700">·</span>
        <span>{container.weight_t} t</span>
        {container.ship_code ? <><span className="text-slate-700">·</span><span className="font-mono">{container.ship_code}</span></> : null}
      </div>
      <div className="mt-1.5 truncate text-[10.5px] text-slate-500">{container.location}</div>
      <div className="mt-1.5 flex items-center justify-between border-t border-line/60 pt-1.5">
        <span className="truncate font-mono text-3xs text-slate-600">{container.destination}</span>
        {container.waiting_hours != null && container.waiting_hours > 12 ? (
          <span className="font-mono text-3xs text-amber-400/80">{fmtNumber(container.waiting_hours, 0)}h wait</span>
        ) : (
          <span className="flex items-center gap-1 font-mono text-3xs text-slate-600 opacity-0 transition-opacity group-hover:opacity-100">Open <ArrowRight size={9} /></span>
        )}
      </div>
    </button>
  );
}
