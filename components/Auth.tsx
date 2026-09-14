"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/session";
import { createClient } from "@/lib/supabase/client";

function friendlyError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) {
    return "Usuario o contraseña incorrectos.";
  }
  if (normalized.includes("already registered") || normalized.includes("already exists")) {
    return "Ya existe una cuenta con ese correo.";
  }
  if (normalized.includes("password")) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }
  return "Ocurrió un error. Intenta de nuevo.";
}

export function Auth() {
  const router = useRouter();
  const { login } = useSession();
  const [tab, setTab] = useState<"in" | "up">("in");
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [oauthLoading, setOauthLoading] = useState<"google" | "github" | null>(null);

  const changeTab = (next: "in" | "up") => {
    setTab(next);
    setError(null);
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const supabase = createClient();

    if (tab === "up") {
      const username = (user || "PLAYER1").toUpperCase().slice(0, 10);
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password: pass,
        options: { data: { username } },
      });
      setLoading(false);
      if (signUpError) {
        setError(friendlyError(signUpError.message));
        return;
      }
      if (!data.session) {
        // Con "Confirm email" desactivado, signUp() sin sesión de vuelta suele
        // significar que el correo ya tenía una cuenta (protección anti-enumeración).
        setError("Revisa tus datos o intenta iniciar sesión.");
        return;
      }
      router.push("/biblioteca");
      return;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: pass });
    setLoading(false);
    if (signInError) {
      setError(friendlyError(signInError.message));
      return;
    }
    router.push("/biblioteca");
  };

  const playAsGuest = () => {
    login(null);
    router.push("/biblioteca");
  };

  const signInWithOAuth = async (provider: "google" | "github") => {
    setError(null);
    setOauthLoading(provider);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (oauthError) {
      setError(friendlyError(oauthError.message));
      setOauthLoading(null);
    }
    // En éxito el navegador redirige al proveedor — no queda nada más por hacer aquí.
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-faint)", letterSpacing: "0.16em", marginTop: 6 }}>
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        <div className="auth-tabs">
          <button className={tab === "in" ? "on" : ""} onClick={() => changeTab("in")}>
            INICIAR SESIÓN
          </button>
          <button className={tab === "up" ? "on" : ""} onClick={() => changeTab("up")}>
            CREAR CUENTA
          </button>
        </div>

        <form onSubmit={submit}>
          {tab === "up" && (
            <div className="field slide-in">
              <label>Usuario</label>
              <input value={user} onChange={(e) => setUser(e.target.value)} placeholder="px_kai" />
            </div>
          )}
          <div className="field">
            <label>Correo electrónico</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jugador@vault.gg" />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input
              type="password"
              required
              minLength={6}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="mono" style={{ fontSize: 11, color: "var(--magenta)", marginTop: 10, letterSpacing: "0.02em" }}>
              {error}
            </div>
          )}

          <button className="btn lg" type="submit" disabled={loading} style={{ width: "100%", marginTop: 8 }}>
            {loading ? "ENVIANDO..." : tab === "in" ? "ENTRAR AL VAULT" : "CREAR Y JUGAR"}
          </button>
        </form>

        <button className="btn ghost" style={{ width: "100%", marginTop: 10 }} onClick={playAsGuest}>
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button
            className="btn ghost"
            type="button"
            disabled={oauthLoading !== null}
            onClick={() => void signInWithOAuth("google")}
          >
            {oauthLoading === "google" ? "CONECTANDO..." : "◆ GOOGLE"}
          </button>
          <button
            className="btn ghost"
            type="button"
            disabled={oauthLoading !== null}
            onClick={() => void signInWithOAuth("github")}
          >
            {oauthLoading === "github" ? "CONECTANDO..." : "▣ GITHUB"}
          </button>
        </div>

        <div style={{ marginTop: 18, textAlign: "center", fontSize: 11, color: "var(--ink-faint)", letterSpacing: "0.1em" }}>
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
