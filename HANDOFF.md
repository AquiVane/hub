# HANDOFF — hub (frontend, Marketing Hub de COSMART)

Actualizado: 2026-09-02. Léelo entero antes de tocar código o responder preguntas sobre el estado del proyecto.

## Tareas y Archivos — varios pedidos de Vaneh (02/09)

- **Subtareas**: viven mezcladas con las tareas normales en Kanban/Lista de "Mis tareas" (admin) y del dashboard del cliente -- mismas tarjetas, verde clarito (rosa si vencidas) + etiqueta "SUBTAREA". "Solo subtareas" es un filtro, no una vista aparte. Tildar una subtarea autoguarda al toque (server-side) y si quedan TODAS hechas, la tarea padre pasa sola a "Listo" -- así se refleja en el resumen "Tareas" del Home del cliente, que cuenta por `estado` de la tarea, no mira subtareas.
- **Drag-and-drop** en los 3 kanban (Mis tareas, Gestión COSMART, Tareas del cliente) estaba roto por un bug real: el guard anti-reapertura del modal tenía `ondragstart="this._dragged=false"` (al revés, debía ser `true`) -- corregido en los 3 lugares. Si en algún momento se copia este patrón de nuevo (`kanban-card` con `draggable`+`onclick` guardado por `_dragged`), OJO con esto.
- **Buscador de tareas**: por título, en "Mis tareas" (admin, `misTareasBuscar`) y en "Tareas" del cliente (barra superior de esa sección).
- **Archivos adjuntos en tareas**: el input ya no restringe tipo de archivo (antes bloqueaba .html y otros).
- **"Links y Archivos" del cliente**: ahora tiene carpetas de UN SOLO NIVEL (`STATE.home.archivoCarpetas` + `archivo.carpeta`, no hay subcarpetas anidadas a propósito), un buscador de archivos (busca en todas las carpetas), un menú "⋮" por archivo (mismo patrón visual que `.client-row-menu` del admin) con Abrir/Editar/Mover a carpeta/Eliminar, y un botón "📁⬆ Subir carpeta" que usa el selector nativo de carpetas del sistema operativo (`<input webkitdirectory>`) -- sube TODOS los archivos de la carpeta elegida (aplanando subcarpetas, porque acá solo hay un nivel) y los agrupa en una carpeta nueva con el nombre de la carpeta original. "Mover a carpeta" usa un `prompt()` simple, no un selector visual -- si Vaneh pide algo más prolijo ahí, es la próxima mejora obvia.
- **Borrador local de tareas** (dashboard del cliente, `js/app.js`): título, descripción, el comentario sin enviar Y las subtareas que se estén armando/editando se guardan en `localStorage` y se restauran solas si se reabre la tarea sin haber guardado -- pedido explícito porque perder subtareas ya tipeadas era "una paja". Es SOLO local al navegador (no es un draft server-side ni sincroniza entre dispositivos), se borra solo al guardar o eliminar la tarea, o si se aprieta "Descartar borrador" en el cartel que aparece. Los mismos modales del admin (`in-*`/`mt-*`/`nmt-*` en `admin/index.html`) NO tienen este borrador todavía -- si se pide ahí también, replicar el mismo patrón (`tareaDraftKey`/`guardarBorradorTarea`/`restaurarBorradorTarea` en `js/app.js`).

## ⚠️ MULTI-TENANCY (agencias) — leer esto ANTES de tocar el backend

Desde el 29/08 el Hub es multi-tenant de verdad: **cualquier agencia externa puede crear su propia cuenta** (`hub.cosmart.com.ar/signup.html` → `POST /agencia/signup`) y usa el Hub con sus propios clientes/colaboradores, totalmente aislado de COSMART y de cualquier otra agencia. Es la respuesta a "quiero venderle esto a otras agencias por USD 3/mes o 30/año" — decisión de Vaneh del 29/08, ver la sección de pendientes reales abajo.

