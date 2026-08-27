# SPEC 05 — Juego real de Asteroides integrado en el reproductor

> **Status:** Aprobado
> **Depends on:** SPEC 01
> **Date:** 2026-08-27
> **Objective:** Portar el juego de Asteroids ya construido en `references/started-games/02-asteroids/game.js` (canvas HTML5, sin dependencias) a un motor TypeScript reutilizable y conectarlo a una nueva entrada del catálogo (`asteroides`) para que `GamePlayer` lo muestre como el primer juego realmente jugable, dejando el resto de juegos con su simulación decorativa actual.

## Why this spec exists

`components/GamePlayer.tsx` es hoy una simulación puramente visual compartida por todos los juegos (`SCORE`/`LIVES`/`LEVEL` fijos, naves CSS animadas) — un bug ya documentado en `CLAUDE.md` ("`reproductor.jsx` is a simulation, not a game"). Este spec resuelve esa brecha para un primer juego real, portando el motor de Asteroids ya construido de forma independiente en `references/started-games/02-asteroids/`, y define una arquitectura de registro (`id` de juego → componente real) para que futuros juegos reales se sumen sin volver a tocar `GamePlayer` desde cero.

## Scope

**In:**

- Nueva entrada `asteroides` en `GAMES` (`lib/data.ts`): `cat: "SHOOTER"`, `color: "yellow"`, `cover: "cover-asteroides"`, con `title`/`short`/`long` propios describiendo el juego real (nave triangular, campo toroidal, asteroides que se dividen, power-up de disparo triple, 3 vidas con invencibilidad temporal). `best`/`plays` quedan como valores mock estáticos, igual de desconectados del leaderboard real que en el resto del catálogo (bug ya documentado, no se corrige aquí).
- Nueva clase `.cover-asteroides` en `app/globals.css`, junto al resto de `.cover-*`, con su propio gradiente (no reutiliza `.cover-rocas`).
- `lib/games/types.ts`: contrato compartido (`RealGameProps`, `RealGameHandle`) que cualquier juego real implementa.
- `lib/games/asteroids-engine.ts`: motor del juego portado de `game.js` (clases `Bullet`, `Asteroid`, `Ship`, `Particle`, `PowerUp`, constantes de física, colisiones, power-up de disparo triple), encapsulado en una factory `createAsteroidsEngine(canvas, callbacks)` con estado propio por instancia (sin `let` a nivel de módulo), con `pause()`/`resume()`/`endNow()`/`destroy()`, y con `preventDefault()` en las 4 teclas del juego mientras sus listeners están activos. El motor conserva `drawHUD()` y `drawOverlay()` (score/nivel/vidas dibujados en el canvas, y la pantalla "GAME OVER" con el texto original) tal cual el original — duplican visualmente al HUD externo de React de forma intencional — pero se quita el disparo de reinicio: en el estado `'gameover'`, `pressed('Space')` deja de llamar a `initGame()` (el overlay sigue mostrando "ESPACIO PARA REINICIAR" pero ya no hace nada); solo el botón "JUGAR DE NUEVO" del modal de React reinicia.
- `components/games/AsteroidsCanvas.tsx` (`"use client"`): wrapper de React sobre el motor — canvas fijo 800×600 que llena `.crt-screen` vía CSS, monta/desmonta el motor, refleja el prop `paused` en `pause()`/`resume()`, y expone `end()` por `ref` (`useImperativeHandle`).
- `components/games/registry.ts`: `REAL_GAMES`, mapa `id de juego → componente real` implementando `RealGameProps`/`RealGameHandle`, con una única entrada (`asteroides`) por ahora.
- `components/GamePlayer.tsx`: cuando `REAL_GAMES[game.id]` existe, reemplaza el `.game-arena` decorativo por el componente real; el HUD externo (Puntuación/Vidas/Nivel) pasa a alimentarse de los callbacks del motor en vez de las constantes `SCORE`/`LIVES`/`LEVEL`; "PAUSA" controla el `paused` real; "FIN" llama a `ref.current.end()`; "JUGAR DE NUEVO" remonta el componente real (nuevo `key`) para reiniciar desde cero. Cuando `game.id` no tiene entrada en `REAL_GAMES`, el comportamiento es exactamente el actual (sin cambios).

