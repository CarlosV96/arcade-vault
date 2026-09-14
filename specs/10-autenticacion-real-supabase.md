# SPEC 10 — Autenticación real con Supabase Auth

> **Status:** Aprobado
> **Depends on:** SPEC 04
> **Date:** 2026-09-14
> **Objective:** Reemplazar la simulación de `components/Auth.tsx` (`localStorage["av_user"]`) por registro, login, logout, OAuth (Google/GitHub) y recuperación de contraseña reales usando Supabase Auth, integrados en `lib/session.tsx`.

## Why this spec exists

SPEC 04 conectó el proyecto a Supabase (`lib/supabase/client.ts`, `lib/supabase/server.ts`) pero dejó la autenticación explícitamente fuera de alcance ("Autenticación real... `components/Auth.tsx` y `lib/session.tsx` siguen siendo la simulación actual, sin cambios" y "`middleware.ts` para refrescar la sesión de auth — no aplica todavía... se agrega junto con el spec de autenticación real"). Este es ese spec: usa la base de clientes ya creada, sin modificarla, y construye encima el flujo real de cuentas.

## Scope

**In:**

- Registro con email + contraseña vía `supabase.auth.signUp`, guardando el nombre de usuario en `options.data.username` (sin tabla `profiles` — vive en `user_metadata` de `auth.users`).
- Login con email + contraseña vía `supabase.auth.signInWithPassword`.
- Logout real vía `supabase.auth.signOut()`, disparado desde el botón que ya existe en `components/Nav.tsx`.
- Login con OAuth (Google y GitHub) vía `supabase.auth.signInWithOAuth`, con `app/auth/callback/route.ts` (nuevo Route Handler) que intercambia el código por sesión (`exchangeCodeForSession`) y redirige a `/biblioteca` (o a `?next=` si viene indicado).
- Recuperación de contraseña: enlace "¿Olvidaste tu contraseña?" en la pestaña de login que pide el email y llama a `supabase.auth.resetPasswordForEmail`; nueva ruta `app/auth/actualizar-contrasena/page.tsx` con un formulario de nueva contraseña que llama a `supabase.auth.updateUser({ password })` una vez Supabase redirige ahí tras el enlace del correo.
- Auto-confirmación de email activa (sin paso de "revisa tu correo" antes de poder loguear tras registrarse) — requiere que "Confirm email" esté desactivado en el proyecto de Supabase (paso manual de configuración, ver Risks).
- `middleware.ts` en la raíz + `lib/supabase/middleware.ts` (helper `updateSession`), siguiendo el patrón estándar de `@supabase/ssr`, para refrescar la cookie de sesión en cada request.
- Reescritura de `lib/session.tsx`: `SessionProvider` hidrata `user` desde la sesión real de Supabase (`getSession()` + `onAuthStateChange`) cuando existe, y cae al comportamiento actual de `localStorage["av_user"]` cuando no (modo invitado). `SessionUser` gana un campo `email: string | null`.
- Reescritura de `components/Auth.tsx`: mismo layout visual (card, tabs "INICIAR SESIÓN"/"CREAR CUENTA", botón de invitado, botones sociales), ahora conectado a las llamadas reales de arriba, con estados de carga y de error inline, y el enlace de recuperación de contraseña dentro de la pestaña de login.
- Ajuste mínimo en `components/Nav.tsx`: el `onClick` del botón de logout pasa a invocar la versión async de `logout()`.
- Nombre de usuario (`username`) se sigue normalizando en mayúsculas y truncado a 10 caracteres, igual que hoy — tanto en el registro como al derivar el nombre para cuentas de OAuth (ver Data model).

**Out of scope (for future specs):**