- **Todo el trabajo pesado de aislamiento está en el backend** (`cosmart-workers/workers/marketing-hub/src/index.js`) — cada usuario tiene un `agencyId`; COSMART es la agencia por default (`'cosmart'`) y sigue usando las claves de KV de siempre, sin prefijo (cero riesgo para los datos ya en producción); cualquier agencia nueva usa claves prefijadas `agencia_{id}:`. **Regla dura, no romper nunca**: el `agencyId` sale SIEMPRE del usuario ya autenticado (`requireAdmin`/`requireAdminOrColaborador`), nunca del body/query de la request — si se agrega un endpoint nuevo que toca `_clients`, `_colaboradores`, datos de cliente o archivos, tiene que leer el agencyId de ahí. Ver el comentario grande al principio del archivo del worker para el detalle completo.
- El frontend (este repo) es el MISMO para todas las agencias — no hay branding por dominio. `js/auth.js` guarda `agencyId`/`agenciaNombre`/`agenciaLogoUrl` en la sesión al loguearse; `admin/index.html` swapea el logo/nombre del sidebar si `agencyId !== 'cosmart'` (ver el bloque justo después de `requireAuth` en el script de `admin/index.html`).
- **"Agencias"**: nueva sección en el nav del admin, visible SOLO para el super-admin (el admin de la agencia COSMART, o sea Vaneh) — lista todas las agencias registradas y permite cambiar su `estado` (`trial` / `activo` / `vencido`). Una agencia en `vencido` no puede loguearse (bloqueado server-side en `handleLogin`) ni recibe los crons diarios/mensuales.
- **Lo que NO está hecho todavía** (documentado para no reinventar ni prometerlo de nuevo sin avisar):
  1. **Blanqueo de marca parcial**: el sidebar del panel admin sí cambia (logo/nombre) y el login muestra el logo de la agencia si se entra por `login.html?agencia=slug` (ver sección de suscripción más abajo), pero **todos los emails automáticos** (bienvenida, informes, recordatorio de facturación, resumen mensual, tareas que vencen) siguen saliendo con el remitente/firma/logo de COSMART (`emailBase`, `FIRMA`, `FOOTER`, `SERVICIOS_BLOCK` en el worker) — solo el destinatario (`to`) y el nombre visible cambian por agencia, no el diseño del email en sí. Corregir esto a fondo (blanquear `emailBase` por agencia, sacar el bloque "también hacemos esto" para no-COSMART) es una tarea aparte y grande — hay ~10 templates (`tplBienvenida`, `tplArranque`, `tplReporte`, etc.) que habría que parametrizar con la agencia, no trivial porque el remitente real (`info@cosmart.com.ar`) tiene que seguir siendo el dominio verificado en Brevo — no se puede mandar "de" cualquier email sin verificar el dominio.
  2. **Métricas de email (Brevo cross-vertical)** quedan restringidas a COSMART únicamente (`handleEmailStats` devuelve 501 para otras agencias) — depende de tags propios de las verticales de COSMART, no generaliza sin que cada agencia conecte su propio Brevo.
  3. `login.html` sigue mostrando siempre la marca/verticales/cursos de COSMART como contenido de la página — lo único que cambia por agencia es el logo del box de login cuando se entra con `?agencia=slug` (ver abajo). Es a propósito: la página sigue siendo un buen escaparate de COSMART para cualquiera que aterrice ahí.
  4. No hay plan de features por tier (todas las agencias ven exactamente las mismas funciones que COSMART) — si en algún momento se quiere un plan más limitado, es trabajo aparte.

## 💳 Suscripción de agencias — cobro automático (30/08)

Ya no hace falta que Vaneh active/desactive agencias a mano. Landing de venta en `gestion-de-clientes-para-agencias.html` (persuasiva, con precio dinámico) → `signup.html` (Paso 1: alta de cuenta → Paso 2, en la misma página sin salir: elegir mensual/anual y pagar con Mercado Pago o PayPal). Al confirmarse el pago, el backend pone `estado: 'activo'` solo.

**7 días gratis (30/08, pedido explícito de Vaneh)**: se carga la tarjeta en el Paso 2 igual que antes, pero tanto el `preapproval` de MP (`auto_recurring.free_trial: {frequency:7, frequency_type:'days'}`) como el Plan de PayPal (billing_cycles con un ciclo `TRIAL` de 7 días a $0 antes del ciclo `REGULAR`) hacen que el primer cobro real recién pase el día 8 — la agencia queda `estado:'activo'` desde el minuto uno (MP devuelve `authorized` y PayPal `ACTIVE` aunque estén en el período de trial).

