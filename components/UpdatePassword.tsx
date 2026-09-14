"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function friendlyError(message: string): string {
  const normalized = message.toLowerCase();
  if (normalized.includes("session") || normalized.includes("token")) {
    return "El enlace expiró o no es válido. Solicita uno nuevo desde INICIAR SESIÓN.";
  }
  if (normalized.includes("password")) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }
  return "Ocurrió un error. Intenta de nuevo.";
}

export function UpdatePassword() {
  const router = useRouter();
  const [pass, setPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (pass !== confirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password: pass });
    setLoading(false);
    if (updateError) {
      setError(friendlyError(updateError.message));
      return;
    }
    router.push("/biblioteca");
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark" />
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div className="mono" style={{ fontSize: 11, color: "var(--ink-faint)", letterSpacing: "0.16em", marginTop: 6 }}>
            NUEVA CONTRASEÑA
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="field">
            <label>Nueva contraseña</label>
            <input
              type="password"
              required
              minLength={6}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          <div className="field">
            <label>Confirmar contraseña</label>
            <input
              type="password"
              required
              minLength={6}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="mono" style={{ fontSize: 11, color: "var(--magenta)", marginTop: 10, letterSpacing: "0.02em" }}>
              {error}
            </div>
          )}

          <button className="btn lg" type="submit" disabled={loading} style={{ width: "100%", marginTop: 8 }}>
            {loading ? "GUARDANDO..." : "GUARDAR CONTRASEÑA"}
          </button>
        </form>
      </div>
    </div>
  );
}
