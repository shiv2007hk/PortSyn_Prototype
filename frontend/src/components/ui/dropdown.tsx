import * as DropdownPrimitive from "@radix-ui/react-dropdown-menu";
import { cn } from "@/lib/format";
import type { ReactNode } from "react";

export const DropdownMenu = DropdownPrimitive.Root;
export const DropdownMenuTrigger = DropdownPrimitive.Trigger;
export const DropdownTrigger = DropdownPrimitive.Trigger;

export function DropdownContent({ children, className, align = "end" }: { children: ReactNode; className?: string; align?: "start" | "center" | "end" }) {
  return (
    <DropdownPrimitive.Portal>
      <DropdownPrimitive.Content
        align={align}
        sideOffset={6}
        className={cn(
          "z-50 min-w-[180px] rounded-md border border-line-strong bg-ink-800 p-1 shadow-float",
          className,
        )}
      >
        {children}
      </DropdownPrimitive.Content>
    </DropdownPrimitive.Portal>
  );
}

export function DropdownItem({
  children,
  onSelect,
  danger,
  disabled,
}: {
  children: ReactNode;
  onSelect?: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <DropdownPrimitive.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded px-2.5 py-1.5 text-[12.5px] outline-none transition-colors data-[highlighted]:bg-ink-700",
        danger ? "text-red-300 data-[highlighted]:bg-red-500/10" : "text-slate-300 data-[highlighted]:text-slate-50",
        disabled && "pointer-events-none opacity-40",
      )}
    >
      {children}
    </DropdownPrimitive.Item>
  );
}

export function DropdownLabel({ children }: { children: ReactNode }) {
  return <div className="px-2.5 py-1.5 font-mono text-3xs uppercase tracking-[0.1em] text-slate-600">{children}</div>;
}

export function DropdownSeparator() {
  return <DropdownPrimitive.Separator className="my-1 h-px bg-line" />;
}