- **Precio vigente**: `precioVigente()` en el worker decide el escalón USD según la fecha del servidor — USD 3/mes hasta el 31/08/2026, se extiende a USD 3/mes hasta el 30/09/2026, y desde octubre sube a USD 5/mes (anual siempre USD 30, fijo). Esto es SOLO el precio que ve alguien nuevo — una agencia que ya se suscribió sigue pagando el monto que tenía hasta que Vaneh lo cambie a mano. `GET /precio-vigente` (público) lo expone para la landing y el signup.
- **Mercado Pago cobra en ARS** (igual que `training`: sin cotización en vivo, precio fijo que Vaneh edita ella misma desde Panel admin → Agencias → "Precio de Mercado Pago (ARS)", sin tocar código). Se usa `preapproval` de la API de MP con `card_token_id` (tokenizado en el browser con `mp.createCardToken()`, igual que en `training/carrito.html` pero con un form propio ya que no hay Brick de suscripciones) — nunca sale de la página. **PayPal cobra en USD** vía Plans + Subscriptions (`paypal.Buttons({createSubscription...})`, embebido, sin redirect) — el Product/Plan de PayPal se crean solos la primera vez que hace falta cada escalón de precio (`obtenerPlanPaypal`), no hay que crearlos a mano en el dashboard.
- **Webhooks**: `POST /webhook/mp-suscripcion` y `POST /webhook/paypal-suscripcion` — ninguno de los dos confía en el body del evento; ambos vuelven a pedirle el estado real a la API del proveedor antes de tocar `estado`. El de PayPal además verifica la firma del webhook contra `PAYPAL_WEBHOOK_ID` — si ese secret no está seteado, el endpoint devuelve 501 en vez de aceptar cualquier cosa sin verificar.
- **Requiere acción de Vaneh antes de que esto funcione en producción** (no lo puede hacer Claude, son credenciales/dashboard):
  1. Agregar a los secrets del worker `marketing-hub` (Cloudflare dashboard o `wrangler secret put`, NUNCA en `wrangler.toml`): `MP_ACCESS_TOKEN`, `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`. **Ojo**: los secrets de Cloudflare son de una sola vía — ni Claude ni Vaneh pueden "leer" el valor ya cargado en `cosmart-training` para copiarlo, solo sobreescribir. Hay que volver a sacarlos de la fuente original (dashboard de Mercado Pago → Credenciales de producción; developer.paypal.com → Apps & Credentials, la misma app que ya usa `training`) y cargarlos también acá.
  2. En el dashboard de Mercado Pago, registrar el webhook de "preapproval" apuntando a `https://marketing-hub.conglomeradocosmart.workers.dev/webhook/mp-suscripcion`.
  3. En el dashboard de PayPal (Apps & Credentials → la misma app que ya usa `training` → Webhooks), crear un webhook apuntando a `https://marketing-hub.conglomeradocosmart.workers.dev/webhook/paypal-suscripcion`, suscripto como mínimo a `BILLING.SUBSCRIPTION.ACTIVATED`, `BILLING.SUBSCRIPTION.CANCELLED`, `BILLING.SUBSCRIPTION.SUSPENDED`, `BILLING.SUBSCRIPTION.EXPIRED`, `PAYMENT.SALE.COMPLETED`. PayPal va a dar un Webhook ID — cargarlo como secret `PAYPAL_WEBHOOK_ID`.
  4. Cargar el precio de Mercado Pago (ARS) desde Panel admin → Agencias — arranca con una semilla de $3.000/mes y $30.000/año que hay que ajustar.
  5. Hacer una suscripción de prueba real de punta a punta (con una tarjeta propia, y cancelarla después) antes de confiar en el flujo — nunca se probó contra credenciales reales porque Claude no tiene acceso a las cuentas de MP/PayPal de COSMART.
- **Login con logo de agencia antes de loguearse**: `login.html?agencia=slug` pega a `GET /agencia-publica/:id` (público, solo devuelve nombre/logo) y reemplaza el logo del box de login — el resto de la página (tagline, verticales, cursos) queda igual para todos, a propósito.

