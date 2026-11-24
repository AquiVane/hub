# AUDITORÍA — COSMART Marketing Hub (¿listo para vender y escalar?)

**Fecha:** 24/11/2026 · **Modo:** solo lectura (no se modificó, commiteó ni desplegó nada; este archivo es lo único creado y queda sin commitear).
**Alcance:** repo `AquiVane/hub` (frontend) y `AquiVane/cosmart-workers` (worker `marketing-hub` + CI/backups). Se leyeron código, workflows y HANDOFF; se consultó DNS público, RDAP del dominio, GitHub Actions, Cloudflare (lista de workers) y la documentación oficial de Cloudflare.
**Importante:** no es una auditoría exhaustiva línea por línea (el worker tiene ~5.800 líneas en `index.js` + 3.700 en módulos; el front ~20.000). Los hallazgos con archivo/línea están verificados; lo que no pude comprobar está marcado **NO VERIFICADO**.

---

## Veredicto corto

**Hoy se puede seguir vendiendo a clientes conocidos, pero NO está listo para salir a vender en abierto (signup público de agencias) hasta cerrar 4 cosas:** (1) el link de recuperación de contraseña falsificable, (2) alta pública sin antibot ni verificación de email, (3) términos/privacidad generales inexistentes, (4) el modelo de datos "una lista gigante por clave" que se pisa y se frena con más usuarios. Lo bueno: hay base seria (PBKDF2, límite de intentos, aislamiento por agencia con prefijo, respaldo diario que anda, 384 corridas de CI, webhook de PayPal firmado).

---

## 1. SEGURIDAD

### 🔴 CRÍTICO

**S1 — El mail de "recuperar contraseña" se puede falsificar y robar la cuenta.**
- Evidencia: `workers/marketing-hub/src/index.js:1039` → `const origin = req.headers.get('Origin') || 'https://hub.cosmart.com.ar'; const link = \`${origin}/reset.html?token=${t}\``. El header `Origin` lo manda quien hace el pedido; un atacante con `curl` puede poner `Origin: https://sitio-malo.com`.
- Riesgo (simple): el atacante pide recuperar la clave de *tu* email; te llega un mail **real de COSMART** pero con el botón apuntando a su sitio. Si lo tocás, él recibe el token y cambia tu clave (admin de agencia incluido).
- Corrección: ignorar `Origin` y armar el link siempre con una lista fija de dominios propios (`https://hub.cosmart.com.ar`, o el del `agencyId` si hay dominio propio de agencia).

### 🟠 IMPORTANTE

**S2 — Alta pública de agencias sin antibot, sin verificar email, sin límite.**
- Evidencia: `index.js:3465-3492` (`handleSignupAgencia`): crea usuario admin + agencia + cliente demo con solo nombre/email/clave. No hay Turnstile ni captcha (grep en `signup.html`/`login.html`/worker: 0 coincidencias; el HANDOFF de la auditoría del 16/11 dejó Turnstile "pendiente de Site Key"). No valida formato de email, no manda mail de confirmación, no hay rate limit por IP, y responde 409 "Ya existe un usuario con ese email" (permite saber qué emails existen).
- Riesgo: bots llenan KV de agencias basura (cuesta escrituras y ensucia `_agencias`); alguien se registra con el email de otra persona ("squatting"); se enumeran cuentas.
- Corrección: Turnstile en signup/login/forgot (el chequeo ya está diseñado para quedar apagado hasta que exista el secret), confirmación de email antes de activar, límite por IP, respuesta genérica.

**S3 — Recuperar contraseña sin límite y sin cerrar sesiones abiertas.**
- Evidencia: `handleForgot` (`index.js:1029-1050`) no usa `rlBloqueado`/`rlFallo` (el límite existe solo en login, `:946-975`); `handleReset` (`:1053`) y `handleChangePassword` (`:1002`) no borran las sesiones existentes (las sesiones son `MH_SESSIONS` por token, `:993`, 30 días).
- Riesgo: se puede bombardear de mails a un usuario (y gastar cuota de Brevo); si te robaron la clave, cambiarla **no** saca al intruso hasta 30 días.
- Corrección: limitar `/forgot` por email/IP; guardar un índice `usuario → tokens` (o una "versión de sesión" en el usuario) y revocar todo al cambiar/resetear la clave; acortar sesión (7–14 días con renovación).

