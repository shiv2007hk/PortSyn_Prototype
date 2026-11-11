import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/format";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  children,
  className,
  size = "md",
  title,
  description,
}: {
  children: ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  title: string;
  description?: string;
}) {
  const widths = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" };
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink-950/75 backdrop-blur-[3px] data-[state=open]:animate-in data-[state=open]:fade-in" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 max-h-[88vh] w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-panel border border-line-strong bg-ink-800 shadow-float focus:outline-none",
          widths[size],
          className,
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-3.5">
          <div>
            <DialogPrimitive.Title className="font-display text-[15px] font-semibold tracking-tight text-slate-100">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="mt-0.5 text-xs text-slate-500">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <DialogPrimitive.Close className="rounded-md p-1 text-slate-500 transition-colors hover:bg-ink-800 hover:text-slate-200">
            <X size={16} />
          </DialogPrimitive.Close>
        </div>
        <div className="max-h-[calc(88vh-64px)] overflow-y-auto scroll-thin px-5 py-4">{children}</div>
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogFooter({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("mt-5 flex items-center justify-end gap-2 border-t border-line pt-4", className)}>
      {children}
    </div>
  );
}
