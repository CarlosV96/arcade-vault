# SPEC 01 — MVP visual de Arcade Vault (pantallas sin lógica de juego)

> **Status:** Aprobado
> **Depends on:** Ninguno
> **Date:** 2026-08-04
> **Objective:** Portar las 5 pantallas del prototipo (Biblioteca, Detalle de juego, GamePlayer, Auth, Salón de la Fama) a rutas reales de Next.js App Router como componentes cliente, con estilos y datos migrados, sin implementar la lógica de ningún juego.

## Scope

**In:**

- Layout raíz (`app/layout.tsx`) con fuentes `next/font/google` (Press Start 2P, Courier Prime, JetBrains Mono) reemplazando Geist, `<div class="av-bg">` / `<div class="av-noise">` antes del contenido, `lang="es"`, metadata actualizada.
- 5 rutas de App Router según el mapeo de `CLAUDE.md`: `/` (Library), `/juegos/[id]` (GameDetail), `/juegos/[id]/jugar` (GamePlayer), `/auth` (Auth), `/salon` (HallOfFame).
- Componentes cliente (`"use client"`) en `components/`: `Nav`, `Library` (+ `GameCard`), `GameDetail`, `GamePlayer`, `Auth`, `HallOfFame`.
- `lib/data.ts`: `GAMES`, `CATS`, `PLAYERS`, `seededScores` portados a TypeScript con tipos `Game` y `ScoreRow`.
- `lib/session.tsx`: `SessionProvider` + hook `useSession()`, respaldado por `localStorage["av_user"]`, para compartir el usuario logueado entre el `Nav` (en el layout) y las páginas (rutas independientes de App Router).
- `lib/scores.ts`: `saveScore(entry)` que escribe en `localStorage["av_scores"]` (write-only, igual que el prototipo — nada la vuelve a leer).
- `GamePlayer` como **shell interactivo sin simulación**: HUD fijo (puntaje 0, vidas 3, nivel 1), botones PAUSA/FIN/SALIR funcionales, overlay de pausa, modal de fin de partida con input de iniciales y guardado de puntuación. Sin `setInterval` que sume puntaje ni lógica de subida de nivel.
- `app/globals.css` con el sistema de diseño de `styles.css` portado como CSS plano (paleta oscura como custom properties), sin convertirlo a tokens `@theme` de Tailwind.
- Formulario de `Auth` sin validación de campos (igual que el prototipo): cualquier input, incluso vacío, permite entrar; login como invitado sigue serializando `null` a `"null"` en `localStorage`.
- Resaltado de navegación activa en `Nav` usando `usePathname()` (equivalente al `isActive()` del prototipo, incluyendo que `/juegos/*` resalta "Biblioteca").

**Out of scope (for future specs):**

- Lógica real de juego para cualquiera de los 8 juegos (canvas, game loop, colisiones, etc.).
- Arreglar las inconsistencias de datos ya documentadas en `CLAUDE.md`: `game.best` no coincide con el leaderboard generado, `detalle.jsx` y `salon.jsx` generan leaderboards distintos para el mismo juego, login invitado indistinguible de deslogueado.
- Leer de vuelta `localStorage["av_scores"]` para mostrarlo en el Salón de la Fama (sigue siendo write-only, tal como hoy).
- Autenticación real / backend (los botones de Google/GitHub en `Auth` son decorativos, sin OAuth).
- Validación de formularios en `Auth`.
- Tests automatizados (no hay test runner en este repo).
- Convertir la paleta de `styles.css` a tokens `@theme` de Tailwind v4.
- Auditoría de accesibilidad o breakpoints responsive más allá de los que ya trae el prototipo.

## Data model

```ts
// lib/data.ts
export type Category = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

export interface Game {
  id: string; // kebab-case slug
  title: string;
  short: string;
  long: string;
  cat: Category;
  cover: string; // nombre de clase CSS (ej. "cover-bricks"), NO una ruta de imagen
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;
  plays: string; // string pre-formateado, ej. "12.4K" — no un number
}

export const GAMES: Game[]; // los 8 juegos del prototipo
export const CATS: ("TODOS" | Category)[];
export const PLAYERS: string[]; // nombres usados por seededScores

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // "DD/MM/2026"
}

export function seededScores(seed: number, count?: number): ScoreRow[];
```

```ts
// lib/session.tsx
export interface SessionUser {
  name: string; // MAYÚSCULAS, máx. 10 caracteres
}
// SessionProvider envuelve {children} en app/layout.tsx
// useSession() => { user: SessionUser | null, login(user), logout() }
// Persiste en localStorage["av_user"]
```

```ts
// lib/scores.ts
export interface ScoreEntry {
  game: string; // Game.id
  score: number;
  name: string;
}
export function saveScore(entry: ScoreEntry): void;
// Escribe { ...entry, at: <timestamp> } en localStorage["av_scores"]
```