**S4 — Contraseña mínima de 6 caracteres, sin ningún chequeo más.**
- Evidencia: `index.js:1008, 1058, 3468`. Con PBKDF2 de 100.000 iteraciones (`:55`, bien) igual es débil.
- Corrección: mínimo 10, bloquear claves comunes; y subir iteraciones (la guía actual de OWASP para PBKDF2-SHA256 es mucho mayor que 100.000; hoy el tope práctico lo da el CPU de Workers Paid).

**S5 — Permisos de GitHub y workflows operando sobre datos reales desde `main`.**
- Evidencia: `.github/workflows/` tiene ~38 workflows (`inspect-user.yml`, `set-secret.yml`, `grant-course.yml`, `upload-r2-file.yml`, `arca-cargar-certificado.yml`…) y el historial reciente muestra pushes directos a `main` tipo "tmp: recuperar tarea Ando" / "tmp: adjuntos Ando" que corren con los secrets de Cloudflare. No hay PR obligatorio.
- Riesgo: quien entre a la cuenta GitHub de AquiVane (o un token filtrado) tiene control total de producción y de los secrets. **2FA en GitHub/Cloudflare/MP: NO VERIFICADO.**
- Corrección: 2FA obligatorio, protección de rama `main` (PR + check de tests), mover los workflows de operación a `environment` con aprobación manual, borrar los "tmp" ya usados.

### 🟡 MEJORA

- **S6 — Webhook de Mercado Pago sin firma (`x-signature`).** `handleWebhookMP` (`index.js:4956-4985`) no valida firma, pero **mitiga bien**: solo usa el id y vuelve a pedir el estado real a la API de MP con el token. PayPal sí valida firma (`:5102-5126`). Recomendado igual validar `x-signature` de MP y responder 200 siempre rápido.
- **S7 — `SETUP_SECRET` comparado con `!==`** (`:3447`) y sin límite: usar `igualesCT` (ya existe en `:966`) y limitar intentos.
- **S8 — Archivos subidos se sirven con el Content-Type que declaró quien subió** y sin `nosniff` ni `Content-Disposition` (`handleArchivoUpload :2751`, `handleArchivoFile :2855-2861`). Un HTML subido podría ejecutarse en el dominio del worker. Mitiga: requiere token Bearer (no cookie) y el dominio del worker no es el del Hub. Corrección: forzar `Content-Disposition: attachment` salvo imágenes/PDF, `X-Content-Type-Options: nosniff`, lista blanca de tipos.
- **S9 — XSS en el front: revisión parcial.** Hay `escapeHtml` y `sanitizarHtml` (`js/app.js:31`, `admin/index.html:3038`) y se usan en general, pero hay ~136 `innerHTML` en `app.js` y ~176 en admin. Muestreo: la mayoría de campos de usuario están escapados; vi interpolaciones sin escapar de `step.titulo/step.texto` (`js/app.js:126-127`, probablemente texto propio, no del usuario) y `c.id` dentro de `onclick` (`:2300`). **No se auditó cada una → NO VERIFICADO al 100 %.** No hay CSP de scripts (`_headers:31` solo `frame-ancestors/base-uri/object-src`), así que un XSS tendría impacto total. Corrección: auditar los 300 usos con un linter, y CSP con nonces cuando se pueda.
- **S10 — CORS `*` en el código** pero filtrado por `cors-seguro.js` (solo orígenes propios): ✔ correcto. Nota: sin header `Origin` (curl, apps) no se filtra, es lo esperado.
- **S11 — Webhook saliente de CRM configurable por la agencia** (`index.js:4601`) solo valida que sea una URL: posible SSRF/abuso. Exigir `https://` y bloquear IPs privadas/localhost.

