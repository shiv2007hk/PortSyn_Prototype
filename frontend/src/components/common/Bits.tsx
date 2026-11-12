import type { ReactNode } from "react";
import { cn } from "@/lib/format";
import { Badge } from "@/components/ui/primitives";
import { SHIP_STATUS_STYLE } from "@/lib/status";

export function PageIntro({
  eyebrow,
  title,
  description,
  actions,
  meta,
}: {
  eyebrow: string;
  title: string;
  description: string;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="micro-label text-cyan-400/70">{eyebrow}</div>
        <h1 className="mt-1 font-display text-[22px] font-semibold leading-tight tracking-tight text-slate-50">{title}</h1>
        <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-slate-500">{description}</p>
        {meta ? <div className="mt-2 flex flex-wrap items-center gap-2">{meta}</div> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function KpiTile({
  label,
  value,
  unit,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  hint?: string;
  icon?: ReactNode;
  tone?: "default" | "cyan" | "amber" | "red" | "green";
}) {
  const bar = {
    default: "bg-marine-500",
    cyan: "bg-signal-cyan",
    amber: "bg-amber-400",
    red: "bg-red-400",
    green: "bg-emerald-400",
  }[tone];
  return (
    <div className="group relative overflow-hidden rounded-panel border border-line bg-ink-750/70 px-3.5 py-3 shadow-panel transition-colors hover:border-line-strong">
      <span className={cn("absolute left-0 top-0 h-px w-full opacity-60", bar)} />
      <div className="flex items-start justify-between gap-2">
        <span className="micro-label">{label}</span>
        <span className="text-slate-600">{icon}</span>
      </div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="data-value text-[24px] font-medium leading-none">{value}</span>
        {unit ? <span className="font-mono text-[10px] uppercase text-slate-500">{unit}</span> : null}
      </div>
      {hint ? <div className="mt-1.5 truncate text-[10.5px] text-slate-600">{hint}</div> : null}
    </div>
  );
}

export function ScoreRing({ score, grade, size = 132 }: { score: number; grade: string; size?: number }) {
  const radius = size / 2 - 9;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, score)) / 100;
  const color = score >= 85 ? "#22C55E" : score >= 70 ? "#22D3EE" : score >= 55 ? "#F59E0B" : "#EF4444";
  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(148,163,184,0.12)" strokeWidth="7" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${circumference * pct} ${circumference}`}
          style={{ transition: "stroke-dasharray 600ms ease" }}
        />
        <circle cx={size / 2} cy={size / 2} r={radius - 10} fill="none" stroke="rgba(148,163,184,0.06)" strokeWidth="1" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="data-value text-[28px] font-semibold leading-none" style={{ color }}>
          {Math.round(score)}
        </span>
        <span className="mt-1 font-mono text-3xs uppercase tracking-[0.12em] text-slate-500">{grade}</span>
        <span className="mt-0.5 font-mono text-3xs uppercase tracking-[0.1em] text-slate-700">/ 100</span>
      </div>
    </div>
  );
}

export function ShipStatusBadge({ status }: { status: string }) {
  return (
    <Badge className={cn("normal-case tracking-[0.04em]", SHIP_STATUS_STYLE[status] ?? "border-line-strong text-slate-400")}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}

export function DiffBar({ value, max = 100, tone = "blue" }: { value: number; max?: number; tone?: "blue" | "cyan" | "green" | "amber" | "red" }) {
  const colors = {
    blue: "bg-marine-500",
    cyan: "bg-signal-cyan",
    green: "bg-emerald-400",
    amber: "bg-amber-400",
    red: "bg-red-400",
  };
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-ink-600">
        <div className={cn("h-full rounded-full", colors[tone])} style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-right font-mono text-2xs tabular-nums text-slate-400">{Math.round(value)}</span>
    </div>
  );
}