- Tabla `profiles` en Supabase — el username vive en `user_metadata`, sin unicidad garantizada (dos cuentas pueden tener el mismo nombre para mostrar).
- Verificación de unicidad de username.
- Pantalla de edición de perfil (cambiar username, email o contraseña desde una cuenta ya logueada, fuera del flujo de recuperación).
- Rutas o contenido protegido por sesión — `/biblioteca`, `/juegos/*` y `/salon` siguen siendo accesibles sin login, exactamente igual que hoy con el modo invitado.
- Confirmación de email obligatoria antes de loguear.
- Providers OAuth adicionales a Google y GitHub.
- Vincular puntuaciones ya guardadas en modo invitado (`localStorage.av_scores`) a una cuenta real tras loguear — no hay migración de datos entre modos.
- Cambios a `lib/scores.ts` (`saveScore`/`saveRealScore`) — ambas funciones siguen recibiendo `name` como string libre, sin relación forzada con la cuenta autenticada.
- Cambios de comportamiento en `components/GamePlayer.tsx` más allá de qué valor prellena el campo de nombre — sigue siendo editable por el jugador antes de guardar.
- Corregir el bug conocido de `localStorage["av_user"]` guardando la cadena `"null"` para invitado (documentado en `CLAUDE.md`, Known bugs) — el modo invitado se mantiene igual, deliberadamente.
- Habilitar los providers Google/GitHub en el dashboard de Supabase — es un paso de configuración manual fuera del código (ver Risks), no algo que `/spec-impl` pueda automatizar.

## Data model

Este spec no crea tablas nuevas. Reutiliza `auth.users` (gestionada por Supabase Auth) y le agrega metadata de aplicación:

```ts
// user_metadata en auth.users, seteado en signUp() y derivado para OAuth
interface AppUserMetadata {
  username: string; // mayúsculas, máx. 10 chars — mismo formato que el resto del catálogo
}
```

```ts
// lib/session.tsx
export interface SessionUser {
  name: string; // username normalizado, o "INVITADO" resuelto en los componentes que lo usan
  email: string | null; // null para modo invitado
}
```

Convenciones:

- Cuentas por email/contraseña: `name` viene de `user_metadata.username` capturado en el formulario de registro.
- Cuentas por OAuth (sin username propio del formulario): `name` se deriva, en este orden, de `user_metadata.full_name`, `user_metadata.name`, o el prefijo del email antes de `@`; siempre normalizado a mayúsculas y truncado a 10 caracteres, igual que el resto de la app.
- Modo invitado: sin cambios — `login(null)` sigue guardando la cadena `"null"` en `localStorage["av_user"]` (bug conocido, no se toca).

## Implementation plan

1. Crear `lib/supabase/middleware.ts` con la función `updateSession(request)` (patrón estándar de `@supabase/ssr`: crea un cliente de servidor con las cookies del request/response, llama a `supabase.auth.getUser()` para refrescar el token). Crear `middleware.ts` en la raíz que la invoca, con `matcher` excluyendo `_next/static`, `_next/image`, y archivos con extensión de asset. Prueba manual: `npm run dev` sigue arrancando y navegando por el sitio sin errores en consola ni en la terminal del servidor.
2. Reescribir `lib/session.tsx`: al montar, intenta `supabase.auth.getSession()`; si hay sesión real, deriva `SessionUser` como en Data model y la usa. Si no, cae al `localStorage["av_user"]` actual. Se suscribe a `supabase.auth.onAuthStateChange` para mantener `user` sincronizado. `logout()` pasa a ser async: si hay sesión real llama a `supabase.auth.signOut()`, y siempre limpia el estado/localStorage de invitado. `login()` se mantiene igual (solo la usa el flujo de invitado ahora). Prueba manual: la app compila y renderiza sin errores; el modo invitado (`login(null)` desde el botón "JUGAR COMO INVITADO") sigue funcionando exactamente igual que antes.
3. Actualizar `components/Nav.tsx` para invocar la versión async de `logout()` en el botón existente. Prueba manual: logueado con una cuenta real, el botón cierra sesión y vuelve a mostrar "Iniciar Sesión".
4. Reescribir la pestaña de login y registro en `components/Auth.tsx` para llamar a `supabase.auth.signInWithPassword` / `supabase.auth.signUp` (con `options.data.username`), agregando el campo de email también en login, estados de carga (botón deshabilitado + texto "ENVIANDO...") y mensajes de error inline (credenciales inválidas, email ya registrado, contraseña débil, error genérico de red). Al tener éxito, redirige a `/biblioteca` igual que hoy. Prueba manual: registrar una cuenta nueva entra directo (sin confirmación de email) a `/biblioteca`; loguear con esa cuenta funciona; loguear con contraseña incorrecta muestra el error inline sin recargar la página.
5. Conectar los botones "GOOGLE"/"GITHUB" de `components/Auth.tsx` a `supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${location.origin}/auth/callback` } })`. Crear `app/auth/callback/route.ts` (`GET`) que lee `code` de la query, llama a `supabase.auth.exchangeCodeForSession(code)` con el cliente de servidor, y redirige a `next` (query opcional) o `/biblioteca` por defecto. Prueba manual (requiere el paso manual de configuración del Risk correspondiente ya hecho): pulsar "GOOGLE" o "GITHUB" redirige al proveedor y, tras autorizar, vuelve logueado a `/biblioteca`.
6. Agregar el enlace "¿Olvidaste tu contraseña?" en la pestaña de login de `components/Auth.tsx`, que despliega un campo de email y llama a `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/auth/callback?next=/auth/actualizar-contrasena` })`, mostrando un mensaje de confirmación ("Revisa tu correo"). Prueba manual: pedir el reset no lanza error de consola y muestra el mensaje de confirmación.
7. Crear `app/auth/actualizar-contrasena/page.tsx` y su componente cliente (formulario de nueva contraseña + confirmación) que llama a `supabase.auth.updateUser({ password })` y redirige a `/biblioteca` al terminar. Prueba manual: siguiendo el enlace de un correo de recuperación real, se puede fijar una contraseña nueva y loguear con ella después.
8. Prueba manual de punta a punta: registro, logout, login, cerrar y volver a abrir el navegador (la sesión persiste), recuperación de contraseña completa, login con Google, login con GitHub, y modo invitado (sigue funcionando sin tocar Supabase). Confirmar que `GamePlayer.tsx` prellena el nombre de sesión real (o "INVITADO") sin cambios de código adicionales.
9. Pulido final: `npm run lint` y `npm run build` sin errores.

