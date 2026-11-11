import { useMemo, useState } from "react";
import { Activity, Fuel, Gauge, History, Pencil, Plus, Trash2, Truck, UserRound, Wrench } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useDocks, useResources, queryClient, keys } from "@/lib/hooks";
import { cn, fmtDateTime, fmtNumber, titleCase } from "@/lib/format";
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
} from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiTile, PageIntro } from "@/components/common/Bits";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import type { Crane, Driver, Vehicle } from "@/lib/types";

type Kind = "crane" | "vehicle" | "driver";
type Entity = Crane | Vehicle | Driver;

const KIND_LABEL: Record<Kind, string> = { crane: "crane", vehicle: "truck", driver: "driver" };

const STATUS_OPTIONS: Record<Kind, string[]> = {
  crane: ["idle", "active", "maintenance", "fault"],
  vehicle: ["available", "assigned", "in_transit", "idle", "maintenance", "fault"],
  driver: ["on_duty", "off_duty", "on_break"],
};

function useResourceForm(initial?: Entity, kind?: Kind): Record<string, string> {
  return useMemo(() => {
    if (!initial) {
      if (kind === "crane") return { crane_type: "STS", capacity_t: "40", health: "90", status: "idle", dock_code: "" };
      if (kind === "vehicle") return { capacity_t: "32", fuel: "80", health: "90", status: "available", driver_code: "" };
      if (kind === "driver") return { name: "", duty_status: "on_duty", shift: "Day 06:00-14:00", skills: "", workload: "0" };
      return {};
    }
    if (kind === "crane") {
      const crane = initial as Crane;
      const values: Record<string, string> = {
        crane_type: crane.crane_type,
        capacity_t: String(crane.capacity_t),
        health: String(crane.health),
        status: crane.status,
        dock_code: crane.dock_code ?? "",
      };
      return values;
    }
    if (kind === "vehicle") {
      const vehicle = initial as Vehicle;
      const values: Record<string, string> = {
        capacity_t: String(vehicle.capacity_t),
        fuel: String(vehicle.fuel),
        health: String(vehicle.health),
        status: vehicle.status,
        driver_code: vehicle.driver_code ?? "",
      };
      return values;
    }
    const driver = initial as Driver;
    const values: Record<string, string> = {
      name: driver.name,
      duty_status: driver.duty_status,
      shift: driver.shift,
      skills: driver.skills.join(", "),
      workload: String(driver.workload),
    };
    return values;
  }, [initial, kind]);
}

