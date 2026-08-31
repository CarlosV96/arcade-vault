# SPEC 09 — Juego real de Snake integrado en el reproductor

> **Status:** Aprobado
> **Depends on:** SPEC 05, SPEC 06
> **Date:** 2026-08-31
> **Objective:** Construir desde cero un motor real de Snake (no hay `game.js` de referencia, solo el atlas de sprites de fruta en `references/source-assets/snake-assets/`) y conectarlo al catálogo como `snake-real`, siguiendo la misma arquitectura de registro que `asteroides`/`tetris`/`arkanoid`.

## Why this spec exists

A diferencia de SPEC 05/07/08, este juego no parte de un `game.js` ya construido en `references/started-games/` — no existe una carpeta de Snake ahí. Lo único disponible es un atlas de sprites de fruta (`references/source-assets/snake-assets/snake-assets/fruits.png` + `sprites.js`) que el usuario aportó explícitamente para este juego. Por lo tanto este spec no es un "port" en el sentido estricto de SPEC 05/07/08: es la implementación de un Snake clásico desde cero, usando el mismo contrato (`RealGameProps`/`RealGameHandle`) y el mismo patrón de registro que los juegos ya integrados, con las reglas de juego (bordes, vidas, velocidad) decididas explícitamente con el usuario en ausencia de un código fuente que las fijara de antemano.

También documenta un riesgo nuevo: `sprites.js` indica que `fruits.png` proviene de spriters-resource.com (assets extraídos de Google Snake), no es arte original del usuario. El usuario confirmó explícitamente usarlos igual, aceptando el riesgo de procedencia/licencia (ver Decisions y Risks).

## Scope

**In:**

- Nueva entrada `snake-real` en `GAMES` (`lib/data.ts`): `title: "SNAKE"`, `cat: "ARCADE"`, `color: "green"`, `cover: "cover-snake-real"`, `short`/`long` describiendo el juego real (serpiente sobre grilla, fruta que crece y acelera, bordes letales). `best`/`plays` quedan como valores mock estáticos (`best: 3200`, `plays: "4.1K"`), igual de desconectados del leaderboard real que el resto del catálogo hasta que se juega — mismo patrón que `asteroides`/`tetris`/`arkanoid` en SPEC 06.
- Nueva clase `.cover-snake-real` en `app/globals.css`, con su propio gradiente — no reutiliza `.cover-snake` (la portada del juego decorativo existente `serpentina`).
- `lib/games/snake-engine.ts`: motor nuevo, `createSnakeEngine(canvas, callbacks)`, implementando Snake clásico sobre una grilla (ver Data model), con todo el estado dentro del closure de la instancia (sin `let` a nivel de módulo), `pause()`/`resume()`/`endNow()`/`destroy()`, y `preventDefault()` en las 8 teclas del juego (flechas + WASD) mientras sus listeners están activos.
- `lib/games/snake-sprites.ts`: port de `references/source-assets/snake-assets/snake-assets/sprites.js` a un módulo TS (`export const FRUIT_SPRITES: Record<string, {x,y,w,h}>`), sin el global `window.SPRITE_ATLAS` del archivo original.
- `public/games/snake-real/fruits.png`: copia del atlas de sprites original, servido como asset estático de Next.
- `components/games/SnakeCanvas.tsx` (`"use client"`): wrapper `forwardRef<RealGameHandle, RealGameProps>` sobre el motor — mismo patrón que `AsteroidsCanvas.tsx`: canvas fijo que llena `.crt-screen`, monta/destruye el motor, refleja `paused` en `pause()`/`resume()`, expone `end()` por `ref`.
- Una línea nueva en `lib/games/real-game-ids.ts` (`REAL_GAME_IDS`) y una entrada nueva en `components/games/registry.ts` (`COMPONENTS`). Ninguna otra línea de `registry.ts` cambia, y `GamePlayer.tsx`/`GameDetail.tsx`/`HallOfFame.tsx`/`Library.tsx`/`lib/games-data.ts`/`lib/scores.ts` no requieren cambios — confirmado genérico sobre `REAL_GAME_IDS` desde SPEC 06.
- Migración de Supabase (`mcp__supabase__apply_migration`, aplicada durante `/spec-impl`, no por este skill) que inserta una fila en `games` igual a la entrada de `lib/data.ts` (`id`/`title`/`short`/`long`/`cat`/`cover`/`color`/`plays` — la tabla `games` no tiene columna `best`, según el modelo de datos de SPEC 06).

**Out of scope (for future specs):**