### ✅ Bien
- Contraseñas con PBKDF2-SHA256 + salt por usuario, migración automática de cuentas viejas (`:50-80, :985`); comparación en tiempo constante (`:966`).
- Límite de intentos de login: 8 por cuenta y 40 por IP cada 15 min (`:946-975`) — **nota:** es "falla abierta" si KV falla y los contadores son lectura-modificación-escritura (se pueden esquivar con pedidos simultáneos).
- Sin claves ni tokens en el código ni en el historial del Hub (escaneo de patrones: solo aparece la `PUBLIC_KEY` de Mercado Pago, que es pública por diseño). `.gitignore` excluye `.dev.vars`. 
- No se guardan datos de tarjeta: el cobro es con Brick de MP / botones PayPal (`js/app.js:6920`, `signup.html:191`).
- `npm audit --omit=dev` en `marketing-hub`: **0 vulnerabilidades** (y el CI lo corre en cada push). El front no tiene dependencias npm.
- Headers de seguridad en `_headers` (HSTS, nosniff, Referrer-Policy, Permissions-Policy, frame-ancestors).
- **Historial del backend (`cosmart-workers`): NO VERIFICADO** — mi clon es superficial (1 commit). La sesión del 16/11 anotó que `Reciclaje26` (clave de un cliente) quedó en el historial de git; en el HEAD actual no aparece. Hay que rotarla y verificar con un escaneo completo (`gitleaks`/`trufflehog`).
- Secrets de Cloudflare cargados (BREVO, MP, PAYPAL, etc.), **su valor y rotación: NO VERIFICADO**.

---

## 2. AISLAMIENTO ENTRE CLIENTES / AGENCIAS

**Resultado: sólido por diseño, con 3 puntos a vigilar. No encontré una ruta que deje a un usuario ver datos de otra agencia.**

- Todas las claves de datos pasan por `nsKey(agencyId, …)` (`index.js:122-126`) y `agencyId` sale del usuario autenticado (`agencyIdDe(user)`, `:115`), nunca del body (la regla está escrita en `:100-110`). `handleGetData/handleSaveData` (`:2418-2440, :2546-2555`) exigen: admin, o su propio `clientId`, o colaborador asignado, o equipo del cliente. Los archivos van a `nsKey(agencyId, clientId)/uuid` (`:2751`) y se leen con el mismo prefijo (`:2852`).
- 🟠 **A1 (IMPORTANTE) — La agencia dueña (COSMART) usa claves SIN prefijo** (`nsKey`, `:123-125`). Una clave como `agencia_xyz:_clients` y un `clientId` cualquiera de COSMART viven en el mismo espacio de nombres: un admin de COSMART (de confianza) podría, con un `clientId` armado a mano, tocar datos de otra agencia (`/data/agencia_xyz/_clients`). Una agencia externa **no** puede salir de su prefijo. Riesgo bajo hoy (solo Vaneh), pero rompe la promesa "aislamiento total" si algún día hay un colaborador admin en COSMART. Corrección: validar `clientId` con regex `^[a-z0-9_-]{1,40}$` sin `:` y migrar COSMART a prefijo explícito.
- 🟡 **A2 — El `agencyId` del cliente demo y del mail es público** (`demo@{agencyId}.hub-demo.local`); no es secreto, pero conviene no depender de que sea difícil de adivinar.
- 🟡 **A3 — Un mismo email solo puede existir en una agencia** (`MH_USERS` es global por email). Un consultor que trabaja con dos agencias no puede tener dos cuentas, y el 409 de alta delata existencia. Decisión de producto; anotar.
- 🔴/🟠 **A4 — Faltan pruebas automáticas de aislamiento** (ver sección 5): hoy nada en CI garantiza que un cambio futuro no abra la puerta.

---

## 3. BASE DE DATOS Y ESCALA

La "base de datos" es **Workers KV** (`MH_DATA`, `MH_USERS`, `MH_SESSIONS`, `MH_RESETS`) más R2, Durable Objects y D1 en otros workers. KV es **eventualmente consistente** y limita a **1 escritura por segundo por clave** (docs: developers.cloudflare.com/kv/api/write-key-value-pairs/ y /kv/reference/faq/). Todo el modelo guarda **listas completas en una sola clave** (`{cliente}:tareas`, `_clients`, `_colaboradores`, `_agencias`…).

### 🔴 CRÍTICO

