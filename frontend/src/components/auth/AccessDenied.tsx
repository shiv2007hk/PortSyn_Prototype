import { useNavigate } from "react-router-dom";
import { ArrowLeft, Lock, LogOut, ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { ROLE_LABELS, getPermittedRoutes } from "@/lib/rbac";
import { Button } from "@/components/ui/primitives";

const ROUTE_NAMES: Record<string, string> = {
  "/app": "Port Overview",
  "/app/twin": "Digital Twin",
  "/app/ships": "Ships & Docks",
  "/app/optimizer": "Resource Optimizer",
  "/app/fleet": "Fleet & Equipment",
  "/app/containers": "Container Tracking",
  "/app/warehouse": "Warehouse & Dispatch",
  "/app/simulations": "Simulation Centre",
  "/app/alerts": "Alerts & Maintenance",
  "/app/analytics": "Operational Analytics",
  "/app/system": "System Configuration & Roles",
};

export function AccessDenied({ path }: { path: string }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const role = user?.role ?? "viewer";
  const roleName = ROLE_LABELS[role] ?? role;
  const moduleName = ROUTE_NAMES[path] ?? "this module";
  const permitted = getPermittedRoutes(role);

  const handleSignOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="flex min-h-[500px] flex-col items-center justify-center p-6 text-center">
      <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/30 bg-red-500/10 text-red-400 shadow-[0_0_30px_-10px_rgba(239,68,68,0.5)]">
        <ShieldAlert size={32} />
        <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-ink-900 text-slate-400">
          <Lock size={12} />
        </div>
      </div>

      <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/[0.08] px-3 py-1 text-3xs font-mono uppercase tracking-[0.12em] text-red-400">
        HTTP 403 · Access Denied
      </div>

      <h2 className="mt-3 font-display text-xl font-bold tracking-tight text-slate-100 sm:text-2xl">
        Restricted to Authorized Roles
      </h2>

      <p className="mt-2 max-w-md text-xs leading-relaxed text-slate-400 sm:text-[13px]">
        You are authenticated as <span className="font-semibold text-slate-200">{user?.name}</span> with the role of{" "}
        <span className="rounded border border-line-strong bg-ink-800 px-1.5 py-0.5 font-mono font-medium text-cyan-400">
          {roleName}
        </span>
        . This account is not permitted to access <span className="font-medium text-slate-200">{moduleName}</span>.
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
        <Button variant="primary" onClick={() => navigate("/app")}>
          <ArrowLeft size={14} /> Return to Dashboard
        </Button>
        <Button variant="ghost" onClick={handleSignOut}>
          <LogOut size={14} /> Switch Account
        </Button>
      </div>

      <div className="mt-8 max-w-lg rounded-panel border border-line bg-ink-800/40 p-3.5 text-left">
        <div className="font-mono text-3xs uppercase tracking-[0.1em] text-slate-500">
          Modules available to {roleName}:
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {permitted.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => navigate(p)}
              className="rounded border border-line bg-ink-750 px-2 py-1 font-mono text-[11px] text-slate-300 transition-colors hover:border-marine-500 hover:text-white"
            >
              {ROUTE_NAMES[p] ?? p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
