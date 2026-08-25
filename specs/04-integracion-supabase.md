# SPEC 04 — Integración base de Supabase con el proyecto Next.js

> **Status:** Aprobado
> **Depends on:** SPEC 01
> **Date:** 2026-08-25
> **Objective:** Conectar el proyecto Next.js a la instancia de Supabase ya vinculada vía MCP (`project_ref gxefrfheaoijzllcpmek`), instalando el SDK oficial y creando los clientes de navegador y de servidor con `@supabase/ssr`, sin crear tablas ni implementar autenticación todavía.

## Why this spec exists

El proyecto ya tiene un servidor MCP de Supabase conectado (`.mcp.json`) y una variable `SUPABASE_DB_PASSWORD` pendiente en `.env.template` de un commit previo, pero el código de la app (`app/`, `components/`, `lib/`) todavía no importa el SDK de Supabase en ningún lado. Este spec cierra esa brecha con la integración mínima y reusable — sin construir encima ninguna feature (auth, scores, realtime, edge functions) — para que los specs futuros que sí las construyan partan de una base ya conectada y verificada.

## Scope

**In:**

- Dependencias `@supabase/ssr` y `@supabase/supabase-js` agregadas a `package.json`/`package-lock.json`.
- `.env.template`: se agregan `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` como placeholders vacíos, igual que el resto de variables del archivo (`RESEND_API_KEY`, `SUPABASE_DB_PASSWORD`). `.env.local` (no versionado) sí lleva los valores reales del proyecto conectado (`https://gxefrfheaoijzllcpmek.supabase.co` y la publishable key `sb_publishable_...`).
- `lib/supabase/client.ts`: `createClient()` que instancia un cliente de navegador (`createBrowserClient` de `@supabase/ssr`), para usar desde Client Components.
- `lib/supabase/server.ts`: `createClient()` async que instancia un cliente de servidor (`createServerClient` de `@supabase/ssr`, leyendo/escribiendo cookies vía `next/headers`), para usar desde Server Components y Route Handlers.
- `app/api/supabase-health/route.ts`: Route Handler `GET` que usa el cliente de servidor para confirmar que la conexión al proyecto Supabase funciona de verdad, sin depender de ninguna tabla real (ver Data model).

**Out of scope (for future specs):**

- Cualquier tabla en la base de datos (`profiles`, `scores`, `games`, etc.).
- Autenticación real (signup/login/logout vía Supabase Auth) — `components/Auth.tsx` y `lib/session.tsx` siguen siendo la simulación actual (`localStorage["av_user"]`), sin cambios.
- `middleware.ts` para refrescar la sesión de auth — no aplica todavía porque no hay sesión que mantener; se agrega junto con el spec de autenticación real.
- Persistencia real de puntuaciones/leaderboard (`GamePlayer`, `GameDetail`, `HallOfFame`) — siguen igual (`localStorage` write-only / `seededScores` mock), según los bugs documentados en `CLAUDE.md`.
- Realtime y Edge Functions — mencionados por el usuario como uso futuro; van en sus propios specs cuando se implementen.
- Providers OAuth (Google/GitHub) — los botones de `Auth.tsx` siguen decorativos.
- Loop de juego real en `GamePlayer` (`SCORE` dinámico) — bug conocido documentado en `CLAUDE.md`, no se toca en este spec.
- Supabase CLI local / carpeta `supabase/migrations` — las migraciones futuras se aplican con las herramientas MCP ya conectadas (`mcp__supabase__apply_migration`), no con CLI local. `SUPABASE_DB_PASSWORD` (ya declarada en `.env.template` de un commit previo) queda sin uso por ahora.

## Data model

Este spec no introduce tablas ni datos persistentes. Único elemento nuevo, el contrato del endpoint de verificación:

```ts
// app/api/supabase-health/route.ts
// GET /api/supabase-health
// Response 200: { ok: true }
// Response 500: { ok: false; error: string }
```

## Implementation plan

1. Instalar dependencias: `npm install @supabase/ssr @supabase/supabase-js`. Prueba manual: `package.json` y `package-lock.json` quedan actualizados; `npm run build` sigue sin errores.
2. Agregar `NEXT_PUBLIC_SUPABASE_URL=` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=` vacías a `.env.template`, y completar esas dos variables con los valores reales en `.env.local` (no versionado, cubierto por `.gitignore`). Prueba manual: `npm run dev` arranca y `process.env.NEXT_PUBLIC_SUPABASE_URL` está disponible en el navegador.
3. Crear `lib/supabase/client.ts` con `createClient()` (`createBrowserClient` de `@supabase/ssr`). Prueba manual: el archivo compila sin errores de tipos.
4. Crear `lib/supabase/server.ts` con `createClient()` async (`createServerClient` de `@supabase/ssr`, cookies de `next/headers`). Prueba manual: `npm run build` compila sin errores de tipos.
5. Crear `app/api/supabase-health/route.ts` (`GET`): usa el cliente de servidor para consultar una tabla inexistente (ej. `select("id").from("_health_check").limit(1)`) y devuelve `{ ok: true }` si el error recibido es `PGRST205` (PostgREST no encontró la tabla en su schema cache — prueba que la conexión llegó hasta el proyecto), o `{ ok: false, error }` en cualquier otro caso (URL/clave inválida, sin red, etc.). Prueba manual: con `npm run dev` corriendo, `GET http://localhost:3000/api/supabase-health` devuelve `{ ok: true }`.
6. Pulido final: `npm run lint` y `npm run build` sin errores.