**Out of scope (for future specs):**

- Controles táctiles/on-screen — el motor portado usa únicamente teclado, igual que `game.js` original. La etiqueta decorativa "TECLADO / TÁCTIL" en `GameDetail` ya existía antes de este spec y no se corrige aquí.
- Escalado del canvas por `devicePixelRatio` — se mantiene el buffer fijo 800×600 estirado por CSS, igual que el original; puede verse borroso en pantallas grandes.
- Portar otros juegos del catálogo a motores reales — este spec deja lista la arquitectura de registro (`components/games/registry.ts`), pero solo agrega `asteroides`. El resto sigue con la simulación decorativa de `GamePlayer`.
- Corregir los bugs de leaderboard ya documentados en `CLAUDE.md`: `game.best` inconsistente con `seededScores`, `localStorage.av_scores` write-only (`HallOfFame` sigue simulando la fila del jugador), y los dos leaderboards independientes (`detalle.jsx` vs `salon.jsx`) que no coinciden. `saveScore` se usa tal cual ya existe.
- Cambiar el layout/CSS de `.crt`, `.crt-screen` o `.player-hud` — se reutilizan tal cual están.
- Reemplazar la card/cover de `rocas` u otro juego existente — no se toca ninguna entrada existente de `GAMES`.

## Data model

```ts
// lib/data.ts — nueva entrada en GAMES
{
  id: "asteroides",
  title: "ASTEROIDES",
  cat: "SHOOTER",
  cover: "cover-asteroides",
  color: "yellow",
  best: /* valor mock estático, ej. 38700 */,
  plays: /* string mock, ej. "9.7K" */,
  // short/long describen el juego real: nave triangular, campo toroidal,
  // asteroides que se dividen en fragmentos, power-up de disparo triple.
}
```

```ts
// lib/games/types.ts
export interface RealGameProps {
  paused: boolean;
  onScoreChange(score: number): void;
  onLivesChange(lives: number): void;
  onLevelChange(level: number): void;
  onGameOver(score: number): void;
}

export interface RealGameHandle {
  end(): void; // termina la partida ya, dispara onGameOver(score) con el score actual
}
```

```ts
// lib/games/asteroids-engine.ts
export interface AsteroidsEngine {
  pause(): void;
  resume(): void;
  endNow(): void;
  destroy(): void; // cancela el loop y quita los listeners de teclado
}

export function createAsteroidsEngine(
  canvas: HTMLCanvasElement,
  callbacks: Pick<RealGameProps, "onScoreChange" | "onLivesChange" | "onLevelChange" | "onGameOver">
): AsteroidsEngine;
```

```ts
// components/games/registry.ts
export const REAL_GAMES: Record<string, ForwardRefExoticComponent<RealGameProps & RefAttributes<RealGameHandle>>> = {
  asteroides: AsteroidsCanvas,
};
```

Conventions: el motor conserva las constantes de física del original (`W=800`, `H=600`, `RADII`, `SPEEDS`, `POINTS`, `POWERUP_*`) sin cambios de balance — es un port, no un rediseño.

## Implementation plan

