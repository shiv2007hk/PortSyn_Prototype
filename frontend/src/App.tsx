import { Suspense, lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { useAuth } from "@/lib/auth";
import { hasRouteAccess } from "@/lib/rbac";
import { LandingPage } from "@/pages/LandingPage";
import { LoginPage } from "@/pages/LoginPage";
import { SignupPage } from "@/pages/SignupPage";

const page = <T extends Record<string, React.ComponentType>>(loader: () => Promise<T>, name: keyof T) =>
  lazy(() => loader().then((mod) => ({ default: mod[name] })));

const OverviewPage = page(() => import("@/pages/OverviewPage"), "OverviewPage");
const DigitalTwinPage = page(() => import("@/pages/DigitalTwinPage"), "DigitalTwinPage");
const ShipsDocksPage = page(() => import("@/pages/ShipsDocksPage"), "ShipsDocksPage");
const OptimizerPage = page(() => import("@/pages/OptimizerPage"), "OptimizerPage");
const FleetPage = page(() => import("@/pages/FleetPage"), "FleetPage");
const ContainersPage = page(() => import("@/pages/ContainersPage"), "ContainersPage");
const WarehouseDispatchPage = page(() => import("@/pages/WarehouseDispatchPage"), "WarehouseDispatchPage");
const SimulationsPage = page(() => import("@/pages/SimulationsPage"), "SimulationsPage");
const AlertsMaintenancePage = page(() => import("@/pages/AlertsMaintenancePage"), "AlertsMaintenancePage");
const AnalyticsPage = page(() => import("@/pages/AnalyticsPage"), "AnalyticsPage");
const SystemAdminPage = page(() => import("@/pages/SystemAdminPage"), "SystemAdminPage");

const LEGACY = ["twin", "ships", "optimizer", "fleet", "containers", "warehouse", "simulations", "alerts", "analytics", "system"];

function RoleRoute({ path, children }: { path: string; children: React.ReactNode }) {
  const { user } = useAuth();
  if (!hasRouteAccess(user?.role, path)) {
    return <AccessDenied path={path} />;
  }
  return <>{children}</>;
}

export function App() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-sm text-slate-400">
          Loading…
        </div>
      }
    >
      <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route index element={<OverviewPage />} />
        <Route path="twin" element={<RoleRoute path="/app/twin"><DigitalTwinPage /></RoleRoute>} />
        <Route path="ships" element={<RoleRoute path="/app/ships"><ShipsDocksPage /></RoleRoute>} />
        <Route path="optimizer" element={<RoleRoute path="/app/optimizer"><OptimizerPage /></RoleRoute>} />
        <Route path="fleet" element={<RoleRoute path="/app/fleet"><FleetPage /></RoleRoute>} />
        <Route path="containers" element={<RoleRoute path="/app/containers"><ContainersPage /></RoleRoute>} />
        <Route path="warehouse" element={<RoleRoute path="/app/warehouse"><WarehouseDispatchPage /></RoleRoute>} />
        <Route path="simulations" element={<RoleRoute path="/app/simulations"><SimulationsPage /></RoleRoute>} />
        <Route path="alerts" element={<RoleRoute path="/app/alerts"><AlertsMaintenancePage /></RoleRoute>} />
        <Route path="analytics" element={<RoleRoute path="/app/analytics"><AnalyticsPage /></RoleRoute>} />
        <Route path="system" element={<RoleRoute path="/app/system"><SystemAdminPage /></RoleRoute>} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Route>

      {LEGACY.map((path) => (
        <Route key={path} path={`/${path}`} element={<Navigate to={`/app/${path}`} replace />} />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
