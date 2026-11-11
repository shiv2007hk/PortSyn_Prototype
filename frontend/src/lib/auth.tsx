import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, setCsrfToken, type AuthUser } from "./api";

interface AuthValue {
  user: AuthUser | null;
  loading: boolean;
  readOnly: boolean;
  login: (email: string, password: string, remember: boolean) => Promise<AuthUser>;
  signup: (name: string, email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue>({
  user: null,
  loading: true,
  readOnly: true,
  login: async () => {
    throw new Error("AuthProvider missing");
  },
  signup: async () => {
    throw new Error("AuthProvider missing");
  },
  logout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const session = await api.auth.me();
      setCsrfToken(session.csrf_token);
      setUser(session.user);
    } catch {
      setCsrfToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onUnauthorized = () => {
      setCsrfToken(null);
      setUser(null);
      queryClient.clear();
    };
    window.addEventListener("portsync:unauthorized", onUnauthorized);
    return () => window.removeEventListener("portsync:unauthorized", onUnauthorized);
  }, [queryClient]);

  const login = useCallback(
    async (email: string, password: string, remember: boolean) => {
      const session = await api.auth.login({ email, password, remember });
      setCsrfToken(session.csrf_token);
      queryClient.clear();
      setUser(session.user);
      return session.user;
    },
    [queryClient],
  );

  const signup = useCallback(
    async (name: string, email: string, password: string) => {
      const session = await api.auth.signup({ name, email, password, terms: true });
      setCsrfToken(session.csrf_token);
      queryClient.clear();
      setUser(session.user);
      return session.user;
    },
    [queryClient],
  );

  const logout = useCallback(async () => {
    try {
      await api.auth.logout();
    } finally {
      setCsrfToken(null);
      setUser(null);
      queryClient.clear();
    }
  }, [queryClient]);

  const value = useMemo<AuthValue>(
    () => ({
      user,
      loading,
      readOnly: user?.role === "viewer",
      login,
      signup,
      logout,
      refresh,
    }),
    [user, loading, login, signup, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