1. Agregar la entrada `asteroides` a `GAMES` en `lib/data.ts` y la clase `.cover-asteroides` en `app/globals.css`. Prueba manual: `/biblioteca` muestra la nueva card con portada propia; `/juegos/asteroides` muestra la página de detalle (el reproductor sigue siendo el decorativo actual en este punto).
2. Crear `lib/games/types.ts` con `RealGameProps`/`RealGameHandle`. Prueba manual: el archivo compila, sin consumidores todavía.
3. Crear `lib/games/asteroids-engine.ts`: port de `references/started-games/02-asteroids/game.js` a `createAsteroidsEngine(canvas, callbacks)`, conservando `drawHUD()`/`drawOverlay()` tal cual el original, quitando solo el disparo de reinicio por Espacio en el estado `'gameover'`, con `pause()/resume()/endNow()/destroy()` y `preventDefault()` en las 4 teclas del juego. Prueba manual: instanciado contra un `<canvas>` de prueba, la nave responde a las teclas, los asteroides se mueven/dividen igual que en la demo original, y al perder la última vida se ve el overlay "GAME OVER" del canvas — pero Espacio ya no reinicia.
4. Crear `components/games/AsteroidsCanvas.tsx` (`forwardRef<RealGameHandle, RealGameProps>`): canvas 800×600 que llena `.crt-screen`, crea/destruye el motor en el ciclo de montaje, sincroniza `paused` con `pause()/resume()`, expone `end()` vía `useImperativeHandle`. Prueba manual: montado de forma aislada, el juego se ve y se juega con teclado.
5. Crear `components/games/registry.ts` con `REAL_GAMES = { asteroides: AsteroidsCanvas }`.
6. Actualizar `components/GamePlayer.tsx`: cuando `REAL_GAMES[game.id]` existe, renderizar el componente real en vez de `.game-arena`, con `score/lives/level` en estado de React alimentado por los callbacks (reemplazando las constantes `SCORE/LIVES/LEVEL` solo en este camino), `onGameOver` conectado al modal existente (`over`/`saved`), "PAUSA" controlando el `paused` real, "FIN" llamando a `ref.current?.end()`, y un `key` que cambia en "JUGAR DE NUEVO" para remontar el motor desde cero. Cualquier `game.id` sin entrada en `REAL_GAMES` conserva el comportamiento decorativo exacto de hoy. Prueba manual: `/juegos/asteroides/jugar` se juega de punta a punta (ver Acceptance criteria); `/juegos/rocas/jugar` (u otro juego) se ve y comporta idéntico a antes de este spec.
7. Pulido final: `npm run lint` y `npm run build` sin errores.

## Acceptance criteria

- [ ] `npm run build` completa sin errores.
- [ ] `npm run lint` completa sin errores.
- [ ] `/biblioteca` muestra una card "ASTEROIDES" con portada propia (`cover-asteroides`) y categoría SHOOTER.
- [ ] `/juegos/asteroides` muestra la descripción del juego y un leaderboard "MEJORES PUNTUACIONES", igual mecanismo que el resto de juegos.
- [ ] `/juegos/asteroides/jugar` renderiza un canvas realmente jugable (no el placeholder decorativo): la nave rota con ←/→, propulsa con ↑ y dispara con Espacio; los asteroides envuelven los bordes de la pantalla y se dividen en fragmentos más pequeños al ser destruidos.
- [ ] El HUD externo (Puntuación/Vidas/Nivel) se actualiza en vivo mientras se juega. El canvas también dibuja su propio score/nivel/vidas (duplicado intencional, tal cual el juego original).
- [ ] Perder las 3 vidas detiene el juego, muestra el overlay "GAME OVER" del canvas (tal cual el original) y abre el modal "FIN DEL JUEGO" de React encima, con la puntuación real alcanzada.
- [ ] Sobre el overlay "GAME OVER" del canvas, presionar Espacio no reinicia nada — solo el botón "JUGAR DE NUEVO" del modal de React reinicia.
- [ ] Pulsar "FIN" en medio de la partida detiene el juego, muestra el overlay "GAME OVER" del canvas y abre el modal de React de inmediato, con la puntuación alcanzada hasta ese momento.
- [ ] Pulsar "PAUSA" congela el juego (nave/asteroides/balas dejan de moverse); "REANUDAR" continúa desde el mismo estado sin saltos de tiempo.
- [ ] Guardar la puntuación desde el modal llama a `saveScore` con la puntuación real y muestra la confirmación "PUNTUACIÓN GUARDADA", igual que antes.
- [ ] "JUGAR DE NUEVO" inicia una partida completamente nueva (puntuación 0, 3 vidas, nivel 1, campo de asteroides nuevo).
- [ ] Pulsar ←/→/↑/Espacio mientras se juega no hace scroll de la página.
- [ ] Salir de la partida a medias (botón "SALIR" o navegación) no deja errores en consola ni un loop de animación corriendo de fondo.
- [ ] Cualquier otro juego (ej. `/juegos/rocas/jugar`) se ve y comporta exactamente igual que antes de este spec (placeholder decorativo, HUD estático).

## Decisions