**D1 — Dos personas guardando a la vez se pisan (pérdida silenciosa de datos).**
- Evidencia: `handleSaveData` (`index.js:2546+`) sobrescribe la lista entera para `tareas`, `campanas`, `home`, `plan`, `reportes`, etc. Solo `contenidos` tiene control de versión (`If-Match` + Durable Object coordinador, `:2581`, `contenidos-coordinador.js`, test `concurrencia-contenidos.test.js`). 49 llamadas a `MH_DATA.put`; la mayoría hacen leer→modificar→escribir (ej. `_clients` en `:1349-1357, 1379-1400, 1459-1532`; `_colaboradores` `:1196-1211`; `_informes_pendientes` `:1703-1788`).
- Riesgo (simple): si Vaneh y una colaboradora editan las tareas de un cliente casi a la vez, **gana la última y la otra se borra sin aviso**. Con KV además una lectura puede venir "vieja" hasta ~60 s (cacheTtl por defecto). Con más usuarios por agencia el problema crece de forma directa.
- Mitigación ya hecha (24/11): papelera + copia del día en R2 (`respaldo.js`) permite recuperar, pero no evita la pérdida ni avisa.
- Corrección: extender el patrón que ya funciona (versión + Durable Object) a todos los tipos, o pasar a **un registro por ítem** (D1 o DO por cliente) en vez de una lista gigante.

### 🟠 IMPORTANTE

**D2 — `_agencias` es una sola clave global con todas las agencias.** `saveAgencia`/`handleUpdateAgencia`/webhooks de pago reescriben el JSON completo (`:128-144, :3587, :4980`). Con altas simultáneas o cobros en paralelo se pisan; y más agencias = clave más pesada en cada login (`getAgencia` la lee entera). Límite duro de valor: 25 MiB. Corrección: una clave por agencia (`agencia:{id}`) + índice.

**D3 — Contadores y límites con lectura-escritura no atómica** (almacenamiento usado `:2754`, intentos de login `:955-963`): se desfasan con concurrencia (el código ya lo admite: "contador aproximado").

**D4 — Datos duplicados que se pueden desincronizar.** El equipo de un cliente vive en `_clients[].usuarios` y también en `_colaboradores[].clientIds` y en el registro del usuario (`MH_USERS.clientIds`) (`:1163-1176, :1349-1357`). Se actualizan en pasos separados sin transacción: si falla uno a mitad, quedan inconsistentes (el HANDOFF menciona la lógica "equipo = fuente de verdad" `:2410-2418`). Corrección: una sola fuente de verdad y derivar el resto.

**D5 — Sin versión de esquema ni migraciones de datos.** No hay `schemaVersion` (grep: 0). Los cambios se resuelven con compatibilidad en el código ("cuentas viejas sin prefijo", etc.). Funciona mientras haya un solo equipo y pocos datos; con muchas agencias, un cambio de estructura sin migración rompe a algunas en silencio. Corrección: campo `v` en cada documento + función de migración al leer.

**D6 — Lecturas que crecen con los datos.** `GET/POST /data/:clientId/:tipo` hace `JSON.parse`/`stringify` de la lista completa por pedido; el propio HANDOFF (línea ~52) documenta una caída sospechada por listas grandes (guiones con imágenes pegadas). `listAgencias` y `_clients` se leen enteras en muchos endpoints (login incluido). A 1.000 clientes por agencia o listas de 5–10 MB, los 10 ms/50 ms de CPU se vuelven un problema aun en Paid.

### 🟡 MEJORA
- Cron y alarmas: el diseño usa Durable Objects (sin cron) para lo escalable ✔; el único cron diario recorre agencias en bucle (`scheduled()`): a muchas agencias necesita paginado.
- Respaldo de R2 (archivos de clientes) **no está en el backup diario** (lo dice el workflow); solo papelera/copias internas.

### Qué se rompe primero (estimación, con límites oficiales)

