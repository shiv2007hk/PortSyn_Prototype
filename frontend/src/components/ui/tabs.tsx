import * as TabsPrimitive from "@radix-ui/react-tabs";
import type { ReactNode } from "react";
import { cn } from "@/lib/format";

export const Tabs = TabsPrimitive.Root;

export function TabsList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <TabsPrimitive.List
      className={cn("inline-flex items-center gap-1 border-b border-line", className)}
    >
      {children}
    </TabsPrimitive.List>
  );
}

export function TabsTrigger({ value, children, count }: { value: string; children: ReactNode; count?: number }) {
  return (
    <TabsPrimitive.Trigger
      value={value}
      className="relative -mb-px flex items-center gap-1.5 border-b-2 border-transparent px-3 py-2 font-mono text-2xs uppercase tracking-[0.08em] text-slate-500 transition-colors hover:text-slate-300 data-[state=active]:border-signal-cyan data-[state=active]:text-slate-100"
    >
      {children}
      {count !== undefined ? (
        <span className="rounded bg-ink-700 px-1 py-px text-3xs tabular-nums text-slate-400">{count}</span>
      ) : null}
    </TabsPrimitive.Trigger>
  );
}

export function TabsContent({ value, children, className }: { value: string; children: ReactNode; className?: string }) {
  return (
    <TabsPrimitive.Content value={value} className={cn("mt-4 focus:outline-none", className)}>
      {children}
    </TabsPrimitive.Content>
  );
}