- **Sí:** crear una entrada de catálogo nueva (`asteroides`) en vez de reusar `rocas`. `rocas` sigue siendo un juego mock independiente con su simulación decorativa; el juego real portado es una entrada propia, evitando pisar la card/cover/leaderboard ya existentes de `rocas`.
- **Sí:** arquitectura de registro (`components/games/registry.ts`, `id → componente`) en vez de un `if/else` puntual dentro de `GamePlayer`. El costo extra ahora es bajo y evita otro refactor de `GamePlayer` cuando llegue el segundo juego real.
- **Sí:** conservar el HUD y el overlay de "GAME OVER" que dibuja el canvas original, tal cual, en vez de quitarlos. Decisión explícita del usuario tras revisar la primera versión del spec — el score/nivel/vidas y la pantalla "GAME OVER" del canvas quedan duplicados visualmente con el HUD externo de React y el modal, de forma intencional.
- **Sí:** aun conservando el overlay visual "GAME OVER" del canvas, desactivar el disparo real de reinicio por Espacio (`pressed('Space') → initGame()` en el estado `'gameover'`). El modal de React (nombre, guardar puntuación, "JUGAR DE NUEVO") es el único flujo que efectivamente reinicia; el texto "ESPACIO PARA REINICIAR" del canvas queda como parte del overlay original, pero sin acción detrás. Mantener el reinicio real activo ahí crearía dos caminos de reinicio simultáneos.
- **Sí:** `preventDefault()` en ←/→/↑/Espacio mientras el motor está montado. El juego vive embebido en una página con scroll; sin esto, jugar desplazaría la página.
- **Sí:** "PAUSA" congela el loop de verdad (no llama `update()` mientras `paused`). Hoy el botón solo superpone un overlay visual sin detener nada; con un juego real eso dejaría la física corriendo invisible detrás del overlay.
- **Sí:** "FIN" dispara el mismo flujo que perder la última vida (`onGameOver(score)` con la puntuación alcanzada). Un solo camino de finalización es más simple de mantener y de razonar que dos.
- **No:** controles táctiles en este spec. El motor original es solo teclado; agregar controles on-screen es una ampliación de alcance que puede ir en su propio spec.
- **No:** escalar el canvas por `devicePixelRatio`. Mantiene el port simple y fiel al original; se puede revisar en un spec futuro si la nitidez en pantallas grandes se vuelve un problema real.
- **No:** tocar los bugs de leaderboard ya documentados en `CLAUDE.md` (`game.best` inconsistente, `localStorage.av_scores` write-only, doble leaderboard detalle/salón). Son bugs preexistentes que afectan a todo el catálogo, no algo introducido por este spec.
- **No:** reusar `cover-rocas` para la portada de `asteroides`. Cada juego del catálogo tiene su propia clase de portada; reusar una existente haría que dos juegos distintos luzcan idénticos en la biblioteca.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| React Strict Mode (dev) monta/desmonta efectos dos veces; si `destroy()` no cancela bien el `requestAnimationFrame` y quita los listeners de teclado, podrían quedar dos loops o listeners duplicados corriendo el juego al doble de velocidad o respondiendo doble a cada tecla | `destroy()` cancela explícitamente el frame pendiente y remueve los listeners de `keydown`/`keyup`; se verifica en desarrollo que el juego corre a velocidad normal y cada tecla dispara una sola acción. |
| El motor original usaba estado a nivel de módulo (`let score, lives, ...` compartido por todo `game.js`); si el port a `createAsteroidsEngine` deja algo fuera del closure de la instancia, dos partidas montadas en momentos distintos (ej. tras "JUGAR DE NUEVO") podrían arrastrar estado de la partida anterior | El plan remonta `AsteroidsCanvas` con un `key` nuevo en cada reinicio, lo que fuerza una instancia de motor completamente nueva en vez de reutilizar/resetear la anterior. |

## What is **not** in this spec

- Controles táctiles/on-screen.
- Escalado del canvas por `devicePixelRatio`.
- Port de otros juegos del catálogo a motores reales (solo `asteroides` en este spec).
- Corrección de los bugs de leaderboard/`localStorage` ya documentados.
- Cambios al layout/CSS de `.crt`, `.crt-screen` o `.player-hud`.
- Cambios a la card, cover o datos de `rocas` u otro juego existente.

Cada uno de estos, si se necesita, va en su propio spec.
