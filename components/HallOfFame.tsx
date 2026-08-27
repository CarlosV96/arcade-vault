"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { type Game } from "@/lib/data";
import { type ScoreRow } from "@/lib/games-data";
import { useSession } from "@/lib/session";

function PodiumSlot({
  className,
  rankLabel,
  row,
  children,
}: {
  className: string;
  rankLabel: string;
  row: ScoreRow | undefined;
  children?: React.ReactNode;
}) {
  return (
    <div className={"podium-slot " + className}>
      {children}
      <div className="rank-num">{rankLabel}</div>
      <div className="name">{row?.name ?? "—"}</div>
      <div className="score">{row ? row.score.toLocaleString("es-ES") : "—"}</div>
      <div className="date">{row?.date ?? "—"}</div>
    </div>
  );
}

export function HallOfFame({
  games,
  leaderboards,
}: {
  games: Game[];
  leaderboards: Record<string, ScoreRow[]>;
}) {
  const { user } = useSession();
  const [tab, setTab] = useState(games[0]?.id ?? "");
  const rows = useMemo(() => leaderboards[tab] ?? [], [leaderboards, tab]);
  const game = games.find((g) => g.id === tab);
  const youRow = useMemo(
    () => (user ? rows.find((r) => r.name === user.name) : undefined),
    [rows, user]
  );

  return (
    <div className="av-hall fade-in">
      <div className="hall-head">
        <h1>SALÓN DE LA FAMA</h1>
        <p className="pixel" style={{ fontSize: 10 }}>
          LOS NOMBRES QUE NUNCA SE BORRAN DE LA PANTALLA
        </p>
      </div>

      <div className="hall-tabs">
        {games.map((g) => (
          <button key={g.id} className={"chip" + (tab === g.id ? " active" : "")} onClick={() => setTab(g.id)}>
            {g.title}
          </button>
        ))}
      </div>

      <div className="podium">
        <PodiumSlot className="silver" rankLabel="02" row={rows[1]} />
        <PodiumSlot className="gold" rankLabel="01" row={rows[0]}>
          <div className="pixel" style={{ fontSize: 9, color: "var(--gold)", letterSpacing: "0.18em" }}>
            CAMPEÓN
          </div>
        </PodiumSlot>
        <PodiumSlot className="bronze" rankLabel="03" row={rows[2]} />
      </div>

      <div className="hall-table">
        <div className="th">
          <div>RANGO</div>
          <div>JUGADOR</div>
          <div>PUNTUACIÓN</div>
          <div>FECHA</div>
        </div>
        {rows.length === 0 ? (
          <div style={{ padding: "24px 0", textAlign: "center", color: "var(--ink-faint)" }}>
            AÚN NO HAY PUNTUACIONES
          </div>
        ) : (
          rows.map((r, i) => (
            <div
              key={r.rank}
              className={"tr" + (i === 0 ? " top1" : i === 1 ? " top2" : i === 2 ? " top3" : "")}
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="rk">#{String(r.rank).padStart(2, "0")}</div>
              <div className="pl">{r.name}</div>
              <div className="sc">{r.score.toLocaleString("es-ES")}</div>
              <div className="dt">{r.date}</div>
            </div>
          ))
        )}
        {user && youRow && game && (
          <>
            <div className="tr you-label">▸ TU MEJOR MARCA EN {game.title}</div>
            <div className="tr you" style={{ animationDelay: `${rows.length * 50 + 50}ms` }}>
              <div className="rk" style={{ color: "var(--yellow)" }}>
                #{String(youRow.rank).padStart(2, "0")}
              </div>
              <div className="pl" style={{ color: "var(--yellow)" }}>
                {youRow.name}
              </div>
              <div className="sc" style={{ color: "var(--yellow)", textShadow: "0 0 6px rgba(245,255,0,0.5)" }}>
                {youRow.score.toLocaleString("es-ES")}
              </div>
              <div className="dt">{youRow.date}</div>
            </div>
          </>
        )}
      </div>

      <div style={{ textAlign: "center", marginTop: 32 }}>
        <Link href="/biblioteca" className="btn lg">
          VOLVER A LA BIBLIOTECA
        </Link>
      </div>
    </div>
  );
}
