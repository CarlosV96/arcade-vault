# SPEC 02 — Home (landing) y Acerca de

> **Status:** Implementado
> **Depends on:** SPEC 01
> **Date:** 2026-08-21
> **Objective:** Portar las pantallas Home (landing) y Acerca de del prototipo `references/templates/home-about/` a `/` y `/about`, mover la Biblioteca a `/biblioteca` y actualizar el `Nav` y los enlaces "volver" existentes en consecuencia.

## Why this spec exists

`/` pasa de ser la Biblioteca a ser una landing page nueva (Home). Eso desplaza la Biblioteca a otra ruta y rompe todos los enlaces existentes que asumían que "volver al vault" era `/`. Este spec documenta ese cambio de raíz explícitamente para que no se pierda entre los detalles de las dos pantallas nuevas.

## Scope

**In:**

- `Home` (`components/Home.tsx`) montado en `app/page.tsx` (ruta `/`): hero con eyebrow/título/CTAs y siluetas SVG flotantes decorativas, sección "¿Por qué Arcade Vault?" (4 `feature-card`), sección "Juegos disponibles ahora" (`mini-rail` con los primeros 6 `GAMES` de `lib/data.ts`, navega a `/juegos/[id]`), sección de stats (3 `stat-block`), sección "Actividad en vivo" (ticker de puntuaciones + top 5 jugadores, con arrays estáticos tal cual el prototipo), sección de precios (`price-card` + `pricing-faq`), CTA final. Animación de aparición al hacer scroll (`.reveal`/`.reveal.in`) vía un hook compartido `lib/useReveal.ts`.
- `About` (`components/About.tsx`) montado en `app/about/page.tsx` (ruta `/about`): hero de misión + 3 `highlight`, divisor decorativo animado, formulario de contacto (nombre/correo/mensaje) con validación de "no vacío" (shake si falla), envío que renderiza una transcripción de terminal falsa (`terminal-success`) sin llamada a red ni persistencia — mismo patrón sin-backend que `Auth`. Usa el mismo hook `lib/useReveal.ts`.
- Mover el contenido actual de `app/page.tsx` (que renderiza `Library`) a `app/biblioteca/page.tsx` (ruta `/biblioteca`).
- `components/Nav.tsx`: agregar los enlaces "Inicio" (`/`) y "Acerca de" (`/about`) en el nav de escritorio y en el panel móvil, en el orden Inicio / Biblioteca / Salón de la Fama / Acerca de. `isActive("biblioteca")` pasa a comparar contra `/biblioteca` (más `/juegos/*`) en vez de `/`; se agrega `isActive("home")` para `pathname === "/"` exacto.
- Actualizar los enlaces que hoy apuntan a `/` asumiendo que es la Biblioteca, para que apunten a `/biblioteca`: "VOLVER AL VAULT" en `components/GamePlayer.tsx` y `components/GameDetail.tsx`, "VOLVER A LA BIBLIOTECA" en `components/HallOfFame.tsx`, y el logo del `Nav` sigue apuntando a `/` (ahora Home, correcto).
- `components/Auth.tsx`: los dos `router.push("/")` (login y "jugar como invitado") cambian a `router.push("/biblioteca")`.
- `app/globals.css`: agregar las secciones `HOME PAGE`, `ABOUT PAGE`, `ACTIVITY (leaderboard + ticker)` y `PRICING` del `styles.css` de referencia (líneas ~930–1150 y ~1621–1730 del archivo de referencia).
- `lib/useReveal.ts`: hook `useReveal()` que reemplaza la lógica de `IntersectionObserver` duplicada en `home.jsx` y `about.jsx` del prototipo.

**Out of scope (for future specs):**

- El bloque `GAMEPAD` / `Theme variants` (~470 líneas) del `styles.css` de referencia: controlador virtual on-screen, variantes de tema neon/vapor/cabinet, floaters de puntuación (`score-pop`). No lo usa ni `Home` ni `About`; parece preparación para un futuro rediseño de `GamePlayer`, que sigue siendo un shell sin lógica según SPEC 01.
- Derivar "Actividad en vivo" (ticker y top jugadores) de datos reales (`GAMES`, `seededScores`) — se queda como arrays estáticos, igual que el prototipo.
- Envío real del formulario de contacto (backend, email, guardado en `localStorage`). Sigue siendo una simulación puramente visual, igual que los botones OAuth de `Auth`.
- Convertir la paleta o cualquier clase nueva a tokens `@theme` de Tailwind v4 (ya descartado en SPEC 01, se mantiene el mismo criterio).
- Cualquier cambio a `GameDetail`, `GamePlayer`, `HallOfFame`, `Library` o `Auth` más allá de actualizar los destinos de enlaces/redirects mencionados en el scope.
- Tests automatizados (no hay test runner en este repo).

## Data model

