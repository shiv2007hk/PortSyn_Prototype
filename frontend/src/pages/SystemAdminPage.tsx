import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  Clock,
  Play,
  Pause,
  RotateCcw,
  Sliders,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { fmtDateTime } from "@/lib/format";
import { DEMO_ACCOUNTS } from "@/lib/rbac";
import { Badge, Button, Input, Label, Skeleton } from "@/components/ui/primitives";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageIntro } from "@/components/common/Bits";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";

export function SystemAdminPage() {
  const queryClient = useQueryClient();
  const [resetOpen, setResetOpen] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Queries
  const settingsQuery = useQuery({
    queryKey: ["system", "settings"],
    queryFn: () => api.system.settings(),
  });

  const auditQuery = useQuery({
    queryKey: ["system", "audit"],
    queryFn: () => api.system.audit(1, 40),
  });

  // State for health weights
  const [weights, setWeights] = useState<Record<string, number> | null>(null);

  const currentWeights = weights ?? settingsQuery.data?.health_weights ?? {};

  const weightsMutation = useMutation({
    mutationFn: (newWeights: Record<string, number>) => api.system.updateHealthWeights(newWeights),
    onSuccess: (data) => {
      toast.success("Health weights updated", { description: data.note });
      setWeights(data.weights);
      queryClient.invalidateQueries({ queryKey: ["system", "settings"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    },
    onError: (err) => {
      toast.error("Failed to update weights", { description: err instanceof Error ? err.message : "Error" });
    },
  });

  const clockMutation = useMutation({
    mutationFn: (body: { running?: boolean; speed?: number }) => api.system.updateClock(body),
    onSuccess: () => {
      toast.success("Simulation clock updated");
      queryClient.invalidateQueries({ queryKey: ["system", "settings"] });
      queryClient.invalidateQueries({ queryKey: ["system", "info"] });
    },
    onError: (err) => {
      toast.error("Failed to update clock", { description: err instanceof Error ? err.message : "Error" });
    },
  });

  const resetDemo = async () => {
    setResetting(true);
    try {
      const res = await api.system.resetDemo();
      toast.success(res.message, { description: `Deterministic seed ${res.seed} reseeded.` });
      await queryClient.invalidateQueries();
      setResetOpen(false);
    } catch (err) {
      toast.error("Reset failed", { description: err instanceof Error ? err.message : "Error" });
    } finally {
      setResetting(false);
    }
  };

  const simClock = settingsQuery.data?.sim_clock ?? { running: true, speed: 1.0 };

  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow="Administration · Terminal Authority"
        title="System configuration & role management"
        description="Super Admin central console for user role assignments, port health weight formulas, live simulation engine controls, and immutable operational audit logs."
        meta={
          <>
            <Badge className="border-purple-500/30 bg-purple-500/10 text-purple-300">Super Admin Mode</Badge>
            <span className="font-mono text-3xs uppercase tracking-[0.08em] text-slate-500">
              6 Roles Active · RBAC Enforced
            </span>
          </>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="danger" size="sm" onClick={() => setResetOpen(true)}>
              <RotateCcw size={13} /> Reset Demo Dataset
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="roles" className="space-y-4">
        <TabsList>
          <TabsTrigger value="roles">
            <span className="flex items-center gap-1.5"><Users size={14} /> Roles &amp; Demo Users</span>
          </TabsTrigger>
          <TabsTrigger value="weights">
            <span className="flex items-center gap-1.5"><Sliders size={14} /> Health Scoring Weights</span>
          </TabsTrigger>
          <TabsTrigger value="clock">
            <span className="flex items-center gap-1.5"><Clock size={14} /> Simulation Clock</span>
          </TabsTrigger>
          <TabsTrigger value="audit">
            <span className="flex items-center gap-1.5"><Activity size={14} /> Audit Trail</span>
          </TabsTrigger>
        </TabsList>

        {/* Roles Tab */}
        <TabsContent value="roles" className="space-y-3">
          <div className="rounded-panel border border-line bg-ink-800/60 p-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h3 className="font-display text-[15px] font-semibold text-slate-100">Configured Role Profiles</h3>
                <p className="text-xs text-slate-400">
                  Each role enforces distinct navigation permissions and backend API boundaries.
                </p>
              </div>
              <Badge className="border-cyan-400/30 bg-cyan-400/10 text-cyan-300">6 Core Roles + Supervisor</Badge>
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {DEMO_ACCOUNTS.map((acc) => (
                <div
                  key={acc.role}
                  className="rounded-lg border border-line bg-ink-850/80 p-3.5 transition-colors hover:border-line-strong"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-display text-sm font-semibold text-slate-200">{acc.title}</span>
                    <span className={`rounded border px-2 py-0.5 font-mono text-[9.5px] uppercase ${acc.accent}`}>
                      {acc.badge}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{acc.description}</p>
                  <div className="mt-3 border-t border-line/60 pt-2 font-mono text-[11px] text-slate-500">
                    <div className="text-slate-300">{acc.name}</div>
                    <div className="truncate text-slate-500">{acc.email}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Health Weights Tab */}
        <TabsContent value="weights" className="space-y-3">
          <div className="rounded-panel border border-line bg-ink-800/60 p-4">
            <div className="border-b border-line pb-3">
              <h3 className="font-display text-[15px] font-semibold text-slate-100">Port Health Score Weights</h3>
              <p className="text-xs text-slate-400">
                Adjust the scoring influence of each component. Weights are normalized automatically to sum to 1.0.
              </p>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(currentWeights).map(([key, val]) => (
                <div key={key} className="rounded-lg border border-line bg-ink-850/80 p-3">
                  <Label>
                    {key.replace(/_/g, " ")}
                  </Label>
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      type="number"
                      step="0.05"
                      min="0.05"
                      max="1.0"
                      value={val}
                      onChange={(e) => {
                        const parsed = parseFloat(e.target.value) || 0;
                        setWeights({ ...currentWeights, [key]: parsed });
                      }}
                      className="h-8 font-mono text-xs"
                    />
                    <span className="font-mono text-xs text-slate-500">({(val * 100).toFixed(0)}%)</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 flex items-center justify-end gap-2 border-t border-line/60 pt-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setWeights(settingsQuery.data?.health_weights ?? {})}
              >
                Reset to Current
              </Button>
              <Button
                variant="primary"
                size="sm"
                loading={weightsMutation.isPending}
                onClick={() => weightsMutation.mutate(currentWeights)}
              >
                Save &amp; Recalculate Health
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* Simulation Clock Tab */}
        <TabsContent value="clock" className="space-y-3">
          <div className="rounded-panel border border-line bg-ink-800/60 p-4">
            <div className="border-b border-line pb-3">
              <h3 className="font-display text-[15px] font-semibold text-slate-100">Live Simulation Control</h3>
              <p className="text-xs text-slate-400">
                Pause or modify the tick velocity of vessel arrivals, crane lifts, and yard trucks.
              </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Button
                  variant={simClock.running ? "outline" : "primary"}
                  size="sm"
                  onClick={() => clockMutation.mutate({ running: !simClock.running })}
                >
                  {simClock.running ? <Pause size={13} /> : <Play size={13} />}
                  {simClock.running ? "Pause Engine" : "Resume Engine"}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">Velocity multiplier:</span>
                {[0.5, 1.0, 2.0, 5.0].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    onClick={() => clockMutation.mutate({ speed: spd })}
                    className={`rounded px-2.5 py-1 font-mono text-xs transition-colors ${
                      simClock.speed === spd
                        ? "bg-marine-600 text-white"
                        : "border border-line bg-ink-850 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    {spd}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Audit Trail Tab */}
        <TabsContent value="audit" className="space-y-3">
          <div className="rounded-panel border border-line bg-ink-800/60 p-4">
            <div className="border-b border-line pb-3">
              <h3 className="font-display text-[15px] font-semibold text-slate-100">Immutable Audit Records</h3>
              <p className="text-xs text-slate-400">
                Log of all operational overrides, berthing decisions, resource assignments, and system updates.
              </p>
            </div>

            {auditQuery.isLoading ? (
              <div className="space-y-2 py-4">
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
                <Skeleton className="h-10" />
              </div>
            ) : (
              <div className="mt-3 overflow-x-auto scroll-thin">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-line text-slate-500">
                    <tr>
                      <th className="pb-2 font-mono uppercase tracking-wider">Timestamp</th>
                      <th className="pb-2 font-mono uppercase tracking-wider">Actor</th>
                      <th className="pb-2 font-mono uppercase tracking-wider">Action</th>
                      <th className="pb-2 font-mono uppercase tracking-wider">Entity</th>
                      <th className="pb-2 font-mono uppercase tracking-wider">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line/60">
                    {(auditQuery.data?.items ?? []).map((row) => (
                      <tr key={row.id} className="text-slate-300 hover:bg-ink-800/40">
                        <td className="py-2.5 font-mono text-3xs text-slate-500 whitespace-nowrap">
                          {fmtDateTime(row.ts)}
                        </td>
                        <td className="py-2.5 font-medium text-slate-200 whitespace-nowrap">{row.actor}</td>
                        <td className="py-2.5 whitespace-nowrap">
                          <span className="rounded bg-ink-750 px-1.5 py-0.5 font-mono text-[10px] text-cyan-300">
                            {row.action}
                          </span>
                        </td>
                        <td className="py-2.5 font-mono text-3xs text-slate-400 whitespace-nowrap">
                          {row.entity_type}:{row.entity_code}
                        </td>
                        <td className="max-w-xs truncate py-2.5 text-slate-400">{row.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Reset Dialog */}
      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent
          size="sm"
          title="Reset the demo dataset?"
          description="This action clears all operational data and reseeds the deterministic demo snapshot. User accounts and sessions remain intact."
        >
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={resetting} onClick={resetDemo}>
              Confirm Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
