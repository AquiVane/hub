---
name: cargar-campana-meta-ads
description: Guía paso a paso para cargar una campaña de pauta paga en Meta Ads Manager (Facebook/Instagram) para cualquier cliente de COSMART, cubriendo las decisiones donde más se pifia -- objetivo de campaña, CBO vs ABO, destino del tráfico y el botón de CTA correcto según ese destino. Usar SIEMPRE que alguien del equipo (Vaneh o un colaborador) vaya a crear, revisar o corregir una campaña en Meta Ads Manager, o pregunte cosas como "qué objetivo elijo", "CBO o ABO", "qué botón le pongo", o mencione cargar/armar/subir una campaña de Meta/Facebook/Instagram Ads. También usar como checklist antes de publicar una campaña ya armada, y para actualizar el registro correspondiente en Pauta Digital del Hub una vez publicada.
---

# Cargar una campaña en Meta Ads Manager

Esta guía es para el equipo humano de COSMART (no es código del Hub). Nació de errores reales
al cargar campañas para Lambo Energy en septiembre 2026 -- entre otros, elegir el botón de CTA
equivocado. La idea es que cualquiera que la siga llegue al mismo resultado correcto, sin
depender de que alguien se acuerde de memoria.

## Antes que nada: los labels de Meta cambian

Meta actualiza la interfaz de Ads Manager seguido -- nombres de botones, orden de pantallas,
hasta objetivos enteros aparecen y desaparecen. Todo lo que dice esta guía sobre nombres exactos
de botones/menús está confirmado a la fecha en que se escribió cada sección, pero **antes de
tocar algo, mirá la pantalla real y confirmá que el label coincide** con lo que dice acá. Si no
coincide, andá con lo que ves en pantalla, no con lo que dice esta guía -- y de paso, actualizá
esta guía (o pedile a Claude que la actualice) para que no se repita el desfasaje. Esta guía se
va a ir corrigiendo con el tiempo; no la trates como verdad fija.

## Paso 1 — Elegir el objetivo de campaña según qué resultado buscás

El error más caro es elegir el objetivo equivocado, porque Meta optimiza la entrega del anuncio
para lo que le pediste, no para lo que en realidad querés. Preguntate primero: **¿qué acción
concreta quiero que haga la persona que ve el anuncio?**

- **Quiero que me sigan / crecer el perfil** → Objetivo **Tráfico**, destino **Perfil de
  Instagram**. No existe un objetivo nativo de "conseguir seguidores" en Meta -- Tráfico
  apuntando al perfil es el approach estándar. Usalo especialmente cuando la cuenta todavía
  tiene pocos seguidores: con poca base, un objetivo de conversión/leads no tiene con qué
  optimizar (Meta necesita datos históricos de gente calificada para aprender, y con pocos
  seguidores esa audiencia semilla no existe todavía).
- **Quiero captar contactos/leads con una landing propia** (ej. un formulario para
  distribuidores) → Objetivo **Clientes potenciales (Leads)** o **Tráfico**, destino **Sitio
  web**, apuntando a la URL de la landing. Para que esto funcione de verdad (no solo medir
  clics) hace falta el **Pixel de Meta instalado en ESE dominio específico** -- si la landing
  vive en un dominio o sitio distinto al que ya tiene el Pixel instalado (ej. la tienda
  Shopify), hay que instalar el Pixel ahí también, si no Meta no puede medir ni optimizar la
  conversión real.
- **Quiero que me escriban directo** (click-to-chat, sin landing ni formulario) → Objetivo
  **Interacción** o **Clientes potenciales**, eligiendo **Mensajes/WhatsApp** como destino.

Si tenés dudas sobre cuál corresponde a tu caso y no es ninguno de estos tres, no adivines --
preguntá antes de crear la campaña.

Esta elección de destino la hacés en una pantalla que se llama **"Conversión" → "Ubicación de
la conversión"**, con estas opciones (confirmado en pantalla real, septiembre 2026): Video en
directo de Instagram, Sitio web, Aplicación, Destinos del mensaje, **Instagram o Facebook**
("Envía tráfico a un perfil de Instagram, a una página de Facebook o a ambos"), Llamadas. Para
"quiero que me sigan" elegís **Instagram o Facebook**.

### ⚠ Problema común: "Conectar perfil" pide loguearse de nuevo aunque Instagram ya esté vinculado

Si en el nivel del anuncio, en "Destino", el checkbox de **Perfil de Instagram** aparece con un
botón **"Conectar perfil"** en vez de dejarte tildarlo directo -- incluso si el cliente te dijo
que "ya conectó Instagram" -- es porque **hay dos vínculos distintos y son independientes**:

