import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
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

const LEGACY = ["twin", "ships", "optimizer", "fleet", "containers", "warehouse", "simulations", "alerts", "analytics"];

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
        <Route path="twin" element={<DigitalTwinPage />} />
        <Route path="ships" element={<ShipsDocksPage />} />
        <Route path="optimizer" element={<OptimizerPage />} />
        <Route path="fleet" element={<FleetPage />} />
        <Route path="containers" element={<ContainersPage />} />
        <Route path="warehouse" element={<WarehouseDispatchPage />} />
        <Route path="simulations" element={<SimulationsPage />} />
        <Route path="alerts" element={<AlertsMaintenancePage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="*" element={<Navigate to="/app" replace />} />
      </Route>

      {LEGACY.map((path) => (
        <Route key={path} path={`/${path}`} element={<Navigate to={`/app/${path}`} replace />} />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
