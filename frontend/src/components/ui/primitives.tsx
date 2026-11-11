import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/format";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-[13px] font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-45",
  {
    variants: {
      variant: {
        primary: "bg-marine-600 text-white hover:bg-marine-500 shadow-[0_1px_0_rgba(255,255,255,0.08)_inset]",
        secondary: "border border-line-strong bg-ink-800 text-slate-200 hover:bg-ink-700 hover:text-slate-50",
        ghost: "text-slate-400 hover:bg-ink-800 hover:text-slate-50",
        danger: "border border-red-500/40 bg-red-500/10 text-red-300 hover:bg-red-500/20",
        success: "border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20",
        cyan: "border border-cyan-400/40 bg-cyan-400/10 text-cyan-200 hover:bg-cyan-400/20",
        outline: "border border-line-strong bg-transparent text-slate-300 hover:border-slate-500 hover:text-slate-50",
      },
      size: {
        sm: "h-8 px-2.5 text-xs",
        md: "h-9 px-3.5",
        lg: "h-10 px-4",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : null}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("panel", className)} {...props} />;
}

export function PanelHeader({
  title,
  description,
  action,
  className,
  icon,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-3 border-b border-line px-4 py-3", className)}>
      <div className="flex min-w-0 items-start gap-2.5">
        {icon ? <span className="mt-0.5 text-slate-500">{icon}</span> : null}
        <div className="min-w-0">
          <h2 className="font-display text-[13.5px] font-semibold tracking-tight text-slate-100">{title}</h2>
          {description ? <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p> : null}
        </div>
      </div>
      {action ? <div className="flex shrink-0 items-center gap-2">{action}</div> : null}
    </div>
  );
}

export function Badge({
  children,
  className,
  dot,
}: {
  children: ReactNode;
  className?: string;
  dot?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded border px-1.5 py-0.5 font-mono text-3xs font-medium uppercase tracking-[0.08em]",
        className ?? "border-line-strong bg-ink-800 text-slate-400",
      )}
    >
      {dot ? <span className={cn("status-dot", dot)} /> : null}
      {children}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const label = status.replace(/_/g, " ");
  return <Badge className={cn("normal-case tracking-[0.04em]", className)}>{label}</Badge>;
}

export function Metric({ label, value, unit, hint }: { label: string; value: ReactNode; unit?: string; hint?: string }) {
  return (
    <div>
      <div className="micro-label">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="data-value text-[20px] font-medium leading-none">{value}</span>
        {unit ? <span className="font-mono text-[10px] text-slate-500">{unit}</span> : null}
      </div>
      {hint ? <div className="mt-1 text-[11px] text-slate-500">{hint}</div> : null}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn("field", className)} {...props} />;
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn("field h-auto min-h-[72px] py-2", className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn("field appearance-none pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Label({ children, htmlFor, hint }: { children: ReactNode; htmlFor?: string; hint?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-center justify-between gap-2">
      <span className="micro-label text-slate-400">{children}</span>
      {hint ? <span className="text-[10px] text-slate-600">{hint}</span> : null}
    </label>
  );
}

export function Progress({
  value,
  max = 100,
  className,
  barClassName,
}: {
  value: number;
  max?: number;
  className?: string;
  barClassName?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cn("h-1.5 w-full overflow-hidden rounded-full bg-ink-600", className)}>
      <div className={cn("h-full rounded-full bg-marine-500 transition-all duration-500", barClassName)} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-ink-700", className)} />;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-10 text-center", className)}>
      {icon ? <div className="mb-1 text-slate-600">{icon}</div> : null}
      <p className="font-display text-[13px] font-medium text-slate-300">{title}</p>
      {description ? <p className="max-w-sm text-xs leading-relaxed text-slate-500">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex rounded-md border border-line bg-ink-900/60 p-0.5", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded px-2.5 py-1 font-mono text-2xs uppercase tracking-[0.06em] transition-colors",
            value === option.value ? "bg-ink-600 text-slate-100" : "text-slate-500 hover:text-slate-300",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-line", className)} />;
}

export function InlineNote({ tone = "info", children }: { tone?: "info" | "warning" | "critical" | "success"; children: ReactNode }) {
  const tones = {
    info: "border-sky-500/20 bg-sky-500/[0.06] text-sky-200/80",
    warning: "border-amber-500/25 bg-amber-500/[0.06] text-amber-200/90",
    critical: "border-red-500/25 bg-red-500/[0.06] text-red-200/90",
    success: "border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-200/90",
  };
  return <div className={cn("rounded-md border px-3 py-2 text-[11.5px] leading-relaxed", tones[tone])}>{children}</div>;
}
