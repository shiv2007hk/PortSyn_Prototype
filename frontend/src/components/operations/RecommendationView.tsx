import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, GitCompareArrows, ShieldAlert, XCircle } from "lucide-react";
import { cn, fmtNumber, titleCase } from "@/lib/format";
import { Badge, Button, InlineNote, Panel, PanelHeader, Select, Textarea } from "@/components/ui/primitives";
import { DiffBar } from "@/components/common/Bits";
import type { Recommendation, ScoredResource } from "@/lib/types";

export interface AllocationDecision {
  ship_code: string;
  dock_code?: string | null;
  crane_code?: string | null;
  truck_codes: string[];
  driver_codes: string[];
  warehouse_code?: string | null;
  score: number;
  source: "optimizer" | "override";
  explanation?: string;
  container_code?: string | null;
}

function ScorePill({ score }: { score: number }) {
  const tone =
    score >= 85
      ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
      : score >= 70
        ? "border-cyan-400/35 bg-cyan-400/10 text-cyan-200"
        : score >= 55
          ? "border-amber-500/35 bg-amber-500/10 text-amber-300"
          : "border-red-500/35 bg-red-500/10 text-red-300";
  return (
    <span className={cn("inline-flex items-baseline gap-1 rounded border px-2 py-1 font-mono text-[15px] tabular-nums", tone)}>
      {score.toFixed(1)}
      <span className="text-[9px] uppercase tracking-[0.1em] opacity-70">/100</span>
    </span>
  );
}

function ResourceRow({ label, resource }: { label: string; resource: ScoredResource | null }) {
  if (!resource) {
    return (
      <div className="flex items-center justify-between rounded border border-line bg-ink-900/40 px-2.5 py-2">
        <span className="micro-label">{label}</span>
        <span className="text-[11px] text-slate-600">not required</span>
      </div>
    );
  }
  return (
    <div className="rounded border border-line bg-ink-900/40 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="micro-label">{label}</span>
        <span className="font-mono text-[11px] tabular-nums text-slate-300">{resource.code}</span>
      </div>
      <div className="mt-1.5">
        <DiffBar value={resource.score} tone={resource.score >= 80 ? "green" : resource.score >= 60 ? "cyan" : "amber"} />
      </div>
      {resource.warnings?.length ? (
        <p className="mt-1 text-[10.5px] leading-snug text-amber-300/80">{resource.warnings.join(" · ")}</p>
      ) : null}
    </div>
  );
}

