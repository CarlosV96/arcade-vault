# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

Package manager is npm (`package-lock.json` is the only lockfile).

| Command | Purpose |
|---|---|
| `npm run dev` | Start the dev server (also rewrites `AGENTS.md` — see above) |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run lint` | ESLint, flat config (`eslint.config.mjs`) |

There is no test runner, no test script, and no test files anywhere in the repo, and no CI
(`.github/` doesn't exist). Adding a test setup is a decision to make, not something to look up.

## Stack specifics (Next.js 16 / React 19)

- Next `16.3.0`, React `19.2.8`, TypeScript strict, Tailwind **v4, CSS-first config**.
- There is **no `tailwind.config.*`, and that's correct for v4** — theme tokens live in the
  `@theme inline` block inside `app/globals.css`; `postcss.config.mjs` only wires up
  `@tailwindcss/postcss`.
- **Typed routes are on.** `next-env.d.ts` pulls in `.next/dev/types/`, which is why
  `app/layout.tsx` types its props as `LayoutProps<"/">` instead of a hand-written
  `{ children: React.ReactNode }`. Don't "fix" that — it's a generated global type.
- Path alias `@/*` → repo root (there is no `src/`).
- Fonts (Press Start 2P, Courier Prime, JetBrains Mono) are loaded via `next/font/google` in
  `app/layout.tsx`, replacing the original Geist boilerplate.
- Dependencies beyond Next/React: `@supabase/ssr` + `@supabase/supabase-js` (catalog/leaderboard
  persistence) and `resend` (transactional email for the contact form). No ORM, no state
  management library — `lib/session.tsx`'s `SessionProvider` (React context) is the only
  cross-page client state.

## Workflow: Spec-Driven Design

This repo is built entirely through `/spec` → `/spec-impl`, both from
`Klerith/fernando-skills` (`npx skills@latest add Klerith/fernando-skills`; installed under
both `.agents/skills/` and `.claude/skills/`). Every feature in `app/`, `components/`, and
`lib/` traces back to a numbered file in `specs/` (`specs/NN-slug.md`), each with `Status`,
`Depends on`, `Scope (In/Out)`, `Data model`, `Implementation plan`, `Acceptance criteria`,
`Decisions`, and `Risks` sections. **Read the relevant spec before changing behavior it
describes** — the `Decisions` section usually records *why* something looks the way it does
(often "the user explicitly chose X over Y"), which isn't visible from the code alone.

There's also a project-specific skill, `.claude/skills/add-game/SKILL.md` (`/add-game`), that
generates a new `specs/NN-slug.md` for porting a real game into the catalog — it only asks
game-specific questions (id, category, color, cover, canvas/asset strategy) because the
integration architecture (registry, Supabase tables, `RealGameProps` contract) is already
fixed by SPEC 05/06. It never writes application code or touches Supabase itself; it only
produces a Draft spec for `/spec-impl` to implement.

Specs so far (all in `specs/`, chronological):

| Spec | Title | Status |
|---|---|---|
| 01 | MVP visual — 5 pantallas del prototipo portadas a App Router | Implementado |
| 02 | Home (landing) y Acerca de — `/` se convierte en Home, Biblioteca se muda a `/biblioteca` | Implementado |
| 03 | Envío real de contacto vía Resend (`app/api/contact`) | Implementado |
| 04 | Integración base de Supabase (clientes navegador/servidor, health-check) | Implementado |
| 05 | Juego real de Asteroides (`asteroides`) — arquitectura de registro | Implementado |
| 06 | Catálogo y leaderboard reales en Supabase (tablas `games`/`scores`) | Aprobado |
| 07 | Juego real de Tetris (`tetris`) | Implementado |
| 08 | Juego real de Arkanoid (`arkanoid`) | Aprobado |
| 09 | Juego real de Snake (`snake-real`) — sin `game.js` de referencia, atlas de sprites propio | Aprobado |

Read spec 05 and 06 in full before touching anything under `lib/games/`,
`components/games/`, or the Supabase catalog — they fix the extension architecture that
07/08/09 (and `/add-game`) all follow without re-deriving it.

## Current state

The prototype described below has been fully ported and substantially extended. `app/` is
**not** unmodified `create-next-app` output anymore — treat the routes/components/lib layout
as the real source of truth; the porting table further down is historical context for *why*
things are named and shaped the way they are, not a to-do list.

### Routes

| Route | Component | Notes |
|---|---|---|
| `/` | `Home` (`components/Home.tsx`) | Landing page (SPEC 02) — hero, features, mini game rail, stats, static "actividad en vivo", pricing, CTA. |
| `/biblioteca` | `Library` (`components/Library.tsx`) | The original prototype's default screen; moved here in SPEC 02. Reads the catalog via `lib/games-data.ts`. |
| `/juegos/[id]` | `GameDetail` (`components/GameDetail.tsx`) | Game description + real leaderboard (`getLeaderboard`) via Supabase, `lib/data.ts` as fallback. |
| `/juegos/[id]/jugar` | `GamePlayer` (`components/GamePlayer.tsx`) | HUD + real canvas game when `REAL_GAMES[id]` exists (see below), otherwise the original decorative shell. |
| `/auth` | `Auth` (`components/Auth.tsx`) | Still a frontend-only simulation — no real backend auth (see Known bugs). |
| `/salon` | `HallOfFame` (`components/HallOfFame.tsx`) | One tab per game in `games`, real leaderboards, "TU MEJOR MARCA" resolved against real rows. |
| `/about` | `About` (`components/About.tsx`) | Mission/contact page (SPEC 02); contact form posts to `/api/contact` (SPEC 03, real Resend send). |
| `/api/contact` | Route Handler | `POST`, validates + sends via Resend to a fixed recipient, `reply_to` = sender's email. |
| `/api/supabase-health` | Route Handler | `GET`, confirms Supabase connectivity without needing any real table. |

`Nav` (`components/Nav.tsx`, in `app/layout.tsx`) highlights: Inicio (`/`), Biblioteca
(`/biblioteca` + any `/juegos/*`), Salón de la Fama (`/salon`), Acerca de (`/about`).

### Game catalog: decorative vs. real

`GAMES` in `lib/data.ts` now has **13 entries**: the original 8 decorative ones (`bloque-buster`,
`caida`, `serpentina`, `gloton`, `invasores`, `rocas`, `ranaria`, `duelo-pixel` — still pure
CSS/HUD simulations, no real engine, untouched since SPEC 01) plus **4 real, playable games**
added one per spec, each as a brand-new catalog id (never replacing the thematically similar
decorative entry — e.g. `asteroides` next to `rocas`, `tetris` next to `caida`, `arkanoid` next
to `bloque-buster`, `snake-real` next to `serpentina`):

| Real game id | Spec | Engine | Canvas wrapper | Notes |
|---|---|---|---|---|
| `asteroides` | 05 | `lib/games/asteroids-engine.ts` | `components/games/AsteroidsCanvas.tsx` | Keeps its own canvas-drawn HUD/"GAME OVER" overlay (intentional duplication with React's HUD); 800×600. |
| `tetris` | 07 | `lib/games/tetris-engine.ts` | `components/games/TetrisCanvas.tsx` | 450×600 single canvas (board + "next piece" panel fused); no internal HUD; `onLivesChange` fixed at `1` (no lives concept). |
| `arkanoid` | 08 | `lib/games/arkanoid-engine.ts` | `components/games/ArkanoidCanvas.tsx` | No spritesheet/audio ported — canvas primitives only; no internal HUD/pause overlay; dual mouse+arrow paddle control; 800×600. |
| `snake-real` | 09 | `lib/games/snake-engine.ts` | `components/games/SnakeCanvas.tsx` | Built from scratch (no reference `game.js`); uses a real fruit sprite atlas (`lib/games/snake-sprites.ts` + `public/games/snake-real/fruits.png`, sourced from spriters-resource.com — licensing risk accepted, see SPEC 09); 1 life, lethal (non-toroidal) walls; 800×600. |

**The registry architecture (fixed since SPEC 05/06, do not redesign):**

- `lib/games/types.ts` — the fixed contract every engine implements: `RealGameProps`
  (`paused`, `onScoreChange`, `onLivesChange`, `onLevelChange`, `onGameOver`) and
  `RealGameHandle` (`end()`). **Never changes per game.**
- `lib/games/real-game-ids.ts` — `REAL_GAME_IDS: string[]`, the single list of which catalog
  ids have a real engine. Adding a game means adding one id here.
- `components/games/registry.ts` — `COMPONENTS` maps id → canvas wrapper component;
  `REAL_GAMES` is derived from `REAL_GAME_IDS` + `COMPONENTS` automatically. Adding a game
  means adding one entry to `COMPONENTS`.
- Everything else (`GamePlayer.tsx`, `GameDetail.tsx`, `HallOfFame.tsx`, `Library.tsx`,
  `lib/games-data.ts`, `lib/scores.ts`) is generic over `REAL_GAME_IDS`/`REAL_GAMES` and needs
  **zero changes** to onboard a new real game — confirmed true across specs 07/08/09. If you
  find yourself editing one of those files just to add a game, something has drifted from the
  intended architecture; stop and re-read spec 05/06 first.
- Each engine is a `create<Name>Engine(canvas, callbacks)` factory with all state inside the
  instance closure (no module-level `let`), and `pause()`/`resume()`/`endNow()`/`destroy()`.
  Remounting via a changed `key` (on "JUGAR DE NUEVO") is how a clean instance is guaranteed —
  don't try to add a `reset()` method instead.

### Data layer: Supabase-first with local fallback

Since SPEC 06, the catalog and leaderboards are **real Supabase tables**, not the mock arrays
the prototype used:

- `games` table — full catalog (13 rows), publicly readable via RLS. `lib/games-data.ts`'s
  `getGames()`/`getGame(id)` read from it, falling back to `GAMES` (`lib/data.ts`) if Supabase
  is unreachable. `games` has **no `best` column** — `toGame()` always sets `best: 0` on rows
  read from Supabase; the mock `best` values in `lib/data.ts` are fallback-only and never reach
  the UI once Supabase is up (`GameDetail`/`Library` compute "best" from real `scores` instead).
- `scores` table — real player scores, `game_id` FK to `games.id`, publicly readable and
  publicly insertable via RLS (no auth to check against — accepted risk, see SPEC 06 Risks).
  Only games in `REAL_GAME_IDS` ever get real rows here.
- `lib/games-data.ts` also exposes `getLeaderboard(gameId, limit)` and `getBestScores()`, both
  Supabase-backed with empty-result fallbacks (`[]`/`{}`) rather than throwing.
- `plays` ("Partidas") is dynamic **only** for `REAL_GAME_IDS` games — computed from a live
  `count` of `scores` rows and formatted like the mock strings (`"1.2K"`). The 8 decorative
  games keep their hardcoded mock `plays` from `lib/data.ts` forever, since they never write
  real score rows.
- `lib/data.ts` no longer exports `seededScores`, `PLAYERS`, or the old `ScoreRow` generator —
  those were removed in SPEC 06 once real leaderboards took over. `ScoreRow` now lives in
  `lib/games-data.ts` (server-computed, `date` formatted from `created_at`).
- `lib/scores.ts` has **two** save functions with different destinations, chosen by
  `GamePlayer.tsx` based on whether the game is in `REAL_GAMES`:
  - `saveScore(entry)` — the 8 decorative games, writes to `localStorage.av_scores`,
    **write-only** (nothing reads it back — see Known bugs, this is intentionally unfixed).
  - `saveRealScore(entry)` — the 4 real games, inserts into Supabase `scores` via
    `lib/supabase/client.ts` (browser client, no server route — there's no session to check
    server-side yet).
- Supabase clients: `lib/supabase/client.ts` (browser, `createBrowserClient`) and
  `lib/supabase/server.ts` (server, `createServerClient` + `next/headers` cookies). No
  `middleware.ts` exists — there's no auth session to refresh (Auth is still the
  `localStorage` simulation, unrelated to Supabase).
- Migrations are applied via the Supabase MCP tools (`mcp__supabase__apply_migration`, etc.),
  **not** a local Supabase CLI / `supabase/migrations` folder — there isn't one in this repo.
- Env vars: `.env.template` lists `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
  `RESEND_API_KEY`, `SUPABASE_DB_PASSWORD` (unused placeholder) as empty placeholders; real
  values live only in `.env.local` (gitignored, present locally, never commit it).

## Domain model

"Arcade Vault" is a retro arcade portal: browse a game catalog, play, compete on
leaderboards. **Naming is bilingual:** filenames, CSS classes, and UI copy are Spanish;
component names and props are English. Locale is `es-ES` throughout — numbers via
`.toLocaleString("es-ES")`, dates as `DD/MM/YYYY`.

Entities:

- **Game** (`lib/data.ts` fallback type, mirrored by the `games` table minus `best`) —
  `{id, title, short, long, cat, cover, color, best, plays}`. `id` is a kebab-case slug. `cat`
  is `ARCADE / PUZZLE / SHOOTER / VERSUS` (plus `TODOS` as a filter-only value). `cover` is a
  **CSS class name** (e.g. `cover-bricks`), not an image path — cover art is CSS gradients in
  `globals.css`, no image assets for covers. `plays` is a pre-formatted string (`"12.4K"`),
  dynamic for real games, static mock for decorative ones (see Data layer above).
- **Player** — username uppercased, capped at 10 chars, enforced both in `Auth.tsx` and in
  each real game's score-save flow. No real accounts — just a free-text name.
- **Score** — real rows in Supabase `scores` for the 4 real games (`saveRealScore`); fake
  write-only `localStorage` entries for the 8 decorative ones (`saveScore`, unread — see
  Known bugs).
- **Leaderboard** / **Hall of Fame** — unified onto real `scores` data since SPEC 06 (no more
  of the old dual-generator bug). Games with zero real scores show an explicit
  "AÚN NO HAY PUNTUACIONES" empty state rather than fabricated rows.

## Porting hazards (historical — SPEC 01 already applied these)

The original prototype (an untracked reference at `references/resources/resources/templates/`,
plus `references/started-games/*` for the real game ports and `references/source-assets/*` for
the Snake sprite atlas) could not be dropped in as-is. What was actually done, for context when
reading old code shapes:

- Global-window component wiring (`window.X = Component`) and hook aliasing
  (`useStateApp`, `useMemoD`, …) were converted to normal ES module imports — there are no
  aliased hooks left anywhere in `components/`/`lib/`.
- Every interactive screen is a Client Component (`"use client"`), since the source was React
  18 UMD + in-browser Babel and every screen has interaction.
- `.av-bg`/`.av-noise` sit before `{children}` in `app/layout.tsx`, and the content wrapper
  carries `position: relative; z-index: 2` — if the background ever renders on top of content,
  this ordering is the first thing to check.
- The dark palette (`--bg`, `--cyan`, `--magenta`, `--yellow`, `--green`, gold/silver/bronze)
  stayed as plain CSS custom properties in `app/globals.css`, deliberately **not** converted to
  Tailwind v4 `@theme` tokens (SPEC 01 decision — lower risk for the MVP, revisit only if asked).

## Known prototype bugs — still intentionally unfixed for decorative games

These affect only the **8 decorative games** (the real 4 fixed their equivalent issue when
each was ported — e.g. `asteroides`'s leaderboard is real, not `seededScores`):

- `game.best` in `lib/data.ts` for decorative games is still an arbitrary mock number,
  unrelated to anything real (there's no real leaderboard to compare it against for those
  games — they've never had one).
- `localStorage.av_scores` is still write-only for decorative games: `saveScore` appends to
  it, nothing reads it back. `HallOfFame`'s "TU MEJOR MARCA" only works for real games (looked
  up against actual `scores` rows); for decorative games there's no real row to match against,
  so the row simply never appears.
- Guest login in `Auth.tsx` still calls `login(null)`, serialized as the string `"null"` in
  `localStorage["av_user"]` — guest and logged-out remain indistinguishable. Unrelated to
  Supabase; `Auth` has no real backend at all.
- The 8 decorative games in `GamePlayer.tsx` are still simulations, not games: fixed
  HUD numbers driven by a `setInterval`/CSS animation, no real canvas loop. Only games in
  `REAL_GAMES` (see above) are actually playable.

Do not "fix" these for decorative games as a side effect of unrelated work — each was either
an explicit SPEC 01 decision or is simply out of scope until/unless a future spec ports that
specific game to a real engine.
