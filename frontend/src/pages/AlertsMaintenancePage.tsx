import { useMemo, useState } from "react";
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  ClipboardCheck,
  Gauge,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAlertSummary, useAlerts, useMaintenance, useResources, queryClient, keys } from "@/lib/hooks";
import { cn, fmtAgo, fmtDateTime, fmtNumber, titleCase } from "@/lib/format";
import { ALERT_STATUS_STYLE, SEVERITY_STYLE, riskStyle } from "@/lib/status";
import {
  Badge,
  Button,
  EmptyState,
  InlineNote,
  Input,
  Label,
  Panel,
  PanelHeader,
  Select,
  Skeleton,
  Textarea,
} from "@/components/ui/primitives";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KpiTile, PageIntro } from "@/components/common/Bits";
import type { Alert, MaintenanceTask, RiskEntry } from "@/lib/types";

const MAINTENANCE_FLOW: Record<string, string[]> = {
  scheduled: ["in_progress", "completed"],
  in_progress: ["completed"],
  completed: [],
};

function CreateTaskDialog({
  open,
  onOpenChange,
  preset,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preset?: { equipment_type: "crane" | "vehicle"; equipment_code: string } | null;
}) {
  const resources = useResources();
  const [equipmentType, setEquipmentType] = useState<"crane" | "vehicle">(preset?.equipment_type ?? "crane");
  const [equipmentCode, setEquipmentCode] = useState(preset?.equipment_code ?? "");
  const [reason, setReason] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [notes, setNotes] = useState("");

  const options = equipmentType === "crane" ? resources.data?.cranes ?? [] : resources.data?.vehicles ?? [];

  const mutation = useMutation({
    mutationFn: () =>
      api.maintenance.createTask({
        equipment_type: equipmentType,
        equipment_code: equipmentCode,
        reason: reason || undefined,
        scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
        notes: notes || undefined,
      }),
    onSuccess: (task) => {
      toast.success(`${task.code} scheduled`, { description: `${task.equipment_code} · risk ${task.risk_score.toFixed(0)}` });
      queryClient.invalidateQueries({ queryKey: keys.maintenance });
      queryClient.invalidateQueries({ queryKey: keys.alerts() });
      onOpenChange(false);
      setReason("");
      setNotes("");
      setScheduledFor("");
    },
    onError: (error) => toast.error("Maintenance task rejected", { description: error.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md" title="Schedule maintenance" description="Tasks are advisory work orders. Predictive risk is never presented as a guaranteed failure.">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Equipment type</Label>
            <Select
              value={equipmentType}
              onChange={(event) => {
                setEquipmentType(event.target.value as "crane" | "vehicle");
                setEquipmentCode("");
              }}
            >
              <option value="crane">Crane</option>
              <option value="vehicle">Terminal truck</option>
            </Select>
          </div>
          <div>
            <Label>Equipment</Label>
            <Select value={equipmentCode} onChange={(event) => setEquipmentCode(event.target.value)}>
              <option value="">Select {equipmentType}</option>
              {options.map((row) => <option key={row.code} value={row.code}>{row.code}</option>)}
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Label>Reason</Label>
            <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="e.g. Preventive service before peak berth window" />
          </div>
          <div>
            <Label hint="UTC">Scheduled for</Label>
            <Input type="datetime-local" value={scheduledFor} onChange={(event) => setScheduledFor(event.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <Label hint="optional">Notes</Label>
            <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-[64px]" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="primary" loading={mutation.isPending} disabled={!equipmentCode} onClick={() => mutation.mutate()}>Create task</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function AlertsMaintenancePage() {
  const [severity, setSeverity] = useState("");
  const [status, setStatus] = useState("active");
  const [taskOpen, setTaskOpen] = useState(false);
  const [preset, setPreset] = useState<{ equipment_type: "crane" | "vehicle"; equipment_code: string } | null>(null);
  const summary = useAlertSummary();
  const alerts = useAlerts({ severity: severity || undefined, status: status || undefined, page_size: 100 });
  const maintenance = useMaintenance();

  const update = useMutation<Alert | MaintenanceTask, Error, { id: number; action: "acknowledge" | "resolve" | "maintenance" }>({
    mutationFn: ({ id, action }) => {
      if (action === "acknowledge") return api.alerts.acknowledge(id);
      if (action === "resolve") return api.alerts.resolve(id);
      return api.alerts.toMaintenance(id);
    },
    onSuccess: (_result, variables) => {
      const label = variables.action === "maintenance" ? "Maintenance task created" : variables.action === "acknowledge" ? "Alert acknowledged" : "Alert resolved";
      toast.success(label, { description: "Alert summary, dashboard and maintenance register refreshed." });
      queryClient.invalidateQueries({ queryKey: keys.alerts() });
      queryClient.invalidateQueries({ queryKey: keys.alertSummary });
      queryClient.invalidateQueries({ queryKey: keys.maintenance });
      queryClient.invalidateQueries({ queryKey: keys.dashboard });
    },
    onError: (error) => toast.error("Alert action rejected", { description: error.message }),
  });

  const scan = useMutation({
    mutationFn: () => api.alerts.scan(),
    onSuccess: (result) => {
      toast.success(result.created ? `${result.created} new alert(s)` : "No new conditions detected", {
        description: "Rule-based scan across congestion, equipment, fuel, storage and dispatch.",
      });
      queryClient.invalidateQueries({ queryKey: keys.alerts() });
      queryClient.invalidateQueries({ queryKey: keys.alertSummary });
    },
    onError: (error) => toast.error("Scan failed", { description: error.message }),
  });

  const taskUpdate = useMutation({
    mutationFn: ({ code, status: next }: { code: string; status: string }) => api.maintenance.updateTask(code, next),
    onSuccess: (task) => {
      toast.success(`${task.code} → ${task.status.replace(/_/g, " ")}`, { description: task.status === "completed" ? `${task.equipment_code} returned to service.` : "Maintenance register updated." });
      queryClient.invalidateQueries({ queryKey: keys.maintenance });
      queryClient.invalidateQueries({ queryKey: keys.resources });
    },
    onError: (error) => toast.error("Task update rejected", { description: error.message }),
  });

  const risks = maintenance.data?.risks ?? [];
  const riskBuckets = useMemo(() => {
    return {
      critical: risks.filter((risk) => risk.level === "critical").length,
      warning: risks.filter((risk) => risk.level === "warning").length,
      normal: risks.filter((risk) => risk.level === "normal").length,
    };
  }, [risks]);

  const openTask = (risk?: RiskEntry) => {
    setPreset(risk ? { equipment_type: risk.equipment_type, equipment_code: risk.code } : null);
    setTaskOpen(true);
  };

  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow="Intelligence · exceptions & upkeep"
        title="Alerts & maintenance"
        description="Rule-based alerts across congestion, equipment, fuel, storage and dispatch — plus a transparent risk register that recommends service windows. Nothing here claims to predict a failure."
        meta={
          <>
            <Badge className="border-red-500/25 bg-red-500/10 text-red-300">{summary.data?.active ?? 0} active</Badge>
            <span className="font-mono text-3xs uppercase tracking-[0.08em] text-slate-600">{summary.data?.acknowledged ?? 0} acknowledged · {summary.data?.resolved ?? 0} resolved</span>
          </>
        }
        actions={
          <Button variant="secondary" size="sm" loading={scan.isPending} onClick={() => scan.mutate()}>
            <BellRing size={13} /> Run alert scan
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
        <KpiTile label="Active alerts" value={fmtNumber(summary.data?.active)} icon={<BellRing size={14} />} tone="red" />
        <KpiTile label="Critical" value={fmtNumber(summary.data?.critical)} hint="active only" icon={<AlertTriangle size={14} />} tone="red" />
        <KpiTile label="Warnings" value={fmtNumber(summary.data?.warning)} hint="active only" icon={<AlertTriangle size={14} />} tone="amber" />
        <KpiTile label="Acknowledged" value={fmtNumber(summary.data?.acknowledged)} hint="owner assigned" icon={<CheckCircle2 size={14} />} tone="cyan" />
        <KpiTile label="Open tasks" value={fmtNumber(maintenance.data?.summary.open_tasks)} hint="scheduled / in progress" icon={<Wrench size={14} />} tone="amber" />
        <KpiTile label="High-risk assets" value={fmtNumber(riskBuckets.critical)} hint="advisory register" icon={<Gauge size={14} />} tone="red" />
      </div>

      <Tabs defaultValue="alerts">
        <TabsList>
          <TabsTrigger value="alerts" count={alerts.data?.total}>Alert centre</TabsTrigger>
          <TabsTrigger value="maintenance" count={maintenance.data?.tasks.length}>Predictive maintenance</TabsTrigger>
        </TabsList>

        <TabsContent value="alerts">
          <Panel>
            <PanelHeader
              title="Exception feed"
              description="Active and acknowledged alerts are ordered by severity, then recency."
              icon={<BellRing size={15} />}
              action={
                <div className="flex flex-wrap gap-2">
                  <Select value={severity} onChange={(event) => setSeverity(event.target.value)} className="h-8 w-32">
                    <option value="">All severity</option>
                    {["critical", "warning", "info"].map((value) => <option key={value} value={value}>{value}</option>)}
                  </Select>
                  <Select value={status} onChange={(event) => setStatus(event.target.value)} className="h-8 w-36">
                    <option value="">All statuses</option>
                    {["active", "acknowledged", "resolved"].map((value) => <option key={value} value={value}>{value}</option>)}
                  </Select>
                </div>
              }
            />
            {alerts.isLoading ? (
              <div className="space-y-2 p-4">{Array.from({ length: 6 }).map((_, index) => <Skeleton key={index} className="h-14" />)}</div>
            ) : !alerts.data?.items.length ? (
              <EmptyState title="No alerts in this view" description="Run a scan or clear the filters." action={<Button size="sm" onClick={() => scan.mutate()}>Run alert scan</Button>} />
            ) : (
              <div className="divide-y divide-line/60">
                {alerts.data.items.map((alert) => {
                  const tone = SEVERITY_STYLE[alert.severity] ?? SEVERITY_STYLE.info;
                  const canMaintain = ["crane", "vehicle"].includes(alert.entity_type ?? "");
                  return (
                    <div key={alert.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded border", tone.border, tone.bg)}>
                          <AlertTriangle size={13} className={tone.text} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-[12.5px] font-medium text-slate-200">{alert.title}</span>
                            <Badge className={cn("normal-case tracking-[0.03em]", tone.border, tone.bg, tone.text)}>{alert.severity}</Badge>
                            <Badge className={cn("normal-case tracking-[0.03em]", ALERT_STATUS_STYLE[alert.status])}>{alert.status}</Badge>
                            <span className="font-mono text-3xs uppercase tracking-[0.06em] text-slate-600">{alert.category.replace(/_/g, " ")}</span>
                          </div>
                          <p className="mt-0.5 text-[11.5px] leading-relaxed text-slate-500">{alert.message}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-2 font-mono text-3xs text-slate-600">
                            {alert.entity_code ? <span className="rounded border border-line bg-white/[0.03] px-1 py-px">{alert.entity_code}</span> : null}
                            <span>source {alert.source}</span>
                            <span>·</span>
                            <span>{fmtAgo(alert.created_at)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-1.5 sm:pl-3">
                        {alert.status === "active" ? (
                          <Button variant="secondary" size="sm" loading={update.isPending} onClick={() => update.mutate({ id: alert.id, action: "acknowledge" })}>Acknowledge</Button>
                        ) : null}
                        {alert.status !== "resolved" ? (
                          <Button variant="success" size="sm" loading={update.isPending} onClick={() => update.mutate({ id: alert.id, action: "resolve" })}>Resolve</Button>
                        ) : null}
                        {canMaintain && alert.status !== "resolved" ? (
                          <Button variant="cyan" size="sm" loading={update.isPending} onClick={() => update.mutate({ id: alert.id, action: "maintenance" })}>
                            <Wrench size={12} /> Service
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="maintenance">
          <div className="grid gap-3 xl:grid-cols-12">
            <Panel className="xl:col-span-7">
              <PanelHeader
                title="Risk register"
                description="Advisory risk scored from health, utilisation, fuel and days since service."
                icon={<Gauge size={15} />}
                action={<Button size="sm" variant="primary" onClick={() => openTask()}><Wrench size={13} /> Schedule task</Button>}
              />
              {maintenance.isLoading ? (
                <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-20" />)}</div>
              ) : risks.length === 0 ? (
                <EmptyState title="No risk entries" />
              ) : (
                <div className="grid gap-2 p-3 md:grid-cols-2">
                  {risks.map((risk) => (
                    <div key={`${risk.equipment_type}-${risk.code}`} className="rounded border border-line bg-ink-900/40 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-[12px] text-slate-200">{risk.code}</span>
                          <Badge className={cn("normal-case tracking-[0.03em]", riskStyle(risk.level))}>{risk.level}</Badge>
                        </span>
                        <span className="font-mono text-[15px] tabular-nums text-slate-200">{risk.risk_score.toFixed(0)}</span>
                      </div>
                      <div className="mt-1 text-[11px] text-slate-500">{risk.name} · {risk.status}</div>
                      <div className="mt-2 space-y-1">
                        {risk.factors.map((factor) => (
                          <div key={factor.label} className="flex items-center justify-between gap-2 text-[10.5px]">
                            <span className="text-slate-600">{factor.label}</span>
                            <span className="font-mono text-slate-400">{factor.value}</span>
                          </div>
                        ))}
                      </div>
                      <p className="mt-2 text-[10.5px] leading-relaxed text-amber-200/70">{risk.recommendation}</p>
                      <div className="mt-2 flex justify-end">
                        <Button variant="ghost" size="sm" onClick={() => openTask(risk)}>Schedule service</Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="border-t border-line px-4 py-2.5">
                <p className="text-[10.5px] leading-relaxed text-slate-600">{maintenance.data?.disclaimer}</p>
              </div>
            </Panel>

            <div className="space-y-3 xl:col-span-5">
              <Panel>
                <PanelHeader title="Work orders" description="Scheduled, in progress and completed maintenance." icon={<ClipboardCheck size={15} />} />
                {maintenance.isLoading ? (
                  <div className="space-y-2 p-4">{Array.from({ length: 3 }).map((_, index) => <Skeleton key={index} className="h-12" />)}</div>
                ) : !maintenance.data?.tasks.length ? (
                  <EmptyState title="No work orders" description="Schedule service from the risk register or from an equipment alert." />
                ) : (
                  <div className="divide-y divide-line/60">
                    {maintenance.data.tasks.map((task) => (
                      <div key={task.code} className="px-4 py-2.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11.5px] text-slate-200">{task.code}</span>
                            <Badge className="normal-case">{task.equipment_type}</Badge>
                            <span className="font-mono text-3xs text-slate-500">{task.equipment_code}</span>
                          </div>
                          <Badge className={cn("normal-case tracking-[0.03em]", task.status === "completed" ? "border-emerald-500/25 bg-emerald-500/[0.08] text-emerald-300" : task.status === "in_progress" ? "border-amber-500/25 bg-amber-500/10 text-amber-300" : "border-sky-500/25 bg-sky-500/10 text-sky-300")}>
                            {task.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <p className="mt-0.5 text-[10.5px] text-slate-500">{task.reason}</p>
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <span className="font-mono text-3xs text-slate-600">
                            risk {task.risk_score.toFixed(0)} · {task.scheduled_for ? fmtDateTime(task.scheduled_for) : "unscheduled"}
                          </span>
                          <div className="flex gap-1">
                            {(MAINTENANCE_FLOW[task.status] ?? []).map((next) => (
                              <Button key={next} variant={next === "completed" ? "success" : "secondary"} size="sm" loading={taskUpdate.isPending} onClick={() => taskUpdate.mutate({ code: task.code, status: next })}>
                                {next === "in_progress" ? "Start" : "Complete"}
                              </Button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Panel>

              <Panel>
                <PanelHeader title="How risk is scored" description="Transparent rule-based inputs, no black box." icon={<ShieldCheck size={15} />} />
                <div className="space-y-1.5 px-4 py-3.5">
                  {[
                    "Equipment health below the safe floor raises risk.",
                    "High utilisation and long service intervals add weight.",
                    "Low fuel on trucks contributes to near-term breakdown risk.",
                    "Output is an advisory maintenance recommendation, reviewed by a human.",
                  ].map((line) => (
                    <p key={line} className="flex gap-2 text-[11px] leading-relaxed text-slate-400">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cyan-400/70" />{line}
                    </p>
                  ))}
                </div>
              </Panel>
            </div>
          </div>

          <div className="mt-3">
            <InlineNote tone="info">
              Predictive maintenance here is rule-based and advisory. PortSync does not claim to predict failures; a human operator decides whether to withdraw equipment.
            </InlineNote>
          </div>
        </TabsContent>
      </Tabs>

      <CreateTaskDialog
        key={`${preset?.equipment_code ?? "new"}-${taskOpen ? "open" : "closed"}`}
        open={taskOpen}
        onOpenChange={setTaskOpen}
        preset={preset}
      />
    </div>
  );
}
