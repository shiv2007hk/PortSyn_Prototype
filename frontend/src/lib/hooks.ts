import { QueryClient, useQuery } from "@tanstack/react-query";
import { api } from "./api";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 10_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const keys = {
  dashboard: ["dashboard"] as const,
  twin: ["twin"] as const,
  ships: (params?: unknown) => ["ships", params ?? {}] as const,
  ship: (code: string) => ["ship", code] as const,
  docks: ["docks"] as const,
  resources: ["resources"] as const,
  containers: (params?: unknown) => ["containers", params ?? {}] as const,
  board: (params?: unknown) => ["containers-board", params ?? {}] as const,
  container: (code: string) => ["container", code] as const,
  warehouses: ["warehouses"] as const,
  dispatch: (params?: unknown) => ["dispatch", params ?? {}] as const,
  ready: ["dispatch-ready"] as const,
  alerts: (params?: unknown) => ["alerts", params ?? {}] as const,
  alertSummary: ["alerts-summary"] as const,
  maintenance: ["maintenance"] as const,
  analytics: (days: number, granularity: string) => ["analytics", days, granularity] as const,
  scenarios: ["simulations"] as const,
  system: ["system"] as const,
  settings: ["settings"] as const,
  allocations: ["allocations"] as const,
};

export function useDashboard() {
  return useQuery({ queryKey: keys.dashboard, queryFn: api.dashboard, refetchInterval: 30_000 });
}

export function useTwin(enabled = true) {
  return useQuery({ queryKey: keys.twin, queryFn: api.twin, enabled, refetchInterval: 12_000 });
}

export function useShips(params: Parameters<typeof api.ships.list>[0] = {}) {
  return useQuery({ queryKey: keys.ships(params), queryFn: () => api.ships.list(params) });
}

export function useShip(code: string | null) {
  return useQuery({
    queryKey: keys.ship(code ?? ""),
    queryFn: () => api.ships.get(code as string),
    enabled: Boolean(code),
  });
}

export function useDocks() {
  return useQuery({ queryKey: keys.docks, queryFn: api.docks.list });
}

export function useResources() {
  return useQuery({ queryKey: keys.resources, queryFn: api.resources.summary, refetchInterval: 20_000 });
}

export function useBoard(params: Parameters<typeof api.containers.board>[0] = {}) {
  return useQuery({ queryKey: keys.board(params), queryFn: () => api.containers.board(params) });
}

export function useContainer(code: string | null) {
  return useQuery({
    queryKey: keys.container(code ?? ""),
    queryFn: () => api.containers.get(code as string),
    enabled: Boolean(code),
  });
}

export function useWarehouses() {
  return useQuery({ queryKey: keys.warehouses, queryFn: api.warehouses.list, refetchInterval: 25_000 });
}

export function useDispatches(params: Parameters<typeof api.dispatch.list>[0] = {}) {
  return useQuery({ queryKey: keys.dispatch(params), queryFn: () => api.dispatch.list(params) });
}

export function useReadyDispatch() {
  return useQuery({ queryKey: keys.ready, queryFn: api.dispatch.ready });
}

export function useAlerts(params: Parameters<typeof api.alerts.list>[0] = {}) {
  return useQuery({ queryKey: keys.alerts(params), queryFn: () => api.alerts.list(params), refetchInterval: 20_000 });
}

export function useAlertSummary() {
  return useQuery({ queryKey: keys.alertSummary, queryFn: api.alerts.summary, refetchInterval: 20_000 });
}

export function useMaintenance() {
  return useQuery({ queryKey: keys.maintenance, queryFn: api.maintenance.overview, refetchInterval: 45_000 });
}

export function useAnalytics(days: number, granularity: "day" | "week") {
  return useQuery({ queryKey: keys.analytics(days, granularity), queryFn: () => api.analytics.get(days, granularity) });
}

export function useScenarios() {
  return useQuery({ queryKey: keys.scenarios, queryFn: api.simulations.list });
}

export function useSystemInfo() {
  return useQuery({ queryKey: keys.system, queryFn: api.system.info, refetchInterval: 30_000 });
}

export function useSettings() {
  return useQuery({ queryKey: keys.settings, queryFn: api.system.settings });
}
