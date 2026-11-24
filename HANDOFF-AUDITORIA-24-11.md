# Traspaso: auditoría de seguridad y escala (24/11/2026)

> Para la sesión que continúe. Leé primero `AUDITORIA.md` (informe completo, con archivo y línea) y esta hoja. Vaneh habla solo español rioplatense.

## Estado
- **Hecho y subido, sin desplegar** (PRs en borrador): [cosmart-workers#21](https://github.com/AquiVane/cosmart-workers/pull/21) (backend, 203/203 tests) y [hub#6](https://github.com/AquiVane/hub/pull/6) (front + CI + informe). Rama `claude/festive-planck-30zbmf` en ambos repos.
- **Mergear juntos** (el front y el backend piden contraseña de 8). Después, **deploy manual** de `marketing-hub` con `deploy.yml`, **solo ese worker, nunca "all"**, y **avisando antes a Vaneh** (regla del repo). Antes de desplegar: `git fetch` y revisar que ninguna otra rama `claude/*` toque `workers/marketing-hub`.
- Ya aplicado en código: link de reset sin `Origin` falsificable, límite en forgot (3/h por email, 15/h por IP), cierre de sesiones al resetear/cambiar clave (índice `su:<email>:<token>` en `MH_SESSIONS`; las sesiones previas al deploy no lo tienen), contraseña mínima 8 (la que elige la persona; las creadas por admin siguen en 6), alta de agencia con validación y 5/h por IP, `SETUP_SECRET` en tiempo constante, webhook CRM solo https público, archivos HTML/SVG/XML/JS con descarga forzada + `nosniff`, `:` rechazado en `clientId`/`type`, log si Brevo falla, `GET /health`, 9 tests nuevos en `test/auth-seguridad.test.js`, CI de sintaxis del front (`.github/workflows/validar.yml`).

## Datos confirmados por Vaneh
- Cloudflare: **Workers Paid (US$5)**. Brevo: **plan gratis, tope 300 mails/día** (documentar; vigilar si crecen las agencias).
- Cada agencia/persona usa **su propia clave de Anthropic** (`_claude_api_key` por agencia); no hay costo de IA compartido ni tope que poner desde acá.
- 2FA: Mercado Pago y PayPal sí. GitHub: no recuerda. Cloudflare: cree que no (lo va a revisar ella).
- **No proteger `main`** en GitHub por ahora: las sesiones suben directo y se rompería el flujo.
- Ando Reciclaje es un cliente; solo importa porque su contraseña quedó en el historial de git (anotado el 16/11). Si ya la cambió, no hay nada que hacer.
- El check rojo **"Workers Builds: hub"** es una conexión vieja (Worker `hub` del 12/06) que falla en todos los PRs, también en el #5; **no es de estos cambios**. Lo deja en Cloudflare, no en código.

## Pendiente (en orden)
1. **Autorización de Vaneh para el deploy** de `marketing-hub` (la esperamos).
2. **Términos y Condiciones + Política de Privacidad general del Hub** + checkbox de aceptación en `signup.html` con registro de fecha/versión. **Regla de Vaneh: el texto se muestra en el chat y se espera su aprobación ANTES de crear archivos.** Después lo valida un abogado/a (Ley 25.326, transferencia internacional, subencargados: Cloudflare, Brevo, Meta, Mercado Pago/PayPal, Anthropic por clave propia). Hoy solo existe `privacidad.html` (Instagram).
3. **Datos (cambios grandes, de a uno, con tests):** D1 control de versiones (`If-Match` + Durable Object, como `contenidos`) para tareas/campañas/etc.; D2 `_agencias` una clave por agencia + índice; D5 `schemaVersion` y migración al leer; A1 migrar claves de COSMART a prefijo explícito.
4. **Alta pública:** Turnstile (falta la **Site Key**, Vaneh nunca creó el widget) + confirmación de email. El chequeo del servidor debe quedar apagado hasta que exista el secret `TURNSTILE_SECRET`.
5. **Fiabilidad:** reintento/cola para mails críticos (reset), conciliación de pagos MP, simulacro de restauración de backup (el backup diario KV+D1 anda: 7/7 corridas), backup de R2.
6. **Front:** auditar los ~300 `innerHTML` (XSS, solo se muestreó) y evaluar CSP con nonces (hoy `_headers` no la tiene a propósito por MP/PayPal).
7. Menores: webhook MP con `x-signature`, validar `www` → raíz, CAA, `archivar` workflows obsoletos, achicar los HANDOFF (237 KB y 264 KB).

## Lo que debe hacer Vaneh (no se puede desde código)
- Activar **2FA en GitHub y Cloudflare** (lo más importante).
- **SPF** en Cloudflare → DNS (TXT de `cosmart.com.ar`): `v=spf1 include:zohomail.com include:spf.brevo.com ~all`. Luego, tras 2–4 semanas mirando reportes, subir DMARC de `p=none` a `p=quarantine`.
- **Monitor de caídas** (UptimeRobot, gratis) sobre `GET /health` del worker, una vez desplegado.
- SSL/TLS → **Full (strict)** en Cloudflare; rotar la clave de Ando si sigue vigente.

## Reglas para no romper nada (de CLAUDE.md y de Vaneh)
Validar con `node --check` y `npm test` en `workers/marketing-hub` antes de commitear; `admin/index.html` tiene un script module inline (extraerlo y chequearlo); no cambiar nada no pedido; todo mobile-first; todo cambio en tareas/contenidos va en TODOS los módulos (panel cliente, admin, app Calendario en `apps-cosmart`); actualizar `HANDOFF.md` y, si cambia qué hace el sistema, `MEMORIA-TECNICA.md`.
