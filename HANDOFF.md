# HANDOFF — hub (frontend, Marketing Hub de COSMART)

Actualizado: 2026-08-29. Léelo entero antes de tocar código o responder preguntas sobre el estado del proyecto.

## ⚠️ MULTI-TENANCY (agencias) — leer esto ANTES de tocar el backend

Desde el 29/08 el Hub es multi-tenant de verdad: **cualquier agencia externa puede crear su propia cuenta** (`hub.cosmart.com.ar/signup.html` → `POST /agencia/signup`) y usa el Hub con sus propios clientes/colaboradores, totalmente aislado de COSMART y de cualquier otra agencia. Es la respuesta a "quiero venderle esto a otras agencias por USD 3/mes o 30/año" — decisión de Vaneh del 29/08, ver la sección de pendientes reales abajo.

- **Todo el trabajo pesado de aislamiento está en el backend** (`cosmart-workers/workers/marketing-hub/src/index.js`) — cada usuario tiene un `agencyId`; COSMART es la agencia por default (`'cosmart'`) y sigue usando las claves de KV de siempre, sin prefijo (cero riesgo para los datos ya en producción); cualquier agencia nueva usa claves prefijadas `agencia_{id}:`. **Regla dura, no romper nunca**: el `agencyId` sale SIEMPRE del usuario ya autenticado (`requireAdmin`/`requireAdminOrColaborador`), nunca del body/query de la request — si se agrega un endpoint nuevo que toca `_clients`, `_colaboradores`, datos de cliente o archivos, tiene que leer el agencyId de ahí. Ver el comentario grande al principio del archivo del worker para el detalle completo.
- El frontend (este repo) es el MISMO para todas las agencias — no hay branding por dominio. `js/auth.js` guarda `agencyId`/`agenciaNombre`/`agenciaLogoUrl` en la sesión al loguearse; `admin/index.html` swapea el logo/nombre del sidebar si `agencyId !== 'cosmart'` (ver el bloque justo después de `requireAuth` en el script de `admin/index.html`).
- **"Agencias"**: nueva sección en el nav del admin, visible SOLO para el super-admin (el admin de la agencia COSMART, o sea Vaneh) — lista todas las agencias registradas y permite cambiar su `estado` (`trial` / `activo` / `vencido`). Una agencia en `vencido` no puede loguearse (bloqueado server-side en `handleLogin`) ni recibe los crons diarios/mensuales.
- **Lo que NO está hecho todavía** (documentado para no reinventar ni prometerlo de nuevo sin avisar):
  1. **Cobro real no está conectado.** El signup deja la agencia en `estado: 'trial'` — activar el cobro (Stripe/MercadoPago/PayPal suscripción a USD 3/mes o 30/año) y que el webhook mueva el estado a `activo` automáticamente es trabajo aparte, no armado. Por ahora Vaneh cambia el estado a mano desde "Agencias" en el admin.
  2. **Blanqueo de marca parcial**: el sidebar del panel admin sí cambia (logo/nombre), pero **todos los emails automáticos** (bienvenida, informes, recordatorio de facturación, resumen mensual, tareas que vencen) siguen saliendo con el remitente/firma/logo de COSMART (`emailBase`, `FIRMA`, `FOOTER`, `SERVICIOS_BLOCK` en el worker) — solo el destinatario (`to`) y el nombre visible cambian por agencia, no el diseño del email en sí. Corregir esto a fondo (blanquear `emailBase` por agencia) es una tarea aparte, no trivial porque el remitente real (`info@cosmart.com.ar`) tiene que seguir siendo el dominio verificado en Brevo — no se puede mandar "de" cualquier email sin verificar el dominio.
  3. **Métricas de email (Brevo cross-vertical)** quedan restringidas a COSMART únicamente (`handleEmailStats` devuelve 501 para otras agencias) — depende de tags propios de las verticales de COSMART, no generaliza sin que cada agencia conecte su propio Brevo.
  4. La página de login (`login.html`) sigue mostrando la marca/verticales de COSMART siempre, incluso para agencias externas que entran a loguearse ahí — no se armó un login separado por agencia. `signup.html` sí es neutral/genérico.
  5. No hay plan de features por tier (todas las agencias ven exactamente las mismas funciones que COSMART) — si en algún momento se quiere un plan más limitado, es trabajo aparte.

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
