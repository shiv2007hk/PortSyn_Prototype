import { cn } from "@/lib/format";

export function LogoMark({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      className={className}
      aria-hidden="true"
    >
      <rect x="0.75" y="0.75" width="38.5" height="38.5" rx="9" fill="#0A1625" stroke="rgba(34,211,238,0.35)" strokeWidth="1.5" />
      <path d="M8 28.5h24" stroke="#22D3EE" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M11 28.5V21h7.5v7.5M18.5 21V11h10v10M23.5 11v10" stroke="#60A5FA" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M8 32h24" stroke="#2563EB" strokeWidth="1.4" strokeLinecap="round" strokeDasharray="2 3" />
      <circle cx="31" cy="10" r="2" fill="#22D3EE" fillOpacity="0.9" />
    </svg>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <LogoMark size={compact ? 28 : 34} />
      <div className="leading-none">
        <div className={cn("font-display font-bold tracking-[0.14em] text-slate-50", compact ? "text-[14px]" : "text-[16px]")}>
          PORTSYNC
        </div>
        {!compact ? (
          <div className="mt-1.5 font-mono text-3xs uppercase tracking-[0.16em] text-slate-500">
            Terminal operations
          </div>
        ) : null}
      </div>
    </div>
  );
}
