# SPEC 06 — Catálogo de juegos y leaderboard real en Supabase

> **Status:** Aprobado
> **Depends on:** SPEC 04, SPEC 05
> **Date:** 2026-08-27
> **Objective:** Migrar el catálogo de 9 juegos y las puntuaciones a tablas reales de Supabase (`games`, `scores`), conectando `Library`, `GameDetail`, `HallOfFame` y `GamePlayer` a esos datos reales en vez del array mock `GAMES` y del generador falso `seededScores`, con `lib/data.ts` como fallback si Supabase falla.

## Why this spec exists

SPEC 04 conectó el proyecto a Supabase pero explícitamente dejó fuera cualquier tabla ("`profiles`, `scores`, `games`, etc.") y la persistencia real de puntuaciones. SPEC 05 dio a `asteroides` un motor de juego real, pero su puntuación sigue sin persistirse de verdad: `GamePlayer` llama a `saveScore`, que escribe en `localStorage.av_scores` sin que nadie lo vuelva a leer, mientras `GameDetail` y `HallOfFame` muestran leaderboards 100% inventados (`seededScores`) que además usan semillas distintas y no coinciden entre sí — los tres bugs de leaderboard ya documentados en `CLAUDE.md`. Este spec cierra esa brecha: crea las tablas `games` y `scores`, migra el catálogo hardcodeado a `games`, y conecta ambos leaderboards a `scores` como fuente única de verdad.

## Scope

**In:**

- Migración de Supabase (vía `mcp__supabase__apply_migration`) que crea:
  - Tabla `games` (catálogo completo, columnas descritas en Data model), con RLS activado y política de lectura pública. Se siembra con los 9 juegos que hoy están en `GAMES` (`lib/data.ts`), incluyendo `asteroides`.
  - Tabla `scores` (puntuaciones reales), con `game_id` como FK a `games.id`, RLS activado, lectura pública e inserción pública (sin autenticación real, igual que hoy).
- `lib/games-data.ts`: funciones de lectura server-side (`getGames()`, `getGame(id)`, `getLeaderboard(gameId, limit)`, `getBestScores()`) que consultan Supabase vía `lib/supabase/server.ts` y hacen fallback a `GAMES` (de `lib/data.ts`) y a leaderboards vacíos si la consulta falla.
- `lib/scores.ts`: nueva función `saveRealScore(entry)` (inserta en la tabla `scores` vía el cliente de navegador `lib/supabase/client.ts`), usada solo por juegos con motor real (`REAL_GAMES`). La función `saveScore` existente (localStorage) se mantiene sin cambios para los 8 juegos decorativos.
- `lib/data.ts`: se mantiene `GAMES`, `Game`, `CATS` tal cual (fallback). Se elimina `seededScores`, `PLAYERS` y el tipo `ScoreRow` con su generador — dejan de tener consumidores.
- Páginas (`app/biblioteca/page.tsx`, `app/juegos/[id]/page.tsx`, `app/juegos/[id]/jugar/page.tsx`, `app/salon/page.tsx`) pasan de leer `GAMES` directamente a usar `lib/games-data.ts`, y pasan los datos como props a sus componentes.
- `components/Library.tsx`, `components/GameDetail.tsx`, `components/HallOfFame.tsx`: reciben los juegos/leaderboards por props en vez de importar `GAMES`/`seededScores`. Los 8 juegos sin fila en `scores` muestran un estado explícito "sin puntuaciones todavía" (tanto en el leaderboard de `GameDetail` como en la pestaña correspondiente de `HallOfFame`), en vez de datos inventados.
- `components/HallOfFame.tsx`: la fila "TU MEJOR MARCA" deja de simularse (`youRank = 8 + (tab.length % 4)`) — se resuelve buscando si `user.name` aparece entre las filas reales del juego activo; si no aparece, no se muestra la fila.
- `components/GameDetail.tsx`: el stat "Mejor global" deja de leer `game.best` (mock) y pasa a ser la puntuación más alta real de `scores` para ese juego (`—` si no hay ninguna).
- `components/Library.tsx`: el badge "MEJOR PUNTUACIÓN" de cada card pasa a ser la puntuación más alta real de ese juego (`—` si no hay ninguna), en vez de `game.best`.
- `components/GamePlayer.tsx`: al guardar la puntuación, si el juego tiene motor real (`REAL_GAMES[game.id]`) llama a `saveRealScore` (Supabase); si no, sigue llamando a `saveScore` (localStorage) exactamente igual que hoy.

**Out of scope (for future specs):**

