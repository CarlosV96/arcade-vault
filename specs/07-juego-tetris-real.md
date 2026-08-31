# SPEC 07 — Juego real de Tetris integrado en el reproductor

> **Status:** Implementado
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-08-31
> **Objective:** Portar `references/started-games/03-tetris/game.js` a un motor real e integrarlo al catálogo como `tetris`.

## Why this spec exists

SPEC 05 dejó lista la arquitectura de registro (`REAL_GAME_IDS` → `REAL_GAMES`) para que sumar un segundo juego real no requiera tocar `GamePlayer.tsx`, `GameDetail.tsx`, `HallOfFame.tsx`, `Library.tsx`, `lib/games-data.ts` ni `lib/scores.ts`. Este spec es la primera prueba real de esa promesa: portar `references/started-games/03-tetris/game.js` (10×20 celdas, 7 piezas + tuerca, pieza fantasma, wall kicks, niveles) a `createTetrisEngine`, agregarlo al catálogo como `tetris` (nueva entrada, no reemplaza a la decorativa `caida`), y confirmar que el único trabajo real es el motor, su wrapper, la fila de catálogo y la clase CSS de portada.

## Scope

**In:**

- Nueva entrada `tetris` en `GAMES` (`lib/data.ts`): `cat: "PUZZLE"`, `color: "cyan"`, `cover: "cover-tetris"`, `title: "TETRIS"`, con `short`/`long` describiendo el juego real (tablero 10×20, 7 piezas clásicas + pieza "tuerca", pieza fantasma, wall kicks, niveles que aceleran la caída cada 10 líneas, vista previa de la siguiente pieza). `best`/`plays` quedan como valores mock estáticos (`best: 152300`, `plays: "8.3K"`), igual de desconectados del leaderboard real que el resto del catálogo — bug ya documentado, no se corrige aquí.
- Nueva clase `.cover-tetris` en `app/globals.css`, junto al resto de `.cover-*`, con su propio gradiente (no reutiliza `.cover-tetro` de `caida`).
- `lib/games/tetris-engine.ts`: port de `game.js` a una factory `createTetrisEngine(canvas, callbacks)`, con todo el estado de módulo (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `lastTime`, `dropAccum`, `dropInterval`, `animId`) movido dentro del closure de la instancia, con `pause()`/`resume()`/`endNow()`/`destroy()`, y `preventDefault()` en las teclas del juego (`ArrowLeft`, `ArrowRight`, `ArrowDown`, `ArrowUp`, `KeyX`, `Space`) mientras sus listeners están activos.
- `components/games/TetrisCanvas.tsx` (`"use client"`): wrapper `forwardRef<RealGameHandle, RealGameProps>` sobre el motor, mismo patrón que `AsteroidsCanvas.tsx` — un único `<canvas>` de 450×600 (300×600 de tablero + 150 px de panel lateral con la vista previa de la siguiente pieza, fusionados en el mismo buffer) que llena `.crt-screen` estirado por CSS a 100%×100% (mismo patrón que `AsteroidsCanvas`, decisión explícita del usuario pese a la proporción angosta del tablero), monta/destruye el motor, refleja el prop `paused` en `pause()`/`resume()`, expone `end()` por `ref`.
- Una línea agregada a `lib/games/real-game-ids.ts` (`REAL_GAME_IDS`) y una entrada agregada a `components/games/registry.ts` (`COMPONENTS`). Ninguna otra línea de `registry.ts` cambia de forma; `GamePlayer.tsx`, `GameDetail.tsx`, `HallOfFame.tsx`, `Library.tsx`, `lib/games-data.ts`, `lib/scores.ts` no requieren cambios — confirmado genérico sobre `REAL_GAME_IDS` desde SPEC 06.
- Migración de Supabase (`mcp__supabase__apply_migration`, aplicada durante `/spec-impl`, no por este spec) que inserta una fila en `games` idéntica a la entrada de `lib/data.ts` (`id`/`title`/`short`/`long`/`cat`/`cover`/`color`/`plays`; la tabla `games` no tiene columna `best`, según el modelo de datos de SPEC 06).

**Out of scope (for future specs):**

