# SPEC 08 — Juego real de Arkanoid integrado en el reproductor

> **Status:** Aprobado
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-08-31
> **Objective:** Portar `references/started-games/04-arkanoid/game.js` a un motor real e integrarlo al catálogo como `arkanoid`.

## Why this spec exists

SPEC 05 y SPEC 07 dejaron probada la arquitectura de registro (`REAL_GAME_IDS` → `REAL_GAMES`) con dos juegos reales que no necesitaron tocar `GamePlayer.tsx`, `GameDetail.tsx`, `HallOfFame.tsx`, `Library.tsx`, `lib/games-data.ts` ni `lib/scores.ts`. Este spec es el tercer juego real y el primero con dos diferencias de fondo respecto a los anteriores:

1. El original (`references/started-games/04-arkanoid/`) depende de un spritesheet PNG y dos sonidos mp3 — territorio nuevo para este catálogo, donde `asteroides` y `tetris` se dibujaron enteramente con primitivas de canvas. Este spec decide **no** portar esos assets (ver Decisions).
2. Arkanoid sí tiene un concepto real de vidas (3, decrecientes al caer la pelota) — a diferencia de `tetris`, que simuló `onLivesChange` con un valor fijo `1` por no tener vidas. Aquí `onLivesChange` refleja el conteo real, igual que hizo `asteroids-engine.ts`.

Además, el original dibuja su propio overlay de pausa con botones clicables para saltar de nivel — una función que quedaría inalcanzable en el reproductor integrado, porque el overlay "EN PAUSA" de React (`GamePlayer.tsx`) ya se pinta encima del canvas cuando `paused` es `true`, bloqueando cualquier click al canvas. Este spec elimina esa función en vez de portarla rota.

## Scope

**In:**

- Nueva entrada `arkanoid` en `GAMES` (`lib/data.ts`): `cat: "ARCADE"`, `color: "magenta"`, `cover: "cover-arkanoid"`, `title: "ARKANOID"`, con `short`/`long` describiendo el juego real (paleta y pelota, 5 niveles con patrones de bloques distintos, velocidad de pelota creciente por nivel, 3 vidas). `best: 33200`, `plays: "7.5K"` quedan como valores mock estáticos, igual de desconectados del leaderboard real que el resto del catálogo (bug ya documentado, no se corrige aquí).
- Nueva clase `.cover-arkanoid` en `app/globals.css`, junto al resto de `.cover-*`, con su propio gradiente (no reutiliza `.cover-bricks` de `bloque-buster`).
- `lib/games/arkanoid-engine.ts`: port de `game.js` + `levels.js` a una factory `createArkanoidEngine(canvas, callbacks)`, con todo el estado de módulo del original (`paddle`, `ball`, `blocks`, `explosions`, `lives`, `score`, `gameState`, `currentLevel`, `keys`, `lastTime`, el id de `requestAnimationFrame`) movido dentro del closure de la instancia. Cambios respecto al original, todos decididos en Phase 2:
  - Sin spritesheet ni audio: bloques/paleta/pelota se dibujan con `ctx.fillStyle` usando los mismos nombres de color del original (`red`, `yellow`, `cyan`, `magenta`, `hotpink`, `green`, `gray`); no se cargan `assets/spritesheet-breakout.png` ni los `.mp3`.
  - La animación de explosión al romper un bloque deja de usar los 4 frames del spritesheet y pasa a ser un flash con primitivas: un rectángulo del color del bloque que se desvanece/encoge durante los mismos 150 ms de `EXPLOSION_DURATION` del original.
  - Se elimina el toggle interno de pausa por tecla (`p`/`P`/`Escape`) — la pausa se controla solo externamente vía `pause()`/`resume()`, igual que "PAUSA" en `GamePlayer`.
  - Se elimina el listener de `click` sobre el canvas y el overlay de pausa con los 5 botones de selección de nivel — quedaría inalcanzable bajo el overlay "EN PAUSA" de React (ver Why this spec exists).
  - Se elimina todo dibujo de HUD/overlay propio en el canvas (score/nivel/vidas, "GAME OVER", "¡Completaste el juego!") — el motor no dibuja nada de eso; delega 100 % al HUD externo de React y al modal "FIN DEL JUEGO" (mismo patrón que `tetris-engine.ts`, a diferencia de `asteroids-engine.ts`, que sí conserva su HUD/overlay).
  - `LEVELS` (5 niveles: patrones de bloques y multiplicador de velocidad de `levels.js`) se porta como constante interna del archivo del motor, no como archivo separado.
  - Completar el nivel 5 (estado `'win'` del original) dispara `onGameOver(score)`, el mismo camino que perder las 3 vidas — `RealGameProps` no tiene un callback de "victoria" separado.
  - Control de paleta dual conservado tal cual: sigue el mouse (`mousemove` sobre el canvas, con el mismo cálculo de escala `canvas.width / rect.width` del original) y responde a `ArrowLeft`/`ArrowRight`.
  - `preventDefault()` en `ArrowLeft`/`ArrowRight` mientras el motor está montado (únicas teclas que el motor escucha, tras eliminar el toggle de pausa por teclado).
  - `pause()`/`resume()`/`endNow()`/`destroy()`, mismo contrato que `asteroids-engine.ts`/`tetris-engine.ts`.
