import { useMemo, useState } from "react";
import { ArrowRight, Boxes, CheckSquare, PackageCheck, Settings2, Truck, TrainFront, Warehouse as WarehouseIcon } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useDispatches, useReadyDispatch, useWarehouses, queryClient, keys } from "@/lib/hooks";
import { cn, fmtDateTime, fmtNumber, fmtTime, titleCase } from "@/lib/format";
import { RESOURCE_STATUS_STYLE } from "@/lib/status";
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
  Textarea,
} from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiTile, PageIntro } from "@/components/common/Bits";
import type { Container, Warehouse } from "@/lib/types";

const DISPATCH_FLOW: Record<string, string[]> = {
  pending: ["scheduled", "cancelled"],
  scheduled: ["in_transit", "cancelled"],
  in_transit: ["completed"],
  completed: [],
  cancelled: [],
};

function WarehouseSettings({ warehouse, onClose }: { warehouse: Warehouse | null; onClose: () => void }) {
  const [status, setStatus] = useState(warehouse?.status ?? "operational");
  const [threshold, setThreshold] = useState(String(warehouse?.threshold ?? 85));
  const [capacity, setCapacity] = useState(String(warehouse?.capacity_teu ?? 0));

  const mutation = useMutation({
    mutationFn: () =>
      api.warehouses.update(warehouse?.code as string, {
        status,
        threshold: Number(threshold),
        capacity_teu: Number(capacity),
      }),
    onSuccess: () => {
      toast.success(`${warehouse?.code} settings saved`, { description: "Capacity, threshold and availability are live." });
      queryClient.invalidateQueries();
      onClose();
    },
    onError: (error) => toast.error("Settings rejected", { description: error.message }),
  });

  return (
    <Dialog open={Boolean(warehouse)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="sm" title={`${warehouse?.code ?? ""} storage settings`} description="Capacity can never fall below live occupancy; the backend enforces this.">
        <div className="space-y-3">
          <div>
            <Label>Status</Label>
            <Select value={status} onChange={(event) => setStatus(event.target.value as Warehouse["status"])}>
              {["operational", "restricted", "maintenance"].map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
            </Select>
          </div>
          <div>
            <Label hint="TEU">Capacity</Label>
            <Input type="number" min={warehouse?.occupancy ?? 1} value={capacity} onChange={(event) => setCapacity(event.target.value)} />
          </div>
          <div>
            <Label hint="% of capacity">Alert threshold</Label>
            <Input type="number" min={50} max={100} value={threshold} onChange={(event) => setThreshold(event.target.value)} />
          </div>
          <InlineNote tone="info">Live occupancy is {warehouse?.occupancy} TEU. Restricting storage blocks new receipts immediately.</InlineNote>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={mutation.isPending} onClick={() => mutation.mutate()}>Save settings</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AssignStorageDialog({ warehouse, onClose }: { warehouse: Warehouse | null; onClose: () => void }) {
  const [selected, setSelected] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const candidates = useQuery({
    queryKey: ["storage-candidates", warehouse?.code],
    queryFn: async () => {
      const [atYard, transit] = await Promise.all([
        api.containers.list({ status: "at_yard", page_size: 200 }),
        api.containers.list({ status: "in_transit", page_size: 200 }),
      ]);
      return [...transit.items, ...atYard.items];
    },
    enabled: Boolean(warehouse),
  });

  const eligible = (candidates.data ?? []).filter((container) => container.warehouse_code !== warehouse?.code);
  const totalWeight = useMemo(
    () => eligible.filter((container) => selected.includes(container.code)).reduce((sum, container) => sum + container.weight_t, 0),
    [eligible, selected],
  );

  const mutation = useMutation({
    mutationFn: () => api.warehouses.assign({ warehouse_code: warehouse?.code as string, container_codes: selected, note: note || undefined }),
    onSuccess: (result) => {
      toast.success(result.message, { description: `${warehouse?.code} occupancy is now ${result.warehouse.occupancy}/${result.warehouse.capacity_teu} TEU.` });
      setSelected([]);
      setNote("");
      queryClient.invalidateQueries();
      onClose();
    },
    onError: (error) => toast.error("Storage rejected", { description: error.message }),
  });

  return (
    <Dialog open={Boolean(warehouse)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        size="lg"
        title={`Receive containers at ${warehouse?.code ?? ""}`}
        description={`${warehouse?.available ?? 0} of ${warehouse?.capacity_teu ?? 0} TEU free. Eligible states: in transit or at yard.`}
      >
        {candidates.isLoading ? (
          <Skeleton className="h-56" />
        ) : eligible.length === 0 ? (
          <EmptyState title="No eligible containers" description="Containers must be in transit or at another yard before they can be received here." />
        ) : (
          <div className="max-h-72 space-y-1 overflow-y-auto scroll-thin pr-1">
            {eligible.map((container) => {
              const checked = selected.includes(container.code);
              return (
                <button
                  key={container.code}
                  type="button"
                  onClick={() => setSelected((current) => checked ? current.filter((code) => code !== container.code) : [...current, container.code])}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded border px-2.5 py-2 text-left transition-colors",
                    checked ? "border-cyan-400/40 bg-cyan-400/[0.06]" : "border-line bg-ink-900/40 hover:border-line-strong",
                  )}
                >
                  <span className={cn("flex h-4 w-4 items-center justify-center rounded-sm border", checked ? "border-cyan-400 bg-cyan-400/20 text-cyan-200" : "border-slate-600")}>
                    {checked ? <CheckSquare size={11} /> : null}
                  </span>
                  <span className="flex-1">
                    <span className="block font-mono text-[11.5px] text-slate-200">{container.code}</span>
                    <span className="block text-[10.5px] text-slate-500">{container.destination} · {container.weight_t} t · currently {container.status.replace(/_/g, " ")}</span>
                  </span>
                  <span className="font-mono text-3xs text-slate-500">{container.warehouse_code ?? "no storage"}</span>
                </button>
              );
            })}
          </div>
        )}
        <div className="mt-3">
          <Label hint="optional">Receipt note</Label>
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} className="min-h-[64px]" placeholder="e.g. Reefer block B, booked by Navis export desk." />
        </div>
        <div className="mt-2 flex items-center justify-between rounded border border-line bg-ink-900/40 px-3 py-2 text-[11.5px]">
          <span className="text-slate-500">{selected.length} selected · {fmtNumber(totalWeight, 1)} t</span>
          <span className={cn("font-mono", selected.length > (warehouse?.available ?? 0) ? "text-red-300" : "text-slate-400")}>
            {selected.length}/{warehouse?.available ?? 0} TEU slots
          </span>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" loading={mutation.isPending} disabled={!selected.length} onClick={() => mutation.mutate()}>
            Receive {selected.length || ""} container{selected.length === 1 ? "" : "s"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateDispatchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const ready = useReadyDispatch();
  const [mode, setMode] = useState<"road" | "rail">("road");
  const [destination, setDestination] = useState("Inland DC · Nashik");
  const [carrier, setCarrier] = useState("");
  const [vehicleCode, setVehicleCode] = useState("");
  const [departure, setDeparture] = useState("");
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const containers = ready.data?.containers ?? [];
  const vehicles = ready.data?.vehicles ?? [];
  const totalWeight = containers.filter((container) => selected.includes(container.code)).reduce((sum, container) => sum + container.weight_t, 0);
  const vehicle = vehicles.find((row) => row.code === vehicleCode);

  const mutation = useMutation({
    mutationFn: () =>
      api.dispatch.create({
        mode,
        destination,
        container_codes: selected,
        carrier: carrier || undefined,
        vehicle_code: mode === "road" ? vehicleCode || undefined : undefined,
        scheduled_departure: departure ? new Date(departure).toISOString() : undefined,
        notes: notes || undefined,
      }),
    onSuccess: (result) => {
      toast.success(`${result.dispatch.code} created`, { description: `${result.dispatch.container_count} container(s) · ${result.dispatch.mode} · ${result.dispatch.destination}` });
      queryClient.invalidateQueries();
      onOpenChange(false);
      setSelected([]);
      setNotes("");
    },
    onError: (error) => toast.error("Dispatch rejected", { description: error.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" title="Create outbound manifest" description="Only ready-for-dispatch boxes are eligible. Completing this dispatch is the sole path to delivered.">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <Label>Mode</Label>
            <Select value={mode} onChange={(event) => setMode(event.target.value as "road" | "rail")}>
              <option value="road">Road</option>
              <option value="rail">Rail</option>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Destination</Label>
            <Input value={destination} onChange={(event) => setDestination(event.target.value)} placeholder="Inland DC · Nashik" />
          </div>
          <div>
            <Label hint="UTC">Scheduled departure</Label>
            <Input type="datetime-local" value={departure} onChange={(event) => setDeparture(event.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label hint="optional">Carrier</Label>
            <Input value={carrier} onChange={(event) => setCarrier(event.target.value)} placeholder={mode === "rail" ? "Konkan Rail Freight" : "PortSync Haulage"} />
          </div>
          {mode === "road" ? (
            <div className="sm:col-span-2">
              <Label hint="available only">Terminal truck</Label>
              <Select value={vehicleCode} onChange={(event) => setVehicleCode(event.target.value)}>
                <option value="">Auto-assign best truck</option>
                {vehicles.map((row) => (
                  <option key={row.code} value={row.code}>{row.code} · {row.capacity_t} t · fuel {row.fuel.toFixed(0)}% · {row.driver_name}</option>
                ))}
              </Select>
            </div>
          ) : (
            <div className="flex items-end sm:col-span-2">
              <InlineNote tone="info">Rail dispatch does not use a terminal truck; the manifest is handed to the rail carrier.</InlineNote>
            </div>
          )}
          <div className="sm:col-span-2 lg:col-span-4">
            <Label hint="optional">Notes</Label>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-[60px]" placeholder="Customs paperwork, priority instructions…" />
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="micro-label">Ready containers</span>
            <span className="font-mono text-3xs text-slate-500">{selected.length} selected · {fmtNumber(totalWeight, 1)} t</span>
          </div>
          {ready.isLoading ? (
            <Skeleton className="h-40" />
          ) : containers.length === 0 ? (
            <EmptyState title="Nothing is ready for dispatch" description="Move boxes to ready_for_dispatch from Container tracking or storage receipts first." />
          ) : (
            <div className="max-h-56 space-y-1 overflow-y-auto scroll-thin pr-1">
              {containers.map((container) => {
                const checked = selected.includes(container.code);
                return (
                  <button
                    key={container.code}
                    type="button"
                    onClick={() => setSelected((current) => checked ? current.filter((code) => code !== container.code) : [...current, container.code])}
                    className={cn("flex w-full items-center gap-2.5 rounded border px-2.5 py-1.5 text-left transition-colors", checked ? "border-cyan-400/40 bg-cyan-400/[0.06]" : "border-line bg-ink-900/40 hover:border-line-strong")}
                  >
                    <span className={cn("flex h-4 w-4 items-center justify-center rounded-sm border", checked ? "border-cyan-400 bg-cyan-400/20 text-cyan-200" : "border-slate-600")}>
                      {checked ? <CheckSquare size={11} /> : null}
                    </span>
                    <span className="flex-1 font-mono text-[11.5px] text-slate-200">{container.code}</span>
                    <span className="text-[10.5px] text-slate-500">{container.destination}</span>
                    <span className="font-mono text-3xs text-slate-500">{container.weight_t} t</span>
                    <span className="font-mono text-3xs text-slate-600">{container.priority}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {mode === "road" && vehicle && vehicle.capacity_t < totalWeight ? (
          <div className="mt-2">
            <InlineNote tone="critical">Selected load {fmtNumber(totalWeight, 1)} t exceeds {vehicle.code} payload {vehicle.capacity_t} t.</InlineNote>
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            variant="primary"
            loading={mutation.isPending}
            disabled={!selected.length || !destination.trim() || (mode === "road" && Boolean(vehicle) && (vehicle as { capacity_t: number }).capacity_t < totalWeight)}
            onClick={() => mutation.mutate()}
          >
            Create dispatch
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WarehouseDispatchPage() {
  const warehouses = useWarehouses();
  const dispatches = useDispatches({ page_size: 100 });
  const [settingsFor, setSettingsFor] = useState<Warehouse | null>(null);
  const [assignFor, setAssignFor] = useState<Warehouse | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const transition = useMutation({
    mutationFn: ({ code, status }: { code: string; status: string }) => api.dispatch.updateStatus(code, status),
    onSuccess: (result) => {
      toast.success(`${result.dispatch.code} → ${result.dispatch.status.replace(/_/g, " ")}`, { description: result.event.message });
      queryClient.invalidateQueries();
    },
    onError: (error) => toast.error("Dispatch transition rejected", { description: error.message }),
  });

  const summary = warehouses.data?.summary ?? {};
  const dispatchSummary = (dispatches.data?.summary ?? {}) as Record<string, number>;
  const storage = warehouses.data?.items ?? [];

  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow="Operations · storage & outbound"
        title="Warehouse & dispatch"
        description="Capacity is a hard constraint, not a warning. Receive containers into storage, stage outbound manifests for road or rail, and complete deliveries with a full lifecycle record."
        meta={
          <>
            <Badge className="border-cyan-400/25 bg-cyan-400/[0.07] text-cyan-300">{fmtNumber(summary.occupancy_teu)} / {fmtNumber(summary.capacity_teu)} TEU</Badge>
            <span className="font-mono text-3xs uppercase tracking-[0.08em] text-slate-600">{summary.above_threshold ?? 0} above threshold · {summary.operational ?? 0} operational</span>
          </>
        }
        actions={<Button variant="primary" size="sm" onClick={() => setCreateOpen(true)}><Truck size={13} /> Create dispatch</Button>}
      />

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-5">
        <KpiTile label="Total capacity" value={fmtNumber(summary.capacity_teu)} unit="TEU" hint="all storage zones" icon={<WarehouseIcon size={14} />} />
        <KpiTile label="Occupied" value={fmtNumber(summary.occupancy_teu)} unit="TEU" hint={`${summary.occupancy_pct ?? 0}% utilised`} icon={<Boxes size={14} />} tone="amber" />
        <KpiTile label="Available" value={fmtNumber(summary.available_teu)} unit="TEU" hint="free for receipt" icon={<PackageCheck size={14} />} tone="green" />
        <KpiTile label="Open dispatches" value={fmtNumber((dispatchSummary.pending ?? 0) + (dispatchSummary.scheduled ?? 0))} hint={`${dispatchSummary.in_transit ?? 0} in transit`} icon={<Truck size={14} />} tone="cyan" />
        <KpiTile label="Completed" value={fmtNumber(dispatchSummary.completed)} hint="outbound manifests" icon={<TrainFront size={14} />} tone="green" />
      </div>

      <Tabs defaultValue="storage">
        <TabsList>
          <TabsTrigger value="storage" count={storage.length}>Storage zones</TabsTrigger>
          <TabsTrigger value="dispatches" count={dispatches.data?.total}>Dispatch manifests</TabsTrigger>
        </TabsList>

        <TabsContent value="storage">
          {warehouses.isLoading ? (
            <div className="grid gap-3 lg:grid-cols-2">{Array.from({ length: 2 }).map((_, index) => <Skeleton key={index} className="h-56" />)}</div>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {storage.map((warehouse) => (
                <Panel key={warehouse.code}>
                  <PanelHeader
                    title={<span className="flex items-center gap-2"><span className="rounded border border-line bg-ink-900/70 px-1.5 py-0.5 font-mono text-[11px] text-slate-300">{warehouse.code}</span>{warehouse.name}</span>}
                    description={`${warehouse.zone} · alert at ${warehouse.threshold}% · ${warehouse.tracked_containers ?? 0} tracked boxes`}
                    icon={<WarehouseIcon size={15} />}
                    action={
                      <div className="flex items-center gap-2">
                        <Badge className={cn("normal-case tracking-[0.03em]", RESOURCE_STATUS_STYLE[warehouse.status])}>{warehouse.status}</Badge>
                        <Button variant="ghost" size="icon" onClick={() => setSettingsFor(warehouse)} aria-label={`Settings for ${warehouse.code}`}><Settings2 size={14} /></Button>
                      </div>
                    }
                  />
                  <div className="space-y-3 px-4 py-3.5">
                    <div>
                      <div className="flex items-center justify-between text-[11.5px]">
                        <span className="text-slate-400">Occupancy</span>
                        <span className="font-mono tabular-nums text-slate-200">{warehouse.occupancy}/{warehouse.capacity_teu} TEU <span className={cn("ml-1.5", warehouse.above_threshold ? "text-amber-300" : "text-slate-600")}>{warehouse.utilization}%</span></span>
                      </div>
                      <div className="relative mt-1.5 h-2.5 overflow-hidden rounded-full bg-ink-600">
                        <div className={cn("h-full rounded-full", warehouse.utilization >= 95 ? "bg-red-400" : warehouse.above_threshold ? "bg-amber-400" : "bg-emerald-400")} style={{ width: `${warehouse.utilization}%` }} />
                        <span className="absolute inset-y-0 w-px bg-slate-400" style={{ left: `${warehouse.threshold}%` }} />
                      </div>
                      <div className="mt-1 flex justify-between font-mono text-3xs uppercase tracking-[0.06em] text-slate-600">
                        <span>{warehouse.available} TEU free</span>
                        <span>threshold {warehouse.threshold}%</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {Object.entries(warehouse.container_counts ?? {}).map(([status, count]) => (
                        <div key={status} className="rounded border border-line bg-ink-900/40 px-2 py-1">
                          <div className="truncate font-mono text-3xs uppercase tracking-[0.04em] text-slate-600">{status.replace(/_/g, " ")}</div>
                          <div className="font-mono text-[13px] text-slate-300">{count}</div>
                        </div>
                      ))}
                      {!Object.keys(warehouse.container_counts ?? {}).length ? <span className="col-span-3 text-[10.5px] text-slate-600">No tracked containers in this zone yet.</span> : null}
                    </div>
                    <div className="flex items-center justify-between border-t border-line pt-2.5">
                      <p className="text-[10.5px] text-slate-600">Occupancy includes legacy stock plus tracked receipts.</p>
                      <Button variant="primary" size="sm" disabled={warehouse.status !== "operational" || warehouse.available <= 0} onClick={() => setAssignFor(warehouse)}>
                        Receive containers
                      </Button>
                    </div>
                  </div>
                </Panel>
              ))}
            </div>
          )}
          {warehouses.data?.note ? <p className="mt-2 text-[10.5px] leading-relaxed text-slate-600">{warehouses.data.note}</p> : null}
        </TabsContent>

        <TabsContent value="dispatches">
          <Panel>
            <PanelHeader
              title="Outbound manifests"
              description="Road and rail. Completing a manifest releases the truck, decrements storage and delivers its containers."
              icon={<Truck size={15} />}
              action={<div className="flex flex-wrap gap-1.5">
                {["pending", "scheduled", "in_transit", "completed"].map((status) => (
                  <Badge key={status} className="normal-case tracking-[0.03em]">{status} {dispatchSummary[status] ?? 0}</Badge>
                ))}
              </div>}
            />
            {dispatches.isLoading ? (
              <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-10" />)}</div>
            ) : !dispatches.data?.items.length ? (
              <EmptyState title="No dispatch manifests" description="Create one from ready-for-dispatch containers." action={<Button size="sm" onClick={() => setCreateOpen(true)}>Create dispatch</Button>} />
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr><th>Manifest</th><th>Mode</th><th>Destination</th><th>Carrier / truck</th><th>Containers</th><th>Departure</th><th>Status</th><th className="text-right">Actions</th></tr>
                  </thead>
                  <tbody>
                    {dispatches.data.items.map((dispatch) => {
                      const next = DISPATCH_FLOW[dispatch.status] ?? [];
                      return (
                        <tr key={dispatch.code}>
                          <td className="font-mono text-[11.5px] text-slate-200">{dispatch.code}</td>
                          <td>
                            <span className="flex items-center gap-1.5 text-[11px] capitalize text-slate-300">
                              {dispatch.mode === "rail" ? <TrainFront size={12} /> : <Truck size={12} />} {dispatch.mode}
                            </span>
                          </td>
                          <td className="max-w-[180px] truncate text-[11.5px] text-slate-300">{dispatch.destination}</td>
                          <td className="text-[11px] text-slate-400">{dispatch.vehicle_code ?? dispatch.carrier ?? "—"}</td>
                          <td>
                            <div className="flex max-w-[220px] flex-wrap gap-1">
                              {dispatch.container_codes.slice(0, 3).map((code) => <Badge key={code} className="normal-case tracking-[0.02em]">{code}</Badge>)}
                              {dispatch.container_count > 3 ? <Badge className="normal-case">+{dispatch.container_count - 3}</Badge> : null}
                            </div>
                          </td>
                          <td className="font-mono text-3xs uppercase tracking-[0.04em] text-slate-500">{fmtDateTime(dispatch.scheduled_departure)}</td>
                          <td><Badge className={cn("normal-case tracking-[0.03em]", RESOURCE_STATUS_STYLE[dispatch.status])}>{dispatch.status.replace(/_/g, " ")}</Badge></td>
                          <td>
                            <div className="flex flex-wrap justify-end gap-1">
                              {next.map((status) => (
                                <Button
                                  key={status}
                                  variant={status === "cancelled" ? "danger" : status === "completed" ? "success" : "secondary"}
                                  size="sm"
                                  loading={transition.isPending}
                                  onClick={() => transition.mutate({ code: dispatch.code, status })}
                                >
                                  {titleCase(status)}
                                </Button>
                              ))}
                              {!next.length ? <span className="text-[10.5px] text-slate-600">closed</span> : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </TabsContent>
      </Tabs>

      <WarehouseSettings warehouse={settingsFor} onClose={() => setSettingsFor(null)} />
      <AssignStorageDialog warehouse={assignFor} onClose={() => setAssignFor(null)} />
      <CreateDispatchDialog open={createOpen} onOpenChange={setCreateOpen} />

      <InlineNote tone="warning">
        A container becomes delivered only when its dispatch reaches completed. Dispatch completion also releases the truck, returns it to available and frees one TEU of warehouse occupancy.
      </InlineNote>
    </div>
  );
}
