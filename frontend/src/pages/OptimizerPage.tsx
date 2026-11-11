import { useEffect, useMemo, useState } from "react";
import { Calculator, GitCompareArrows, RefreshCw, SlidersHorizontal, Sparkles } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useDocks, useShips, queryClient, keys } from "@/lib/hooks";
import { fmtDateTime } from "@/lib/format";
import { Badge, Button, EmptyState, InlineNote, Input, Label, Panel, PanelHeader, Select, Skeleton } from "@/components/ui/primitives";
import { PageIntro } from "@/components/common/Bits";
import { RecommendationView, type AllocationDecision } from "@/components/operations/RecommendationView";
import type { Recommendation } from "@/lib/types";

const KIND_OPTIONS = [
  { value: "full", label: "Full package", hint: "Berth, crane, trucks, drivers, storage" },
  { value: "dock", label: "Berth only", hint: "Score berth compatibility and congestion" },
  { value: "resources", label: "Resources only", hint: "Cranes, trucks, drivers, storage against the current berth" },
] as const;

export function OptimizerPage() {
  const ships = useShips({ include_departed: false, page_size: 100 });
  const docks = useDocks();
  const [shipCode, setShipCode] = useState("");
  const [kind, setKind] = useState<"full" | "dock" | "resources">("full");
  const [dockCode, setDockCode] = useState("");
  const [containerCode, setContainerCode] = useState("");
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);

  useEffect(() => {
    if (!shipCode && ships.data?.items.length) setShipCode(ships.data.items[0].code);
  }, [ships.data, shipCode]);

  const activeShips = useMemo(
    () => (ships.data?.items ?? []).filter((ship) => ship.status !== "departed"),
    [ships.data],
  );

  const recommend = useMutation({
    mutationFn: () =>
      api.allocations.recommend({
        ship_code: shipCode,
        kind,
        dock_code: kind === "dock" && dockCode ? dockCode : undefined,
        container_code: containerCode.trim() || undefined,
      }),
    onSuccess: (result) => {
      setRecommendation(result);
      toast.success(`${result.ship.code} scored ${result.overall_score.toFixed(1)}/100`, {
        description: result.blockers.length ? "Hard constraints block this plan." : `${result.dock?.code ?? "No berth"} · ${result.crane?.code ?? "no crane"} · ${result.trucks.length} truck(s).`,
      });
    },
    onError: (error) => toast.error("Optimizer could not score this request", { description: error.message }),
  });

  const decide = useMutation({
    mutationFn: ({ decision, reason }: { decision: AllocationDecision; reason?: string }) =>
      reason ? api.allocations.override({ ...decision, reason }) : api.allocations.accept(decision),
    onSuccess: (result) => {
      toast.success(result.message ?? "Allocation applied", {
        description: "Assignments are active and the vessel state was updated.",
      });
      queryClient.invalidateQueries();
    },
    onError: (error) => toast.error("Plan could not be applied", { description: error.message }),
  });

  const history = useQuery({
    queryKey: [...keys.allocations, "optimizer-history"],
    queryFn: () => api.allocations.history({ page_size: 8 }),
  });

  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow="Operations · decision support"
        title="Resource optimizer"
        description="Versioned, explainable allocation: feasibility is checked first, then weighted scores rank the feasible package. You accept, override with a reason, or recalculate — the engine never commits on its own."
        meta={
          <>
            <Badge className="border-cyan-400/25 bg-cyan-400/[0.07] text-cyan-300">Hard constraints first</Badge>
            <span className="font-mono text-3xs uppercase tracking-[0.08em] text-slate-600">score = Σ factor × weight</span>
          </>
        }
      />

      <Panel>
        <PanelHeader
          title="Optimization request"
          description="Pick a vessel and the scope of the package. Leave the berth blank to let the engine score every feasible berth."
          icon={<SlidersHorizontal size={15} />}
          action={<Badge className="border-line-strong text-slate-400">read-only scoring</Badge>}
        />
        <div className="grid gap-3 px-4 py-4 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <Label>Vessel</Label>
            <Select value={shipCode} onChange={(event) => { setShipCode(event.target.value); setRecommendation(null); }}>
              {activeShips.length === 0 ? <option value="">No active vessels</option> : null}
              {activeShips.map((ship) => (
                <option key={ship.code} value={ship.code}>
                  {ship.code} · {ship.name} · {ship.priority}
                </option>
              ))}
            </Select>
          </div>
          <div className="lg:col-span-3">
            <Label>Scope</Label>
            <Select value={kind} onChange={(event) => { setKind(event.target.value as typeof kind); setRecommendation(null); }}>
              {KIND_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </Select>
          </div>
          <div className="lg:col-span-2">
            <Label hint="optional">Berth filter</Label>
            <Select value={dockCode} onChange={(event) => { setDockCode(event.target.value); setRecommendation(null); }} disabled={kind !== "dock"}>
              <option value="">Any berth</option>
              {(docks.data?.items ?? []).map((dock) => <option key={dock.code} value={dock.code}>{dock.code} · {dock.name}</option>)}
            </Select>
          </div>
          <div className="lg:col-span-2">
            <Label hint="optional">Container</Label>
            <Input placeholder="CONT-0042" value={containerCode} onChange={(event) => setContainerCode(event.target.value)} />
          </div>
          <div className="flex items-end lg:col-span-1">
            <Button variant="primary" className="w-full" loading={recommend.isPending} disabled={!shipCode} onClick={() => recommend.mutate()}>
              <Sparkles size={13} /> Score
            </Button>
          </div>
        </div>
        <div className="border-t border-line px-4 py-2.5">
          <p className="text-[10.5px] leading-relaxed text-slate-600">
            {KIND_OPTIONS.find((option) => option.value === kind)?.hint}. A vessel that is already docked keeps its berth; resource-only scoring then evaluates cranes, trucks, drivers and storage.
          </p>
        </div>
      </Panel>

      {recommend.isPending ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <Skeleton className="h-[280px]" />
          <Skeleton className="h-[280px]" />
        </div>
      ) : recommendation ? (
        <RecommendationView
          recommendation={recommendation}
          pending={decide.isPending}
          onAccept={(decision) => decide.mutate({ decision })}
          onOverride={(decision, reason) => decide.mutate({ decision, reason })}
          onReject={() => { setRecommendation(null); toast.message("Recommendation dismissed", { description: "Nothing changed — the engine can be rerun at any time." }); }}
        />
      ) : (
        <Panel>
          <EmptyState
            icon={<Calculator size={26} />}
            title={activeShips.length ? "Ready to score a feasible package" : "No active vessels to optimize"}
            description={activeShips.length ? "Choose a vessel and press Score. The engine evaluates hard constraints, then weighted availability, suitability and priority fit — with every factor visible." : "Register an approaching vessel on the Ships & berths page, then return here."}
          />
        </Panel>
      )}

      <div className="grid gap-3 lg:grid-cols-12">
        <Panel className="lg:col-span-7">
          <PanelHeader
            title="Decision history"
            description="Latest accepted and overridden packages."
            icon={<GitCompareArrows size={15} />}
            action={
              <Button variant="ghost" size="sm" onClick={() => history.refetch()}>
                <RefreshCw size={12} /> Refresh
              </Button>
            }
          />
          {history.isLoading ? (
            <div className="space-y-2 p-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-9" />)}</div>
          ) : !history.data?.items.length ? (
            <EmptyState title="No decisions yet" description="Accepted recommendations and reasoned overrides will appear here." />
          ) : (
            <div className="divide-y divide-line/60">
              {history.data.items.map((row) => (
                <div key={row.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="flex h-7 min-w-12 items-center justify-center rounded border border-line bg-ink-900/60 px-1 font-mono text-[10px] text-slate-300">
                    {row.resource_code}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[12px] text-slate-300">
                      <span>{row.kind}</span>
                      <span className="text-slate-700">·</span>
                      <span className="font-mono text-[11px] text-slate-500">{row.ship_code}</span>
                      {row.source === "override" ? <Badge className="border-amber-500/30 bg-amber-500/10 text-amber-300">override</Badge> : null}
                    </div>
                    <p className="truncate text-[10.5px] text-slate-600">{row.explanation ?? "Optimizer decision"}</p>
                  </div>
                  <span className="font-mono text-2xs tabular-nums text-cyan-300">{row.score.toFixed(0)}</span>
                  <span className="w-16 text-right font-mono text-3xs text-slate-600">{fmtDateTime(row.created_at).split(" · ")[1]}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <div className="space-y-3 lg:col-span-5">
          <Panel>
            <PanelHeader title="Why this is safe" description="Guardrails baked into the engine." icon={<GitCompareArrows size={15} />} />
            <div className="space-y-2 px-4 py-3.5">
              {[
                "Berth length, draft and cargo-type compatibility are hard constraints — no score can bypass them.",
                "Cranes, trucks and drivers with active assignments are excluded to prevent double-booking.",
                "Warehouse storage is only proposed where available capacity is greater than zero.",
                "Every accept and override writes an immutable audit record with operator, score and reason.",
              ].map((line) => (
                <p key={line} className="flex gap-2 text-[11.5px] leading-relaxed text-slate-400">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cyan-400/70" />
                  {line}
                </p>
              ))}
            </div>
          </Panel>
          <InlineNote tone="info">
            Recommendations are decision support, not autonomous control. The chatbot is read-only and cannot apply them; only an operator action commits a package.
          </InlineNote>
        </div>
      </div>
    </div>
  );
}