- `components/games/ArkanoidCanvas.tsx` (`"use client"`): wrapper `forwardRef<RealGameHandle, RealGameProps>` sobre el motor, mismo patrón que `AsteroidsCanvas.tsx` — un único `<canvas>` de 800×600 (dimensión nativa del original) que llena `.crt-screen`, monta/destruye el motor, refleja el prop `paused` en `pause()`/`resume()`, expone `end()` por `ref`.
- Una línea agregada a `lib/games/real-game-ids.ts` (`REAL_GAME_IDS`) y una entrada agregada a `components/games/registry.ts` (`COMPONENTS`). Ninguna otra línea de `registry.ts` cambia de forma; `GamePlayer.tsx`, `GameDetail.tsx`, `HallOfFame.tsx`, `Library.tsx`, `lib/games-data.ts`, `lib/scores.ts` no requieren cambios — confirmado genérico sobre `REAL_GAME_IDS` desde SPEC 06.
- Migración de Supabase (`mcp__supabase__apply_migration`, aplicada durante `/spec-impl`, no por este spec) que inserta una fila en `games` idéntica a la entrada de `lib/data.ts` (`id`/`title`/`short`/`long`/`cat`/`cover`/`color`/`plays`; la tabla `games` no tiene columna `best`, según el modelo de datos de SPEC 06).

**Out of scope (for future specs):**

- Portar el spritesheet (`assets/spritesheet-breakout.png`) y los sonidos (`ball-bounce.mp3`, `break-sound.mp3`) del original — decisión explícita de esta primera versión; puede revisarse en un spec futuro si se quiere más fidelidad visual/sonora.
- El selector de nivel por click sobre el overlay de pausa del original — se elimina por completo, no se reimplementa de otra forma (p. ej. como botones HTML externos) en este spec.
- Controles táctiles/on-screen — el motor portado usa únicamente mouse y teclado, igual que `game.js` original.
- Escalado del canvas por `devicePixelRatio` — se mantiene el buffer fijo 800×600 estirado por CSS.
- Portar otros juegos del catálogo a motores reales — este spec solo agrega `arkanoid`.
- Corregir los bugs de leaderboard ya documentados en `CLAUDE.md` (`game.best` inconsistente, `localStorage.av_scores` write-only, doble leaderboard detalle/salón) — riesgo preexistente que afecta a todo el catálogo, no introducido por este spec.
- Cambiar el layout/CSS de `.crt`, `.crt-screen` o `.player-hud` — se reutilizan tal cual están.
- Reemplazar la card/cover/id de `bloque-buster` — no se toca ninguna entrada existente de `GAMES`; `bloque-buster` sigue siendo un juego decorativo independiente con su simulación actual.

## Data model

