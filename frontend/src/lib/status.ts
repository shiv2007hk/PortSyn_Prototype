export const SEVERITY_STYLE: Record<string, { text: string; bg: string; border: string; dot: string; label: string }> = {
  critical: {
    text: "text-red-300",
    bg: "bg-red-500/10",
    border: "border-red-500/30",
    dot: "bg-red-400",
    label: "Critical",
  },
  warning: {
    text: "text-amber-300",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    dot: "bg-amber-400",
    label: "Warning",
  },
  info: {
    text: "text-sky-300",
    bg: "bg-sky-500/10",
    border: "border-sky-500/30",
    dot: "bg-sky-400",
    label: "Info",
  },
};

export const ALERT_STATUS_STYLE: Record<string, string> = {
  active: "bg-red-500/10 text-red-300 border-red-500/30",
  acknowledged: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  resolved: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
};

export const SHIP_STATUS_STYLE: Record<string, string> = {
  approaching: "bg-sky-500/10 text-sky-300 border-sky-500/30",
  arrived: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  waiting: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  docked: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  unloading: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
  departed: "bg-slate-500/10 text-slate-400 border-slate-500/30",
};

export const DOCK_STATUS_STYLE: Record<string, string> = {
  available: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  occupied: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  maintenance: "bg-amber-500/10 text-amber-300 border-amber-500/30",
};

export const RESOURCE_STATUS_STYLE: Record<string, string> = {
  available: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  idle: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  on_duty: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  assigned: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  active: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
  in_transit: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
  on_break: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  maintenance: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  restricted: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  fault: "bg-red-500/10 text-red-300 border-red-500/30",
  off_duty: "bg-slate-500/10 text-slate-400 border-slate-500/30",
  operational: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  scheduled: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  pending: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  completed: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
  applied: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
  reset: "bg-slate-500/10 text-slate-400 border-slate-500/30",
  cancelled: "bg-slate-500/10 text-slate-400 border-slate-500/30",
  in_progress: "bg-amber-500/10 text-amber-300 border-amber-500/30",
};

export const CONTAINER_COLUMNS: { status: string; label: string; hint: string; accent: string }[] = [
  { status: "waiting", label: "Waiting queue", hint: "Discharged, awaiting allocation", accent: "bg-slate-400" },
  { status: "allocated", label: "Allocated", hint: "Crane & move assigned", accent: "bg-sky-400" },
  { status: "loading", label: "Loading", hint: "Under the crane", accent: "bg-blue-400" },
  { status: "in_transit", label: "In transit", hint: "On a terminal truck", accent: "bg-cyan-400" },
  { status: "at_yard", label: "At yard / warehouse", hint: "Stored", accent: "bg-amber-400" },
  { status: "ready_for_dispatch", label: "Ready for dispatch", hint: "Staged outbound", accent: "bg-violet-400" },
  { status: "delivered", label: "Delivered", hint: "Left the terminal", accent: "bg-emerald-400" },
];

export const CONTAINER_STATUS_STYLE: Record<string, string> = {
  waiting: "bg-slate-500/10 text-slate-300 border-slate-500/30",
  allocated: "bg-sky-500/10 text-sky-300 border-sky-500/30",
  loading: "bg-blue-500/10 text-blue-300 border-blue-500/30",
  in_transit: "bg-cyan-500/10 text-cyan-300 border-cyan-500/30",
  at_yard: "bg-amber-500/10 text-amber-300 border-amber-500/30",
  ready_for_dispatch: "bg-violet-500/10 text-violet-300 border-violet-500/30",
  delivered: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
};

export const PRIORITY_STYLE: Record<string, string> = {
  critical: "text-red-300",
  high: "text-amber-300",
  normal: "text-slate-300",
  low: "text-slate-500",
};

export const CHART_COLORS = {
  blue: "#3B82F6",
  cyan: "#22D3EE",
  green: "#22C55E",
  amber: "#F59E0B",
  red: "#EF4444",
  violet: "#8B5CF6",
  slate: "#64748B",
  grid: "rgba(148,163,184,0.12)",
};

export function riskStyle(level: string): string {
  if (level === "critical") return "text-red-300 bg-red-500/10 border-red-500/30";
  if (level === "warning") return "text-amber-300 bg-amber-500/10 border-amber-500/30";
  return "text-emerald-300 bg-emerald-500/10 border-emerald-500/30";
}
