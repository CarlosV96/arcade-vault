---
name: add-game
description: Designs a spec to port a real game (canvas/JS, no framework) from references/started-games/ into the catalog and leaderboard, following the fixed architecture from specs 05 and 06 (RealGameProps/RealGameHandle engine contract, registry, Supabase games/scores). Asks only game-specific questions — the wiring is already generic — and writes specs/NN-slug.md in Draft state, ready for /spec-impl. Use it when the user wants to add a new playable game to Arcade Vault.
disable-model-invocation: true
argument-hint: '<carpeta en references/started-games (ej. 03-tetris) o slug ya elegido>'
allowed-tools: Read, Glob, Grep, Write, AskUserQuestion, Bash(ls:*), Bash(cat:*), Bash(date:*), mcp__supabase__list_tables, mcp__supabase__execute_sql
---

# /add-game — Spec designer for porting a real game into the catalog

## Session context

Today's date (use this for the spec header, never guess it):
!`date +%F`

Games available to port:
!`ls references/started-games 2>/dev/null || echo "references/started-games does not exist"`

Specs that already exist:
!`ls specs/ 2>/dev/null || echo "The specs/ folder does not exist yet"`

Games already registered as real (`lib/games/real-game-ids.ts`):
!`cat lib/games/real-game-ids.ts 2>/dev/null`

---

