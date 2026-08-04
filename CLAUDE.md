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
- `app/globals.css` sets `body { font-family: Arial, Helvetica, sans-serif; }`, which
  currently overrides the Geist fonts `layout.tsx` loads via `next/font/google`. Harmless
  boilerplate leftover — both fonts get replaced during the port described below anyway.

## Styles 
Usa siempre /frontend-design para diseñar la interfaz de usuario.

## Current state vs. target

**`app/` is unmodified `create-next-app` output** — one route (`/`), zero `"use client"`,
no components/lib/data layer, still titled "Create Next App". Nothing has been built yet.

**The actual spec is an untracked design prototype** at
`references/resources/resources/templates/` (note the doubled `resources/`; ignore
`references/resources/__MACOSX/` — macOS archive junk). It's a standalone React 18 UMD +
in-browser-Babel SPA — the visual and behavioral reference to port into the Next.js app, not
code to import directly. Read `Arcade Vault.html` first; it shows the script load order the
other files depend on.

Screens map to components and a plausible route layout as follows. `nav.jsx`'s `isActive()`
treats `detalle`/`player` as children of `biblioteca` for nav highlighting — a hint that
`GameDetail`/`GamePlayer` should nest under the library route:

| Prototype route | Component | Source file | Suggested Next route |
|---|---|---|---|
| `biblioteca` (default) | `Library` | `biblioteca.jsx` | `/` |
| `detalle` + `id` | `GameDetail` | `detalle.jsx` | `/juegos/[id]` |
| `player` + `id` | `GamePlayer` | `reproductor.jsx` | `/juegos/[id]/jugar` |
| `auth` | `Auth` | `auth.jsx` | `/auth` |
| `salon` | `HallOfFame` | `salon.jsx` | `/salon` |

Also: `nav.jsx` → `Nav` (persistent chrome), `data.jsx` → mock fixtures, `styles.css` → the
full design system (~950 lines), `app.jsx` → root state (route + user), whose chrome
(`Nav` + `<main>` + footer) becomes the future root layout.

## Domain model

"Arcade Vault" is a retro arcade portal: browse a game catalog, play, compete on
leaderboards. **Naming is bilingual — the biggest thing to get right when porting:**
filenames, CSS classes, and all UI copy are Spanish; component names and props are English
(`biblioteca.jsx` → `Library`, `detalle.jsx` → `GameDetail`, `salon.jsx` → `HallOfFame`,
`reproductor.jsx` → `GamePlayer`). Locale is `es-ES` throughout — numbers via
`.toLocaleString("es-ES")`, dates as `DD/MM/YYYY`.

Entities:
- **Game** — `{id, title, short, long, cat, cover, color, best, plays}`. `id` is a
  kebab-case slug. `cat` is one of `ARCADE / PUZZLE / SHOOTER / VERSUS` (plus the `TODOS`
  filter option). Two field traps: `cover` is a **CSS class name** (e.g. `cover-bricks`),
  not an image path — all cover art is generated from gradients in `styles.css`, and there
  will never be game image assets; `plays` is a pre-formatted string (`"12.4K"`), not a number.
- **Player** — username is uppercased and capped at 10 chars, an arcade-initials rule
  enforced independently in both `auth.jsx` and `reproductor.jsx`.
- **Score** / **Leaderboard** / **Hall of Fame** — see bugs below; the leaderboard shown on
  a game's detail page and the one shown in the Hall of Fame are generated independently and
  disagree.

## Porting hazards

The prototype can't be dropped in as-is:

- Components are wired via `window.X = Component` globals in `<script>` load order, and
  every file re-aliases hooks (`useStateApp`, `useStateA`, `useMemoD`, …) to avoid
  collisions across files. Convert to ES module imports and **delete the aliases** —
  they're an artifact of the globals approach, not a pattern to preserve.
- Source is React 18 UMD from unpkg + `@babel/standalone` runtime compilation
  (`type="text/babel"`), target is React 19 via the Next build. Every screen is interactive,
  so every ported screen needs `"use client"`.
- Fonts (Press Start 2P, Courier Prime, JetBrains Mono, currently a Google Fonts `<link>`)
  need to move to `next/font`, replacing Geist.
- `.av-bg` and `.av-noise` are fixed-position siblings placed *before* `#root` in
  `Arcade Vault.html`. In `layout.tsx` they belong before `{children}`, and `#root`'s
  `position: relative; z-index: 2` needs to move to whatever wraps the app content — get
  this wrong and the UI renders behind the background.
- The palette in `styles.css` `:root` is dark-only (`--bg #0a0a0f`, `--cyan #00f5ff`,
  `--magenta #ff006e`, `--yellow #f5ff00`, `--green #00ff88`, plus gold/silver/bronze).
  Decide whether it becomes Tailwind v4 `@theme` tokens or stays as plain CSS alongside
  Tailwind — either works, but pick one rather than mixing ad hoc.

## Known prototype bugs — don't port these faithfully

Each looks intentional in isolation but they contradict each other across files:

- `game.best` in `data.jsx` is inconsistent with what `seededScores()` generates (e.g.
  `bloque-buster` has `best: 28450`, but its generated leaderboard rows run 50k–250k) — the
  detail page's "Mejor global" stat reads lower than every row in the leaderboard next to it.
- The same game gets two different leaderboards: `detalle.jsx` seeds `seededScores` with
  `id.length * 17 + 3` (count 10); `salon.jsx` seeds with `tab.length * 23 + 7` (count 12).
- `localStorage.av_scores` is write-only: `app.jsx`'s `handleSaveScore` appends to it, but
  nothing reads it back — `HallOfFame` fakes the current player's row instead
  (`youRank = 8 + (tab.length % 4)`). Actually wiring this up is unimplemented work, not
  a straight port.
- Guest login in `auth.jsx` calls `onLogin(null)`, which gets `JSON.stringify`'d to the
  string `"null"` in `localStorage` — guest and logged-out end up indistinguishable.
- `reproductor.jsx` is a simulation, not a game: no canvas, no game loop. A `setInterval`
  adds random points every 220ms, `lives` is never decremented, and the level-up check
  (`score % 2500 < 100`) can fire more than once per threshold.

## Workflow note

`README.md` (Spanish) specifies a Spec-Driven Design workflow using `/spec` and
`/spec-impl` from `Klerith/fernando-skills` (installed via
`npx skills@latest add Klerith/fernando-skills`). Those skills are **not currently
installed** in this environment, so that workflow isn't runnable yet — install them first
if the user expects it.
