import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { AssistantDock } from "@/components/assistant/AssistantDock";
import { RealtimeProvider } from "@/lib/realtime";
import { cn } from "@/lib/format";

const COLLAPSE_KEY = "portsync-sidebar-collapsed";

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return window.localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      /* storage can be blocked */
    }
  }, [collapsed]);

  return (
    <RealtimeProvider>
      <div className="min-h-screen">
        <Sidebar
          open={sidebarOpen}
          collapsed={collapsed}
          onClose={() => setSidebarOpen(false)}
          onToggleCollapse={() => setCollapsed((current) => !current)}
        />
        <div className={cn("transition-[padding] duration-200", collapsed ? "lg:pl-[76px]" : "lg:pl-[256px]")}>
          <Topbar onMenu={() => setSidebarOpen(true)} />
          <main className="mx-auto w-full max-w-[1640px] px-4 pb-20 pt-5 lg:px-6">
            <Outlet />
          </main>
        </div>
        <AssistantDock />
      </div>
    </RealtimeProvider>
  );
}
