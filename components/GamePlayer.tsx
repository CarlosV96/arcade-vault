"use client";

import { useRef, useState } from "react";
import type { ForwardRefExoticComponent, RefAttributes } from "react";
import Link from "next/link";
import { useSession } from "@/lib/session";
import { saveScore, saveRealScore } from "@/lib/scores";
import type { Game } from "@/lib/data";
import { REAL_GAMES } from "@/components/games/registry";
import type { RealGameHandle, RealGameProps } from "@/lib/games/types";

const SCORE = 0;
const LIVES = 3;
const LEVEL = 1;

export function GamePlayer({ game }: { game: Game }) {
  const { user } = useSession();
  const RealGame = REAL_GAMES[game.id] as
    | ForwardRefExoticComponent<RealGameProps & RefAttributes<RealGameHandle>>
    | undefined;
  const gameRef = useRef<RealGameHandle>(null);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [name, setName] = useState(user ? user.name : "INVITADO");
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [restartKey, setRestartKey] = useState(0);
  const [realScore, setRealScore] = useState(0);
  const [realLives, setRealLives] = useState(3);
  const [realLevel, setRealLevel] = useState(1);

  const displayScore = RealGame ? realScore : SCORE;
  const displayLives = RealGame ? realLives : LIVES;
  const displayLevel = RealGame ? realLevel : LEVEL;

  const endGame = () => {
    if (RealGame) {
      gameRef.current?.end();
    } else {
      setOver(true);
    }
  };
  const restart = () => {
    setPaused(false);
    setOver(false);
    setSaved(false);
    setSaveError(null);
    setSaving(false);
    setRealScore(0);
    setRealLives(3);
    setRealLevel(1);
    setRestartKey((k) => k + 1);
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{displayScore.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(displayLives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(displayLevel).padStart(2, "0")}</div>
          </div>
        </div>
        <div className="hud-actions">
          <button className="btn yellow" onClick={() => setPaused((p) => !p)}>
            {paused ? "REANUDAR" : "PAUSA"}
          </button>
          <button className="btn magenta" onClick={endGame}>
            FIN
          </button>
          <Link href={`/juegos/${game.id}`} className="btn ghost">
            SALIR
          </Link>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {RealGame ? (
            <RealGame
              key={restartKey}
              ref={gameRef}
              paused={paused}
              onScoreChange={setRealScore}
              onLivesChange={setRealLives}
              onLevelChange={setRealLevel}
              onGameOver={(finalScore) => {
                setRealScore(finalScore);
                setOver(true);
              }}
            />
          ) : (
            <div className="game-arena">
              <div className="grid-floor" />
              <div className="enemy e1" />
              <div className="enemy e2" />
              <div className="enemy e3" />
              <div className="player-ship" />
            </div>
          )}
          {paused && (
            <div className="crt-content" style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}>
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div className="mono" style={{ fontSize: 11, color: "var(--ink-dim)", marginTop: 10, letterSpacing: "0.16em" }}>
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="crt-bottom">
          <span className="led">SEÑAL OK</span>
          <span>
            {game.title} · CRT-83 · 60 HZ
          </span>
          <span>CARGA · 1MB</span>
        </div>
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{displayScore.toLocaleString("es-ES")}</div>
            {!saved ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value.toUpperCase().slice(0, 10))}
                  placeholder="TUS INICIALES"
                />
                <button
                  className="btn yellow"
                  disabled={saving}
                  onClick={async () => {
                    if (RealGame) {
                      setSaving(true);
                      setSaveError(null);
                      try {
                        await saveRealScore({ game: game.id, score: displayScore, name });
                        setSaved(true);
                      } catch {
                        setSaveError("NO SE PUDO GUARDAR LA PUNTUACIÓN");
                      } finally {
                        setSaving(false);
                      }
                    } else {
                      saveScore({ game: game.id, score: displayScore, name });
                      setSaved(true);
                    }
                  }}
                >
                  {saving ? "GUARDANDO…" : "GUARDAR PUNTUACIÓN"}
                </button>
                {saveError && (
                  <div
                    className="toast-saved"
                    style={{ color: "var(--magenta)", textShadow: "0 0 8px var(--magenta)", borderRightColor: "var(--magenta)" }}
                  >
                    ▸ {saveError}_
                  </div>
                )}
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link href="/biblioteca" className="btn magenta">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
