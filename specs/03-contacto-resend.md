# SPEC 03 — Envío real de contacto vía Resend

> **Status:** Aprobado
> **Depends on:** SPEC 02
> **Date:** 2026-08-21
> **Objective:** Conectar el formulario de contacto de `About` a un envío real de correo electrónico vía Resend, dirigido a carlos.valencia@vibeconsulting.com.co, reemplazando la simulación puramente visual de SPEC 02.

## Why this spec exists

SPEC 02 dejó explícitamente fuera de alcance el "Envío real del formulario de contacto (backend, email, guardado en `localStorage`)". Este spec cierra ese punto: el formulario deja de ser una simulación visual y pasa a enviar un correo real usando Resend.

## Scope

**In:**

- Ruta API `app/api/contact/route.ts` (Route Handler `POST`) que recibe `{ name, email, message }`, valida en servidor (campos no vacíos, `email` con formato válido), y usa el SDK `resend` (ya en `package.json`, pendiente de commit) para enviar un correo a `carlos.valencia@vibeconsulting.com.co` con `reply_to` = correo del formulario.
- `components/About.tsx`: el `onSubmit` del formulario de contacto pasa de la simulación visual pura a un `fetch("/api/contact", ...)` real. Se agrega:
  - Validación de formato de correo (regex simple) además de la validación de "no vacío" ya existente — ambas siguen disparando el `shake` actual sin llamar a la API.
  - Estado de carga: mientras se espera la respuesta, el botón "ENVIAR MENSAJE" se deshabilita y muestra "ENVIANDO…".
  - Estado de error: si el `fetch` falla o el servidor responde con error, se muestra una línea de error en la transcripción de terminal (ej. `[ERROR] ...`) en vez de la línea de éxito, sin borrar los datos ya escritos, permitiendo reintentar.
  - Estado de éxito: igual al de hoy (transcripción `terminal-success`), pero ahora solo se muestra tras confirmación real del servidor, no de forma inmediata.
- Variable de entorno `RESEND_API_KEY`, leída únicamente en el servidor (`app/api/contact/route.ts`). El usuario ya tiene su propia key y la agrega manualmente a `.env.local`, cubierto por el patrón `.env*` de `.gitignore` — no se versiona.
- Commitear el cambio pendiente en `package.json` (y el `package-lock.json` correspondiente) que agrega la dependencia `resend`, ya que este spec es quien la necesita.

**Out of scope (for future specs):**

- Protección anti-spam del formulario (honeypot, rate limiting, captcha).
- Verificar un dominio propio en Resend — se usa el dominio de pruebas `onboarding@resend.dev` como remitente.
- Persistir los mensajes de contacto en alguna base de datos o en `localStorage` — el correo enviado es el único registro.
- Enviar una confirmación por correo a quien llenó el formulario — solo se envía el correo a Carlos.
- Cambios a `Auth` o a cualquier otro formulario del sitio — siguen siendo simulaciones visuales sin backend, según SPEC 01/02.
- Tests automatizados (no hay test runner en este repo).

## Data model

No se agregan estructuras persistentes nuevas (no hay base de datos ni `localStorage` involucrados en este spec). Se agrega un contrato de API:

```ts
// app/api/contact/route.ts
// POST /api/contact
// Request body: { name: string; email: string; message: string }
// Response 200: { ok: true }
// Response 400: { ok: false; error: "invalid" }     // datos vacíos o email con formato inválido
// Response 500: { ok: false; error: "send_failed" } // Resend devolvió error o lanzó excepción
```

En `components/About.tsx`, el estado del formulario gana una fase de envío:

```ts
type SendState = "idle" | "sending" | "sent" | "error";
```

## Implementation plan

1. Agregar `RESEND_API_KEY` a `.env.local` (paso manual del usuario, no versionado — cubierto por `.env*` en `.gitignore`). Prueba manual: `npm run dev` arranca y el Route Handler del paso 2 puede leer `process.env.RESEND_API_KEY`.
2. Crear `app/api/contact/route.ts`: Route Handler `POST` que valida `name`/`email`/`message` no vacíos y `email` con formato válido en servidor, y en caso de éxito llama a `new Resend(process.env.RESEND_API_KEY).emails.send(...)` con `from: "onboarding@resend.dev"`, `to: "carlos.valencia@vibeconsulting.com.co"`, `reply_to: email`, un asunto que incluya el nombre del remitente, y el cuerpo con nombre/correo/mensaje. Devuelve `200 { ok: true }` en éxito, `400` si la validación de servidor falla, `500` si Resend falla o lanza excepción. Prueba manual: con un cliente HTTP (ej. `curl`) contra `http://localhost:3000/api/contact` con un body válido, llega un correo real a carlos.valencia@vibeconsulting.com.co.
3. Actualizar `components/About.tsx`: agregar validación de formato de correo antes de enviar, cambiar `onSubmit` para hacer `fetch("/api/contact", { method: "POST", body: JSON.stringify(form) })`, agregar el estado `SendState` (`idle` → `sending` → `sent` | `error`), deshabilitar el botón y mostrar "ENVIANDO…" durante `sending`, mostrar la transcripción de éxito solo cuando el `fetch` resuelve OK, y una línea de error (con opción de reintentar sin perder lo escrito) cuando falla. Prueba manual: enviar el formulario vacío sigue haciendo shake sin llamar a la API; un correo mal formado (ej. `"abc"`) también hace shake sin llamar a la API; con datos válidos el botón muestra "ENVIANDO…", luego la transcripción de éxito, y el correo llega realmente a carlos.valencia@vibeconsulting.com.co con el asunto/cuerpo esperados, y "Responder" en el cliente de correo apunta al correo escrito en el formulario.
4. Forzar un error (ej. una `RESEND_API_KEY` inválida temporalmente, o desconectar la red) y confirmar que se muestra el estado de error sin perder los datos escritos, y que se puede reintentar tras restaurar la key. Revertir la key al valor real al terminar la prueba.
5. Commitear el cambio pendiente en `package.json`/`package-lock.json` (dependencia `resend`) junto con el resto del código de este spec.
6. Pulido final: `npm run lint` y `npm run build` sin errores.

