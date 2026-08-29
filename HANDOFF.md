# HANDOFF — hub (frontend, Marketing Hub de COSMART)

Actualizado: 2026-08-29. Léelo entero antes de tocar código o responder preguntas sobre el estado del proyecto.

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