**Rediseño de la landing (30/08, feedback duro de Vaneh sobre la primera versión)**: la primera versión de `gestion-de-clientes-para-agencias.html` (fondo claro, íconos emoji sueltos, títulos literales "Problema"/"Solución", frases como "100% aislados" o "sin ver ni un dato de nadie más") estaba mal — no seguía el sistema de marca real de COSMART. Se rehizo copiando el sistema visual de `brujula.html` (Google Drive, aprobado por Vaneh): fondo navy oscuro, navbar sticky con el logo real de COSMART en una placa blanca, textos con Playfair Display + acentos celestes, cards traslúcidas con borde `rgba(58,143,199,...)`. Los íconos ahora son **Lucide** (`unpkg.com/lucide@latest`, mismo sistema que ya usa `admin/index.html` en el nav — nunca más emoji sueltos como ícono), coloreados celeste/blanco vía `currentColor`. La copy sigue estructura PAS (dolor → agitar → solución) sin titular literalmente las secciones así. Se agregó un mockup estático (no una captura real) del panel con datos de ejemplo ("Cliente Demo") para mostrar cómo se ve por dentro sin exponer nada real.

**Favicon con fondo blanco (30/08) — el bug estaba en `training`, no acá**: Vaneh se quejó de un favicon de COSMART con fondo blanco (debería ser transparente, como en cosmart.com.ar) y de que `training.cosmart.com.ar` mostraba ese mismo favicon en vez del gorrito de graduación propio. Investigado: **el archivo `app/favicon-cosmart.png` de ESTE repo ya era transparente** (canal alfa confirmado con Pillow) — nunca fue el problema acá. La causa real vivía en `training`: un commit del 29/08 a la noche (`9b698c0`, ver `training/HANDOFF.md`) había reemplazado el gorrito de `training` por la C de COSMART sobre fondo blanco + una franja "TRAINING", que es exactamente lo que Vaneh describió. Se revirtió ese diseño en `training` (ver su HANDOFF). Acá solo se le agregó `?v=2` a las referencias de favicon (`admin/index.html`, `login.html`, `signup.html`, `app/index.html`, la landing) por las dudas, ya que los favicons se cachean muy agresivo en el navegador — pero el archivo en sí nunca estuvo roto.

## Arquitectura

- **Cloudflare Pages**, deploy automático al pushear a `main` (no hace falta ningún paso manual).
- `admin/index.html`: panel admin (colaboradores + admin de COSMART). Todo el JS vive en un único `<script type="module">` inline gigante.
- `app/index.html` + `js/app.js`: panel de cliente (lo ve tanto el cliente final como, con más permisos, colaboradores/admin logueados como ese cliente vía "Ver panel").
- `js/data.js`: toda la capa de acceso a datos (`api()` pega contra el worker `marketing-hub` en `AquiVane/cosmart-workers`; hay un `DEMO_MODE` con `localStorage` si no hay worker configurado).
- `css/style.css`: estilos compartidos por `admin/` y `app/`.
- Backend real: repo hermano `AquiVane/cosmart-workers`, worker `marketing-hub`, KV `MH_DATA` (datos por cliente) y `MH_USERS` (login). Ver su propio `HANDOFF.md` para cron, emails automáticos, etc.

## Modelo de datos (resumen)

- **Cliente**: `{ id, nombre, codigo, email, activo, instagram(s), facebook, tiktok, youtube, linkedin, website(s), metaBusinessId, notas, usuarios: [{nombre, apellido, email, telefono, rol, cargo, instagram, linkedin, tiktok, facebook}], facturacion: { [año]: { [mes 1-12]: { enviada: bool, pago: bool } } } }`.
- **Colaborador**: `{ email, nombre, codigo, clientIds, activo }`. Solo ve/edita los clientes en `clientIds`.
- **Tarea**: `{ id, numero, titulo, estado, prioridad, vencimiento, fechaInicio, esProyecto, notas, recurrencia, diasSemana, linkRef, subtareas: [{titulo, done, asignado:{email,nombre}}], imagenes, comentarios, asignado:{email,nombre,asignadoPor}, visibleParaCliente, completadoEn, vertical (solo en `_cosmart`) }`.
- **Pseudo-clientes**: `_cosmart` (COSMART interno — las tareas tienen `vertical`) y `_personal` (tareas personales por persona, filtradas por `asignado.email`; excepción: `ger@cosmart.com.ar` puede ver también las personales de `vaneh@cosmart.com.ar`, solo esas).