- Autenticación real con Supabase Auth — la identidad del jugador sigue siendo el campo de nombre libre (máx. 10 caracteres), sin verificación, igual que hoy. Cualquiera puede insertar una puntuación con cualquier nombre.
- Portar los 8 juegos decorativos a motores reales — siguen sin generar puntuaciones reales; su leaderboard queda permanentemente en el estado "sin puntuaciones todavía" hasta que tengan un motor real en un spec futuro.
- Anti-cheat / validación de puntuaciones insertadas (nada impide insertar un score absurdo vía la API pública de Supabase) — riesgo aceptado y documentado, no mitigado en este spec.
- Edición/borrado de puntuaciones (moderación) — no hay UI ni política RLS para actualizar/eliminar filas de `scores`.
- Tiempo real (Supabase Realtime) — los leaderboards se cargan una vez por navegación de página, sin suscripción a cambios en vivo.
- CRUD de juegos desde la UI — la tabla `games` solo se llena por la migración semilla; no hay pantalla de administración para agregar/editar juegos.
- Cambiar el campo `plays` ("Partidas") — sigue siendo el mismo valor mock migrado tal cual desde `lib/data.ts`, no se conecta a analítica real.
- Cambiar el layout/CSS de `Library`, `GameDetail`, `HallOfFame` o `GamePlayer` más allá de lo necesario para reflejar los nuevos estados de datos (vacío, fallback).

## Data model

```sql
-- games: catálogo completo (9 filas sembradas desde lib/data.ts)
create table public.games (
  id text primary key,
  title text not null,
  short text not null,
  long text not null,
  cat text not null check (cat in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS')),
  cover text not null,
  color text not null check (color in ('cyan', 'magenta', 'yellow', 'green')),
  plays text not null,
  created_at timestamptz not null default now()
);

alter table public.games enable row level security;
create policy "games are publicly readable" on public.games
  for select using (true);

-- scores: puntuaciones reales, hoy solo insertadas por juegos en REAL_GAMES (asteroides)
create table public.scores (
  id uuid primary key default gen_random_uuid(),
  game_id text not null references public.games (id),
  player_name text not null check (char_length(player_name) between 1 and 10),
  score integer not null check (score >= 0),
  created_at timestamptz not null default now()
);

alter table public.scores enable row level security;
create policy "scores are publicly readable" on public.scores
  for select using (true);
create policy "anyone can insert a score" on public.scores
  for insert with check (true);
```

```ts
// lib/games-data.ts
export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // DD/MM/YYYY, formateado desde created_at
}

export async function getGames(): Promise<Game[]>; // fallback: GAMES de lib/data.ts
export async function getGame(id: string): Promise<Game | undefined>;
export async function getLeaderboard(gameId: string, limit?: number): Promise<ScoreRow[]>; // fallback: []
export async function getBestScores(): Promise<Record<string, number>>; // gameId -> mejor score real; fallback: {}
```

```ts
// lib/scores.ts — se agrega junto a saveScore (localStorage) existente
export async function saveRealScore(entry: { game: string; score: number; name: string }): Promise<void>;
```

Convenciones: `games.id`/`scores.game_id` usan el mismo slug kebab-case que `Game.id` hoy (`"asteroides"`, `"bloque-buster"`, …). `ScoreRow.date` se formatea en el servidor a partir de `created_at` con el mismo patrón `DD/MM/YYYY` que usaba `seededScores`, para no tocar el CSS/markup que ya consume ese formato.

## Implementation plan

