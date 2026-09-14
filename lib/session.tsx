"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export interface SessionUser {
  name: string;
  email: string | null;
}

interface SessionContextValue {
  user: SessionUser | null;
  login: (user: SessionUser | null) => void;
  logout: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

function normalizeName(raw: string): string {
  return raw.toUpperCase().slice(0, 10);
}

function toSessionUser(user: User): SessionUser {
  const metadata = user.user_metadata ?? {};
  const rawName = metadata.username || metadata.full_name || metadata.name || user.email?.split("@")[0] || "PLAYER1";
  return { name: normalizeName(rawName), email: user.email ?? null };
}

function readGuestUser(): SessionUser | null {
  try {
    return JSON.parse(localStorage.getItem("av_user") || "null");
  } catch {
    return null;
  }
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUser(session ? toSessionUser(session.user) : readGuestUser());
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session ? toSessionUser(session.user) : readGuestUser());
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const login = (u: SessionUser | null) => {
    // Solo usado por el modo invitado — las cuentas reales se sincronizan vía
    // supabase.auth.onAuthStateChange.
    setUser(u);
    localStorage.setItem("av_user", JSON.stringify(u));
  };

  const logout = async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (session) {
      await supabase.auth.signOut();
    }
    setUser(null);
    localStorage.removeItem("av_user");
  };

  return <SessionContext.Provider value={{ user, login, logout }}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession debe usarse dentro de SessionProvider");
  return ctx;
}
