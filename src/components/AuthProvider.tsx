"use client";

import { createContext, useContext, useEffect, useState } from "react";

export interface SessionUser {
  id: string;
  name: string;
  email: string;
}

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({
  initialUser = null,
  children,
}: {
  initialUser?: SessionUser | null;
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<SessionUser | null>(initialUser);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/auth/me", { cache: "no-store" });
      const d = await r.json();
      setUser(d.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    window.location.href = "/login";
  };

  useEffect(() => {
    if (!initialUser) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) return { user: null, loading: false, refresh: async () => {}, logout: async () => {} };
  return ctx;
}