```ts
// lib/data.ts — nueva entrada en GAMES
{
  id: "arkanoid",
  title: "ARKANOID",
  short: "Rompe muros de bloques con tu paleta y una pelota imparable.",
  long: "Controla una paleta con el mouse o las flechas y rebota una pelota para pulverizar 5 niveles de bloques con patrones distintos. Cada nivel acelera la pelota. Pierdes una vida si la pelota cae — tienes 3.",
  cat: "ARCADE",
  cover: "cover-arkanoid",
  color: "magenta",
  best: 33200,
  plays: "7.5K",
}
```

```ts
// lib/games/arkanoid-engine.ts
export interface ArkanoidEngine {
  pause(): void;
  resume(): void;
  endNow(): void; // termina la partida ya, dispara onGameOver(score) con el score actual
  destroy(): void; // cancela el loop y quita los listeners de mouse/teclado
}

export function createArkanoidEngine(
  canvas: HTMLCanvasElement,
  callbacks: Pick<RealGameProps, "onScoreChange" | "onLivesChange" | "onLevelChange" | "onGameOver">
): ArkanoidEngine;
```

`RealGameProps`/`RealGameHandle` se reutilizan verbatim desde `lib/games/types.ts` — sin cambios a ese archivo.

```ts
// components/games/registry.ts — única línea nueva
const COMPONENTS: Record<string, ForwardRefExoticComponent<RealGameProps & RefAttributes<RealGameHandle>>> = {
  asteroides: AsteroidsCanvas,
  tetris: TetrisCanvas,
  arkanoid: ArkanoidCanvas,
};
```

```ts
// lib/games/real-game-ids.ts
export const REAL_GAME_IDS: string[] = ["asteroides", "tetris", "arkanoid"];
```

```sql
-- Fila insertada en games (migración aplicada durante /spec-impl)
insert into public.games (id, title, short, long, cat, cover, color, plays)
values (
  'arkanoid',
  'ARKANOID',
  'Rompe muros de bloques con tu paleta y una pelota imparable.',
  'Controla una paleta con el mouse o las flechas y rebota una pelota para pulverizar 5 niveles de bloques con patrones distintos. Cada nivel acelera la pelota. Pierdes una vida si la pelota cae — tienes 3.',
  'ARCADE',
  'cover-arkanoid',
  'magenta',
  '7.5K'
);
```

Convenciones: el motor conserva las constantes de física del original sin cambios de balance (`PADDLE_SPEED=400`, `BLOCK_COLS=10`, `BLOCK_ROWS=6`, `BLOCK_W=64`, `BLOCK_H=24`, `BASE_BALL_VX=200`, `BASE_BALL_VY=-300`, canvas 800×600, `EXPLOSION_DURATION=150`) y los 5 niveles de `LEVELS` (patrones de bloques + multiplicador de velocidad ×1.00 a ×1.46) — es un port, no un rediseño. Los bloques/paleta/pelota se dibujan con `ctx.fillRect` usando los mismos nombres de color CSS del original en vez de `drawSprite`.

## Implementation plan