Convenciones:

- Todo lo que toque `localStorage` vive en un Client Component e inicializa el estado dentro de `useEffect` o un inicializador perezoso de `useState` — nunca a nivel de módulo, para evitar acceso a `localStorage` durante el render en servidor.
- Los textos de la interfaz siguen en español; nombres de componentes y props en inglés, como ya establece `CLAUDE.md`.

## Implementation plan

1. Configurar `app/layout.tsx`: fuentes vía `next/font/google` (Press Start 2P, Courier Prime, JetBrains Mono) reemplazando Geist, `lang="es"`, metadata del título/descripción, y los divs `.av-bg` / `.av-noise` antes de `{children}`. Prueba manual: `npm run dev`, la página por defecto de Next carga sin errores en consola con las fuentes y los divs de fondo presentes.
2. Portar `styles.css` a `app/globals.css` (paleta oscura como custom properties, ajustando solo lo necesario para Next). Prueba manual: el fondo neón oscuro se ve detrás del contenido por defecto de Next.
3. Crear `lib/data.ts` con `GAMES`, `CATS`, `PLAYERS`, `seededScores` y los tipos `Game`/`ScoreRow`. Prueba manual: `npm run lint` no reporta errores de tipos al importar el archivo.
4. Crear `lib/session.tsx` (`SessionProvider` + `useSession`) y `lib/scores.ts` (`saveScore`), y envolver `SessionProvider` alrededor de `{children}` en `app/layout.tsx`. Prueba manual: el servidor de desarrollo sigue renderizando sin errores en consola.
5. Portar `Nav` a `components/Nav.tsx` usando `useSession()` y `usePathname()`/`Link`, y montarlo en `app/layout.tsx` entre los divs de fondo y `<main>`. Prueba manual: el header se ve con logo, links, contador de créditos y botón de login; el link a `/` funciona.
6. Portar `Library` + `GameCard` a `components/Library.tsx` y usarlo en `app/page.tsx`. Prueba manual: `/` muestra el hero, buscador, chips de categoría y grid de 8 juegos; filtrar y buscar actualiza el grid.
7. Portar `GameDetail` a `components/GameDetail.tsx` y crear `app/juegos/[id]/page.tsx` (usa `notFound()` si el `id` no existe en `GAMES`). Prueba manual: clic en una tarjeta desde `/` navega a `/juegos/[id]` mostrando info del juego y un leaderboard de 10 filas; "VOLVER AL VAULT" regresa a `/`.
8. Portar `GamePlayer` (shell interactivo sin simulación) a `components/GamePlayer.tsx` y crear `app/juegos/[id]/jugar/page.tsx`. Prueba manual: "JUGAR AHORA" navega aquí; PAUSA muestra el overlay "EN PAUSA"; FIN abre el modal, guardar puntuación escribe en `localStorage["av_scores"]` y muestra "PUNTUACIÓN GUARDADA"; "JUGAR DE NUEVO" resetea el HUD a 0/3/1; "VOLVER AL VAULT" navega a `/juegos/[id]`.
9. Portar `Auth` a `components/Auth.tsx` y crear `app/auth/page.tsx`. Prueba manual: las pestañas cambian entre iniciar sesión/crear cuenta; enviar cualquiera de los dos formularios (o "JUGAR COMO INVITADO") inicia sesión vía `useSession()` y navega a `/`; el `Nav` refleja el nombre de usuario y al hacer clic cierra sesión.
10. Portar `HallOfFame` a `components/HallOfFame.tsx` y crear `app/salon/page.tsx`. Prueba manual: las pestañas por juego cambian el leaderboard; podio y tabla se ven con 12 filas; con sesión iniciada aparece la fila "TU MEJOR MARCA"; "VOLVER A LA BIBLIOTECA" regresa a `/`.
11. Pulido final: confirmar que `Nav` resalta "Biblioteca" también en `/juegos/*`, correr `npm run lint` y `npm run build` hasta que ambos terminen sin errores, y recorrer manualmente las 5 pantallas.

## Acceptance criteria

