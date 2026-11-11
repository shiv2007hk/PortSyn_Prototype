import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/format";

export function WorkspaceSplit({ children, aside }: { children: ReactNode; aside: ReactNode }) {
  return (
    <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_368px]">
      <div className="min-w-0 space-y-4">{children}</div>
      {aside}
    </div>
  );
}

export function DetailAside({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <>
      <div
        aria-hidden="true"
        onClick={onClose}
        className={cn(
          "fixed inset-0 z-40 bg-ink-950/60 backdrop-blur-[2px] transition-opacity duration-200 xl:hidden",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />
      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex w-[min(92vw,420px)] flex-col overflow-hidden border-l border-line bg-ink-850 shadow-float transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "translate-x-full",
          "xl:sticky xl:top-[72px] xl:z-0 xl:max-h-[calc(100vh-92px)] xl:w-auto xl:translate-x-0 xl:rounded-panel xl:border xl:bg-ink-800/60 xl:shadow-panel xl:transition-none",
        )}
      >
        <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5 xl:hidden">
          <span className="micro-label">{label}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="rounded p-1 text-slate-500 transition-colors hover:bg-ink-700 hover:text-slate-200"
          >
            <X size={15} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto scroll-thin pb-16">{children}</div>
      </aside>
    </>
  );
}

export function DetailEmpty({ title, description, icon }: { title: string; description: string; icon?: ReactNode }) {
  return (
    <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-2.5 px-7 py-10 text-center xl:min-h-[420px]">
      {icon ? <span className="rounded-full border border-line bg-ink-800 p-2.5 text-slate-500">{icon}</span> : null}
      <p className="text-[13px] font-medium text-slate-300">{title}</p>
      <p className="max-w-[235px] text-[11.5px] leading-relaxed text-slate-600">{description}</p>
    </div>
  );
}