1. Migración Supabase: crear `games` y `scores` con las columnas, checks y políticas RLS de arriba, e insertar las 9 filas semilla de `games` con los valores actuales de `GAMES` en `lib/data.ts`. Prueba manual: `mcp__supabase__list_tables` muestra ambas tablas; una consulta `select * from games` devuelve 9 filas, incluyendo `asteroides`.
2. Crear `lib/games-data.ts` con `getGames`, `getGame`, `getLeaderboard`, `getBestScores`, cada una con `try/catch` que retorna el fallback (`GAMES`, `undefined`, `[]`, `{}`) si Supabase falla. Prueba manual: llamadas sueltas desde una ruta de prueba o el REPL de Next confirman que devuelven datos reales con Supabase disponible.
3. Agregar `saveRealScore` a `lib/scores.ts` usando `lib/supabase/client.ts`. Quitar `seededScores`, `PLAYERS` y `ScoreRow` de `lib/data.ts` (ya no tienen consumidores tras el paso 6). Prueba manual: el archivo compila; ninguna importación rota todavía (se actualizan en los pasos siguientes).
4. Actualizar `app/biblioteca/page.tsx` (Server Component async) para llamar a `getGames()` + `getBestScores()` y pasarlos como props a `Library`; actualizar `Library`/`GameCard` para recibir `games`/`bestScores` por props y mostrar `bestScores[game.id] ?? "—"` en vez de `game.best`. Prueba manual: `/biblioteca` muestra las 9 cards con datos de Supabase; si `asteroides` ya tiene puntuaciones guardadas, su badge muestra el máximo real.
5. Actualizar `app/juegos/[id]/page.tsx` para usar `getGame(id)` + `getLeaderboard(id, 10)` y pasarlos a `GameDetail`; actualizar `GameDetail` para recibir `scores` por props, mostrar "Mejor global" desde `scores[0]?.score ?? "—"`, y un estado "AÚN NO HAY PUNTUACIONES" cuando `scores.length === 0`. Prueba manual: `/juegos/asteroides` (con datos) muestra el leaderboard real; `/juegos/bloque-buster` muestra el estado vacío.
6. Actualizar `app/salon/page.tsx` para cargar `getGames()` y un leaderboard por juego (`getLeaderboard` para cada uno de los 9), pasando `games`/`leaderboards` a `HallOfFame`; actualizar `HallOfFame` para recibir esas props, generar sus 9 pestañas desde `games`, resolver el podio con relleno "—" cuando hay menos de 3 filas, mostrar el estado vacío para juegos sin puntuaciones, y calcular "TU MEJOR MARCA" buscando `user.name` en las filas reales del juego activo (sin fila si no aparece). Prueba manual: `/salon` muestra 9 pestañas; la de `asteroides` con datos reales, el resto en estado vacío; el podio no rompe con 0/1/2 filas.
7. Actualizar `app/juegos/[id]/jugar/page.tsx` para usar `getGame(id)` en vez de `GAMES.find`; actualizar `GamePlayer` para llamar a `saveRealScore` cuando `REAL_GAMES[game.id]` existe (mostrando el mismo toast "PUNTUACIÓN GUARDADA" al resolver, o un estado de error simple si falla la inserción) y a `saveScore` (localStorage, sin cambios) en cualquier otro caso. Prueba manual: jugar `asteroides` de punta a punta, guardar la puntuación, y verla aparecer en `/juegos/asteroides` y en la pestaña `ASTEROIDES` de `/salon`; jugar cualquier otro juego y confirmar que su leaderboard sigue vacío después de "guardar".
8. Pulido final: `npm run lint` y `npm run build` sin errores.

## Acceptance criteria

- [ ] `npm run build` completa sin errores.
- [ ] `npm run lint` completa sin errores.
- [ ] Las tablas `games` y `scores` existen en Supabase con RLS activado y las políticas descritas en Data model.
- [ ] `games` tiene exactamente 9 filas sembradas, con `id`/`title`/`cat`/`cover`/`color`/`plays` iguales a los valores actuales de `GAMES` en `lib/data.ts`.
- [ ] `/biblioteca` muestra las 9 cards leídas de Supabase; el badge "MEJOR PUNTUACIÓN" de `asteroides` refleja el máximo real de `scores` (o "—" si aún no hay ninguna).
- [ ] `/juegos/asteroides` muestra "Mejor global" y el leaderboard "MEJORES PUNTUACIONES" desde datos reales de `scores`, no desde `game.best` ni `seededScores`.
- [ ] `/juegos/bloque-buster` (o cualquier otro de los 8 decorativos) muestra el estado "AÚN NO HAY PUNTUACIONES" en su leaderboard, sin datos inventados.
- [ ] Jugar `asteroides` completo, guardar la puntuación desde el modal, y ver esa puntuación aparecer en el leaderboard de `/juegos/asteroides` en la siguiente carga de la página.
- [ ] Esa misma puntuación aparece también en la pestaña `ASTEROIDES` de `/salon`, con el mismo valor (leaderboard unificado, ya no hay dos fuentes independientes).
- [ ] `/salon` muestra 9 pestañas, una por juego; las 8 sin puntuaciones reales muestran un estado vacío sin romper el podio (sin acceder a `rows[1]`/`rows[2]` inexistentes).
- [ ] Iniciar sesión con un nombre que coincide con una fila real de `scores` para el juego activo en `/salon` muestra la fila "TU MEJOR MARCA"; si no coincide ninguna, esa fila no aparece.
- [ ] Guardar una puntuación en cualquiera de los 8 juegos decorativos sigue escribiendo únicamente en `localStorage.av_scores`, sin insertar en la tabla `scores` de Supabase.
- [ ] Si `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` faltan o Supabase no responde, `/biblioteca`, `/juegos/[id]` y `/salon` siguen renderizando (con los 9 juegos de `GAMES` como fallback y leaderboards vacíos) en vez de un error 500.
- [ ] `lib/data.ts` ya no exporta `seededScores`, `PLAYERS` ni `ScoreRow`.