- [X] `npm run build` completa sin errores.
- [X] `npm run lint` completa sin errores.
- [X] `/` muestra el hero, buscador, chips de categoría y grid de 8 juegos; filtrar por categoría y buscar por texto actualiza el grid mostrado.
- [X] Clic en una tarjeta de juego navega a `/juegos/[id]` y muestra título, descripción larga, stats (partidas, mejor global, dificultad) y un leaderboard de 10 filas.
- [x] Desde `/juegos/[id]`, "JUGAR AHORA" navega a `/juegos/[id]/jugar` mostrando el HUD (puntaje 0, vidas 3, nivel 1) y la pantalla CRT.
- [X] En `/juegos/[id]/jugar`, pulsar PAUSA muestra el overlay "EN PAUSA"; pulsar FIN abre el modal de fin de partida.
- [X] Guardar una puntuación en el modal de fin de partida escribe una entrada en `localStorage["av_scores"]` y muestra el aviso "PUNTUACIÓN GUARDADA".
- [X] `/auth` permite iniciar sesión o jugar como invitado sin validación de campos, y redirige a `/` tras el envío.
- [X] Tras iniciar sesión, el `Nav` muestra el nombre de usuario (máx. 10 caracteres, mayúsculas) en vez del botón "Iniciar Sesión", y esto persiste tras recargar la página.
- [X] `/salon` muestra podio (top 3), tabla con 12 filas del juego seleccionado en las pestañas, y una fila adicional "TU MEJOR MARCA" cuando hay sesión iniciada.
- [X] Las fuentes Press Start 2P, Courier Prime y JetBrains Mono se cargan vía `next/font/google` (no vía `<link>` de Google Fonts).
- [X] El fondo (`.av-bg`, `.av-noise`) se ve detrás del contenido en las 5 pantallas, nunca oculto detrás del contenido principal.

## Decisions

- **Sí:** `GamePlayer` como shell interactivo sin simulación de puntaje (sin `setInterval`, sin lógica de nivel). Es la lectura más literal de "no implementar ningún juego", manteniendo la pantalla demostrable.
- **No:** portar la simulación falsa del prototipo (`setInterval` que suma puntos, subida de nivel). Es lo más parecido a "un juego" que tiene el prototipo, así que queda excluido aunque sea simple.
- **Sí:** el HUD arranca y permanece en puntaje 0 / vidas 3 / nivel 1 hasta pulsar FIN. Estado inicial limpio y consistente, sin inventar una captura a medio jugar.
- **Sí:** sesión persistida en `localStorage["av_user"]` a través de un `SessionProvider` de contexto. Reutiliza el comportamiento del prototipo; es necesario porque en el App Router el `Nav` (en el layout) y las páginas de ruta son componentes separados que necesitan compartir este estado.
- **Sí:** el guardado de puntuación escribe en `localStorage["av_scores"]`, write-only, igual que el bug conocido del prototipo. Arreglar el lado de lectura es trabajo no implementado, explícitamente fuera de alcance.
- **No:** arreglar las inconsistencias de datos conocidas (`best` vs. leaderboard, semillas distintas entre `detalle`/`salon`, colisión invitado/deslogueado). Son bugs de datos mock, se difieren a un spec futuro para que este MVP se mantenga enfocado en las pantallas.
- **Sí:** `styles.css` portado como CSS plano en `app/globals.css`, con la paleta oscura como custom properties. Evita una reescritura grande y riesgosa a tokens `@theme` de Tailwind v4 para un MVP.
- **No:** convertir la paleta a tokens `@theme` de Tailwind ahora. Mayor esfuerzo, mayor riesgo de desviar el look del prototipo, sin beneficio funcional para este spec.
- **Sí:** `lib/data.ts` como archivo único con `GAMES`/`CATS`/`PLAYERS`/`seededScores` tipados. Coincide con el modelo de entidad `Game` ya documentado en `CLAUDE.md`.
- **Sí:** formulario de `Auth` sin validación en cliente, igual que el prototipo. No hay backend contra el cual validar todavía.
- **Sí:** rutas de archivo de Next.js App Router reemplazan el router por hash de `app.jsx`. El App Router ya da rutas reales según la tabla sugerida en `CLAUDE.md`.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Acceso a `localStorage` durante el render en servidor (las páginas de App Router renderizan primero en servidor) | Todo componente que toque `localStorage` (`SessionProvider`, `saveScore`) es un Client Component y lee/escribe solo dentro de `useEffect` o un inicializador perezoso, nunca a nivel de módulo. |
| El preflight/reset de Tailwind choca visualmente con las ~950 líneas portadas de `styles.css` | Verificar visualmente cada pantalla después del paso 2 (port de `styles.css`) antes de seguir construyendo las pantallas restantes. |
| Alguna de las 3 fuentes (Press Start 2P, Courier Prime, JetBrains Mono) falla al cargar vía `next/font/google` | Confirmar que las 3 cargan en `npm run dev` antes del build final del paso 11. |

## What is **not** in this spec

- Lógica real de juego para cualquiera de los 8 juegos (canvas, game loop, colisiones).
- Arreglar las inconsistencias de datos mock ya documentadas en `CLAUDE.md`.
- Leer de vuelta `localStorage["av_scores"]` en el Salón de la Fama.
- Autenticación real / backend / OAuth.
- Validación de formularios en `Auth`.
- Tests automatizados.
- Tokens `@theme` de Tailwind v4 para la paleta.

Cada uno de estos, si se necesita, va en su propio spec.
