"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getMe, logout as apiLogout } from "./api";
import type { SaasMeResponse } from "./api-types";

interface AuthContextValue {
  me: SaasMeResponse | null;
  loading: boolean;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  me: null,
  loading: true,
  logout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<SaasMeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    try {
      const data = await getMe();
      setMe(data);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    try {
      await apiLogout();
    } catch {}
    setMe(null);
  }

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const data = await getMe();
        if (!cancelled) {
          setMe(data);
        }
      } catch {
        if (!cancelled) {
          setMe(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ me, loading, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