- Controles táctiles/on-screen — el motor portado usa únicamente teclado, igual que `game.js` original.
- Escalado del canvas por `devicePixelRatio` — se mantiene el buffer fijo 450×600 estirado por CSS.
- Portar otros juegos del catálogo a motores reales (`arkanoid` u otros) — este spec solo agrega `tetris`.
- El selector de tema claro/oscuro (`theme-toggle`, `localStorage.tetris-theme`) del `index.html` original — Arcade Vault ya tiene su propio sistema de tema (paleta oscura fija de `styles.css`); no se porta.
- Corregir los bugs de leaderboard ya documentados en `CLAUDE.md` (`game.best` inconsistente, `localStorage.av_scores` write-only, doble leaderboard detalle/salón) — riesgo preexistente que afecta a todo el catálogo, no introducido por este spec.
- Cambiar el layout/CSS de `.crt`, `.crt-screen` o `.player-hud` — se reutilizan tal cual están.
- Reemplazar la card/cover/id de `caida` — no se toca ninguna entrada existente de `GAMES`; `caida` sigue siendo un juego decorativo independiente con su simulación actual.
- Un contador de "Líneas" en el HUD externo — `RealGameProps` no tiene un callback para eso (contrato fijo desde SPEC 05, no se modifica); `lines` se sigue calculando dentro del motor porque determina `level`, pero no se expone a React.

## Data model

```ts
// lib/data.ts — nueva entrada en GAMES
{
  id: "tetris",
  title: "TETRIS",
  short: "Encaja las 7 piezas clásicas en caída libre antes de que se acumulen.",
  long: "Un tablero de 10×20 celdas recibe piezas geométricas en caída constante. Rota con corrección de pared (wall kicks) automática, guíate con la pieza fantasma que marca dónde aterrizará cada ficha y consulta la vista previa de la siguiente pieza. Limpia líneas para subir de nivel — la velocidad de caída aumenta cada 10 líneas eliminadas.",
  cat: "PUZZLE",
  cover: "cover-tetris",
  color: "cyan",
  best: 152300,
  plays: "8.3K",
}
```

```ts
// lib/games/tetris-engine.ts
export interface TetrisEngine {
  pause(): void;
  resume(): void;
  endNow(): void; // termina la partida ya, dispara onGameOver(score) con el score actual
  destroy(): void; // cancela el loop y quita los listeners de teclado
}

export function createTetrisEngine(
  canvas: HTMLCanvasElement,
  callbacks: Pick<RealGameProps, "onScoreChange" | "onLivesChange" | "onLevelChange" | "onGameOver">
): TetrisEngine;
```

`RealGameProps`/`RealGameHandle` se reutilizan verbatim desde `lib/games/types.ts` — sin cambios a ese archivo.

```ts
// components/games/registry.ts — única línea nueva
const COMPONENTS: Record<string, ForwardRefExoticComponent<RealGameProps & RefAttributes<RealGameHandle>>> = {
  asteroides: AsteroidsCanvas,
  tetris: TetrisCanvas,
};
```

```ts
// lib/games/real-game-ids.ts
export const REAL_GAME_IDS: string[] = ["asteroides", "tetris"];
```

```sql
-- Fila insertada en games (migración aplicada durante /spec-impl)
insert into public.games (id, title, short, long, cat, cover, color, plays)
values (
  'tetris',
  'TETRIS',
  'Encaja las 7 piezas clásicas en caída libre antes de que se acumulen.',
  'Un tablero de 10×20 celdas recibe piezas geométricas en caída constante. Rota con corrección de pared (wall kicks) automática, guíate con la pieza fantasma que marca dónde aterrizará cada ficha y consulta la vista previa de la siguiente pieza. Limpia líneas para subir de nivel — la velocidad de caída aumenta cada 10 líneas eliminadas.',
  'PUZZLE',
  'cover-tetris',
  'cyan',
  '8.3K'
);
```

Convenciones: el motor conserva las constantes del original sin cambios de balance (`COLS=10`, `ROWS=20`, `BLOCK=30`, `LINE_SCORES=[0,100,300,500,800]`, `dropInterval = max(100, 1000 − (level−1)×90)`, `level = floor(lines/10) + 1`) — es un port, no un rediseño. El buffer del canvas es 450×600: los primeros 300 px de ancho son el tablero (`COLS×BLOCK` × `ROWS×BLOCK`, idéntico al original), los 150 px restantes son un panel lateral dibujado a mano con la etiqueta "NEXT" y la vista previa de la siguiente pieza (reemplaza al `<canvas id="next-canvas">` separado del original, fusionado en el mismo buffer).