Límites vigentes consultados en la doc oficial de Cloudflare (24/11/2026): KV **1 escritura/seg por clave**, valor máx. 25 MiB; Workers Free **100.000 req/día, 10 ms CPU**, 1.000 escrituras KV/día; Workers Paid sin tope de requests, CPU hasta 5 min por request, 10 M req + 30 M ms CPU incluidos/mes (+$0,30 por millón de req; +$0,02 por millón de ms CPU), KV incluido 10 M lecturas y 1 M escrituras/mes (+$0,50/M lecturas; +$5/M escrituras), almacenamiento 1 GB (+$0,50/GB-mes), cuenta Free: **5 cron triggers totales**, Paid 1.000.

| Escala | Qué se rompe primero | Costo aproximado (solo Cloudflare) |
|---|---|---|
| **Hoy → 10x** (decenas de agencias) | Pisadas de datos (D1) y `_agencias` global (D2); soporte por "se me borró una tarea". Si la cuenta siguiera en Free: 1.000 escrituras KV/día y 10 ms CPU rompen todo antes. | ~US$5/mes del plan Paid + centavos. |
| **100x** (cientos de agencias, miles de usuarios) | Listas grandes por clave (D6): CPU y latencia; login lento por `_agencias`/hash PBKDF2; escrituras KV >1 M/mes empiezan a cobrarse (US$5/M). Brevo/Meta/Anthropic pasan a ser el costo real (IA sin tope = riesgo). | Decenas de USD/mes en Cloudflare; el gasto de IA/Brevo puede superarlo. |
| **1000x** (miles de agencias) | KV como base transaccional deja de servir: hace falta D1 o un DO por agencia/cliente, paginación, colas para emails/IA, y un plan de soporte. `_agencias`/`_clients` en una clave es inviable (25 MiB y 1 write/s). | Varios cientos de USD/mes + rediseño de datos (el costo grande es de ingeniería, no de plataforma). |

**Plan de Cloudflare: NO VERIFICADO.** El `CLAUDE.md` y varios comentarios de `wrangler.toml` siguen diciendo "cuenta Workers Free (tope 5 crons)", pero la sesión del 16/11 pidió confirmar el plan de US$5 (PBKDF2 necesita ~17 ms de CPU y Free corta a 10 ms). La API no me dejó leerlo desde acá. Si fuera Free, el login ya estaría fallando (no está: el backup y los tests corren), así que probablemente es Paid, pero hay que **confirmarlo en el panel** y actualizar la documentación.

---

## 4. DISPONIBILIDAD

### 🟠 IMPORTANTE
**V1 — Sin monitoreo ni alertas de caída.** Solo está `[observability]` de Workers (`wrangler.toml`, logs con retención corta). No hay uptime monitor externo, ni alerta por tasa de errores, ni página de estado (grep UptimeRobot/Sentry/Healthchecks en HANDOFF: 0). Si el Hub se cae un sábado, se entera el cliente. Corrección: monitor externo gratuito sobre `/health` (hay que agregarlo) + Cloudflare Notifications (errores de Workers, vencimiento de certificado) + alerta si falla el backup (hoy solo queda en rojo en Actions).

**V2 — Nunca se probó restaurar un backup completo.** Backup diario KV+D1 en GitHub Actions: **7 de 7 corridas exitosas (17→23/11)**, retención 30 días, sin sesiones/tokens ✔. Pero el HANDOFF solo describe cómo restaurar un objeto puntual (caso Ando), no hay un simulacro completo documentado, y el artefacto vive en la misma cuenta GitHub (S5). R2 (archivos) no está incluido. Corrección: simulacro trimestral (restaurar a un KV de prueba), copia semanal fuera de GitHub (R2 de otra cuenta o similar), y backup de R2.

**V3 — Fallas de servicios externos mal comunicadas.**
- `sendEmail` (`index.js:181-200`) devuelve el `fetch` sin mirar la respuesta ni reintentar: si Brevo falla, `handleForgot` igual responde "ok" y el usuario nunca recibe el link, sin que nadie se entere.
- Login con KV caído: el límite de intentos "falla abierta" (`:947`), y `verifySession` no maneja errores de KV (excepción → 500 genérico).
- Pagos: MP/PayPal caídos devuelven errores técnicos al front; webhook de MP ignora silenciosamente fallos (`catch → ok`, `:4968`) y no reintenta, así que un estado de pago podría quedar desactualizado hasta el cron.
- Corrección: log + reintento con cola (Queues) para mails críticos, mensajes claros en el front ("no pudimos enviar el mail, probá en unos minutos"), conciliación periódica de pagos.

