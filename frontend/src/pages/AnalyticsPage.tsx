import { useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, Download, FileText, Filter, Printer, TrendingUp } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { useAnalytics } from "@/lib/hooks";
import { cn, fmtDay, fmtDateTime, fmtNumber } from "@/lib/format";
import { CHART_COLORS, SEVERITY_STYLE } from "@/lib/status";
import { Badge, Button, EmptyState, InlineNote, Panel, PanelHeader, Segmented, Select, Skeleton } from "@/components/ui/primitives";
import { ChartLegend, ChartShell, ChartTooltip } from "@/components/charts/ChartBits";
import { KpiTile, PageIntro, ScoreRing } from "@/components/common/Bits";

const EXPORTS = [
  { dataset: "summary", label: "Summary metrics" },
  { dataset: "containers", label: "Container ledger" },
  { dataset: "ships", label: "Vessel calls" },
  { dataset: "dispatches", label: "Dispatches" },
  { dataset: "alerts", label: "Alerts" },
  { dataset: "activity", label: "Activity log" },
];

export function AnalyticsPage() {
  const [days, setDays] = useState(7);
  const [granularity, setGranularity] = useState<"day" | "week">("day");
  const { data, isLoading, isError, error } = useAnalytics(days, granularity);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20" />
        <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">{Array.from({ length: 10 }).map((_, index) => <Skeleton key={index} className="h-[88px]" />)}</div>
        <div className="grid gap-3 xl:grid-cols-12"><Skeleton className="h-[300px] xl:col-span-8" /><Skeleton className="h-[300px] xl:col-span-4" /></div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="space-y-3">
        <PageIntro eyebrow="Intelligence · reporting" title="Operational analytics" description="The analytics service did not answer." />
        <InlineNote tone="critical">{error instanceof Error ? error.message : "Unknown analytics error"}</InlineNote>
      </div>
    );
  }

  const maxUtil = Math.max(1, ...data.utilization.map((row) => row.value));

  return (
    <div className="space-y-4">
      <PageIntro
        eyebrow="Intelligence · reporting"
        title="Operational analytics"
        description="Period-filtered throughput, turnaround, resource utilisation and bottlenecks — exportable as CSV and printable as an operations report."
        meta={
          <>
            <Badge className="border-cyan-400/25 bg-cyan-400/[0.07] text-cyan-300">{days}-day window</Badge>
            <span className="font-mono text-3xs uppercase tracking-[0.08em] text-slate-600">
              {data.period.from ? `${fmtDateTime(data.period.from)} → ${fmtDateTime(data.period.to)}` : "all available history"}
            </span>
          </>
        }
        actions={
          <>
            <Segmented
              options={[
                { value: "7", label: "7d" },
                { value: "30", label: "30d" },
                { value: "90", label: "90d" },
              ]}
              value={String(days)}
              onChange={(value) => setDays(Number(value))}
            />
            <Segmented
              options={[
                { value: "day", label: "Daily" },
                { value: "week", label: "Weekly" },
              ]}
              value={granularity}
              onChange={(value) => setGranularity(value)}
            />
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer size={13} /> Print report
            </Button>
            <Select
              className="h-8 w-44"
              value=""
              onChange={(event) => {
                if (event.target.value) window.location.href = api.analytics.exportUrl(event.target.value, days);
              }}
            >
              <option value="">Export CSV…</option>
              {EXPORTS.map((row) => <option key={row.dataset} value={row.dataset}>{row.label}</option>)}
            </Select>
          </>
        }
      />

      <div className="hidden print:mb-4 print:block">
        <div className="border-b border-slate-300 pb-2">
          <div className="font-display text-[18px] font-semibold">PortSync · Jawahar Terminal 2</div>
          <div className="text-[11px] text-slate-600">Operational report · {days}-day window · generated {fmtDateTime(data.generated_at)} UTC</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-5">
        {data.kpis.map((kpi) => (
          <KpiTile key={kpi.key} label={kpi.label} value={fmtNumber(kpi.value, kpi.unit === "%" || kpi.unit === "h" ? 1 : 0)} unit={kpi.unit} hint={kpi.hint} tone={kpi.key === "port_health" ? "cyan" : undefined} />
        ))}
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <Panel className="xl:col-span-8">
          <PanelHeader
            title="Throughput & activity"
            description={`Arrivals, container throughput, dispatches and alerts per ${granularity}.`}
            icon={<Activity size={15} />}
            action={<ChartLegend items={[{ label: "Arrivals", color: CHART_COLORS.cyan }, { label: "Throughput", color: CHART_COLORS.blue }, { label: "Dispatches", color: CHART_COLORS.violet }, { label: "Alerts", color: CHART_COLORS.amber }]} />}
          />
          <ChartShell className="h-[280px] px-2 pb-3 pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.series} margin={{ top: 4, right: 12, left: -14, bottom: 0 }}>
                <defs>
                  <linearGradient id="throughputFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.blue} stopOpacity={0.2} />
                    <stop offset="100%" stopColor={CHART_COLORS.blue} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="arrivalsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_COLORS.cyan} stopOpacity={0.16} />
                    <stop offset="100%" stopColor={CHART_COLORS.cyan} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={CHART_COLORS.grid} vertical={false} />
                <XAxis dataKey="date" tickFormatter={fmtDay} tickLine={false} axisLine={false} dy={6} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={34} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(148,163,184,0.25)" }} />
                <Area type="monotone" dataKey="throughput" name="Throughput" stroke={CHART_COLORS.blue} strokeWidth={1.8} fill="url(#throughputFill)" />
                <Area type="monotone" dataKey="arrivals" name="Arrivals" stroke={CHART_COLORS.cyan} strokeWidth={1.6} fill="url(#arrivalsFill)" />
                <Area type="monotone" dataKey="dispatches" name="Dispatches" stroke={CHART_COLORS.violet} strokeWidth={1.3} fill="transparent" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="alerts" name="Alerts" stroke={CHART_COLORS.amber} strokeWidth={1.2} fill="transparent" strokeDasharray="2 3" />
              </AreaChart>
            </ResponsiveContainer>
          </ChartShell>
        </Panel>

        <div className="space-y-3 xl:col-span-4">
          <Panel>
            <PanelHeader title="Port health" description={data.health.formula} icon={<TrendingUp size={15} />} />
            <div className="flex flex-col items-center gap-3 px-4 py-4 sm:flex-row">
              <ScoreRing score={data.health.score} grade={data.health.grade} size={112} />
              <div className="w-full flex-1 space-y-1.5">
                {data.health.components.map((component) => (
                  <div key={component.key}>
                    <div className="flex items-center justify-between text-[10.5px]">
                      <span className="truncate text-slate-500">{component.label}</span>
                      <span className="font-mono text-slate-300">{component.value.toFixed(0)}</span>
                    </div>
                    <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-white/[0.06]">
                      <div className="h-full rounded-full bg-signal-cyan/80" style={{ width: `${Math.max(2, component.value)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="Resource utilisation" description={`Mean over the last ${days} days.`} icon={<Filter size={15} />} />
            <ChartShell className="h-[196px] px-2 pb-2 pt-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.utilization} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke={CHART_COLORS.grid} horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
                  <YAxis type="category" dataKey="name" width={82} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip formatter={(value) => `${Number(value).toFixed(1)}%`} />} cursor={{ fill: "rgba(148,163,184,0.06)" }} />
                  <Bar dataKey="value" name="Utilisation" radius={[0, 2, 2, 0]} barSize={9}>
                    {data.utilization.map((row) => (
                      <Cell key={row.name} fill={row.value >= 90 ? CHART_COLORS.red : row.value >= 75 ? CHART_COLORS.amber : row.value >= 40 ? CHART_COLORS.cyan : CHART_COLORS.slate} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </ChartShell>
            <div className="border-t border-line px-4 py-2">
              <p className="font-mono text-3xs uppercase tracking-[0.06em] text-slate-600">peak {fmtNumber(maxUtil, 1)}% · synthetic dataset</p>
            </div>
          </Panel>
        </div>
      </div>

      <div className="grid gap-3 xl:grid-cols-12">
        <Panel className="xl:col-span-5">
          <PanelHeader title="Bottlenecks" description="Rules over current congestion, backlog and resource state." icon={<Filter size={15} />} />
          {data.bottlenecks.length === 0 ? (
            <EmptyState title="No bottlenecks detected" description="Congestion, backlog and dispatch rules are all inside tolerance." />
          ) : (
            <div className="divide-y divide-line/60">
              {data.bottlenecks.map((row) => {
                const tone = SEVERITY_STYLE[row.severity] ?? SEVERITY_STYLE.info;
                return (
                  <div key={row.title} className="flex items-start gap-2.5 px-4 py-2.5">
                    <span className={cn("mt-1.5 status-dot", tone.dot)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[12px] text-slate-200">{row.title}</span>
                        <Badge className={cn("normal-case tracking-[0.03em]", tone.border, tone.bg, tone.text)}>{row.severity}</Badge>
                      </div>
                      <p className="mt-0.5 text-[10.5px] leading-relaxed text-slate-500">{row.detail}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel className="xl:col-span-4">
          <PanelHeader title="Optimized vs baseline" description="Where allocation and dispatch discipline moved the number." icon={<TrendingUp size={15} />} />
          <div className="space-y-2 px-4 py-3.5">
            {[data.comparison].map((row) => {
              const positive = row.delta_pct >= 0;
              return (
                <div key={row.metric} className="rounded border border-line bg-ink-900/40 px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11.5px] text-slate-300">{row.metric}</span>
                    <span className={cn("flex items-center gap-1 font-mono text-[12px] tabular-nums", positive ? "text-emerald-300" : "text-red-300")}>
                      {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                      {fmtNumber(Math.abs(row.delta_pct), 1)}%
                    </span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between font-mono text-3xs text-slate-600">
                    <span>baseline {fmtNumber(row.baseline, 1)} → optimized {fmtNumber(row.optimized, 1)}</span>
                  </div>
                  <p className="mt-0.5 text-[10px] leading-snug text-slate-600">{row.note}</p>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel className="xl:col-span-3">
          <PanelHeader title="Recent deliveries" description="Manifests completed in the window." icon={<FileText size={15} />} />
          {data.delivered_recent.length === 0 ? (
            <EmptyState title="No deliveries yet" description="Complete a dispatch to populate this list." />
          ) : (
            <div className="divide-y divide-line/60">
              {data.delivered_recent.slice(0, 10).map((row) => (
                <div key={row.code} className="px-4 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] text-slate-200">{row.code}</span>
                    <span className="font-mono text-3xs text-slate-600">{row.ship_code ?? "—"}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between text-[10px] text-slate-600">
                    <span>{row.warehouse ?? "direct"}</span>
                    <span>{row.delivered_at ? fmtDateTime(row.delivered_at) : "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="border-t border-line px-4 py-2.5">
            <div className="flex flex-wrap gap-1.5">
              {EXPORTS.slice(0, 3).map((row) => (
                <a key={row.dataset} href={api.analytics.exportUrl(row.dataset, days)} className="flex items-center gap-1 rounded border border-line px-2 py-1 font-mono text-3xs uppercase tracking-[0.06em] text-slate-500 transition-colors hover:border-line-strong hover:text-slate-300">
                  <Download size={10} /> {row.dataset}
                </a>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10.5px] leading-relaxed text-slate-600">{data.data_note}</p>
        <p className="font-mono text-3xs uppercase tracking-[0.06em] text-slate-700">generated {fmtDateTime(data.generated_at)} UTC</p>
      </div>
    </div>
  );
}