## Implementation plan

1. Agregar la entrada `tetris` a `GAMES` en `lib/data.ts` y la clase `.cover-tetris` en `app/globals.css`. Prueba manual: `/biblioteca` muestra la nueva card "TETRIS" con portada propia (cyan, PUZZLE), sin afectar la card de `caida`; `/juegos/tetris` muestra la página de detalle (el reproductor sigue siendo el decorativo actual en este punto).
2. Crear `lib/games/tetris-engine.ts`: port de `references/started-games/03-tetris/game.js` a `createTetrisEngine(canvas, callbacks)`. Todo el estado a nivel de módulo del original (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `lastTime`, `dropAccum`, `dropInterval`, `animId`) pasa dentro del closure de la instancia. Se elimina el toggle interno de pausa por tecla `P` (`togglePause` ligado a `KeyP`) — la pausa se controla solo externamente vía `pause()`/`resume()`, igual que "PAUSA" en `GamePlayer`. Se elimina el selector de tema (`theme-toggle`, `localStorage.tetris-theme`) y todas las referencias a DOM externo (`scoreEl`, `linesEl`, `levelEl`, `overlay`, `overlayTitle`, `overlayScore`, `restartBtn`) — se reemplazan por los callbacks `onScoreChange`/`onLevelChange`/`onGameOver`. `onLivesChange` se llama una única vez al iniciar con el valor constante `1` (Tetris no tiene vidas; termina por "top-out", no por pérdida de vidas) y no se vuelve a invocar. El dibujo incluye tablero + pieza fantasma + pieza actual + panel lateral con la vista previa de la siguiente pieza, todo en el mismo canvas. Prueba manual: instanciado contra un `<canvas>` de prueba, las piezas caen, rotan con wall kicks, se ve la pieza fantasma y la vista previa de la siguiente pieza en el panel lateral; al apilar hasta el tope se dispara `onGameOver`.
3. Crear `components/games/TetrisCanvas.tsx` (`forwardRef<RealGameHandle, RealGameProps>`): canvas 450×600 que llena `.crt-screen` estirado a 100%×100% (mismo patrón que `AsteroidsCanvas`), crea/destruye el motor en el ciclo de montaje, sincroniza `paused` con `pause()/resume()`, expone `end()` vía `useImperativeHandle`. Prueba manual: montado de forma aislada, el juego se ve y se juega con teclado.
4. Agregar `"tetris"` a `lib/games/real-game-ids.ts` (`REAL_GAME_IDS`) y `tetris: TetrisCanvas` a `COMPONENTS` en `components/games/registry.ts`. Prueba manual: sin ningún otro cambio, `/juegos/tetris/jugar` ya renderiza `TetrisCanvas` en vez del placeholder decorativo (porque `GamePlayer.tsx` ya es genérico sobre `REAL_GAMES` desde SPEC 05); `/juegos/asteroides/jugar` sigue funcionando exactamente igual.
5. Migración Supabase: insertar la fila de `tetris` en `games` con los mismos valores de `lib/data.ts` (sin `best`). Prueba manual: `select id, title, cat, color, cover from games order by id` devuelve 10 filas, incluyendo `tetris`.
6. Prueba manual de punta a punta: jugar `tetris` en `/juegos/tetris/jugar` (mover, rotar, soft/hard drop, limpiar líneas, subir de nivel, pausar/reanudar, perder), guardar la puntuación vía `saveRealScore`, confirmar que aparece en `/juegos/tetris` y en la pestaña `TETRIS` de `/salon`, y que "Partidas" incrementa en `/biblioteca` y en el stat strip de `/juegos/tetris` tras recargar.
7. Pulido final: `npm run lint` y `npm run build` sin errores.

## Acceptance criteria