## Sistema de códigos de tarea (`#COD-01`)

Cada tarea muestra `${CODIGO}-${numero con 2 dígitos}` antes del título, en TODAS las vistas (Kanban, Lista, calendario, título de modal).

- Cliente real → `client.codigo` (se autosugiere con `codigoDesdeNombre()` al crear el cliente — primera letra de las dos primeras palabras del nombre — pero es editable).
- `_cosmart` → `VERTICAL_CODIGO[t.vertical] || 'CS'`. Mapa: `Training→TR, Rumbo Voraz→RV, ComuniCOS→CO, MPG→MPG, Design→DG, Shows→SW, Talent→TL, Brújula→BRJ, Euforia→EF`.
- `_personal` → código del colaborador (`colaborador.codigo`, editable al crear/editar colaborador); Vaneh tiene el código hardcodeado `VH` (constante `VANEH_CODIGO`).
- La numeración (`numero`) es **por grupo, no global**: por cliente completo (cada cliente ya tiene su propio array en KV), por `vertical` dentro de `_cosmart`, y por `asignado.email` dentro de `_personal`.
- Tareas viejas sin `numero`: botón "Numerar tareas existentes" en Configuración (admin) — migración idempotente, solo toca tareas sin número, agrupando igual que arriba.

## Proyectos (`esProyecto`)

Una tarea marcada como proyecto tiene además `fechaInicio` (además de `vencimiento`, que pasa a leerse como "fecha de finalización"). Se ve en azul marino (`var(--primary-dark)`, texto blanco, prefijo 🔷) y ocupa su **rango completo** (no solo el día de vencimiento) en:
- Calendario de Tareas del panel cliente, calendario de Gestión COSMART, calendario de Mis Tareas (admin).
- Tarjetas Kanban y de Lista en las tres superficies: Tareas (panel cliente), Gestión COSMART, Mis Tareas (admin, tanto Kanban como Lista).

El checkbox "🔷 Es un proyecto" + campo "Fecha de inicio" existe en **todos** los modales de tarea: `tf-*` (panel cliente, `app/index.html`/`js/app.js`), `in-*` (Gestión COSMART), y — agregado 29/08 tras un reclamo explícito de Vaneh porque faltaba — `mt-*` (editar desde Mis Tareas) y `nmt-*` (Nueva tarea desde Mis Tareas). Los cuatro usan el mismo patrón: checkbox `onchange="toggleXEsProyecto()"` que muestra/oculta el grupo de fecha de inicio y renombra el label de vencimiento.

Mismo patrón aplicado el 30/08 al selector de **Recurrencia** (`recurrencia`/`diasSemana`, ya existía solo en `tf-*`): ahora también está en `in-*`, `mt-*` (solo si `tipo === 'tarea'`, igual que "Es un proyecto") y `nmt-*`, con `toggleXRecurrencia()` mostrando/ocultando el grupo de días específicos.

## Facturación

Botón "🧾 Facturación" en el menú de cada cliente (admin, `☰` junto a cada fila de cliente) → modal con selector de año + los 12 meses, checkbox de "factura enviada" y "pago recibido" por mes, se guarda en `client.facturacion`. Backend (cron diario del worker): día 25 le manda un mail a Vaneh listando clientes sin factura del mes marcada; día 5 le crea a `ger@cosmart.com.ar` una tarea por cada cliente que ya tiene asignado, para revisar si llegó el pago del mes anterior (pensado para extenderse a todos los clientes cuando Ger esté asignado a todos).

## Métricas generales (placeholder)

En la sección "Métricas" (antes "Métricas de email"), arriba de las métricas de email reales hay tiles "Próximamente" para: Ventas, Nuevos clientes, Facturación actual, Potenciales clientes (leads de imanes/Método/Brújula). Al tocar un tile se abre un modal explicando qué va a mostrar cuando se sumen esos datos. Es solo estructura, no hay datos reales todavía.

## Reordenar clientes y responsable de proyecto

Botones ▲▼ en cada fila de Clientes (solo admin) que llaman a `POST /admin/clients/reorder` (reescribe el array `_clients` completo en el orden pedido). El "Responsable de proyecto" que ya existía al crear un cliente ahora también se guarda en el propio registro del cliente (`client.responsable = {email, nombre}`) — antes solo se usaba para darle acceso al colaborador y no quedaba nada persistido — y se muestra al lado del nombre en la fila. Editable también desde "Editar cliente".