## Acceptance criteria

- [ ] `npm run build` completa sin errores.
- [ ] `npm run lint` completa sin errores.
- [ ] Enviar el formulario de `/about` vacío hace shake y no llama a `/api/contact`.
- [ ] Enviar el formulario con un correo de formato inválido hace shake y no llama a `/api/contact`.
- [ ] Enviar el formulario con datos válidos deshabilita el botón y muestra "ENVIANDO…" mientras se espera la respuesta.
- [ ] Un envío válido resulta en un correo real recibido en carlos.valencia@vibeconsulting.com.co, con `reply-to` igual al correo escrito en el formulario.
- [ ] Tras un envío válido exitoso se muestra la transcripción `terminal-success` con el nombre en mayúsculas, igual que en SPEC 02.
- [ ] Si el envío falla (ej. Resend responde error), se muestra un estado de error en la UI sin perder los datos del formulario, permitiendo reintentar.
- [ ] `RESEND_API_KEY` no queda hardcodeada en ningún archivo versionado — se lee de `process.env` únicamente dentro del Route Handler.

## Decisions

- **Sí:** enviar el correo desde un Route Handler de Next.js (`app/api/contact/route.ts`) en vez de llamar a Resend directamente desde el cliente. El SDK de Resend necesita la API key en el servidor; exponerla en el cliente sería una fuga de credenciales.
- **Sí:** usar el dominio de pruebas `onboarding@resend.dev` como remitente. El usuario no tiene todavía un dominio propio verificado en Resend; cambiarlo a un dominio propio es una configuración de Resend, no un cambio de código, y puede hacerse después sin tocar este spec.
- **Sí:** `reply_to` = correo del formulario. Permite responder directo a quien escribió sin depender de que incluya su correo dentro del cuerpo del mensaje.
- **Sí:** agregar validación de formato de correo en el cliente, además de la de "no vacío" que ya existía en SPEC 02. Evita gastar llamadas reales a Resend con datos claramente inválidos.
- **Sí:** estado de error explícito en la UI si el envío falla, en vez de un fallback silencioso a la simulación de éxito. Ocultar un fallo real de un formulario de contacto es peor que mostrar un error, aunque implique más trabajo.
- **No:** anti-spam (honeypot, rate limiting, captcha). El formulario es de bajo tráfico; se agrega después si se vuelve un problema real.
- **No:** persistir los mensajes en una base de datos o `localStorage`. El correo enviado es el único registro, consistente con que el proyecto no tiene backend de datos hasta ahora.
- **Sí:** commitear en este spec el cambio pendiente en `package.json`/`package-lock.json` que agrega `resend`, ya que es la dependencia que este mismo spec necesita para funcionar.

## Risks

| Riesgo | Mitigación |
| --- | --- |
| La `RESEND_API_KEY` termina hardcodeada o commiteada por error | Se lee siempre de `process.env.RESEND_API_KEY` dentro del Route Handler (nunca en un componente cliente); `.env*` ya está en `.gitignore`. |
| El dominio de pruebas `onboarding@resend.dev` puede tener límites de envío o de entregabilidad (ej. cae en spam) más restrictivos que un dominio propio verificado | Se documenta como decisión temporal; migrar a un dominio propio verificado en Resend es un cambio de configuración externo, no de código. |
| Un `fetch` fallido deja el botón deshabilitado indefinidamente si no se maneja bien el estado final | El paso 3 del plan cubre explícitamente los tres estados (`sending` → `sent` o `sending` → `error`), y el paso 4 prueba a propósito el camino de error. |

## What is **not** in this spec

- Anti-spam / rate limiting / captcha en el formulario.
- Verificación de un dominio propio en Resend.
- Persistencia de mensajes de contacto (base de datos o `localStorage`).
- Confirmación por correo a quien llenó el formulario.
- Tests automatizados.
- Cambios a `Auth` u otras pantallas del sitio.

Cada uno de estos, si se necesita, va en su propio spec.