## Decisions

- **Sí:** migrar el catálogo completo (9 juegos) a la tabla `games`, no solo `asteroides`. Decisión explícita del usuario tras la primera ronda de preguntas — deja `games` como la fuente real del catálogo para todos los juegos, no solo los que ya tienen motor real.
- **Sí:** `lib/data.ts` (`GAMES`) se mantiene como fallback si Supabase falla, en vez de eliminarse. Decisión explícita del usuario — evita que un fallo de red o de configuración tumbe `/biblioteca`, `/juegos/[id]` o `/salon` por completo.
- **Sí:** unificar `GameDetail` y `HallOfFame` a la misma fuente real (`scores`), en vez de dejar uno de los dos leaderboards con datos falsos. Corrige de raíz el bug documentado de los dos leaderboards independientes que no coincidían (`detalle.jsx` semilla `id.length * 17 + 3`, `salon.jsx` semilla `tab.length * 23 + 7`).
- **Sí:** eliminar `seededScores` por completo en vez de usarlo como semilla o fallback visual. Decisión explícita del usuario — el leaderboard arranca vacío y honesto en vez de mostrar datos inventados que nunca corresponden a partidas reales.
- **Sí:** `HallOfFame` muestra 9 pestañas (una por fila de `games`), no solo la de juegos con motor real. Decisión explícita del usuario tras señalar la contradicción con la migración completa del catálogo — las 8 pestañas sin puntuaciones reales muestran el estado vacío en vez de ocultarse.
- **Sí:** los 8 juegos decorativos conservan el flujo actual de `saveScore` (`localStorage`, write-only) sin tocar. Decisión explícita del usuario — evita generar filas reales sin sentido (puntuación siempre 0) en la tabla `scores` para juegos que no tienen partida real detrás.
- **Sí:** "Mejor global" (`GameDetail`) y "MEJOR PUNTUACIÓN" (`Library`) pasan a ser el máximo real de `scores` (o "—" sin datos), en vez de conservar el campo mock `best`. Decisión explícita del usuario — corrige el otro bug documentado (`game.best` inconsistente con el leaderboard generado) para `asteroides`, y evita inventar un número para el resto.
- **Sí:** insertar puntuaciones reales desde el cliente de navegador (`lib/supabase/client.ts`) con una política RLS de inserción pública, en vez de una API route intermedia. No hay autenticación real que verificar server-side todavía (ver Out of scope), así que una API route no añadiría seguridad, solo una capa extra.
- **No:** autenticación real / Supabase Auth en este spec. El usuario confirmó explícitamente mantener el nombre libre de hasta 10 caracteres sin verificación, igual que hoy — vincular puntuaciones a cuentas reales es un spec aparte.
- **No:** anti-cheat o validación de puntuaciones. La política de inserción pública permite insertar cualquier score numérico ≥ 0; se documenta como riesgo aceptado (ver Risks), no se mitiga aquí.
- **No:** Supabase Realtime para los leaderboards. Cada página consulta una vez por navegación; una suscripción en vivo es una ampliación de alcance para un spec futuro si hace falta.
- **No:** UI de administración para editar/agregar juegos en `games`. La tabla se llena solo por la migración semilla de este spec.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| La política `for insert with check (true)` en `scores` permite que cualquiera con la publishable key inserte puntuaciones arbitrarias (sin relación con una partida real) | Riesgo aceptado explícitamente (ver Decisions) — coherente con que hoy tampoco hay autenticación real ni verificación de partida. Se revisita si el spec de autenticación real llega a implementarse. |
| El podio de `HallOfFame` (`rows[0]`, `rows[1]`, `rows[2]`) rompe si el juego activo tiene menos de 3 puntuaciones reales — hoy 8 de 9 juegos tendrán 0 | El paso 6 del plan diseña explícitamente el relleno de slots vacíos ("—") en el podio cuando hay menos de 3 filas; cubierto por un criterio de aceptación propio. |
| Si `getGames()`/`getLeaderboard()` fallan silenciosamente (Supabase caído) y el fallback a `GAMES` no se prueba, `/biblioteca` podría quedar en blanco sin aviso | Criterio de aceptación explícito que verifica el comportamiento de fallback simulando credenciales de Supabase inválidas/ausentes. |

## What is **not** in this spec

- Autenticación real con Supabase Auth.
- Motores reales para los 8 juegos decorativos.
- Anti-cheat / validación de puntuaciones insertadas.
- Edición o borrado de puntuaciones.
- Supabase Realtime.
- UI de administración del catálogo de juegos.
- Cambios al campo `plays` más allá de migrarlo tal cual.

Cada uno de estos, si se necesita, va en su propio spec.
