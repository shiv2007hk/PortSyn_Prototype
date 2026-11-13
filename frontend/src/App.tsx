import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AccessDenied } from "@/components/auth/AccessDenied";
import { useAuth } from "@/lib/auth";
import { hasRouteAccess } from "@/lib/rbac";
import { LandingPage } from "@/pages/LandingPage";
import { LoginPage } from "@/pages/LoginPage";
import { SignupPage } from "@/pages/SignupPage";
import { OverviewPage } from "@/pages/OverviewPage";
import { DigitalTwinPage } from "@/pages/DigitalTwinPage";
import { ShipsDocksPage } from "@/pages/ShipsDocksPage";
import { OptimizerPage } from "@/pages/OptimizerPage";
import { FleetPage } from "@/pages/FleetPage";
import { ContainersPage } from "@/pages/ContainersPage";
import { WarehouseDispatchPage } from "@/pages/WarehouseDispatchPage";
import { SimulationsPage } from "@/pages/SimulationsPage";
import { AlertsMaintenancePage } from "@/pages/AlertsMaintenancePage";
import { AnalyticsPage } from "@/pages/AnalyticsPage";
import { SystemAdminPage } from "@/pages/SystemAdminPage";

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
  );
}