Este feature no introduce estructuras de datos nuevas — reutiliza `GAMES` de `lib/data.ts` (SPEC 01) para la sección "Juegos disponibles ahora" de `Home`.

Único elemento nuevo, un hook sin estado persistente:

```ts
// lib/useReveal.ts
export function useReveal(): void;
// Efecto de cliente: observa todos los .reveal del DOM con IntersectionObserver
// y les agrega la clase "in" al entrar en viewport (una sola vez por elemento).
```

Los arrays estáticos de "Actividad en vivo" (ticker de puntuaciones recientes y top 5 jugadores del día) viven como constantes locales dentro de `components/Home.tsx`, copiados del prototipo sin cambios.

## Implementation plan

1. Mover `app/page.tsx` (hoy `<Library />`) a `app/biblioteca/page.tsx`. Prueba manual: `/biblioteca` muestra la Biblioteca igual que antes; `/` da 404 (temporalmente, hasta el paso 5).
2. Actualizar enlaces existentes que asumían `/` como Biblioteca: `href="/"` → `href="/biblioteca"` en "VOLVER AL VAULT" (`GamePlayer.tsx`, `GameDetail.tsx`) y "VOLVER A LA BIBLIOTECA" (`HallOfFame.tsx`); `router.push("/")` → `router.push("/biblioteca")` en los dos flujos de `Auth.tsx`. Prueba manual: desde `/juegos/[id]`, `/juegos/[id]/jugar` y `/salon`, los botones de volver navegan a `/biblioteca`; iniciar sesión o entrar como invitado en `/auth` navega a `/biblioteca`.
3. Agregar al final de `app/globals.css` las secciones `HOME PAGE`, `ABOUT PAGE`, `ACTIVITY` y `PRICING` copiadas del `styles.css` de referencia (sin el bloque `GAMEPAD`/`Theme variants`). Prueba manual: `npm run build` sigue sin errores (nada las usa todavía, solo se agregan reglas CSS).
4. Crear `lib/useReveal.ts` con el hook `useReveal()`. Prueba manual: `npm run lint` no reporta errores al importarlo.
5. Crear `components/Home.tsx` (incluye `FloatingSilhouettes`, `MiniCard`, `FeatureIcon` como funciones internas del archivo, igual que `GameCard` dentro de `Library.tsx`) y montarlo en un nuevo `app/page.tsx`. Prueba manual: `/` muestra el hero, las 4 secciones de contenido y el CTA final; "EXPLORAR JUEGOS" y "VER TODOS LOS JUEGOS →" navegan a `/biblioteca`; "CREAR CUENTA" y "EMPEZAR GRATIS →" navegan a `/auth`; clic en una `MiniCard` navega a `/juegos/[id]`; "VER SALÓN →" navega a `/salon`; las secciones aparecen con la animación de scroll.
6. Crear `components/About.tsx` (incluye `HighlightIcon` interno) y `app/about/page.tsx`. Prueba manual: `/about` muestra el hero de misión y los 3 highlights; enviar el formulario de contacto vacío hace shake y no envía; completarlo muestra la transcripción de terminal con el nombre en mayúsculas; "ENVIAR OTRO MENSAJE" vuelve al formulario vacío.
7. Actualizar `components/Nav.tsx`: agregar "Inicio" (`/`) y "Acerca de" (`/about`) en el orden Inicio/Biblioteca/Salón de la Fama/Acerca de (escritorio y panel móvil), cambiar `isActive("biblioteca")` para comparar contra `/biblioteca` (+ prefijo `/juegos`), y agregar `isActive("home")` para `pathname === "/"`. Prueba manual: en `/` se resalta "Inicio"; en `/biblioteca` y en cualquier `/juegos/*` se resalta "Biblioteca"; en `/about` se resalta "Acerca de"; en `/salon` se resalta "Salón de la Fama".
8. Pulido final: correr `npm run lint` y `npm run build` hasta que ambos terminen sin errores, y recorrer manualmente las 7 rutas (`/`, `/biblioteca`, `/juegos/[id]`, `/juegos/[id]/jugar`, `/auth`, `/salon`, `/about`).

## Acceptance criteria