### 🟡 MEJORA
- IA (Anthropic): el HANDOFF de la sesión del 16/11 deja como pendiente confirmar **tope de gasto** en la consola; **NO VERIFICADO**. Un bucle o un abuso de signup gratis podría generar costo ilimitado.
- Un único worker (`marketing-hub`) concentra todo: una mala publicación lo tumba entero. Hay `[observability]` pero el rollback es manual (ver 5).

---

## 5. DOMINIO Y EMAIL

Verificado por DNS público (Cloudflare DoH) y RDAP de NIC Argentina:

- **Dominio `cosmart.com.ar`:** activo, **vence el 22/10/2027** (registrado 22/10/2025). Servidores de nombres de Cloudflare (`ariadne`/`jason`). Falta confirmar renovación automática y quién es el titular/contacto de NIC.ar → **NO VERIFICADO**. Recomendación: recordatorio a 60 días y que el contacto sea un email que se lea.
- **`hub` y `www`:** resuelven a IPs de Cloudflare (proxy). `https://hub.cosmart.com.ar/` responde 308 → `/login` con HSTS y headers de seguridad ✔. `www.cosmart.com.ar` responde 200 (no pude confirmar si redirige a raíz o es una copia → posible contenido duplicado/SEO; **NO VERIFICADO** el redireccionamiento canónico).
- **Certificado:** el que vi desde esta máquina es el de un proxy de salida (no el de Cloudflare), así que **no lo pude verificar**. Cloudflare Universal SSL renueva solo; confirmar modo "Full (strict)" en el panel (**NO VERIFICADO**, la sesión del 16/11 lo dejó como chequeo manual).
- **CAA:** no hay registro CAA (`status 0`); mejora menor.
- **SPF:** `v=spf1 include:zohomail.com ~all` — 🟠 **no incluye Brevo**, que es quien envía los mails del Hub (`index.js:183`, remitente `info@cosmart.com.ar`). Hoy el SPF de esos mails no alinea.
- **DKIM:** existen `brevo1._domainkey` y `brevo2._domainkey` (CNAME a Brevo) ✔; el selector de Zoho (`zmail`) no lo vi → **NO VERIFICADO** (puede tener otro nombre).
- **DMARC:** `v=DMARC1; p=none; rua=mailto:rua@dmarc.brevo.com` — 🟠 solo monitorea, **no protege** contra suplantación. Como el DKIM de Brevo sí alinea, DMARC pasa hoy, pero con SPF incompleto y `p=none` cualquiera puede mandar mails "de COSMART" y llegan igual.
- **Corrección:** SPF `v=spf1 include:zohomail.com include:spf.brevo.com ~all` (un solo registro SPF), pasar DMARC a `p=quarantine` tras revisar 2–4 semanas de reportes `rua`, y agregar un buzón propio de reportes.

---

## 6. MANTENIMIENTO

### 🟠 IMPORTANTE
**M1 — Cobertura de pruebas: buena en lógica, vacía en lo crítico para vender.**
- Hay CI (`.github/workflows/test.yml`, 384 corridas; último push verde) con ~12.400 líneas de tests en `marketing-hub/test/` y `npm audit`.
- **No hay tests de:** login/rate limit, reset de contraseña (ni del bug S1), alta de agencia, **aislamiento entre agencias/clientes**, cobro/webhooks de suscripción (`handleWebhookMP/PayPal`), cambio de contraseña. (Hay tests de integraciones, Claude MCP, Instagram, concurrencia de contenidos y CORS.)
- El repo `hub` (front, ~20.000 líneas en `app.js`/`admin/index.html`) **no tiene CI ni tests**; el CLAUDE.md pide validar con `node --check` a mano.
- Corrección: suite mínima "no negociable": login+límite, forgot/reset, signup, matriz de permisos (admin/colab/client × propia/otra agencia), webhooks; CI en `hub` con `node --check` + un smoke test con Playwright (ya instalado en este entorno).

