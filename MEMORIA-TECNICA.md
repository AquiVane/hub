# Memoria técnica — HUB de COSMART (sistema de gestión)

Documento pensado para adjuntar al trámite de **Inscripción de obra publicada/inédita (Software)** ante la DNDA, vía TAD. Describe qué es el sistema, cómo funciona y su arquitectura técnica — sin exponer código fuente, credenciales ni datos de clientes.

**Mantenimiento**: este documento se actualiza cada vez que se agrega o cambia una funcionalidad importante del sistema. No hace falta que Vaneh lo pida — es una tarea de mantenimiento continuo, igual que `HANDOFF.md`.

---

## 1. Identificación

- **Nombre de la obra**: HUB de COSMART (también referido como "Marketing Hub").
- **Tipo de obra**: software de gestión — plataforma web multi-tenant de administración para agencias de marketing.
- **Titular**: COSMART (Conglomerado Contacto Smart) — Vanesa Anahí Fernández.
- **Autor/desarrollo**: Vanesa Anahí Fernández, con desarrollo asistido por IA (Claude, de Anthropic) bajo su dirección y especificación en todas las decisiones de producto.
- **Estado**: en producción, en uso activo por COSMART y sus clientes/colaboradores desde agosto de 2026. Desde el 29/08/2026 es multi-tenant: otras agencias pueden darse de alta y usarlo con sus propios clientes.
- **Última actualización de este documento**: 07/09/2026.

## 2. Descripción general (memoria descriptiva)

El HUB de COSMART es un sistema de gestión integral para agencias de marketing digital. Centraliza, para cada agencia y cada uno de sus clientes, la planificación y seguimiento de: tareas internas y de proyecto, calendario y banco de contenidos para redes sociales, campañas de pauta paga (Meta Ads, Google Ads, TikTok Ads, LinkedIn Ads), un CRM de leads potenciales, facturación e informes mensuales, y comunicación entre agencia, colaboradores y clientes (comentarios, menciones, archivos).

Tiene tres tipos de usuario, cada uno con su propio panel:

1. **Administrador de agencia** (ej. Vaneh en COSMART): acceso total a todos los clientes, colaboradores, configuración de la agencia y — solo para el super-admin de COSMART — al listado de todas las agencias registradas en el sistema.
2. **Colaborador**: acceso a los clientes que el administrador le asignó, con los mismos módulos de trabajo (tareas, contenidos, pauta) pero sin las secciones de administración de agencia.
3. **Cliente**: panel propio, de solo lectura/colaboración sobre lo que le corresponde — ve sus tareas, su calendario de contenidos, sus campañas de pauta, sus informes, y puede comentar y subir archivos.

El sistema nació como herramienta interna de COSMART para reemplazar el uso disperso de planillas, WhatsApp y carpetas de Drive entre la agencia y cada cliente, y se convirtió en un producto que otras agencias pueden contratar por suscripción mensual/anual (Mercado Pago o PayPal), operando cada una de forma completamente aislada de las demás.

## 3. Funcionalidades principales

### Gestión de tareas
- Tareas internas de la agencia ("Gestión interna"), tareas personales del equipo ("Mis Tareas") y tareas por cliente, cada una con estado, prioridad, vencimiento, asignado, subtareas (con su propio asignado y estado), archivos adjuntos, comentarios con menciones (`@nombre`) que notifican por email, y visibilidad configurable hacia el cliente.
- Vistas Kanban (arrastrar y soltar), lista y calendario, con filtros por cliente, prioridad, colaborador y vertical de negocio.
- Tareas recurrentes (se reactivan solas según su ciclo: diario/semanal/mensual).
- Proyectos: tareas marcadas como proyecto, con checklist de colaboradores, visibles en una sección agregada.
- **Asignación a "Claude IA"**: una tarea puede asignarse a un pseudo-usuario que la ejecuta automáticamente (usando la clave de IA propia de cada agencia) en el día/horario indicado, dejando el resultado como comentario y marcando la tarea como lista.

### Contenidos para redes sociales
- Banco de contenidos con calendario editorial, filtrable por plataforma, estado del contenido, cuenta y por Orgánico/Pauta/Ambas.
- Vistas especializadas: Feed de Instagram (grilla), Muro de Facebook, Stories, Kanban por estado, banco de ideas.
- Importación masiva desde una plantilla Excel: detecta contenidos ya cargados (por título) para no duplicarlos, muestra qué campos cambiaron y deja elegir reemplazar u omitir fila por fila; permite deshacer una importación completa con un botón.
- Dashboard editorial por cliente: mapa de calor de frecuencia de publicación, gráfico de distribución por tipo de contenido, resumen de trabajo realizado en el mes (tareas, subtareas, contenidos publicados y campañas activas).