- [ ] `npm run build` completa sin errores.
- [ ] `npm run lint` completa sin errores.
- [ ] `/` muestra la landing Home (hero, "¿Por qué Arcade Vault?", "Juegos disponibles ahora", stats, "Actividad en vivo", precios, CTA final), no la Biblioteca.
- [ ] `/biblioteca` muestra la Biblioteca (hero, buscador, chips, grid de 8 juegos) exactamente como antes.
- [ ] Desde `/`, "EXPLORAR JUEGOS" y "VER TODOS LOS JUEGOS →" navegan a `/biblioteca`; "CREAR CUENTA" y "EMPEZAR GRATIS →" navegan a `/auth`; una `MiniCard` navega a `/juegos/[id]`; "VER SALÓN →" navega a `/salon`.
- [ ] `/about` muestra el hero de misión, los 3 highlights, y el formulario de contacto: enviarlo vacío hace shake sin enviar; completarlo muestra la transcripción de terminal con el nombre en mayúsculas y sin escribir nada en `localStorage`.
- [ ] "VOLVER AL VAULT" (`GameDetail`, `GamePlayer`) y "VOLVER A LA BIBLIOTECA" (`HallOfFame`) navegan a `/biblioteca`.
- [ ] Iniciar sesión o entrar como invitado desde `/auth` redirige a `/biblioteca`.
- [ ] El `Nav` resalta "Inicio" en `/`, "Biblioteca" en `/biblioteca` y en cualquier `/juegos/*`, "Acerca de" en `/about`, y "Salón de la Fama" en `/salon`.
- [ ] Las secciones de `/` y `/about` aparecen con animación de fade/slide al hacer scroll (clase `.reveal` → `.reveal.in`).

## Decisions

- **Sí:** mover la Biblioteca a `/biblioteca` en vez de dejarla en `/`. `/` debe ser la nueva Home según el diseño del `Nav` del prototipo (que trata "Inicio" y "Biblioteca" como enlaces distintos).
- **Sí:** ruta `/about` (inglés) para "Acerca de", consistente con la ruta existente `/auth`, en vez de `/acerca-de`.
- **Sí:** actualizar todos los enlaces "volver"/redirect que asumían `/` como Biblioteca (`GamePlayer`, `GameDetail`, `HallOfFame`, `Auth`) para que apunten a `/biblioteca`. Sin este cambio quedarían rotos silenciosamente al mover la Biblioteca.
- **Sí:** login/invitado en `Auth` redirige a `/biblioteca` (no a `/`). Mantiene el comportamiento actual de llevar al jugador directo al catálogo tras loguearse.
- **Sí:** "Actividad en vivo" en Home usa los mismos arrays estáticos hardcodeados del prototipo, sin derivarlos de `GAMES`/`seededScores`. Coincide con el enfoque de datos mock de SPEC 01 y evita sumar una tercera fuente de leaderboard inconsistente (ya hay dos documentadas en `CLAUDE.md`).
- **No:** portar el bloque `GAMEPAD`/`Theme variants` del `styles.css` de referencia. No lo usa ninguna pantalla de este spec; es preparación para un futuro rediseño de `GamePlayer`, fuera de alcance mientras ese componente siga siendo un shell (SPEC 01).
- **Sí:** extraer `lib/useReveal.ts` como hook compartido en vez de duplicar el efecto de `IntersectionObserver` en `Home.tsx` y `About.tsx`. Es exactamente el tipo de duplicación por alias de hooks que `CLAUDE.md` pide eliminar al portar.
- **Sí:** `FloatingSilhouettes`, `MiniCard`, `FeatureIcon` (en `Home.tsx`) y `HighlightIcon` (en `About.tsx`) como funciones internas del mismo archivo, igual que `GameCard` dentro de `Library.tsx` en SPEC 01.
- **No:** persistir ni enviar de verdad el formulario de contacto. No hay backend en este repo; se mantiene como simulación visual, igual que los botones OAuth decorativos de `Auth`.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Mover `/` de Biblioteca a Home rompe enlaces existentes que asumían `/` como catálogo | Paso 2 del plan actualiza explícitamente los 4 lugares conocidos (`GamePlayer`, `GameDetail`, `HallOfFame`, `Auth`) antes de crear la nueva Home, y el paso 8 recorre las 7 rutas manualmente. |
| El bloque `GAMEPAD`/`Theme variants` del `styles.css` de referencia podría copiarse por error junto con las secciones necesarias, si alguien copia el archivo completo en vez de las secciones indicadas | El paso 3 del plan nombra exactamente las 4 secciones a copiar (`HOME PAGE`, `ABOUT PAGE`, `ACTIVITY`, `PRICING`) y excluye el resto. |
| `useReveal()` accede a `document.querySelectorAll` — si se ejecutara en render de servidor, rompería | El hook vive detrás de `"use client"` en `Home.tsx`/`About.tsx` y solo corre dentro de `useEffect`, igual que el resto de componentes con `localStorage` en SPEC 01. |

## What is **not** in this spec

- El bloque `GAMEPAD`/`Theme variants` (controlador virtual, temas neon/vapor/cabinet, score floaters) del `styles.css` de referencia.
- Datos reales para "Actividad en vivo" en Home (sigue siendo mock estático).
- Envío real del formulario de contacto de `About` (backend, email, persistencia).
- Cambios funcionales a `Library`, `GameDetail`, `GamePlayer`, `HallOfFame` o `Auth` más allá de los enlaces/redirects señalados.
- Tokens `@theme` de Tailwind v4 para las clases nuevas.
- Tests automatizados.

Cada uno de estos, si se necesita, va en su propio spec.