- Controles táctiles/on-screen — solo teclado (flechas + WASD), igual que el resto de juegos reales.
- Escalado del canvas por `devicePixelRatio`.
- Vidas múltiples o respawn — decisión explícita del usuario: 1 vida, choque contra pared o contra la propia cola termina la partida al instante.
- Modo toroidal (bordes que envuelven) — decisión explícita del usuario: los bordes matan, no se replica el comportamiento de `asteroides`.
- Cualquier otra entrada del catálogo (real o decorativa), incluyendo `serpentina`/`cover-snake` — no se toca ni se reemplaza.
- Corregir los bugs de leaderboard ya documentados en `CLAUDE.md` — inherente a todo el catálogo, no algo de este spec.
- Cambiar el layout/CSS de `.crt`, `.crt-screen` o `.player-hud`.
- Sonido — el atlas aportado es solo de imágenes; no hay pista de audio en `references/source-assets/`.

## Data model

```ts
// lib/data.ts — nueva entrada en GAMES
{
  id: "snake-real",
  title: "SNAKE",
  short: "Guía a la serpiente por la grilla y devora fruta sin morder tu propia cola.",
  long: "Controla una serpiente de luz sobre una grilla neón: cada fruta que devora la hace más larga y más veloz. Los bordes del tablero son letales y un giro sobre tu propia cola termina la partida al instante. ¿Cuánto puedes crecer antes de fallar?",
  cat: "ARCADE",
  cover: "cover-snake-real",
  color: "green",
  best: 3200,
  plays: "4.1K",
}
```

```ts
// lib/games/snake-sprites.ts — port de sprites.js (sin window.SPRITE_ATLAS)
export interface SpriteRect { x: number; y: number; w: number; h: number; }

export const FRUIT_SHEET_SRC = "/games/snake-real/fruits.png";

export const FRUIT_SPRITES: Record<string, SpriteRect> = {
  banana: { x: 34, y: 136, w: 110, h: 160 },
  orange: { x: 186, y: 136, w: 150, h: 160 },
  // ... las 21 frutas listadas en sprites.js, copiadas tal cual (mismas coordenadas)
};
```

```ts
// lib/games/snake-engine.ts
export interface SnakeEngine {
  pause(): void;
  resume(): void;
  endNow(): void;
  destroy(): void; // cancela el loop de ticks y quita los listeners de teclado
}

export function createSnakeEngine(
  canvas: HTMLCanvasElement,
  callbacks: Pick<RealGameProps, "onScoreChange" | "onLivesChange" | "onLevelChange" | "onGameOver">
): SnakeEngine;
```

Conventions de la grilla:

- Canvas fijo 800×600 (mismo patrón que `asteroides`/`tetris`/`arkanoid`, estirado por CSS para llenar `.crt-screen`).
- Celda de 20px → grilla de 40 columnas × 30 filas.
- La serpiente arranca con 3 segmentos en el centro de la grilla, moviéndose hacia la derecha.
- Una sola fruta viva en el tablero a la vez, en una celda libre (no ocupada por la serpiente), con un sprite aleatorio de `FRUIT_SPRITES` elegido en cada spawn.
- `onScoreChange`: +10 puntos por fruta comida.
- `onLevelChange`: se usa como proxy de "longitud alcanzada" (nivel = longitud de la serpiente / 5, redondeado hacia abajo, mínimo 1) — no hay niveles discretos como en Tetris/Arkanoid, pero el HUD externo espera un valor numérico ahí.
- `onLivesChange`: se llama una sola vez, con `0`, en el momento de la colisión (pared o cuerpo propio) — no hay múltiples vidas.
- Velocidad: intervalo de tick inicial de 140ms; cada fruta comida lo reduce 4ms, con un piso de 60ms.
- Colisión: chocar contra cualquier borde de la grilla (fuera de 0..39 / 0..29) o contra cualquier segmento del propio cuerpo dispara `onGameOver(score)` de inmediato.
- Controles: `ArrowUp/Down/Left/Right` y `W/A/S/D` cambian la dirección del siguiente tick; un giro de 180° sobre la dirección actual (ej. moverse a la derecha y presionar izquierda) se ignora, no mata a la serpiente.

## Implementation plan