**M2 — Ramas, previews y rollback.**
- `hub`: Cloudflare Pages con auto-deploy al pushear a `main`. Pages genera **previews por rama/PR** y permite **rollback a un deploy anterior desde el panel** — pero el flujo real es push directo a `main` por múltiples sesiones en paralelo (CLAUDE.md), sin preview obligatoria ni protección de rama. **Config de Pages: NO VERIFICADO** (no tengo acceso al panel de Pages).
- `cosmart-workers`: deploy **manual** vía GitHub Action (`deploy.yml`) desde `main`; no hay staging ni "versiones/gradual rollout" ni script de rollback documentado (`wrangler rollback` existe, no está escrito en el HANDOFF). Dos sesiones pueden pisar cambios (el CLAUDE.md ya lo advierte).
- Corrección: protección de `main` + PR con tests verdes, entorno `staging` con KV propio, documentar rollback de 1 comando.

### 🟡 MEJORA
- **CLAUDE.md / HANDOFF.md:** están al día en el sentido operativo (HANDOFF del Hub 237 KB y del backend 264 KB, con fechas del 24/11). Contra: son enormes (cuestan tokens y esconden lo importante), y mezclan historial con estado vigente; el CLAUDE.md dice "cuenta Workers Free" cuando probablemente ya es Paid. Sugerencia: separar `HANDOFF.md` (estado y pendientes, <30 KB) de un `HISTORIAL.md`.
- 38 workflows de utilidad, varios obsoletos o específicos de un cliente (`*-elreydelkaraoke`, `inspect-*`): archivar los que ya no se usan.
- `MEMORIA-TECNICA.md` existe para el trámite DNDA ✔.

---

## 7. LEGAL BÁSICO (a validar por un abogado/a — esto no es asesoramiento legal)

### 🔴 CRÍTICO (para vender en abierto)
**L1 — No hay Términos y Condiciones ni Política de Privacidad general del Hub.**
- Evidencia: `privacidad.html` es solo "Política de privacidad · COSMART Hub (Instagram)" (respuestas automáticas, actualizada 7/11/2026). No hay `terminos.html` ni equivalente; `signup.html` y `login.html` no muestran ni exigen aceptar términos/privacidad (grep: 0).
- Riesgo: se venden suscripciones a agencias que cargan **datos personales de sus clientes y de los clientes de ellos** sin contrato de uso, sin definir roles (la agencia es responsable del tratamiento, COSMART encargado), sin límites de responsabilidad, sin política de baja/devolución/cancelación.
- Hay que contemplar la **Ley 25.326 de Protección de Datos Personales** (Argentina) y la inscripción de bases de datos ante la AAIP, derecho de acceso/rectificación/supresión, y transferencia internacional (Cloudflare, Brevo, Anthropic, Meta, Mercado Pago/PayPal están fuera de Argentina). Si hay usuarios fuera de Argentina, evaluar GDPR/otros.
- Corrección: T&C + Privacidad + Cookies/localStorage, aviso de subencargados (lista de proveedores), contrato de encargo de tratamiento para agencias, checkbox de aceptación obligatorio con registro de fecha/versión en el alta, canal de baja y de eliminación de datos, política de retención y borrado al cancelar.

### 🟠 IMPORTANTE
- **L2 — Defensa del consumidor / cobros recurrentes:** botón de arrepentimiento y cancelación fácil (Argentina), datos de contacto y CUIT visibles, facturación (el HANDOFF dice que ARCA ya está integrado para productos propios; confirmar que cubre las suscripciones del Hub).
- **L3 — Contenido de clientes y de menores/Meta:** el Hub procesa comentarios de Instagram con IA; revisar cumplimiento con las políticas de la plataforma de Meta (ya existe URL de eliminación de datos en `privacidad.html#eliminar-datos` ✔).
- **L4 — Propiedad intelectual y marca:** `MEMORIA-TECNICA.md` para la DNDA está; faltan registro de marca y cláusula de licencia de uso del software.

---

## RESUMEN FINAL