### Pauta digital (campañas pagas)
- Registro de campañas por cliente y plataforma, con presupuesto, gasto, alcance, impresiones, clics, CPM/CPC/CTR, conversiones, ingresos y ROAS (calculado automáticamente), comparado contra un ROAS de equilibrio definido por la agencia.
- Importación masiva de campañas desde Excel.
- Estado "Borrador" para campañas recién cargadas cuyos datos todavía no están confirmados — no cuentan como trabajo terminado hasta que se confirman.
- Asociación de cuentas publicitarias propias de la agencia y de cada cliente (Meta, Google, TikTok, LinkedIn), de carga manual por ahora.

### CRM de leads potenciales
- Tablero Kanban (Potencial → Email Marketing/WhatsApp → Nuevo Cliente → Seguimiento), con alta manual y alimentación automática desde eventos reales del negocio (carritos abandonados, formularios de contacto, imanes de leads, pagos fallidos/exitosos) en las distintas verticales de COSMART.
- Filtro por vertical de negocio y buscador.

### Facturación e informes
- Recordatorio automático a la agencia para emitir la factura mensual de cada cliente, y recordatorio automático al cliente si no se registra el pago pasado el vencimiento.
- Generación de informes mensuales por cliente (aprobación manual antes de enviarse) y resumen cualitativo periódico para el equipo.

### CRM y comunicación
- Comentarios con menciones (`@nombre`) en tareas y contenidos, con notificación automática por email a la persona mencionada.
- Emails transaccionales (bienvenida, asignación de tarea, mención, aprobación de contenido, informe listo, recordatorios de facturación, tareas del día/vencidas del equipo) enviados vía un proveedor externo de email transaccional.
- Webhook saliente configurable por agencia hacia su propio CRM externo, disparado en eventos clave (cliente creado, campaña creada, contenido publicado, tarea completada).
- Widget de asistente con IA embebido en el panel de administración.

### Multi-tenancy y suscripción
- Cualquier agencia externa puede darse de alta con su propia cuenta y operar con sus propios clientes, totalmente aislada de COSMART y de cualquier otra agencia (aislamiento de datos garantizado a nivel de backend, nunca confiando en datos provistos por el cliente HTTP).
- Alta con suscripción mensual o anual, cobro automático vía Mercado Pago o PayPal; una agencia con la suscripción vencida queda bloqueada automáticamente hasta regularizar el pago.
- Recorrido guiado (onboarding) interactivo en el primer ingreso, tanto para el panel de administración como para el panel de cliente, con un cliente de demostración pre-cargado para las agencias nuevas.

## 4. Arquitectura técnica

- **Frontend**: aplicación web (HTML/CSS/JavaScript, sin framework) servida como sitio estático, con tres puntos de entrada según el rol (administrador, colaborador vía el mismo panel de administración, cliente). Responsive, con prioridad explícita en la experiencia mobile.
- **Backend**: API REST corriendo sobre infraestructura serverless de borde (Cloudflare Workers), con autenticación por sesión (token) y control de acceso por rol y por agencia en cada endpoint.
- **Persistencia**: almacenamiento clave-valor distribuido (Cloudflare KV) para usuarios, sesiones, y los datos operativos de cada agencia (clientes, tareas, contenidos, campañas, leads, configuración), con las claves de cada agencia aisladas entre sí.
- **Automatizaciones programadas**: tareas recurrentes del sistema (recordatorios de facturación, resumen diario de tareas del equipo, tareas que vencen, ejecución de tareas asignadas a la IA) corren mediante procesos programados del lado del backend, sin intervención manual.
- **Integraciones externas**: proveedor de email transaccional para todos los envíos automáticos; Mercado Pago y PayPal para el cobro de suscripciones de agencia; un proveedor de modelos de lenguaje (IA) para el asistente embebido y la ejecución automática de tareas asignadas a "Claude IA", con clave propia por agencia.
- **Despliegue**: integración continua — el frontend se publica automáticamente al actualizarse el código; el backend se despliega de forma controlada mediante un flujo de integración continua con verificación previa.

## 5. Historial de cambios relevantes (para actualizar)

- **07/09/2026**: corrección de detección de duplicados en la importación de contenidos (ahora matchea por título, con la cuenta solo como desempate); botón para deshacer una importación; columna visible de Orgánico/Pauta en el banco de contenidos; estado "Borrador" para campañas de pauta recién cargadas; endpoint de equipo accesible para colaboradores (antes solo veían al admin en listas de asignación si eran admin ellos mismos); mail de tareas del equipo ahora incluye vencidas, no solo las del día.
- **03/09/2026 y anteriores**: ver `HANDOFF.md` de este repo y de `cosmart-workers` para el detalle completo, tanda por tanda, de todo lo construido desde el inicio del proyecto (multi-tenancy, CRM de leads, tareas asignadas a IA, sistema de comentarios y menciones, importación de Excel, dashboard editorial, etc.).

---

*Documento de uso interno para trámites de registro de propiedad intelectual. No contiene código fuente ni información sensible de clientes.*