## Procesos (sección nueva, interno)

Nav "Procesos" — **solo colaboradores y admin, el cliente no tiene acceso ni lo ve en su panel** (confirmado explícitamente por Vaneh). Selector arriba para elegir cliente real o COSMART (con su propio desplegable de verticales, mismo listado que ya usa Gestión COSMART). Menú izquierdo tipo carpeta con los procesos de ese cliente/vertical — cada proceso puede tener subprocesos opcionales (submenú) — contenido a la derecha, 100% editable (nombre + texto libre), con crear/guardar/eliminar tanto de procesos como de subprocesos. Persistido vía el endpoint genérico `/data/:clientId/:type` que ya existía en el worker (tipo nuevo `procesos`, no hizo falta tocar el backend — no tiene whitelist de tipos). Para `_cosmart`, todos los procesos de todas las verticales viven en un único array (`_cosmart:procesos`), cada uno con un campo `vertical` opcional (null = "General") — mismo patrón que ya usan las tareas internas.

## Presupuesto de pauta e importar procesos (29/08)

En Procesos, arriba (solo para clientes reales, no `_cosmart`): presupuesto total manual + asignado por Meta/Google/TikTok/LinkedIn Ads + plataformas custom, guardado en `client.presupuesto = {total, porPlataforma, otras}`. Ese mismo dato se compara en el panel del cliente (Pauta Digital) contra la suma real de `presupuesto` de las campañas cargadas — si se pasan, aparece un aviso rojo ahí. Botón "Importar" en Procesos: pegar texto o subir `.txt` crea un proceso nuevo (Word: copiar/pegar el texto, no se parsea el `.docx` — decisión de alcance, no bug).

## Drag and drop en los tableros Kanban

Los tres Kanban (Tareas del panel cliente, Gestión COSMART, Mis Tareas admin) tienen `draggable` + listeners de `dragstart/dragover/drop` para mover tarjetas entre columnas. Se detectó y arregló un bug real: faltaba `e.dataTransfer.setData('text/plain', ...)` en el `dragstart` — sin eso Firefox no dispara el drag en absoluto (Chrome es más permisivo). Ya está aplicado en los tres.

**Estado real (29/08, después del fix de arriba): Vaneh reportó que TODAVÍA no puede mover tarjetas de una columna a otra salvo scrolleando hasta arriba de todo.** No se identificó la causa raíz con certeza (candidatos: el `.kanban-board` es `overflow-x:auto` con columnas `flex:1` que pueden necesitar scroll horizontal, y el drag nativo de HTML5 no auto-scrollea contenedores; o algún problema de coordenadas/scroll de página). **Esto sigue roto — no lo des por solucionado.** Antes de volver a intentar un fix con drag nativo, considerar directamente agregar un control no-drag confiable en cada tarjeta Kanban (botones "→" o un `<select>` de estado, como ya tiene la vista Lista) para no depender de HTML5 DnD, que ya falló dos rondas seguidas.

## Reglas duras aprendidas a los golpes

- IDs duplicados entre modales hermanos rompen `getElementById` en silencio (pasó con `editClientModal`/`editColaboradorModal` compartiendo `ec-nombre`/`ec-activo` — arreglado renombrando a `ecl-*`). Gerpeá antes de reusar un prefijo corto.
- Nunca asumas que un fix de estilo/UX aplicado en una superficie (ej. el calendario) se propagó a las otras (Kanban, Lista) — hay que tocar cada render function por separado, son independientes.
- Vaneh es muy precisa con lo que pide — no le atribuyas quejas que no dijo, y si un pedido ya se hizo antes y ella dice que "no está hecho", asumí que hay un bug real (no que ella se equivoca) y volvé a revisar el código, no solo a repetir el fix anterior.

## Pendiente real

- **Drag and drop de Mis Tareas / Kanban en general sigue sin funcionar bien para Vaneh** (ver sección de arriba) — es lo más urgente para retomar.
- Newsletter evergreen (12 ediciones) vive en `cosmart-training-core` (otro repo), no en este.
- Analytics: confirmado que se quiere conectar más adelante, no arrancado.