1. **Vincular Instagram a la Página de Facebook** (`facebook.com/settings/?tab=linked_profiles`
   → Cuentas vinculadas → Instagram). Esto es un vínculo orgánico entre la Página y el
   Instagram -- típicamente lo hace el cliente. **No alcanza para poder usarlo en anuncios.**
2. **Agregar la cuenta de Instagram como activo del Business Manager** de la agencia. Esto es
   lo que realmente habilita que la cuenta publicitaria pueda usar ese perfil como destino de un
   anuncio, y **lo tiene que hacer el cliente** (o quien tenga acceso a esa cuenta de Instagram),
   no la agencia -- ser administrador del Business Manager no da acceso automático al Instagram
   de otra empresa, el Instagram se agrega como activo aparte.

Si el cliente dice que "ya está conectado" pero el checkbox sigue pidiendo login, es casi
seguro que solo se hizo el paso 1. Pasale esto al cliente para que haga el paso 2 -- hay dos
formas:

**Opción 1 (recomendada) — desde la app de Instagram, sin compartir contraseña con nadie:**
1. Abrir la app de Instagram con la cuenta de la empresa (tiene que ser cuenta profesional:
   Business o Creador).
2. Perfil → Menú (☰) → Configuración y actividad → Cuenta (en algunas versiones: "Panel
   profesional").
3. Buscar "Portafolio de negocios" o "Compartir acceso a Meta Business Suite".
4. Elegir "Conectar a un portafolio de negocios".
5. Buscar el negocio de la agencia por nombre (si el cliente ya te dio de alta como admin del
   Business Manager, el negocio le va a aparecer directo en la lista) y seleccionarlo.
6. Confirmar la conexión.

Con esto el Instagram queda como activo del Business Manager, y cualquiera que ya sea admin del
negocio (la agencia) tiene acceso automático -- no hace falta ningún paso extra de nuestro lado.

**Opción 2 (alternativa, si la app del cliente es una versión vieja que no tiene esa opción) —
desde la computadora, requiere compartir la contraseña de Instagram:**
1. `business.facebook.com`, logueado como admin del negocio.
2. Configuración del negocio → Cuentas → Cuentas de Instagram → Agregar.
3. Iniciar sesión con usuario y contraseña del Instagram de la empresa para autorizar.

Usá la Opción 2 solo si la 1 no está disponible -- implica que el cliente comparta su
contraseña de Instagram, que conviene evitar siempre que se pueda.

## Paso 2 — CBO o ABO (Estrategia de presupuesto)

Esta decisión aparece en la pantalla de **Presupuesto**, dentro de "Estrategia de presupuesto",
a nivel CAMPAÑA (no conjunto de anuncios). Vas a ver dos opciones:

- **"Presupuesto de la campaña"** = **CBO** (Campaign Budget Optimization). Cargás un monto
  total y Meta lo reparte solo entre los conjuntos de anuncios de esa campaña, dándole más
  plata al que mejor esté rindiendo.
- **"Presupuesto del conjunto de anuncios"** = **ABO** (Ad Set Budget Optimization). Vos
  definís cuánto gasta cada conjunto de anuncios, sin que Meta mueva plata entre ellos.

**Regla práctica:**

- **Usá ABO** cuando la campaña tiene un solo conjunto de anuncios, o cuando el presupuesto
  total es chico, o cuando la cuenta/píxel es nuevo y todavía no hay datos históricos. Con poco
  presupuesto y poca data, CBO puede repartir mal y "matar" un conjunto de anuncios antes de
  darle tiempo a demostrar si funciona.
- **Pasá a CBO** cuando corrés 2 o más conjuntos de anuncios en paralelo dentro de la misma
  campaña (ej. probando distintas audiencias o creativos) y hay presupuesto suficiente para que
  el algoritmo junte datos de cada uno antes de decidir dónde poner más plata.

Si elegiste ABO, vas a ver un checkbox debajo que dice algo como **"Comparte hasta el 20% de tu
presupuesto con otros conjuntos de anuncios"**. Es una mezcla intermedia entre ABO y CBO: deja
que un conjunto de anuncios le pida prestado presupuesto a otros de la misma campaña, hasta ese
20%, si está encontrando más oportunidades.

- Si la campaña tiene **un solo conjunto de anuncios**, esta opción no hace nada -- no hay
  "otros conjuntos" con quién compartir. Da igual tildarla o no.
- Con **2 o más conjuntos**: dejala destildada mientras la campaña es nueva y estás juntando
  datos por conjunto por separado (para poder comparar cada uno limpio). Una vez que ya sepas
  cuál anda mejor, tildarla le da un poco de margen de maniobra a Meta sin perder del todo el
  control que buscabas al elegir ABO.

Con un solo conjunto de anuncios, da lo mismo cuál elijas -- en ese caso dejá ABO por default,
es más predecible.

## Paso 3 — Conjunto de anuncios

Dentro del conjunto de anuncios, el orden real en pantalla (confirmado septiembre 2026) es:
Conversión (ver Paso 1) → **Identidad** → opciones de optimización avanzada → **Presupuesto y
calendario** → Audiencia → Ubicaciones. No es el orden "lógico" que uno esperaría (audiencia y
presupuesto antes que identidad), pero es como Meta lo muestra -- seguilo en ese orden en vez de
buscar cada sección por tema.

### 3.1 — Identidad

Acá elegís desde qué perfil/página corre el anuncio. **Tiene que ser el de la marca del
cliente**, y tanto la Página de Facebook como el Perfil de Instagram tienen que estar
previamente conectados como activos (ver el problema común de arriba si todavía no lo están).

Regla clave: **elegí el activo que coincide con el destino que definiste en el Paso 1, no los
dos**. Si el destino de la conversión es solo Instagram (ej. "quiero que me sigan"), dejá
seleccionado únicamente el Perfil de Instagram -- no hace falta tildar también la Página de
Facebook si no vas a mandar tráfico ahí.

### 3.2 — Opciones de optimización avanzada

Vas a encontrar estos campos, generalmente opcionales:

- **Objetivo de coste por resultado**: dejalo **vacío** en una campaña nueva. Forzar un costo
  objetivo sin datos históricos reales puede limitar la entrega en vez de ayudarla -- Meta
  todavía no sabe cuánto cuesta de verdad conseguir un resultado para este anuncio puntual.
- **Reglas de valor** ("Crear un conjunto de reglas"): no las crees para una campaña nueva. Son
  para diferenciar la importancia de audiencias/ubicaciones específicas cuando ya hay historial
  de qué segmento vale más -- prematuro sin datos.
- **Tipo de entrega**: dejalo en **Estándar** (no lo cambies a Acelerado salvo que haya una razón
  puntual de urgencia, tipo una promo con fecha límite muy corta).
- **"Anuncio con video en directo"**: dejalo en **No**, salvo que el anuncio sea de verdad un
  video en vivo/streaming (Live de Instagram o Facebook). Un video grabado normal no es esto,
  aunque el nombre pueda confundir.

### 3.3 — Presupuesto y calendario

- Meta pide presupuesto **diario** o total del conjunto de anuncios, no mensual. Si el monto que
  tenés (ej. cargado en Pauta Digital del Hub) es mensual, dividilo por la cantidad de días que
  va a correr para saber el diario.
- **Si arrancás la campaña a mitad de mes, prorrateá el presupuesto a los días reales que van a
  correr, no al mes completo** -- ej. un presupuesto mensual de $945.000 arrancando el día 20 se
  reparte entre los 11 días que quedan hasta fin de mes ($945.000 ÷ 11 ≈ $85.900/día), no entre
  30 días. Es un error fácil de cometer si copiás el número mensual tal cual sin fijarte qué día
  es hoy.
- Calendario: fecha de arranque real → fin del período que ya cargaste para esa campaña en el
  Hub, para que después sea fácil cruzar los números.

### 3.4 — Audiencia

Definila según el objetivo del Paso 1 -- para growth/awareness, audiencia amplia por intereses
relevantes (ej. fitness, deporte, según el rubro del cliente); para B2B/distribuidores, audiencia
mucho más acotada (rubro, cargo/función, ubicación geográfica concreta). Si ya existe una
campaña hermana con la misma audiencia (ej. otra campaña de growth del mismo cliente), reusá la
misma definición en vez de rearmarla de cero. Nada de públicos similares/lookalike con una base
de seguidores chica (mínimo recomendado ~1.000+).

### 3.5 — Ubicaciones

Si el creativo es un video vertical (9:16), elegí ubicaciones **manuales** restringidas a
Stories/Reels/Historias -- en ubicaciones automáticas Meta puede mostrarlo también en formatos
horizontales donde un video vertical se recorta mal.

## Paso 4 — El anuncio: creativo, copy y el botón de CTA correcto

- Subí el creativo (imagen o video) ya revisado -- ver más abajo qué chequear en un video antes
  de subirlo.
- El copy tiene que estar escrito para el destino elegido en el Paso 1. Un copy pensado para
  WhatsApp ("escribinos por WhatsApp") no sirve si el destino real es una landing o el perfil de
  Instagram -- revisalo y ajustalo cada vez que cambie el destino, no reuses el mismo texto para
  todo.
- **El botón de CTA depende pura y exclusivamente del destino que elegiste**, no es una elección
  de gusto:
  - Destino **Perfil de Instagram** → **"Ir al perfil de Instagram"**.
  - Destino **Sitio web** → CTA orientado a la acción real (ej. "Más información",
    "Registrarte"), no "Enviar mensaje" (ese es para destino WhatsApp).
  - Destino **WhatsApp** → **"Enviar mensaje"**.

  Si el botón que ves en pantalla no coincide con ninguno de estos, es porque Meta cambió algo
  -- fijate cuál corresponde al destino elegido en esa pantalla puntual, no fuerces uno de esta
  lista si no aparece.

### Antes de subir un video: mini-checklist

- ¿La medida es la que corresponde a la ubicación? (9:16 = 1080×1920 para Stories/Reels; 1:1 o
  4:5 para Feed). Un video de 1080×1896 o similar, unos pixeles corto de 1920, generalmente pasa
  sin problema, pero si tenés el archivo fuente, exportalo a la medida exacta.
- ¿El texto en pantalla tiene typos u errores de mayúsculas/minúsculas mezcladas? Revisalo cuadro
  por cuadro si hace falta, un typo en un headline grande se nota mucho.
- ¿Tiene audio con música de fondo? Confirmá que sea libre de derechos o producida para la pieza
  -- si tiene una pista comercial sin licencia, Meta puede silenciarlo o rechazarlo en revisión.
- Si el video termina con un CTA nativo tipo "seguinos" (no un hard-sell), suele rendir mejor
  publicado como contenido nativo primero (orgánico) y después boosteado, en vez de forzarlo
  directo como pauta fría desde el arranque.

## Paso 5 — Después de publicar: actualizar el Hub

Publicar en Meta Ads Manager es solo la mitad del trabajo. En el Hub (sección **Pauta Digital**
del cliente correspondiente):

1. Buscá el registro de esa campaña (debería existir ya, salvo que sea la primera vez que se
   carga -- si no existe, creala con "+ Nueva campaña", ver `HANDOFF.md` del repo `hub` para el
   detalle de esos campos).
2. Cambiá el **Estado** de "Borrador" a "Activa" -- una campaña nueva arranca en Borrador a
   propósito, así no cuenta como "trabajo realizado" hasta que de verdad esté corriendo con
   datos reales.
3. A medida que tengas métricas reales desde Meta Ads Manager (impresiones, alcance, clics,
   gastado, conversiones), cargalas ahí -- el ROAS y el resto de los cálculos se arman solos a
   partir de esos números.

## Glosario rápido

- **CBO** (Campaign Budget Optimization): Meta reparte un presupuesto único entre varios
  conjuntos de anuncios de una misma campaña, solo, según cuál rinde mejor.
- **ABO** (Ad Set Budget Optimization): vos fijás el presupuesto de cada conjunto de anuncios
  por separado, sin reparto automático entre ellos.
- **Objetivo de campaña**: lo primero que se elige al crear una campaña en Meta -- le dice al
  algoritmo qué resultado optimizar (tráfico, leads, interacción, ventas, etc.). Todo lo demás
  se configura después, en función de esto.
- **Conjunto de anuncios (ad set)**: el nivel intermedio entre campaña y anuncio -- ahí se
  define audiencia, presupuesto (si es ABO), ubicaciones y calendario. Una campaña puede tener
  uno o varios conjuntos de anuncios.
- **Pixel**: un código que se instala en un sitio web para que Meta pueda medir qué pasa después
  de que alguien hace clic en el anuncio (visitó la página, completó un formulario, compró).
  Vive atado a un dominio específico -- si mandás tráfico a un dominio nuevo, hay que instalarlo
  ahí también, no alcanza con tenerlo en otro sitio del mismo cliente.
- **CAPI** (Conversions API): una forma más confiable de mandarle a Meta los mismos eventos que
  mide el Pixel, pero directo desde el servidor en vez del navegador -- se usa como complemento
  del Pixel, no como reemplazo.
- **Destino de tráfico**: a dónde llega la persona al tocar el anuncio (perfil de Instagram,
  sitio web, WhatsApp, etc.) -- define tanto el copy como el botón de CTA que corresponde usar.