function ResourceDialog({
  open,
  onOpenChange,
  kind,
  entity,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: Kind;
  entity: Entity | null;
}) {
  const isEdit = Boolean(entity);
  const initial = useResourceForm(entity ?? undefined, kind);
  const [form, setForm] = useState<Record<string, string>>({});
  const [code, setCode] = useState("");
  const values = { ...initial, ...form };

  const docks = useDocks();
  const resources = useResources();

  const mutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {};
      if (kind === "crane") {
        if (!isEdit) Object.assign(body, { code });
        Object.assign(body, {
          crane_type: values.crane_type,
          capacity_t: Number(values.capacity_t),
          health: Number(values.health),
          status: values.status,
          ...(values.dock_code !== undefined ? { dock_code: values.dock_code || null } : {}),
        });
        return isEdit ? api.resources.updateCrane((entity as Crane).code, body) : api.resources.createCrane(body);
      }
      if (kind === "vehicle") {
        if (!isEdit) Object.assign(body, { code });
        Object.assign(body, {
          capacity_t: Number(values.capacity_t),
          fuel: Number(values.fuel),
          health: Number(values.health),
          status: values.status,
          ...(values.driver_code !== undefined ? { driver_code: values.driver_code || null } : {}),
        });
        return isEdit ? api.resources.updateVehicle((entity as Vehicle).code, body) : api.resources.createVehicle(body);
      }
      if (!isEdit) Object.assign(body, { code });
      Object.assign(body, {
        name: values.name,
        duty_status: values.duty_status,
        shift: values.shift,
        skills: values.skills,
        workload: Number(values.workload),
      });
      return isEdit ? api.resources.updateDriver((entity as Driver).code, body) : api.resources.createDriver(body);
    },
    onSuccess: () => {
      toast.success(isEdit ? `${KIND_LABEL[kind]} updated` : `${KIND_LABEL[kind]} registered`, {
        description: "Fleet register, twin and allocation pool were refreshed.",
      });
      queryClient.invalidateQueries({ queryKey: keys.resources });
      queryClient.invalidateQueries({ queryKey: keys.dashboard });
      queryClient.invalidateQueries({ queryKey: keys.twin });
      onOpenChange(false);
      setForm({});
      setCode("");
    },
    onError: (error) => toast.error("Fleet update rejected", { description: error.message }),
  });

  const set = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) { setForm({}); setCode(""); } onOpenChange(next); }}>
      <DialogContent
        size="md"
        title={isEdit ? `Edit ${(entity as Entity).code}` : `Register ${KIND_LABEL[kind]}`}
        description={kind === "driver" ? "Duty status gates dispatch eligibility; drivers on a vehicle cannot be set off duty." : "Status changes immediately affect the optimizer's resource pool."}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {!isEdit ? (
            <div>
              <Label hint={kind === "crane" ? "CR-00" : kind === "vehicle" ? "TR-00" : "DR-00"}>Code</Label>
              <Input placeholder={kind === "crane" ? "CR-07" : kind === "vehicle" ? "TR-13" : "DR-13"} value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} />
            </div>
          ) : null}

          {kind === "crane" ? (
            <>
              <div>
                <Label>Type</Label>
                <Select value={values.crane_type ?? "STS"} onChange={(event) => set("crane_type", event.target.value)}>
                  {["STS", "RTG", "MHC"].map((value) => <option key={value} value={value}>{value}</option>)}
                </Select>
              </div>
              <div>
                <Label hint="tonnes">Capacity</Label>
                <Input type="number" min={5} max={120} value={values.capacity_t ?? "40"} onChange={(event) => set("capacity_t", event.target.value)} />
              </div>
              <div>
                <Label hint="0–100">Health</Label>
                <Input type="number" min={0} max={100} value={values.health ?? "90"} onChange={(event) => set("health", event.target.value)} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={values.status ?? "idle"} onChange={(event) => set("status", event.target.value)}>
                  {STATUS_OPTIONS.crane.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label hint="optional">Home berth</Label>
                <Select value={values.dock_code ?? ""} onChange={(event) => set("dock_code", event.target.value)}>
                  <option value="">Unassigned</option>
                  {(docks.data?.items ?? []).map((dock) => <option key={dock.code} value={dock.code}>{dock.code} · {dock.name}</option>)}
                </Select>
              </div>
              <InlineNote tone="warning">
                Setting a crane to maintenance or fault releases its active assignments and raises an alert.
              </InlineNote>
            </>
          ) : null}

          {kind === "vehicle" ? (
            <>
              <div>
                <Label hint="tonnes">Capacity</Label>
                <Input type="number" min={5} max={80} value={values.capacity_t ?? "32"} onChange={(event) => set("capacity_t", event.target.value)} />
              </div>
              <div>
                <Label hint="0–100">Fuel</Label>
                <Input type="number" min={0} max={100} value={values.fuel ?? "80"} onChange={(event) => set("fuel", event.target.value)} />
              </div>
              <div>
                <Label hint="0–100">Health</Label>
                <Input type="number" min={0} max={100} value={values.health ?? "90"} onChange={(event) => set("health", event.target.value)} />
              </div>
              <div>
                <Label>Status</Label>
                <Select value={values.status ?? "available"} onChange={(event) => set("status", event.target.value)}>
                  {STATUS_OPTIONS.vehicle.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label hint="on-duty only">Assigned driver</Label>
                <Select value={values.driver_code ?? ""} onChange={(event) => set("driver_code", event.target.value)}>
                  <option value="">Unassigned</option>
                  {(resources.data?.drivers ?? []).filter((driver) => driver.duty_status === "on_duty").map((driver) => (
                    <option key={driver.code} value={driver.code}>{driver.code} · {driver.name}</option>
                  ))}
                </Select>
              </div>
              <InlineNote tone="warning">
                Trucks need an on-duty driver and at least 15% fuel before they can enter transit.
              </InlineNote>
            </>
          ) : null}

          {kind === "driver" ? (
            <>
              <div>
                <Label>Full name</Label>
                <Input value={values.name ?? ""} onChange={(event) => set("name", event.target.value)} />
              </div>
              <div>
                <Label>Duty status</Label>
                <Select value={values.duty_status ?? "on_duty"} onChange={(event) => set("duty_status", event.target.value)}>
                  {STATUS_OPTIONS.driver.map((value) => <option key={value} value={value}>{titleCase(value)}</option>)}
                </Select>
              </div>
              <div>
                <Label>Shift</Label>
                <Input value={values.shift ?? ""} onChange={(event) => set("shift", event.target.value)} />
              </div>
              <div>
                <Label hint="0–100">Workload</Label>
                <Input type="number" min={0} max={100} value={values.workload ?? "0"} onChange={(event) => set("workload", event.target.value)} />
              </div>
              <div className="sm:col-span-2">
                <Label hint="comma separated">Skills</Label>
                <Input value={values.skills ?? ""} onChange={(event) => set("skills", event.target.value)} placeholder="terminal-truck, reefer, hazmat" />
              </div>
            </>
          ) : null}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" loading={mutation.isPending} disabled={!isEdit && !code} onClick={() => mutation.mutate()}>
            {isEdit ? "Save changes" : `Register ${KIND_LABEL[kind]}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({ kind, code, onClose }: { kind: Kind; code: string | null; onClose: () => void }) {
  const history = useQuery({
    queryKey: ["resource-history", kind, code],
    queryFn: () => api.resources.history(kind, code as string),
    enabled: Boolean(code),
  });

  return (
    <Dialog open={Boolean(code)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg" title={`${code ?? ""} history`} description="Assignments, operational events, maintenance and container touchpoints.">
        {history.isLoading || !history.data ? (
          <Skeleton className="h-48" />
        ) : (
          <div className="space-y-4">
            <div>
              <div className="micro-label mb-1.5">Assignments</div>
              {history.data.assignments.length === 0 ? (
                <p className="text-[11.5px] text-slate-600">No allocation history.</p>
              ) : (
                <div className="space-y-1">
                  {history.data.assignments.slice(0, 6).map((row) => (
                    <div key={row.id} className="flex items-center justify-between gap-2 rounded border border-line bg-ink-900/40 px-2.5 py-1.5 text-[11.5px]">
                      <span className="flex items-center gap-2">
                        <Badge className="normal-case">{row.kind}</Badge>
                        <span className="font-mono text-slate-300">{row.ship_code ?? "—"}</span>
                        <span className="text-slate-600">{row.status}</span>
                      </span>
                      <span className="font-mono text-2xs text-cyan-300">{row.score.toFixed(0)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="micro-label mb-1.5">Maintenance</div>
              {history.data.maintenance.length === 0 ? (
                <p className="text-[11.5px] text-slate-600">No maintenance tasks.</p>
              ) : (
                <div className="space-y-1">
                  {history.data.maintenance.map((task) => (
                    <div key={task.code} className="flex items-center justify-between rounded border border-line bg-ink-900/40 px-2.5 py-1.5 text-[11.5px]">
                      <span className="font-mono text-slate-300">{task.code}</span>
                      <span className="text-slate-500">{task.reason}</span>
                      <Badge className="normal-case">{task.status}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <div className="micro-label mb-1.5">Events</div>
              <div className="max-h-52 space-y-1 overflow-y-auto scroll-thin">
                {history.data.events.slice(0, 10).map((event) => (
                  <div key={event.id} className="flex items-start justify-between gap-3 rounded border border-line bg-ink-900/40 px-2.5 py-1.5 text-[11.5px]">
                    <span className="min-w-0">
                      <span className="block truncate text-slate-300">{event.title}</span>
                      <span className="block truncate text-[10.5px] text-slate-600">{event.message}</span>
                    </span>
                    <span className="shrink-0 font-mono text-3xs text-slate-600">{fmtDateTime(event.ts)}</span>
                  </div>
                ))}
                {history.data.events.length === 0 ? <p className="text-[11.5px] text-slate-600">No events recorded.</p> : null}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function FleetPage() {
  const resources = useResources();
  const [dialog, setDialog] = useState<{ kind: Kind; entity: Entity | null } | null>(null);
  const [history, setHistory] = useState<{ kind: Kind; code: string } | null>(null);
  const [deactivate, setDeactivate] = useState<{ kind: Kind; code: string } | null>(null);
  const [filter, setFilter] = useState("all");

  const remove = useMutation({
    mutationFn: async ({ kind, code }: { kind: Kind; code: string }) => {
      if (kind === "crane") return api.resources.deleteCrane(code);
      if (kind === "vehicle") return api.resources.deleteVehicle(code);
      return api.resources.deleteDriver(code);
    },
    onSuccess: () => {
      toast.success("Resource withdrawn", { description: "It is now unavailable to the optimizer until returned to service." });
      queryClient.invalidateQueries({ queryKey: keys.resources });
      queryClient.invalidateQueries({ queryKey: keys.dashboard });
      setDeactivate(null);
    },
    onError: (error) => toast.error("Could not deactivate resource", { description: error.message }),
  });

  const summary = resources.data?.summary ?? {};
  const cranes = resources.data?.cranes ?? [];
  const vehicles = resources.data?.vehicles ?? [];
  const drivers = resources.data?.drivers ?? [];

  const filters = useMemo(() => ["all", ...new Set([...STATUS_OPTIONS.crane, ...STATUS_OPTIONS.vehicle, ...STATUS_OPTIONS.driver])], []);
  const matches = (status: string) => filter === "all" || status === filter;

  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow="Operations · fleet register"
        title="Fleet & equipment"
        description="Cranes, terminal trucks and drivers are first-class resources. Register, edit status, inspect history and withdraw equipment — every change flows into the twin and optimizer."
        meta={
          <>
            <Badge className="border-cyan-400/25 bg-cyan-400/[0.07] text-cyan-300">{fmtNumber(cranes.length)} cranes · {fmtNumber(vehicles.length)} trucks · {fmtNumber(drivers.length)} drivers</Badge>
            <span className="font-mono text-3xs uppercase tracking-[0.08em] text-slate-600">Operator writes are audited</span>
          </>
        }
        actions={
          <Select value={filter} onChange={(event) => setFilter(event.target.value)} className="h-8 w-40">
            {filters.map((value) => <option key={value} value={value}>{value === "all" ? "All statuses" : titleCase(value)}</option>)}
          </Select>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
        <KpiTile label="Cranes idle" value={fmtNumber(summary.cranes_available)} hint={`${summary.cranes_active ?? 0} active`} icon={<Wrench size={14} />} tone="green" />
        <KpiTile label="Cranes down" value={fmtNumber(summary.cranes_down)} hint="maintenance / fault" icon={<Wrench size={14} />} tone="amber" />
        <KpiTile label="Avg crane health" value={fmtNumber(summary.avg_crane_health, 1)} unit="%" hint="fleet condition" icon={<Gauge size={14} />} tone="cyan" />
        <KpiTile label="Trucks available" value={fmtNumber(summary.vehicles_available)} hint={`${summary.vehicles_engaged ?? 0} engaged`} icon={<Truck size={14} />} tone="green" />
        <KpiTile label="Avg fuel" value={fmtNumber(summary.avg_fuel, 1)} unit="%" hint="transit floor 15%" icon={<Fuel size={14} />} tone="amber" />
        <KpiTile label="Drivers on duty" value={fmtNumber(summary.drivers_on_duty)} hint={`${drivers.length} rostered`} icon={<UserRound size={14} />} tone="cyan" />
      </div>

      <Tabs defaultValue="cranes">
        <TabsList>
          <TabsTrigger value="cranes" count={cranes.length}>Cranes</TabsTrigger>
          <TabsTrigger value="vehicles" count={vehicles.length}>Terminal trucks</TabsTrigger>
          <TabsTrigger value="drivers" count={drivers.length}>Drivers</TabsTrigger>
        </TabsList>

        <TabsContent value="cranes">
          <Panel>
            <PanelHeader
              title="Quay & yard cranes"
              description="Health, utilisation and berth assignment. Withdrawing an active crane is blocked until its assignment is released."
              icon={<Wrench size={15} />}
              action={<Button size="sm" variant="primary" onClick={() => setDialog({ kind: "crane", entity: null })}><Plus size={13} /> Add crane</Button>}
            />
            {resources.isLoading ? (
              <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-9" />)}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr><th>Code</th><th>Type</th><th>Berth</th><th>Status</th><th>Health</th><th className="w-32">Utilisation</th><th className="text-right">Moves</th><th>Last service</th><th className="text-right">Actions</th></tr>
                  </thead>
                  <tbody>
                    {cranes.filter((crane) => matches(crane.status)).map((crane) => (
                      <tr key={crane.code}>
                        <td className="font-mono text-[11.5px] text-slate-200">{crane.code}</td>
                        <td>{crane.crane_type}</td>
                        <td className="font-mono text-[11px]">{crane.dock_code ?? "—"}</td>
                        <td><Badge className={cn("normal-case tracking-[0.03em]", RESOURCE_STATUS_STYLE[crane.status])}>{crane.status}</Badge></td>
                        <td className="w-24"><Progress value={crane.health} barClassName={crane.health < 55 ? "bg-red-400" : crane.health < 75 ? "bg-amber-400" : "bg-emerald-400"} /><span className="mt-0.5 font-mono text-3xs text-slate-500">{crane.health.toFixed(0)}%</span></td>
                        <td><Progress value={crane.utilization} barClassName="bg-signal-cyan" /><span className="mt-0.5 font-mono text-3xs text-slate-500">{crane.utilization.toFixed(0)}%</span></td>
                        <td className="text-right font-mono tabular-nums text-slate-400">{fmtNumber(crane.moves_total)}</td>
                        <td className="font-mono text-3xs text-slate-600">{crane.last_maintenance ? fmtDateTime(crane.last_maintenance) : "—"}</td>
                        <td>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" aria-label={`Edit ${crane.code}`} onClick={() => setDialog({ kind: "crane", entity: crane })}><Pencil size={13} /></Button>
                            <Button variant="ghost" size="icon" aria-label={`History ${crane.code}`} onClick={() => setHistory({ kind: "crane", code: crane.code })}><History size={13} /></Button>
                            <Button variant="ghost" size="icon" aria-label={`Deactivate ${crane.code}`} onClick={() => setDeactivate({ kind: "crane", code: crane.code })}><Trash2 size={13} /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="vehicles">
          <Panel>
            <PanelHeader
              title="Terminal trucks"
              description="Fuel and health gate transit; a truck without an on-duty driver cannot be allocated."
              icon={<Truck size={15} />}
              action={<Button size="sm" variant="primary" onClick={() => setDialog({ kind: "vehicle", entity: null })}><Plus size={13} /> Add truck</Button>}
            />
            {resources.isLoading ? (
              <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-9" />)}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr><th>Code</th><th>Status</th><th>Driver</th><th>Task</th><th className="w-28">Fuel</th><th className="w-28">Health</th><th>Capacity</th><th className="text-right">Trips</th><th className="text-right">Actions</th></tr>
                  </thead>
                  <tbody>
                    {vehicles.filter((vehicle) => matches(vehicle.status)).map((vehicle) => (
                      <tr key={vehicle.code}>
                        <td className="font-mono text-[11.5px] text-slate-200">{vehicle.code}</td>
                        <td><Badge className={cn("normal-case tracking-[0.03em]", RESOURCE_STATUS_STYLE[vehicle.status])}>{vehicle.status.replace(/_/g, " ")}</Badge></td>
                        <td>{vehicle.driver_name ? <span>{vehicle.driver_name}<span className="ml-1 font-mono text-3xs text-slate-600">{vehicle.driver_code}</span></span> : <span className="text-slate-600">Unassigned</span>}</td>
                        <td className="max-w-[180px] truncate text-[11px] text-slate-500">{vehicle.current_task ?? "—"}</td>
                        <td><Progress value={vehicle.fuel} barClassName={vehicle.fuel < 15 ? "bg-red-400" : vehicle.fuel < 35 ? "bg-amber-400" : "bg-emerald-400"} /><span className="mt-0.5 font-mono text-3xs text-slate-500">{vehicle.fuel.toFixed(0)}%</span></td>
                        <td><Progress value={vehicle.health} barClassName={vehicle.health < 50 ? "bg-red-400" : "bg-signal-cyan"} /><span className="mt-0.5 font-mono text-3xs text-slate-500">{vehicle.health.toFixed(0)}%</span></td>
                        <td className="font-mono text-[11px]">{vehicle.capacity_t} t</td>
                        <td className="text-right font-mono tabular-nums text-slate-400">{fmtNumber(vehicle.total_trips)}</td>
                        <td>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" aria-label={`Edit ${vehicle.code}`} onClick={() => setDialog({ kind: "vehicle", entity: vehicle })}><Pencil size={13} /></Button>
                            <Button variant="ghost" size="icon" aria-label={`History ${vehicle.code}`} onClick={() => setHistory({ kind: "vehicle", code: vehicle.code })}><History size={13} /></Button>
                            <Button variant="ghost" size="icon" aria-label={`Deactivate ${vehicle.code}`} onClick={() => setDeactivate({ kind: "vehicle", code: vehicle.code })}><Trash2 size={13} /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="drivers">
          <Panel>
            <PanelHeader
              title="Driver duty roster"
              description="Only on-duty drivers with a free vehicle can be assigned to a dispatch."
              icon={<UserRound size={15} />}
              action={<Button size="sm" variant="primary" onClick={() => setDialog({ kind: "driver", entity: null })}><Plus size={13} /> Add driver</Button>}
            />
            {resources.isLoading ? (
              <div className="space-y-2 p-4">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-9" />)}</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base">
                  <thead>
                    <tr><th>Code</th><th>Name</th><th>Duty</th><th>Shift</th><th>Skills</th><th>Vehicle</th><th className="w-28">Workload</th><th className="text-right">Actions</th></tr>
                  </thead>
                  <tbody>
                    {drivers.filter((driver) => matches(driver.duty_status)).map((driver) => (
                      <tr key={driver.code}>
                        <td className="font-mono text-[11.5px] text-slate-200">{driver.code}</td>
                        <td>{driver.name}</td>
                        <td><Badge className={cn("normal-case tracking-[0.03em]", RESOURCE_STATUS_STYLE[driver.duty_status])}>{driver.duty_status.replace(/_/g, " ")}</Badge></td>
                        <td className="text-[11px] text-slate-400">{driver.shift}</td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {driver.skills.map((skill) => <Badge key={skill} className="normal-case tracking-[0.03em]">{skill}</Badge>)}
                          </div>
                        </td>
                        <td className="font-mono text-[11px]">{driver.vehicle_code ?? "—"}</td>
                        <td><Progress value={driver.workload} barClassName={driver.workload > 80 ? "bg-amber-400" : "bg-signal-cyan"} /><span className="mt-0.5 font-mono text-3xs text-slate-500">{driver.workload.toFixed(0)}%</span></td>
                        <td>
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" aria-label={`Edit ${driver.code}`} onClick={() => setDialog({ kind: "driver", entity: driver })}><Pencil size={13} /></Button>
                            <Button variant="ghost" size="icon" aria-label={`History ${driver.code}`} onClick={() => setHistory({ kind: "driver", code: driver.code })}><History size={13} /></Button>
                            <Button variant="ghost" size="icon" aria-label={`Deactivate ${driver.code}`} onClick={() => setDeactivate({ kind: "driver", code: driver.code })}><Trash2 size={13} /></Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </TabsContent>
      </Tabs>

      {dialog ? (
        <ResourceDialog
          key={`${dialog.kind}-${dialog.entity?.id ?? "new"}`}
          open
          onOpenChange={(open) => !open && setDialog(null)}
          kind={dialog.kind}
          entity={dialog.entity}
        />
      ) : null}

      <HistoryDialog kind={history?.kind ?? "crane"} code={history?.code ?? null} onClose={() => setHistory(null)} />

      <ConfirmDialog
        open={Boolean(deactivate)}
        onOpenChange={(open) => !open && setDeactivate(null)}
        title={`Withdraw ${deactivate?.code ?? ""} from service?`}
        description="This is an availability change, not a deletion. The resource remains in the register for audit and can be returned to service later."
        confirmLabel="Withdraw resource"
        pending={remove.isPending}
        onConfirm={() => deactivate && remove.mutate(deactivate)}
      >
        <div className="space-y-2">
          <p>The optimiser will immediately exclude this {deactivate ? KIND_LABEL[deactivate.kind] : "resource"} from new allocations.</p>
          {deactivate?.kind === "crane" || deactivate?.kind === "vehicle" ? (
            <p className="rounded border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-amber-200/90">
              Active tasks must be released first; the backend rejects the change otherwise.
            </p>
          ) : (
            <p className="rounded border border-amber-500/25 bg-amber-500/[0.06] px-3 py-2 text-amber-200/90">
              A driver assigned to a vehicle cannot be withdrawn until the vehicle is reassigned.
            </p>
          )}
        </div>
      </ConfirmDialog>

      <InlineNote tone="info">
        Equipment health and duty status are operational records. Predictive maintenance suggestions appear under Alerts &amp; maintenance and never claim to predict a failure.
      </InlineNote>
    </div>
  );
}