1. Agregar la entrada `arkanoid` a `GAMES` en `lib/data.ts` y la clase `.cover-arkanoid` en `app/globals.css`. Prueba manual: `/biblioteca` muestra la nueva card "ARKANOID" (magenta, ARCADE) sin afectar la card de `bloque-buster`; `/juegos/arkanoid` muestra la página de detalle (el reproductor sigue siendo el decorativo actual en este punto).
2. Crear `lib/games/arkanoid-engine.ts`: port de `game.js` + `levels.js` a `createArkanoidEngine(canvas, callbacks)`. Todo el estado a nivel de módulo del original pasa dentro del closure de la instancia. Se dibuja con primitivas de canvas (sin spritesheet), se elimina el audio, el toggle de pausa por tecla, el click de selección de nivel y todo el HUD/overlay interno; se agrega el flash de explosión con primitivas descrito en Scope; completar el nivel 5 dispara `onGameOver` igual que perder las vidas. Prueba manual: instanciado contra un `<canvas>` de prueba, la paleta sigue el mouse y responde a ←/→, la pelota rebota en paredes/paleta/bloques, los bloques flashean y desaparecen al ser golpeados, despejar un nivel avanza al siguiente con la pelota más rápida, perder la última vida dispara `onGameOver`, y despejar el nivel 5 también lo dispara.
3. Crear `components/games/ArkanoidCanvas.tsx` (`forwardRef<RealGameHandle, RealGameProps>`): canvas 800×600 que llena `.crt-screen`, mismo patrón que `AsteroidsCanvas`, crea/destruye el motor en el ciclo de montaje, sincroniza `paused` con `pause()/resume()`, expone `end()` vía `useImperativeHandle`. Prueba manual: montado de forma aislada, el juego se ve y se juega con mouse y teclado.
4. Agregar `"arkanoid"` a `lib/games/real-game-ids.ts` (`REAL_GAME_IDS`) y `arkanoid: ArkanoidCanvas` a `COMPONENTS` en `components/games/registry.ts`. Prueba manual: sin ningún otro cambio, `/juegos/arkanoid/jugar` ya renderiza `ArkanoidCanvas` en vez del placeholder decorativo; `/juegos/asteroides/jugar` y `/juegos/tetris/jugar` siguen funcionando exactamente igual.
5. Migración Supabase: insertar la fila de `arkanoid` en `games` con los mismos valores de `lib/data.ts` (sin `best`). Prueba manual: `select id, title, cat, color, cover from games order by id` devuelve 11 filas, incluyendo `arkanoid`.
6. Prueba manual de punta a punta: jugar `arkanoid` en `/juegos/arkanoid/jugar` (mover la paleta con mouse y con ←/→, romper bloques, perder una vida, despejar un nivel, perder las 3 vidas y completar el nivel 5 en partidas separadas), guardar la puntuación vía `saveRealScore`, confirmar que aparece en `/juegos/arkanoid` y en la pestaña `ARKANOID` de `/salon`, y que "Partidas" incrementa en `/biblioteca` y en el stat strip de `/juegos/arkanoid` tras recargar.
7. Pulido final: `npm run lint` y `npm run build` sin errores.

## Acceptance criteria

- [ ] `npm run build` completa sin errores.
- [ ] `npm run lint` completa sin errores.
- [ ] `/biblioteca` muestra una card "ARKANOID" con portada propia (`cover-arkanoid`, magenta) y categoría ARCADE, sin alterar la card de `bloque-buster`.
- [ ] `/juegos/arkanoid` muestra la descripción del juego y un leaderboard "MEJORES PUNTUACIONES", igual mecanismo que el resto de juegos.
- [ ] `/juegos/arkanoid/jugar` renderiza un canvas realmente jugable (no el placeholder decorativo): la paleta se mueve con el mouse y con ←/→; la pelota rebota en paredes, paleta y bloques; los bloques desaparecen con un flash breve al romperse.
- [ ] El HUD externo (Puntuación/Vidas/Nivel) se actualiza en vivo mientras se juega; el canvas no dibuja HUD ni overlays propios (ni score/nivel/vidas, ni pausa, ni game over/win).
- [ ] Romper un bloque suma 10 puntos; despejar todos los bloques de un nivel avanza al siguiente nivel con la pelota más rápida según el multiplicador de `LEVELS`.
- [ ] Perder las 3 vidas detiene el juego y abre el modal "FIN DEL JUEGO" de React con la puntuación real alcanzada.
- [ ] Despejar el nivel 5 (completar el juego) también detiene el juego y abre el modal "FIN DEL JUEGO", con la puntuación real alcanzada — mismo camino de finalización que perder las vidas.
- [ ] Pulsar "FIN" en medio de la partida detiene el juego de inmediato y abre el modal de React con la puntuación alcanzada hasta ese momento.
- [ ] Pulsar "PAUSA" congela el juego (paleta/pelota/bloques dejan de moverse); "REANUDAR" continúa desde el mismo estado sin saltos de tiempo. No aparece ningún overlay de pausa ni selector de nivel dibujado en el canvas — el único control de pausa es el botón externo de React.
- [ ] Guardar la puntuación desde el modal llama a `saveRealScore` con la puntuación real y muestra la confirmación "PUNTUACIÓN GUARDADA".
- [ ] "JUGAR DE NUEVO" inicia una partida completamente nueva (puntuación 0, 3 vidas, nivel 1, bloques nuevos).
- [ ] Pulsar ←/→ mientras se juega no hace scroll de la página.
- [ ] Salir de la partida a medias (botón "SALIR" o navegación) no deja errores en consola ni un loop de animación corriendo de fondo.
- [ ] Cualquier otro juego (ej. `/juegos/bloque-buster/jugar`, `/juegos/asteroides/jugar`, `/juegos/tetris/jugar`) se ve y comporta exactamente igual que antes de este spec.
- [ ] Los dos registros (`lib/games/real-game-ids.ts`, `components/games/registry.ts`) son los únicos archivos tocados fuera del nuevo motor/wrapper/catálogo/CSS; `GamePlayer.tsx`, `GameDetail.tsx`, `HallOfFame.tsx`, `Library.tsx`, `lib/games-data.ts`, `lib/scores.ts` tienen cero diff.

