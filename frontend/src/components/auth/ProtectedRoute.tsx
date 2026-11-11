import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { LogoMark } from "@/components/layout/Logo";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-900">
        <div className="flex flex-col items-center gap-4">
          <LogoMark size={42} />
          <div className="flex items-center gap-2 font-mono text-[9.5px] uppercase tracking-[0.2em] text-slate-500">
            <span className="status-dot bg-cyan-400 animate-pulse-dot" />
            Restoring session
          </div>
        </div>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return <>{children}</>;
}