1. Agregar la entrada `snake-real` a `GAMES` en `lib/data.ts` y la clase `.cover-snake-real` en `app/globals.css`. Prueba manual: `/biblioteca` muestra la nueva card con portada propia; `/juegos/snake-real` muestra la página de detalle (el reproductor sigue siendo el decorativo actual en este punto).
2. Copiar `references/source-assets/snake-assets/snake-assets/fruits.png` a `public/games/snake-real/fruits.png`. Crear `lib/games/snake-sprites.ts` con las 21 entradas de `FRUIT_SPRITES` portadas de `sprites.js`. Prueba manual: el archivo compila, sin consumidores todavía.
3. Crear `lib/games/snake-engine.ts`: `createSnakeEngine(canvas, callbacks)` con la lógica de grilla, movimiento por tick, spawn de fruta con sprite aleatorio, detección de colisión (pared y cuerpo propio), aceleración progresiva, `pause()/resume()/endNow()/destroy()`, y `preventDefault()` en las 8 teclas del juego. Prueba manual: instanciado contra un `<canvas>` de prueba, la serpiente se mueve con teclado, come fruta (dibujada con el sprite correspondiente), crece, acelera, y morir contra pared o cuerpo propio detiene el loop.
4. Crear `components/games/SnakeCanvas.tsx` (`forwardRef<RealGameHandle, RealGameProps>`): canvas 800×600 que llena `.crt-screen`, crea/destruye el motor en el ciclo de montaje, sincroniza `paused`, expone `end()` vía `useImperativeHandle`. Prueba manual: montado de forma aislada, el juego se ve y se juega con teclado.
5. Agregar `"snake-real"` a `REAL_GAME_IDS` (`lib/games/real-game-ids.ts`) y `snake-real: SnakeCanvas` a `COMPONENTS` (`components/games/registry.ts`). Prueba manual: `/juegos/snake-real/jugar` renderiza `SnakeCanvas` en vez del placeholder decorativo.
6. Migración Supabase: insertar la fila `snake-real` en `games` con los mismos valores de `lib/data.ts` (sin `best`, que no existe en esa tabla). Prueba manual: `select id, title, cat, cover, color, plays from games where id = 'snake-real'` devuelve la fila esperada.
7. Prueba manual de punta a punta: jugar `snake-real` completo, comer varias frutas (verificando que el sprite cambia), chocar contra un borde y por separado contra la propia cola, guardar la puntuación vía `saveRealScore`, y verla aparecer en `/juegos/snake-real` y en la pestaña `SNAKE` de `/salon`; confirmar que `plays` sube tras la partida.
8. Pulido final: `npm run lint` y `npm run build` sin errores.

## Acceptance criteria

- [ ] `npm run build` completa sin errores.
- [ ] `npm run lint` completa sin errores.
- [ ] `/biblioteca` muestra una card "SNAKE" con portada propia (`cover-snake-real`) y categoría ARCADE, distinta de la card "SERPENTINA" existente.
- [ ] `/juegos/snake-real` muestra la descripción del juego y un leaderboard "MEJORES PUNTUACIONES", igual mecanismo que el resto de juegos reales.
- [ ] `/juegos/snake-real/jugar` renderiza un canvas realmente jugable: la serpiente se mueve con flechas y WASD, crece al comer fruta, y la fruta se dibuja con un sprite del atlas (no un rectángulo placeholder).
- [ ] El sprite de la fruta cambia (aleatoriamente, entre las 21 frutas del atlas) cada vez que se genera una nueva.
- [ ] Chocar contra cualquier borde del tablero termina la partida de inmediato (no hay envoltura toroidal).
- [ ] Chocar contra el propio cuerpo termina la partida de inmediato.
- [ ] Intentar girar 180° sobre la dirección actual (ej. ir a la derecha y presionar izquierda) se ignora — no mata a la serpiente ni cambia su rumbo.
- [ ] La velocidad de la serpiente aumenta perceptiblemente conforme come más fruta, hasta un piso mínimo.
- [ ] El HUD externo (Puntuación/Vidas/Nivel) se actualiza en vivo: Puntuación sube 10 por fruta, Vidas pasa de 1 a 0 al chocar, Nivel refleja la longitud alcanzada.
- [ ] Al chocar se abre el modal "FIN DEL JUEGO" de React con la puntuación real alcanzada, igual que en `asteroides`/`tetris`/`arkanoid`.
- [ ] Pulsar "FIN" en medio de la partida detiene el juego y abre el modal de React de inmediato, con la puntuación alcanzada hasta ese momento.
- [ ] Pulsar "PAUSA" congela el juego (la serpiente deja de moverse); "REANUDAR" continúa desde el mismo estado.
- [ ] Guardar la puntuación desde el modal llama a `saveRealScore` y la puntuación aparece en `/juegos/snake-real` y en la pestaña `SNAKE` de `/salon` tras recargar.
- [ ] "JUGAR DE NUEVO" inicia una partida completamente nueva (serpiente de 3 segmentos, puntuación 0, velocidad inicial).
- [ ] Pulsar flechas/WASD mientras se juega no hace scroll de la página.
- [ ] Salir de la partida a medias no deja errores en consola ni un loop de tick corriendo de fondo.
- [ ] `/juegos/serpentina/jugar` (el juego decorativo existente) se ve y comporta exactamente igual que antes de este spec.
- [ ] Los únicos archivos fuera de `lib/games/snake-*`, `components/games/SnakeCanvas.tsx`, `lib/data.ts`, `app/globals.css` y `public/games/snake-real/` que cambian son las dos líneas de registro (`real-game-ids.ts`, `registry.ts`) — `GamePlayer`/`GameDetail`/`HallOfFame`/`Library`/`games-data`/`scores` tienen cero diff.