## Decisions

- **Sí:** crear una entrada de catálogo nueva (`arkanoid`) en vez de reusar `bloque-buster`. Mismo precedente que `asteroides`/`rocas` (SPEC 05) y `tetris`/`caida` (SPEC 07) — `bloque-buster` sigue siendo un juego mock independiente con su simulación decorativa.
- **Sí:** categoría `ARCADE` y color `magenta` — distingue la card de `bloque-buster` (ARCADE, cyan) y es un color que ningún otro juego del catálogo usa hoy. Confirmado por el usuario en Phase 2.
- **Sí:** cover propia `.cover-arkanoid`, nunca reutilizar `.cover-bricks` de `bloque-buster`.
- **Sí:** portar el juego sin el spritesheet ni los sonidos del original — bloques/paleta/pelota se dibujan con primitivas de canvas usando los mismos nombres de color. Decisión explícita del usuario en Phase 2: consistente con `asteroids-engine.ts`/`tetris-engine.ts` (ningún juego real portado hasta ahora usa assets), evita preguntas de licencia de los archivos de `references/started-games/04-arkanoid/assets/` y evita la política de autoplay de audio de los navegadores.
- **Sí:** la animación de explosión al romper un bloque se simplifica a un flash de color con primitivas (mismo `EXPLOSION_DURATION` de 150 ms) en vez de omitirse. Decisión explícita del usuario en Phase 2 — conserva feedback visual al romper bloques sin depender del spritesheet.
- **Sí:** el motor no dibuja HUD ni overlays propios en el canvas (ni score/nivel/vidas, ni "GAME OVER"/"¡Completaste el juego!", ni el overlay de pausa con selector de nivel) — mismo patrón que `tetris-engine.ts`, a diferencia de `asteroids-engine.ts`. Decisión explícita del usuario en Phase 2 tras señalar que el overlay "EN PAUSA" externo de React (`GamePlayer.tsx`, z-index 5) ya se pinta encima del canvas al pausar, dejando inalcanzable cualquier overlay/click interno de pausa — portar el selector de nivel por click habría sido portar una función rota.
- **Sí:** se elimina el toggle interno de pausa por tecla (`p`/`P`/`Escape`) del original. Mismo principio que la decisión de SPEC 07 con `tetris` — un solo camino de control (el botón externo "PAUSA"/"REANUDAR") es más simple de razonar que dos disparadores independientes para el mismo estado.
- **Sí:** `onLivesChange` refleja el conteo real de vidas (empieza en 3, decrece al caer la pelota), a diferencia de `tetris-engine.ts` (que fija `1` porque Tetris no tiene vidas). Arkanoid sí tiene el mismo concepto de vidas que `asteroides` — se porta tal cual.
- **Sí:** completar el nivel 5 (estado `'win'` del original) dispara el mismo `onGameOver(score)` que perder las vidas. `RealGameProps` no tiene un callback de "victoria" separado (contrato fijo desde SPEC 05, no se modifica); un solo camino de finalización es más simple de mantener, mismo principio que la decisión de SPEC 05 sobre "FIN".
- **Sí:** `LEVELS` (patrones de bloques + multiplicador de velocidad) se porta como constante interna de `arkanoid-engine.ts`, no como archivo separado (`levels.js` en el original) — mismo criterio que `asteroids-engine.ts`/`tetris-engine.ts`: el port completo vive en un único archivo de motor.
- **Sí:** control de paleta dual (mouse + ←/→) se conserva tal cual el original — ambos métodos coexisten sin conflicto, el último input gana en cada frame, igual que en `game.js`.
- **Sí:** `best: 33200`, `plays: "7.5K"` como valores mock del fallback en `lib/data.ts`. Decisión explícita del usuario en Phase 2 — mismo orden de magnitud que `bloque-buster` (`best: 28450`) y `asteroides` (`best: 38700`).
- **No:** portar `assets/spritesheet-breakout.png` ni los `.mp3` en este spec. Puede revisarse en un spec futuro si se decide dar más fidelidad visual/sonora a `arkanoid`.
- **No:** reimplementar el selector de nivel por click de otra forma (p. ej. botones HTML externos) en este spec — se elimina la función, no se reemplaza.
- **No:** controles táctiles en este spec. El motor original es solo mouse/teclado.
- **No:** escalar el canvas por `devicePixelRatio`. Mantiene el port simple y consistente con el patrón de `AsteroidsCanvas`/`TetrisCanvas`.
- **No:** tocar los bugs de leaderboard ya documentados en `CLAUDE.md`. Son bugs preexistentes que afectan a todo el catálogo, no algo introducido por este spec.
- **No:** reemplazar o modificar la card/cover/id de `bloque-buster`. Cada juego del catálogo (real o decorativo) conserva su propia entrada.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| React Strict Mode (dev) monta/desmonta efectos dos veces; si `destroy()` no cancela bien el `requestAnimationFrame` y quita los listeners de mouse/teclado, podrían quedar dos loops o listeners duplicados corriendo el juego al doble de velocidad o respondiendo doble a cada input | `destroy()` cancela explícitamente el frame pendiente y remueve los listeners de `mousemove`/`keydown`/`keyup`; se verifica en desarrollo que el juego corre a velocidad normal y cada input dispara una sola acción. |
| El motor original usaba estado a nivel de módulo (`let paddle, ball, blocks, lives, score, ...` compartido por todo `game.js`); si el port a `createArkanoidEngine` deja algo fuera del closure de la instancia, dos partidas montadas en momentos distintos (ej. tras "JUGAR DE NUEVO") podrían arrastrar estado de la partida anterior | El plan remonta `ArkanoidCanvas` con un `key` nuevo en cada reinicio (mismo mecanismo que `AsteroidsCanvas`/`TetrisCanvas`), lo que fuerza una instancia de motor completamente nueva en vez de reutilizar/resetear la anterior. |
| Sin el spritesheet original, el flash de explosión con primitivas y los bloques planos de color tienen menor fidelidad visual que el original (que usaba sprites detallados) | Riesgo aceptado explícitamente por el usuario en Phase 2, priorizando consistencia con `asteroides`/`tetris` (ningún assets) sobre fidelidad visual; se puede revisar en un spec futuro si se decide portar el spritesheet. |
| La política `for insert with check (true)` en `scores` ya documentada como riesgo aceptado en SPEC 06 aplica igual a las puntuaciones de `arkanoid` — cualquiera puede insertar un score arbitrario | Riesgo heredado de SPEC 06, no re-litigado aquí. |

## What is **not** in this spec

- El spritesheet (`spritesheet-breakout.png`) y los sonidos (`ball-bounce.mp3`, `break-sound.mp3`) del original.
- El selector de nivel por click del overlay de pausa original.
- Controles táctiles/on-screen.
- Escalado del canvas por `devicePixelRatio`.
- Port de otros juegos del catálogo a motores reales.
- Corrección de los bugs de leaderboard/`localStorage` ya documentados.
- Cambios al layout/CSS de `.crt`, `.crt-screen` o `.player-hud`.
- Cambios a la card, cover o datos de `bloque-buster` u otro juego existente.

Cada uno de estos, si se necesita, va en su propio spec.