## Acceptance criteria

- [ ] `npm run build` completa sin errores.
- [ ] `npm run lint` completa sin errores.
- [ ] Registrarse con email + usuario + contraseña crea la cuenta y deja al usuario logueado de inmediato en `/biblioteca`, sin paso de confirmación de email.
- [ ] Intentar registrarse con un email ya usado muestra un error inline, sin romper el formulario.
- [ ] Loguear con email + contraseña correctos redirige a `/biblioteca` y `Nav` muestra el nombre de usuario.
- [ ] Loguear con contraseña incorrecta muestra "Usuario o contraseña incorrectos" (o equivalente) sin recargar la página.
- [ ] El botón de logout en `Nav` cierra la sesión real (`supabase.auth.signOut()`) y vuelve a mostrar "Iniciar Sesión".
- [ ] Recargar la página (F5) tras loguearse mantiene la sesión iniciada (no vuelve a pedir login).
- [ ] Pulsar "GOOGLE" inicia el flujo OAuth de Google y, tras autorizar, vuelve logueado a `/biblioteca` con un nombre derivado del perfil de Google.
- [ ] Pulsar "GITHUB" inicia el flujo OAuth de GitHub y, tras autorizar, vuelve logueado a `/biblioteca` con un nombre derivado del perfil de GitHub.
- [ ] "¿Olvidaste tu contraseña?" envía el correo de recuperación y muestra un mensaje de confirmación en la UI.
- [ ] Seguir el enlace del correo de recuperación permite fijar una nueva contraseña en `/auth/actualizar-contrasena`, y loguear después con la nueva contraseña funciona.
- [ ] "JUGAR COMO INVITADO" sigue funcionando exactamente igual que antes (sin tocar Supabase, mismo comportamiento de `localStorage`).
- [ ] Al terminar una partida real logueado, el modal de fin de juego prellena el nombre con el username de la cuenta (no "INVITADO"), y sigue siendo editable antes de guardar.
- [ ] Ninguna ruta existente (`/biblioteca`, `/juegos/*`, `/salon`, `/about`) exige sesión iniciada para verse o jugarse.

## Decisions