## Decisions

- **Sí:** id nuevo `snake-real` en vez de reutilizar `serpentina`/`cover-snake`. Mismo precedente que `asteroides` sobre `rocas` en SPEC 05 — el juego decorativo existente se queda intacto con su simulación y su portada, el motor real es una entrada aparte.
- **Sí:** portar el atlas de fruta (`fruits.png` + `sprites.js`) tal cual lo aportó el usuario, en vez de dibujar la fruta con primitivas de canvas. Decisión explícita del usuario tras confirmar que la procedencia (spriters-resource.com, assets extraídos de Google Snake) no es arte original — riesgo aceptado explícitamente, documentado abajo.
- **Sí:** 1 vida, sin respawn — chocar contra pared o contra el propio cuerpo termina la partida al instante. Decisión explícita del usuario, siguiendo la convención del Snake arcade clásico en vez del patrón de 3 vidas de `asteroides`/`arkanoid`.
- **Sí:** bordes letales, no toroidales. Decisión explícita del usuario — diferencia deliberada del campo envolvente de `asteroides`.
- **Sí:** fruta con sprite aleatorio del atlas en cada spawn, en vez de una fruta fija o un recorrido cíclico. Decisión explícita del usuario, prioriza variedad visual.
- **Sí:** velocidad progresiva (el tick se acelera con cada fruta comida, con piso mínimo). Decisión explícita del usuario, sigue el patrón de dificultad creciente de `caida`/`tetris` en vez de velocidad fija.
- **Sí:** color `green` para la card, pese a que ya lo usan `serpentina`/`invasores`/`ranaria`. Decisión explícita del usuario — el color no es un identificador único como el `cover`, y `green` es la asociación temática natural para una serpiente.
- **Sí:** reutilizar `RealGameProps`/`RealGameHandle` (`lib/games/types.ts`) sin cambios, mapeando `onLivesChange` a una única llamada con `0` al morir y `onLevelChange` a la longitud alcanzada — el contrato es fijo desde SPEC 05 y no se modifica por juego.
- **No:** modo de vidas múltiples/respawn. Descartado explícitamente por el usuario a favor del formato clásico de una sola vida.
- **No:** dibujar la fruta con canvas en vez de usar el atlas. El usuario prefirió aprovechar los sprites aportados, asumiendo el riesgo de licencia.
- **No:** sonido — no hay assets de audio aportados; agregarlo sería inventar un alcance no pedido.
- **No:** controles táctiles ni escalado por `devicePixelRatio`, mismos motivos que en SPEC 05/07/08.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| `fruits.png` proviene de spriters-resource.com (assets extraídos de Google Snake), sin licencia clara de redistribución/uso comercial | Riesgo aceptado explícitamente por el usuario. Si el proyecto pasa a producción pública o distribución comercial, revisar la procedencia antes de esa etapa — no se resuelve en este spec. |
| Sin `game.js` de referencia, las reglas (bordes letales, 1 vida, velocidad progresiva) son una implementación nueva, no un port verificado contra un original — más superficie para bugs de lógica que en `asteroides`/`tetris`/`arkanoid` | Los criterios de aceptación cubren explícitamente colisión con pared, colisión con cuerpo propio, el caso del giro de 180° ignorado, y el piso mínimo de velocidad. |
| React Strict Mode (dev) monta/desmonta efectos dos veces; si `destroy()` no cancela bien el intervalo de tick y quita los listeners de teclado, podrían quedar dos loops corriendo el juego al doble de velocidad | `destroy()` cancela explícitamente el timer pendiente y remueve los listeners de `keydown`; se verifica en desarrollo que la velocidad y la respuesta a cada tecla son correctas. |
| La política `for insert with check (true)` en `scores` (heredada de SPEC 06) permite insertar cualquier puntuación arbitraria para `snake-real`, sin relación con una partida real | Riesgo heredado y ya aceptado en SPEC 06, no se re-mitiga aquí. |

## What is **not** in this spec

- Controles táctiles/on-screen.
- Escalado del canvas por `devicePixelRatio`.
- Vidas múltiples o modo toroidal — 1 vida, bordes letales, por decisión explícita del usuario.
- Sonido.
- Cambios a `serpentina`, su card, cover o cualquier otra entrada existente del catálogo.
- Corrección de los bugs de leaderboard ya documentados en `CLAUDE.md`.
- Cambios al layout/CSS de `.crt`, `.crt-screen` o `.player-hud`.

Cada uno de estos, si se necesita, va en su propio spec.