### Qué está bien
- Hash de contraseñas moderno con migración automática, límite de intentos, tiempo constante.
- Aislamiento multi-agencia bien pensado (prefijos, `agencyId` del servidor, sin rutas de fuga que haya podido encontrar para agencias externas).
- Pagos sin datos de tarjeta; PayPal con firma verificada; MP revalidado contra su API.
- CORS cerrado, HSTS y headers, dependencias sin vulnerabilidades, escaneo de secretos limpio en el Hub.
- Backup diario funcionando (7/7), papelera y copia diaria nuevas, 384 corridas de CI, concurrencia ya resuelta para `contenidos`.
- Dominio vigente hasta octubre 2027, DKIM de Brevo y DNS en Cloudflare.

### Qué falta
- Link de recuperación falsificable (S1) y falta de antibot/verificación en el alta (S2).
- Términos, privacidad general y consentimiento (L1).
- Concurrencia en el resto de los tipos de datos y `_agencias` global (D1, D2); sin versionado de datos (D5).
- Monitoreo/alertas (V1), simulacro de restauración y backup de R2 (V2).
- SPF incompleto y DMARC en `p=none` (sección 5).
- Pruebas de login, reset, alta, aislamiento y cobros; CI del front (M1); protección de `main`, staging y rollback (M2).
- Confirmar plan de Cloudflare, 2FA, tope de gasto de IA, rotación de claves viejas.

### Qué haría primero (orden)
1. **S1** — arreglar el link de reset (cambio de pocas líneas, riesgo mayor).
2. **L1** — redactar T&C + Privacidad y agregar aceptación obligatoria en `signup.html` (con abogado/a).
3. **S2/S3** — Turnstile + verificación de email + límite en forgot; revocar sesiones al cambiar clave.
4. **M1** — tests de login/reset/signup/aislamiento y de webhooks de pago (red de seguridad antes de tocar el resto).
5. **SPF/DMARC** y **V1** (monitor externo + alertas): 1 hora de trabajo, riesgo operativo enorme.
6. **D1/D2/D5** — control de versiones en todos los tipos, `_agencias` por agencia, `schemaVersion`.
7. **V2** — simulacro de restauración y backup de R2.
8. Verificar a mano lo "NO VERIFICADO": plan Cloudflare, SSL Full (strict), 2FA, tope de Anthropic, historial git del backend, `www` → raíz.

> Siguiente paso: **no se corrige nada hasta que lo confirmes, de a un hallazgo por vez**. Decime con cuál arrancamos (recomiendo S1).

---

## ESTADO DE CORRECCIONES (24/11/2026, misma sesión)

**Hechas en código** (rama `claude/festive-planck-30zbmf` en ambos repos, PR en borrador, **sin desplegar**; 203 tests verdes en `marketing-hub`, 9 nuevos en `test/auth-seguridad.test.js`):
S1 link de reset fijo a dominios propios · S3 límite en forgot + cierre de sesiones al resetear/cambiar clave · S4 contraseña mínima 8 (front y backend) · S2 (parcial) validación de email/largos + 5 altas/hora por IP · S7 `SETUP_SECRET` en tiempo constante · S8 `nosniff` y descarga forzada de HTML/SVG/XML/JS subidos · S11 webhook CRM solo https público · A1 (parcial) `:` rechazado en `clientId`/`type` · V3 (parcial) registro en logs si Brevo falla · `GET /health` para monitor · M1 (parcial) tests de login, reset, alta, aislamiento y webhook + CI de sintaxis del front · plan Cloudflare documentado como Paid.

**Quedan por hacer vos (no se pueden desde el código):** 2FA en GitHub, Cloudflare, Mercado Pago, PayPal, Brevo y Anthropic · SPF (`include:spf.brevo.com`) y DMARC en el DNS de Cloudflare · monitor de uptime sobre `/health` · protección de la rama `main` en GitHub · rotar la clave de Ando · confirmar SSL "Full (strict)" · tope de gasto si hay una API key de Anthropic cargada.

**Quedan pendientes de desarrollo (cambios grandes, a hacer de a uno):** Turnstile + confirmación de email en el alta (falta Site Key) · D1 control de versiones en todos los tipos de datos · D2 `_agencias` una clave por agencia · D5 `schemaVersion` · simulacro de restauración y backup de R2 · L1 Términos y Privacidad (texto a aprobar por Vaneh y validar con abogado/a).