- [ ] `npm run build` completa sin errores.
- [ ] `npm run lint` completa sin errores.
- [ ] `/biblioteca` muestra una card "TETRIS" con portada propia (`cover-tetris`, cyan) y categoría PUZZLE, sin alterar la card de `caida`.
- [ ] `/juegos/tetris` muestra la descripción del juego y un leaderboard "MEJORES PUNTUACIONES", igual mecanismo que el resto de juegos.
- [ ] `/juegos/tetris/jugar` renderiza un canvas realmente jugable (no el placeholder decorativo): ←/→ mueven la pieza, ↑ o X rotan con wall kicks, ↓ acelera la caída (soft drop), Espacio hace caída instantánea (hard drop); se ve la pieza fantasma y la vista previa de la siguiente pieza.
- [ ] El HUD externo (Puntuación/Nivel) se actualiza en vivo mientras se juega. "Vidas" muestra un valor fijo (♥) durante toda la partida, ya que Tetris no tiene concepto de vidas.
- [ ] Completar una línea suma puntos según `LINE_SCORES` multiplicado por el nivel actual; cada 10 líneas eliminadas sube el nivel y aumenta la velocidad de caída.
- [ ] Apilar piezas hasta que una pieza nueva no pueda aparecer ("top-out") detiene el juego y abre el modal "FIN DEL JUEGO" de React, con la puntuación real alcanzada.
- [ ] Pulsar "FIN" en medio de la partida detiene el juego y abre el modal de React de inmediato, con la puntuación alcanzada hasta ese momento.
- [ ] Pulsar "PAUSA" congela el juego (las piezas dejan de caer); "REANUDAR" continúa desde el mismo estado sin saltos de tiempo. La tecla `P` del juego original ya no tiene efecto — solo el botón externo pausa.
- [ ] Guardar la puntuación desde el modal llama a `saveRealScore` con la puntuación real y muestra la confirmación "PUNTUACIÓN GUARDADA".
- [ ] "JUGAR DE NUEVO" inicia una partida completamente nueva (puntuación 0, nivel 1, tablero vacío).
- [ ] Pulsar ←/→/↑/↓/Espacio mientras se juega no hace scroll de la página.
- [ ] Salir de la partida a medias (botón "SALIR" o navegación) no deja errores en consola ni un loop de animación corriendo de fondo.
- [ ] Cualquier otro juego (ej. `/juegos/caida/jugar`, `/juegos/asteroides/jugar`) se ve y comporta exactamente igual que antes de este spec.
- [ ] Los dos registros (`lib/games/real-game-ids.ts`, `components/games/registry.ts`) son los únicos archivos tocados fuera del nuevo motor/wrapper/catálogo/CSS; `GamePlayer.tsx`, `GameDetail.tsx`, `HallOfFame.tsx`, `Library.tsx`, `lib/games-data.ts`, `lib/scores.ts` tienen cero diff.

## Decisions

