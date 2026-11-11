import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { EventRow, TwinState } from "./types";
import { keys } from "./hooks";

type Connection = "connecting" | "live" | "offline";

interface RealtimeValue {
  status: Connection;
  lastEvent: EventRow | null;
  lastMessageAt: number | null;
  reconnect: () => void;
}

const RealtimeContext = createContext<RealtimeValue>({
  status: "connecting",
  lastEvent: null,
  lastMessageAt: null,
  reconnect: () => {},
});

const TOPIC_KEYS: Record<string, readonly (readonly unknown[])[]> = {
  ships: [keys.ships({}), ["ship"]],
  docks: [keys.docks],
  resources: [keys.resources],
  containers: [["containers"], ["containers-board"], ["container"]],
  board: [["containers-board"]],
  warehouses: [keys.warehouses],
  dispatch: [["dispatch"], keys.ready],
  alerts: [["alerts"], keys.alertSummary],
  maintenance: [keys.maintenance],
  dashboard: [keys.dashboard],
  analytics: [["analytics"]],
  simulations: [keys.scenarios],
  allocations: [keys.allocations, keys.ships({})],
  twin: [keys.twin],
  system: [keys.system, keys.settings],
};

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Connection>("connecting");
  const [lastEvent, setLastEvent] = useState<EventRow | null>(null);
  const [lastMessageAt, setLastMessageAt] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = import.meta.env.VITE_WS_URL ?? `${protocol}//${window.location.host}/ws/operations`;
    let disposed = false;
    let reconnectTimer: number | undefined;
    let pingTimer: number | undefined;

    const connect = () => {
      if (disposed) return;
      setStatus("connecting");
      const socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        if (disposed) return;
        setStatus("live");
        pingTimer = window.setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send("ping");
        }, 25_000);
      };

      socket.onmessage = (message) => {
        setLastMessageAt(Date.now());
        let payload: { type?: string; data?: unknown; topics?: string[] };
        try {
          payload = JSON.parse(message.data);
        } catch {
          return;
        }
        if (payload.type === "twin" && payload.data) {
          queryClient.setQueryData<TwinState>(keys.twin, payload.data as TwinState);
          return;
        }
        if (payload.type === "event" && payload.data) {
          setLastEvent(payload.data as EventRow);
        }
        if (payload.type === "invalidate") {
          const topics = (payload.data as { topics?: string[] } | undefined)?.topics ?? [];
          if (topics.includes("all")) {
            queryClient.invalidateQueries();
            return;
          }
          topics.forEach((topic) => {
            (TOPIC_KEYS[topic] ?? []).forEach((queryKey) => {
              queryClient.invalidateQueries({ queryKey });
            });
          });
        }
      };

      socket.onerror = () => {
        setStatus("offline");
      };

      socket.onclose = () => {
        if (pingTimer) window.clearInterval(pingTimer);
        if (disposed) return;
        setStatus("offline");
        reconnectTimer = window.setTimeout(connect, Math.min(15_000, 1500 * (attempt + 1)));
      };
    };

    connect();

    const poll = window.setInterval(() => {
      if (socketRef.current?.readyState !== WebSocket.OPEN) {
        queryClient.invalidateQueries();
      }
    }, 15_000);

    return () => {
      disposed = true;
      if (pingTimer) window.clearInterval(pingTimer);
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      window.clearInterval(poll);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [attempt, queryClient]);

  const value = useMemo(
    () => ({
      status,
      lastEvent,
      lastMessageAt,
      reconnect: () => setAttempt((current) => current + 1),
    }),
    [status, lastEvent, lastMessageAt],
  );

  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime() {
  return useContext(RealtimeContext);
}