- **Sí:** email + contraseña como identificador de autenticación en ambas pestañas (login y registro), en vez de intentar loguear solo con "Usuario". Es el modelo nativo de Supabase Auth; resolver username→email requeriría una consulta con service role fuera del patrón estándar.
- **No:** tabla `profiles`. El username vive en `user_metadata`, evitando una tabla adicional con RLS propia cuando no hay ningún otro dato de perfil que guardar todavía.
- **No:** verificación de unicidad de username. Consistente con lo anterior — sin tabla propia, comprobar unicidad exigiría un Route Handler con la service role key solo para esto.
- **Sí:** auto-confirmación de email (sin paso de "revisa tu correo" para poder loguear). Mantiene el flujo de registro instantáneo, coherente con el tono ligero del proyecto, y evita depender de la configuración de envío de correo de Supabase Auth (distinta del Resend ya usado para `/api/contact`).
- **Sí:** incluir recuperación de contraseña en este spec, pese a no ser parte del pedido original textual — el usuario lo confirmó explícitamente al definir el alcance.
- **No:** rutas protegidas / contenido exclusivo para usuarios logueados. El modo invitado se mantiene como una vía de acceso completa, igual que hoy; el login es aditivo (personaliza el nombre, agrega logout), no restrictivo.
- **Sí:** mantener el modo invitado (`login(null)`) exactamente igual, incluyendo el bug conocido de `"null"` como string en `localStorage`. Confirmado explícitamente — no se toca como efecto colateral de este spec.
- **Sí:** `middleware.ts` con el patrón estándar de `@supabase/ssr`, aunque hoy ningún Server Component lee la sesión del usuario. Es el paso que SPEC 04 dejó pendiente explícitamente "para el spec de autenticación real"; sin él, las cookies de sesión no se refrescan de forma confiable en Server Components/Route Handlers futuros.
- **No:** cambiar `lib/scores.ts` o forzar el nombre de cuenta al guardar puntuación. El campo de nombre en `GamePlayer.tsx` sigue editable, solo cambia qué valor lo prellena — mantiene el alcance de este spec limitado a las pantallas de autenticación.
- **Sí:** derivar el nombre para mostrar de cuentas OAuth desde `full_name`/`name`/prefijo de email, normalizado igual que el resto de la app (mayúsculas, máx. 10 caracteres) — no hay formulario de username en el flujo OAuth, así que se necesita un fallback determinista.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| Los providers Google y GitHub deben habilitarse manualmente en el dashboard de Supabase (Authentication → Providers) con su client ID/secret — no existe herramienta MCP para automatizarlo | Paso manual documentado aquí y a repetir antes de probar el paso 5 del plan de implementación. Sin este paso, los botones de OAuth redirigen a un error de Supabase, no a un bug de la app. |
| Con "Confirm email" desactivado, `signUp()` con un email ya registrado puede no devolver un error explícito (protección contra enumeración de emails) | Se trata como éxito ambiguo en la UI: si `signUp()` no devuelve error pero tampoco hay sesión nueva, se muestra un mensaje genérico ("Revisa tus datos o intenta iniciar sesión") en vez de asumir que la cuenta se creó. |
| El flujo de recuperación de contraseña depende de que Supabase tenga un remitente de correo configurado (el proyecto ya usa Resend, pero para `/api/contact`, no para los correos de Supabase Auth) | Riesgo aceptado: el remitente por defecto de Supabase Auth (con límites de envío) es suficiente para este alcance; configurar un SMTP propio para Supabase Auth queda fuera de este spec si hiciera falta a futuro. |
| `middleware.ts` corriendo en cada request puede afectar el rendimiento si el `matcher` es demasiado amplio | Se excluyen explícitamente `_next/static`, `_next/image` y archivos con extensión de asset, siguiendo la recomendación estándar de Supabase/Next.js. |

## What is **not** in this spec

- Tabla `profiles` o cualquier tabla nueva en Supabase.
- Verificación de unicidad de username.
- Pantalla de edición de perfil/cuenta.
- Rutas o contenido protegido por sesión iniciada.
- Providers OAuth adicionales a Google y GitHub.
- Migración de puntuaciones de invitado a cuenta real.
- Cambios a `lib/scores.ts` o al comportamiento de edición del nombre en `GamePlayer.tsx`.
- Corrección del bug conocido de `localStorage["av_user"] === "null"` para invitado.
- Habilitación de los providers OAuth en el dashboard de Supabase (paso manual, no código).

Cada uno de estos, si se necesita, va en su propio spec.