- **Sí:** crear una entrada de catálogo nueva (`tetris`) en vez de reusar `caida`. Mismo precedente que `asteroides`/`rocas` en SPEC 05 — `caida` sigue siendo un juego mock independiente con su simulación decorativa.
- **Sí:** color `cyan` para distinguir la nueva card de `caida` (magenta) en la biblioteca, ya que ambas son PUZZLE con temática similar. Confirmado por el usuario en Phase 2.
- **Sí:** cover propia `.cover-tetris`, nunca reutilizar `.cover-tetro` de `caida`.
- **Sí:** fusionar el tablero y la vista previa de la siguiente pieza en un único `<canvas>` (450×600) en vez de mantener dos elementos `<canvas>` como el original. `RealGameProps`/el patrón de wrapper (`AsteroidsCanvas`) asumen un solo canvas; separar en dos elementos rompería ese contrato sin necesidad. Confirmado por el usuario en Phase 2.
- **Sí:** estirar el canvas a 100%×100% de `.crt-screen` (mismo patrón que `AsteroidsCanvas`), pese a que la proporción nativa del tablero (300×600, 1:2) es mucho más angosta que el buffer 800×600 de Asteroids. Decisión explícita del usuario en Phase 2, priorizando consistencia con el wrapper existente sobre evitar la distorsión visual del tablero en pantallas anchas.
- **Sí:** eliminar el toggle interno de pausa por tecla `P` del original. Mismo principio que la decisión de SPEC 05 de desactivar el reinicio por Espacio en el overlay de "GAME OVER" — un solo camino de control (el botón externo "PAUSA"/"REANUDAR") es más simple de razonar que dos disparadores independientes para el mismo estado.
- **Sí:** eliminar el selector de tema claro/oscuro (`theme-toggle`) del original. Arcade Vault ya tiene su propio sistema de tema (paleta oscura fija de `styles.css`); el toggle del prototipo standalone no aplica al contexto del reproductor integrado.
- **Sí:** `onLivesChange` se invoca una sola vez con el valor constante `1` al iniciar el motor, y nunca vuelve a cambiar. El contrato `RealGameProps` es fijo (no se modifica por juego, según SPEC 05), y Tetris no tiene concepto de vidas — el HUD externo de "Vidas" simplemente queda fijo en un corazón durante toda la partida.
- **Sí:** no dibujar HUD/overlay propios en el canvas (a diferencia de `asteroids-engine.ts`, que sí conserva `drawHUD()`/`drawOverlay()` del original). El `game.js` original de Tetris nunca dibujaba HUD/overlay en el canvas — usaba elementos DOM externos (`#score`, `#overlay`, etc.) que no existen en el wrapper integrado. No hay nada equivalente que "conservar"; se depende enteramente del HUD externo de React y del modal "FIN DEL JUEGO".
- **No:** controles táctiles en este spec. El motor original es solo teclado.
- **No:** escalar el canvas por `devicePixelRatio`. Mantiene el port simple y consistente con el patrón de `AsteroidsCanvas`.
- **No:** exponer el conteo de "Líneas" en el HUD externo. `RealGameProps` no tiene un callback para eso y no se modifica ese contrato por este spec; `lines` se sigue calculando internamente porque determina `level`.
- **No:** tocar los bugs de leaderboard ya documentados en `CLAUDE.md`. Son bugs preexistentes que afectan a todo el catálogo, no algo introducido por este spec.
- **No:** reemplazar o modificar la card/cover/id de `caida`. Cada juego del catálogo (real o decorativo) conserva su propia entrada.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| React Strict Mode (dev) monta/desmonta efectos dos veces; si `destroy()` no cancela bien el `requestAnimationFrame` y quita los listeners de teclado, podrían quedar dos loops o listeners duplicados corriendo el juego al doble de velocidad o respondiendo doble a cada tecla | `destroy()` cancela explícitamente el frame pendiente y remueve los listeners de `keydown`; se verifica en desarrollo que las piezas caen a velocidad normal y cada tecla dispara una sola acción. |
| El motor original usaba estado a nivel de módulo (`let board, current, next, score, ...` compartido por todo `game.js`); si el port a `createTetrisEngine` deja algo fuera del closure de la instancia, dos partidas montadas en momentos distintos (ej. tras "JUGAR DE NUEVO") podrían arrastrar estado de la partida anterior (tablero no vacío, nivel/score residual) | El plan remonta `TetrisCanvas` con un `key` nuevo en cada reinicio (mismo mecanismo que `AsteroidsCanvas`), lo que fuerza una instancia de motor completamente nueva en vez de reutilizar/resetear la anterior. |
| Estirar un buffer 450×600 (proporción angosta) a 100%×100% de `.crt-screen` puede distorsionar visualmente el tablero en pantallas anchas, especialmente notorio en un juego de grilla donde los bloques dejan de ser cuadrados | Riesgo aceptado explícitamente por el usuario en Phase 2, priorizando consistencia con el patrón de `AsteroidsCanvas`; se puede revisar en un spec futuro si la distorsión resulta molesta en la práctica. |
| La política `for insert with check (true)` en `scores` ya documentada como riesgo aceptado en SPEC 06 aplica igual a las puntuaciones de `tetris` — cualquiera puede insertar un score arbitrario | Riesgo heredado de SPEC 06, no re-litigado aquí. |

## What is **not** in this spec

- Controles táctiles/on-screen.
- Escalado del canvas por `devicePixelRatio`.
- Port de otros juegos del catálogo a motores reales (`arkanoid` u otros).
- El selector de tema claro/oscuro del prototipo standalone.
- Corrección de los bugs de leaderboard/`localStorage` ya documentados.
- Un contador de "Líneas" en el HUD externo de React.
- Cambios al layout/CSS de `.crt`, `.crt-screen` o `.player-hud`.
- Cambios a la card, cover o datos de `caida` u otro juego existente.

Cada uno de estos, si se necesita, va en su propio spec.