function Breakdown({ rows, title }: { rows: ScoredResource["breakdown"]; title: string }) {
  if (!rows?.length) return null;
  return (
    <div>
      <div className="micro-label mb-1.5">{title}</div>
      <div className="space-y-1.5">
        {rows.map((row) => (
          <div key={row.key} className="grid grid-cols-[minmax(0,1fr)_44px_40px_46px] items-center gap-2 text-[11px]">
            <span className="truncate text-slate-400">{row.label}</span>
            <span className="text-right font-mono tabular-nums text-slate-300">{row.value.toFixed(0)}</span>
            <span className="text-right font-mono text-3xs tabular-nums text-slate-600">×{row.weight.toFixed(2)}</span>
            <span className="text-right font-mono tabular-nums text-cyan-300/90">{row.contribution.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RecommendationView({
  recommendation,
  onAccept,
  onOverride,
  onReject,
  pending,
}: {
  recommendation: Recommendation;
  onAccept: (decision: AllocationDecision) => void;
  onOverride: (decision: AllocationDecision, reason: string) => void;
  onReject?: () => void;
  pending?: boolean;
}) {
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [dockCode, setDockCode] = useState(recommendation.dock?.code ?? "");
  const [craneCode, setCraneCode] = useState(recommendation.crane?.code ?? "");
  const [truckCode, setTruckCode] = useState(recommendation.trucks[0]?.code ?? "");
  const [driverCode, setDriverCode] = useState(recommendation.drivers[0]?.code ?? "");
  const [warehouseCode, setWarehouseCode] = useState(recommendation.warehouse?.code ?? "");

  const dockOptions = useMemo(
    () => dedupe([recommendation.dock, ...(recommendation.alternatives.docks ?? [])].filter(Boolean) as ScoredResource[]),
    [recommendation],
  );
  const craneOptions = useMemo(
    () => dedupe([recommendation.crane, ...(recommendation.alternatives.cranes ?? [])].filter(Boolean) as ScoredResource[]),
    [recommendation],
  );
  const truckOptions = useMemo(
    () => dedupe([...recommendation.trucks, ...(recommendation.alternatives.trucks ?? [])]),
    [recommendation],
  );
  const warehouseOptions = useMemo(
    () => dedupe([recommendation.warehouse, ...(recommendation.alternatives.warehouses ?? [])].filter(Boolean) as ScoredResource[]),
    [recommendation],
  );

  const baseDecision: AllocationDecision = {
    ship_code: recommendation.ship.code,
    dock_code: recommendation.dock?.code ?? null,
    crane_code: recommendation.crane?.code ?? null,
    truck_codes: recommendation.trucks.map((truck) => truck.code),
    driver_codes: recommendation.drivers.map((driver) => driver.code),
    warehouse_code: recommendation.warehouse?.code ?? null,
    score: recommendation.overall_score,
    source: "optimizer",
    explanation: recommendation.explanation.join(" "),
  };

  const blocked = recommendation.blockers.length > 0;

  const submitOverride = () => {
    if (!reason.trim()) return;
    onOverride(
      {
        ...baseDecision,
        dock_code: dockCode || null,
        crane_code: craneCode || null,
        truck_codes: truckCode ? [truckCode] : [],
        driver_codes: driverCode ? [driverCode] : [],
        warehouse_code: warehouseCode || null,
        source: "override",
        explanation: `Manual override: ${reason.trim()}`,
      },
      reason.trim(),
    );
  };

  return (
    <div className="space-y-3">
      <Panel>
        <PanelHeader
          title={
            <span className="flex items-center gap-2">
              Recommendation for {recommendation.ship.code}
              <ScorePill score={recommendation.overall_score} />
            </span>
          }
          description={recommendation.explanation.join(" ")}
          icon={<GitCompareArrows size={15} />}
          action={
            <Badge className="border-cyan-400/25 bg-cyan-400/[0.07] text-cyan-300">
              {recommendation.ship.priority} priority
            </Badge>
          }
        />

        {blocked ? (
          <div className="border-b border-line px-4 py-3">
            <InlineNote tone="critical">
              <span className="flex items-center gap-1.5 font-medium">
                <ShieldAlert size={13} /> Hard constraints block this plan
              </span>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {recommendation.blockers.map((blocker) => (
                  <li key={blocker}>{blocker}</li>
                ))}
              </ul>
            </InlineNote>
          </div>
        ) : null}

        <div className="grid gap-4 px-4 py-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
          <div className="space-y-2">
            <div className="micro-label">Proposed resource package</div>
            <ResourceRow label="Berth" resource={recommendation.dock} />
            <ResourceRow label="Quay crane" resource={recommendation.crane} />
            <ResourceRow
              label="Terminal trucks"
              resource={
                recommendation.trucks.length
                  ? { ...recommendation.trucks[0], code: recommendation.trucks.map((t) => t.code).join(" · ") }
                  : null
              }
            />
            <ResourceRow
              label="Drivers"
              resource={
                recommendation.drivers.length
                  ? { ...recommendation.drivers[0], code: recommendation.drivers.map((d) => d.code).join(" · ") }
                  : null
              }
            />
            <ResourceRow label="Storage" resource={recommendation.warehouse} />
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded border border-line bg-ink-900/40 px-2.5 py-2">
                <div className="micro-label">Expected wait</div>
                <div className="mt-0.5 font-mono text-[15px] tabular-nums text-slate-200">
                  {fmtNumber(recommendation.expected_wait_min)} <span className="text-[10px] text-slate-500">min</span>
                </div>
              </div>
              <div className="rounded border border-line bg-ink-900/40 px-2.5 py-2">
                <div className="micro-label">Travel distance</div>
                <div className="mt-0.5 font-mono text-[15px] tabular-nums text-slate-200">
                  {fmtNumber(recommendation.estimated_travel_km, 1)} <span className="text-[10px] text-slate-500">km</span>
                </div>
              </div>
              <div className="rounded border border-line bg-ink-900/40 px-2.5 py-2">
                <div className="micro-label">Discharge window</div>
                <div className="mt-0.5 font-mono text-[15px] tabular-nums text-slate-200">
                  {fmtNumber(recommendation.expected_impact.discharge_hours, 1)} <span className="text-[10px] text-slate-500">h</span>
                </div>
              </div>
              <div className="rounded border border-line bg-ink-900/40 px-2.5 py-2">
                <div className="micro-label">Crane move rate</div>
                <div className="mt-0.5 font-mono text-[13px] text-slate-200">{recommendation.expected_impact.crane_move_rate}</div>
              </div>
            </div>
            <Breakdown rows={recommendation.dock?.breakdown ?? []} title={`Berth score · ${recommendation.dock?.code ?? "none"}`} />
          </div>
        </div>

        <div className="grid gap-3 border-t border-line px-4 py-3 lg:grid-cols-2">
          <div>
            <div className="micro-label mb-1.5">Rejected by hard constraints / scoring</div>
            {recommendation.rejected.length === 0 ? (
              <p className="text-[11px] text-slate-600">No resource was excluded.</p>
            ) : (
              <div className="space-y-1">
                {recommendation.rejected.slice(0, 6).map((row, index) => (
                  <div key={`${row.kind}-${row.code}-${index}`} className="flex items-start gap-2 text-[11px] leading-snug">
                    <XCircle size={12} className="mt-0.5 shrink-0 text-red-400/70" />
                    <span className="text-slate-500">
                      <span className="font-mono text-slate-400">{row.code}</span>
                      <span className="mx-1 text-slate-700">·</span>
                      {row.reason}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="micro-label mb-1.5">Alternatives considered</div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(recommendation.alternatives).flatMap(([kind, rows]) =>
                (rows ?? []).slice(0, 3).map((row) => (
                  <Badge key={`${kind}-${row.code}`} className="normal-case tracking-[0.03em]">
                    {titleCase(kind)} · {row.code} · {row.score.toFixed(0)}
                  </Badge>
                )),
              )}
              {Object.values(recommendation.alternatives).every((rows) => !rows?.length) ? (
                <span className="text-[11px] text-slate-600">No scored alternatives.</span>
              ) : null}
            </div>
            <p className="mt-2 text-[10.5px] leading-relaxed text-slate-600">{recommendation.expected_impact.note}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3">
          <div className="space-y-0.5 text-[10.5px] text-slate-600">
            <div className="flex items-center gap-2">
              <AlertTriangle size={12} />
              Scoring weights · operator-configurable, persisted
            </div>
            {Object.entries(recommendation.weights).map(([group, value]) =>
              typeof value === "number" ? (
                <div key={group}>
                  {group.replace(/_/g, " ")} {(value * 100).toFixed(0)}%
                </div>
              ) : (
                <div key={group}>
                  <span className="uppercase tracking-[0.08em]">{group}</span>{" "}
                  {Object.entries(value)
                    .map(([key, weight]) => `${key.replace(/_/g, " ")} ${(weight * 100).toFixed(0)}%`)
                    .join(" · ")}
                </div>
              ),
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {onReject ? (
              <Button variant="ghost" size="sm" onClick={onReject}>
                Reject plan
              </Button>
            ) : null}
            <Button variant="secondary" size="sm" onClick={() => setOverrideOpen((open) => !open)}>
              Manual override
            </Button>
            <Button variant="primary" size="sm" loading={pending} disabled={blocked} onClick={() => onAccept(baseDecision)}>
              <CheckCircle2 size={13} /> Accept &amp; apply
            </Button>
          </div>
        </div>
      </Panel>

      {overrideOpen ? (
        <Panel>
          <PanelHeader
            title="Manual override"
            description="Hard constraints are still enforced by the backend. A written reason is stored in the audit trail with your operator identity."
            icon={<ShieldAlert size={15} />}
          />
          <div className="grid gap-3 px-4 py-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <div className="micro-label mb-1">Berth</div>
              <Select value={dockCode} onChange={(event) => setDockCode(event.target.value)}>
                <option value="">No berth</option>
                {dockOptions.map((row) => (
                  <option key={row.code} value={row.code}>
                    {row.code} · score {row.score.toFixed(0)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <div className="micro-label mb-1">Crane</div>
              <Select value={craneCode} onChange={(event) => setCraneCode(event.target.value)}>
                <option value="">No crane</option>
                {craneOptions.map((row) => (
                  <option key={row.code} value={row.code}>
                    {row.code} · score {row.score.toFixed(0)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <div className="micro-label mb-1">Truck</div>
              <Select value={truckCode} onChange={(event) => setTruckCode(event.target.value)}>
                <option value="">No truck</option>
                {truckOptions.map((row) => (
                  <option key={row.code} value={row.code}>
                    {row.code} · score {row.score.toFixed(0)}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <div className="micro-label mb-1">Driver</div>
              <Select value={driverCode} onChange={(event) => setDriverCode(event.target.value)}>
                <option value="">No driver</option>
                {(recommendation.drivers.length ? recommendation.drivers : []).map((row) => (
                  <option key={row.code} value={row.code}>
                    {row.code}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <div className="micro-label mb-1">Storage</div>
              <Select value={warehouseCode} onChange={(event) => setWarehouseCode(event.target.value)}>
                <option value="">No storage</option>
                {warehouseOptions.map((row) => (
                  <option key={row.code} value={row.code}>
                    {row.code} · score {row.score.toFixed(0)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2 lg:col-span-1">
              <div className="micro-label mb-1">Reason for override</div>
              <Textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="e.g. Berth D3 reserved for a hazmat arrival confirmed by harbour control."
                className="min-h-[80px]"
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-3">
            <p className="flex items-center gap-1.5 text-[10.5px] text-slate-600">
              <ArrowRight size={12} /> Override is audited as a human decision, not an optimizer result.
            </p>
            <Button variant="primary" size="sm" loading={pending} disabled={!reason.trim()} onClick={submitOverride}>
              Apply override
            </Button>
          </div>
        </Panel>
      ) : null}
    </div>
  );
}

function dedupe(rows: ScoredResource[]): ScoredResource[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    if (seen.has(row.code)) return false;
    seen.add(row.code);
    return true;
  });
}