This skill produces **one spec**, nothing else. It never writes application code and never touches Supabase. Its only output is `specs/NN-slug.md` in `Draft` state — the user approves it and runs `/spec-impl` exactly like any other spec in this repo. **Your replies must be in the same language as the initial prompt** (this repo's specs are written in Spanish; match that unless the user writes in English).

## Why this skill is narrow

SPEC 05 and SPEC 06 already fixed the entire integration architecture for a "real" game (one with an actual engine, as opposed to the 8 decorative catalog entries):

- `lib/games/types.ts` (`RealGameProps`/`RealGameHandle`) is the fixed contract every engine implements. **It does not change per game.**
- `lib/games/real-game-ids.ts` (`REAL_GAME_IDS`) + `components/games/registry.ts` (`COMPONENTS`/`REAL_GAMES`) is the fixed registration point. Adding a game means adding one id to the array and one entry to the map — nothing else in this file changes shape.
- `components/GamePlayer.tsx`, `components/GameDetail.tsx`, `components/HallOfFame.tsx`, `components/Library.tsx`, `lib/games-data.ts`, `lib/scores.ts` are already generic over `REAL_GAME_IDS` since SPEC 06. **They need zero changes** to onboard a new game — this is the whole point of that spec's registry design.

So the only real per-game work is: **the engine port, its thin canvas wrapper, one catalog row (local fallback + Supabase), and one CSS cover class.** This skill exists so those are the only things you have to decide — not to re-derive the architecture from scratch every time.

## Command flow

### Phase 1 — Read the source game and confirm the architecture still holds

1. Read `.claude/skills/spec/SKILL.md` and `.claude/skills/spec/template.md` in full **first, before anything else** — that skill defines the section structure, tone, and formatting every spec in this repo follows (including specs 05 and 06). Phase 3 below tells you what to pre-fill and what to ask about, but the shape of the document itself — headings, how each section is written, how acceptance criteria are phrased — comes from `/spec`, not from this skill. Do not invoke `/spec` itself; just read its instructions and template as the reference you write against.
2. Resolve `$ARGUMENTS` to a folder under `references/started-games/` (see the listing above). Accept a full folder name (`03-tetris`), a partial match (`tetris`), or — if resuming after Phase 2 was already answered in a prior turn — an already-chosen slug. If empty or ambiguous, show the listing and ask which one.
3. Read, in full: the target folder's `game.js`, `index.html`, and `CLAUDE.md`/`README.md` if present. Note in particular:
   - Canvas dimensions and whether the source uses **more than one `<canvas>`** (e.g. a board canvas + a separate "next piece" preview canvas) — `RealGameProps`/`AsteroidsCanvas` assumes a single canvas filling `.crt-screen`; a second canvas is a real per-game decision, not something to silently drop or silently add.
   - Any **image or audio assets** (`assets/*.png`, `*.mp3`, spritesheet helpers). The asteroids port (SPEC 05) drew everything with canvas primitives and shipped zero assets — a game that depends on a spritesheet or sound files is new territory this repo hasn't done yet, and needs an explicit decision, not an assumption.
   - **Module-level mutable state** (`let score`, `let board`, top-level arrays, etc.) — SPEC 05's port moved all of this inside the `createXEngine` closure specifically so remounting the component (on "JUGAR DE NUEVO") gets a clean instance. List what you find; it becomes both an implementation note and a risk entry.
   - The keys the game listens to, so `preventDefault()` covers the right set and the spec's acceptance criteria can name them.
4. Re-read `specs/05-juego-asteroides-real.md` and `specs/06-catalogo-y-leaderboard-supabase.md` in full — they are the contract, not just background.
5. Confirm the "zero changes needed" claim above still holds by reading current `lib/games/types.ts`, `lib/games/real-game-ids.ts`, `components/games/registry.ts`, and skimming `components/GamePlayer.tsx` for its `REAL_GAMES[game.id]` branch. If the code has drifted from what SPEC 05/06 describe (someone hardcoded `asteroides` again, added a per-game branch, etc.), say so before continuing — the spec you write must describe the *current* wiring, not the documented one.
6. Check the live catalog for id collisions and current shape: `mcp__supabase__list_tables` (confirm `games`/`scores` still exist as SPEC 06 defined them), then `mcp__supabase__execute_sql` with `select id, title, cat, color from games order by id` to see what ids/colors/categories are already taken.
7. Read `lib/data.ts` (`GAMES`) for the same reason, and note: **a thematically similar decorative entry already existing (e.g. `caida` for a Tetris-like game, `bloque-buster` for an Arkanoid-like game, `rocas` for an Asteroids-like game) is not a target to replace.** SPEC 05's explicit decision was to add `asteroides` as a brand-new id rather than reuse `rocas`'s id/cover/leaderboard. Apply the same precedent here — flag the collision in Phase 2 rather than silently deciding either way.

### Phase 2 — Ask only what the architecture doesn't already answer

Everything structural is fixed by SPEC 05/06 — don't re-ask it. Ask in one block (use `AskUserQuestion` where the choice is discrete):

1. **Catalog id** (kebab-case slug for both `games.id` and `scores.game_id`) and **title**. Propose one derived from the source folder, flag explicitly if a similarly-themed decorative game already exists in `GAMES` and confirm the user wants a new id rather than replacing it.
2. **`short`/`long` description copy** (Spanish, matching the tone of existing entries — see `lib/data.ts`) and **category** (`ARCADE`/`PUZZLE`/`SHOOTER`/`VERSUS`) and **color** (`cyan`/`magenta`/`yellow`/`green`) — propose sensible defaults from the genre and from what Phase 1's collision check found underused, but let the user confirm.
3. **Cover art**: confirm a brand-new `.cover-<slug>` gradient (never reuse an existing `.cover-*` class — same reasoning as not reusing `rocas`'s id).
4. **Canvas strategy** if Phase 1 found more than one source canvas: fold everything into one canvas inside the wrapper, or omit the secondary element (e.g. next-piece preview) for a first pass. Also confirm target canvas size and how it fills `.crt-screen` (the asteroids port used a fixed 800×600 buffer stretched by CSS — decide whether that fits this game's native resolution or needs its own fixed size).
5. **Assets** if Phase 1 found images/audio: port them into `public/games/<slug>/` and wire them into the engine, or redraw with canvas primitives only (no assets) for this first version. Either is valid — but it must be a stated decision, since it changes the size of the implementation plan substantially.
6. **Mock `best`/`plays` values** for the `lib/data.ts` fallback entry (arbitrary, same order of magnitude as existing entries — note in the spec that `best` is fallback-only and never reaches the UI once Supabase is up, exactly like every other entry since SPEC 06).

Stop asking once you can write the catalog row, name the engine/wrapper files, and describe the canvas/asset strategy without assuming anything.

### Phase 3 — Write the spec

Write against `.claude/skills/spec/SKILL.md` and `.claude/skills/spec/template.md`, read in Phase 1 — same section order, same tone, same phrasing conventions as every other spec in `specs/`, pre-filled from the fixed architecture. Write the whole spec in one pass once Phase 2 is answered, no section-by-section confirmation needed (the ambiguity that pattern exists for is already resolved by SPEC 05/06 plus Phase 2's answers).

- **Header**: `Status: Draft`, `Depends on: SPEC 05, SPEC 06`, today's date from session context, one-sentence objective ("Portar `references/started-games/<folder>/game.js` a un motor real e integrarlo al catálogo como `<slug>`.").
- **Scope — In**:
  - New `GAMES` entry in `lib/data.ts` (fallback) with the confirmed `id`/`title`/`short`/`long`/`cat`/`cover`/`color`/`best`/`plays`.
  - New `.cover-<slug>` class in `app/globals.css` with its own gradient.
  - `lib/games/<slug>-engine.ts`: port of `game.js` to `create<Name>Engine(canvas, callbacks)`, same shape as `lib/games/asteroids-engine.ts` — `RealGameProps`'s four callbacks, `pause()`/`resume()`/`endNow()`/`destroy()`, `preventDefault()` on the game's keys while mounted, **all state inside the closure** (call out every module-level variable found in Phase 1 that must move inside).
  - `components/games/<Name>Canvas.tsx`: `forwardRef<RealGameHandle, RealGameProps>` wrapper, same shape as `AsteroidsCanvas.tsx` — mount/destroy the engine on mount, sync `paused`, expose `end()`.
  - One line added to `lib/games/real-game-ids.ts` (`REAL_GAME_IDS`) and one entry added to `components/games/registry.ts` (`COMPONENTS`). State explicitly: no other line of `registry.ts` changes, and `GamePlayer.tsx`/`GameDetail.tsx`/`HallOfFame.tsx`/`Library.tsx`/`lib/games-data.ts`/`lib/scores.ts` need **zero changes** — confirmed generic in Phase 1.
  - Supabase migration (`mcp__supabase__apply_migration`, applied during `/spec-impl`, not by this skill) inserting one row into `games` matching the `lib/data.ts` entry exactly (`id`/`title`/`short`/`long`/`cat`/`cover`/`color`/`plays` — the `games` table has no `best` column, per SPEC 06's data model).
  - If Phase 2 chose to port assets: copying the needed files into `public/games/<slug>/` and loading them from the engine.
- **Scope — Out**: touching any other catalog entry (real or decorative); the secondary canvas/assets if Phase 2 chose to omit them (name it as a possible future spec); anything already permanently out of scope per SPEC 06 (auth, anti-cheat, score moderation, Realtime, catalog admin UI); changing `.crt`/`.crt-screen`/`.player-hud` layout unless Phase 2's canvas-size decision required it (then say exactly what and why).
- **Data model**: the concrete `create<Name>Engine` signature (reusing `RealGameProps`/`RealGameHandle` from `lib/games/types.ts` verbatim, no changes to that file), the new `GAMES` object literal, and the SQL `insert` for the migration.
- **Implementation plan**: numbered steps, each leaving the app buildable — catalog entry + CSS class, engine port, canvas wrapper, registry wiring (two one-line edits), Supabase migration, manual end-to-end test (play, HUD live-updates, game over, save via `saveRealScore`, score appears on `/juegos/<slug>` and the matching `/salon` tab, `plays` count increments), `npm run lint && npm run build`.
- **Acceptance criteria**: boolean checklist mirroring SPEC 05's (adapted to `<slug>`), plus: the two registry files are the only files touched outside the new engine/wrapper/catalog/CSS, and `GamePlayer`/`GameDetail`/`HallOfFame`/`Library`/`games-data`/`scores` have zero diff.
- **Decisions**: record the fixed ones inherited from SPEC 05/06 (contract reused as-is, registry pattern reused as-is, new id instead of reusing a decorative game's id/cover, own cover gradient) and the fresh ones from Phase 2 (canvas/asset strategy, mock values, category/color).
- **Risks**: the module-level-state and Strict-Mode-double-mount risks from SPEC 05's template, filled in with the actual globals found in this game's `game.js`; the public-insert RLS risk inherited from SPEC 06 (mention as inherited, don't re-litigate); anything specific to Phase 2's asset decision (e.g. audio autoplay policies, asset licensing if the source assets aren't the user's own — ask, don't assume).

### Phase 4 — Save the spec

Identical mechanics to `/spec` Phase 4: next sequential `NN` from the `specs/` listing above, kebab-case slug from the objective (default to the catalog id chosen in Phase 2 unless that reads oddly as a spec slug), write `specs/NN-slug.md` directly, `Draft` state, confirm the path, remind the user to approve it and then run `/spec-impl NN-slug`. **Stop there** — do not start porting the game, do not touch Supabase, do not create a branch.

## Hard rules

- **Never write application code, CSS, or SQL outside the spec file.** This skill's only artifact is the `.md` spec.
- **Never call `mcp__supabase__apply_migration`.** Read-only Supabase tools only, for context in Phase 1.
- **Never assume the architecture changed without checking.** Phase 1 step 4 exists precisely so a drifted codebase doesn't produce a spec describing wiring that no longer matches reality.
- **Never silently reuse a decorative game's id, cover class, or leaderboard.** Surface the collision in Phase 2 and let the user decide, mirroring SPEC 05's `rocas`/`asteroides` precedent.
- **Never invent the presence of image/audio assets or their license.** If `references/started-games/<folder>/assets/` exists, ask what to do with it — don't default silently either way.