## Acceptance criteria

- [ ] `npm run build` completa sin errores.
- [ ] `npm run lint` completa sin errores.
- [ ] `@supabase/ssr` y `@supabase/supabase-js` aparecen en `package.json` y `package-lock.json`.
- [ ] `.env.template` contiene `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` como placeholders vacíos, y `.env.local` los tiene completados con los valores reales del proyecto conectado.
- [ ] `lib/supabase/client.ts` exporta una función que instancia un cliente de Supabase válido para Client Components.
- [ ] `lib/supabase/server.ts` exporta una función async que instancia un cliente de Supabase válido para Server Components/Route Handlers, usando cookies de `next/headers`.
- [ ] `GET /api/supabase-health` devuelve `{ ok: true }` cuando el proyecto es accesible con las credenciales de `.env.local`.
- [ ] Ningún componente existente (`Auth`, `Library`, `GameDetail`, `GamePlayer`, `HallOfFame`) cambia su comportamiento — siguen usando `localStorage`/mock exactamente igual que antes de este spec.
- [ ] No se crea ninguna tabla en la base de datos del proyecto Supabase.

## Decisions

- **Sí:** usar `@supabase/ssr` en vez de solo `@supabase/supabase-js`, aunque este spec no implementa auth todavía. Es el paquete que Next.js App Router necesita para manejar cookies correctamente en cuanto se agregue auth; evita una migración de paquete en un spec futuro.
- **Sí:** crear el cliente de navegador y el de servidor en el mismo spec, aunque por ahora solo el health-check los usa. Deja la base lista para las features futuras que el usuario ya mencionó (auth, scores, realtime, edge functions).
- **No:** completar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` con los valores reales en `.env.template`. Aunque son valores públicos por diseño (se exponen igual en el bundle del navegador), durante la implementación el usuario decidió mantener `.env.template` solo como referencia de las claves esperadas, sin valores reales — igual tratamiento que `RESEND_API_KEY`. Los valores reales quedan únicamente en `.env.local`, no versionado.
- **Sí:** usar la publishable key moderna (`sb_publishable_...`) en vez de la legacy anon key JWT. Supabase la recomienda para proyectos nuevos por rotación independiente; la legacy sigue disponible si hiciera falta.
- **Sí:** verificar la conexión consultando una tabla inexistente en vez de crear una tabla real solo para el health-check. Confirma que la URL/clave llegan de verdad hasta Postgres sin violar "no crear tablas todavía".
- **No:** `middleware.ts` para refrescar sesión. No hay sesión de auth que mantener en este spec; se agrega junto con el spec de autenticación real.
- **No:** Supabase CLI local ni carpeta `supabase/migrations`. El proyecto ya está conectado vía MCP; las migraciones futuras se aplican con las herramientas MCP ya disponibles, sin duplicar el flujo con un CLI local.
- **No:** tocar `Auth.tsx`, `lib/session.tsx`, `GamePlayer.tsx`, `GameDetail.tsx` o `HallOfFame.tsx`. Quedan exactamente igual hasta que existan specs de autenticación y de puntuaciones reales.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| El código de error usado para detectar "tabla inexistente" (`42P01`, el código crudo de Postgres) no es el que realmente devuelve la API REST de Supabase | PostgREST devuelve su propio código (`PGRST205`, "tabla no encontrada en el schema cache") en vez de `42P01`. Se confirmó contra el proyecto real durante la implementación y se ajustó `app/api/supabase-health/route.ts` para verificar `PGRST205`. |
| Un spec futuro de autenticación necesita el manejo de cookies de `@supabase/ssr` que este spec crea pero no ejercita en un flujo real de usuario | El Route Handler de health-check sí ejercita `lib/supabase/server.ts` end-to-end (incluyendo el manejo de cookies), confirmando que el patrón funciona antes de construir auth encima. |

## What is **not** in this spec

- Tablas en la base de datos (`profiles`, `scores`, `games`, etc.).
- Autenticación real con Supabase Auth.
- `middleware.ts` de refresco de sesión.
- Persistencia real de puntuaciones/leaderboard.
- Realtime y Edge Functions.
- Providers OAuth (Google/GitHub).
- Loop de juego real en `GamePlayer`.
- Supabase CLI local / carpeta `supabase/migrations`.

Cada uno de estos, si se necesita, va en su propio spec.
