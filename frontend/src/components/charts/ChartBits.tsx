import type { ReactNode } from "react";
import { cn } from "@/lib/format";

export function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string; dataKey?: string }[];
  label?: string | number;
  formatter?: (value: number | string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="min-w-[140px] rounded-md border border-line-strong bg-ink-850/98 px-3 py-2 shadow-float">
      <div className="mb-1.5 font-mono text-3xs uppercase tracking-[0.1em] text-slate-500">{label}</div>
      <div className="space-y-1">
        {payload.map((row) => (
          <div key={`${row.dataKey}-${row.name}`} className="flex items-center justify-between gap-4 text-[11.5px]">
            <span className="flex items-center gap-1.5 text-slate-400">
              <span className="status-dot" style={{ background: row.color }} />
              {row.name}
            </span>
            <span className="font-mono tabular-nums text-slate-100">
              {formatter && row.value !== undefined ? formatter(row.value) : row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ChartLegend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 font-mono text-3xs uppercase tracking-[0.06em] text-slate-500">
          <span className="status-dot" style={{ background: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

export function ChartShell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("h-[220px] w-full", className)}>{children}</div>;
}
