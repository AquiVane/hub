# Brief de ilustraciones y animaciones: Plantilla Plan de Ejecución COSMART

**Para quién:** otra IA (o diseñador/a) especializada en ilustración y motion. Este brief reemplaza los dibujos que Claude intentó y que Vaneh rechazó: *no volver a dibujarlos con código a mano*.

**Archivo:** `plantillas/Plantilla_Plan_Ejecucion_COSMART.html`. Buscar `SLOT ILUSTRACIÓN` (4 lugares). No tocar nada más: textos, tipografías (Playfair Display + DM Sans, sin monoespaciada ni cursivas) y colores ya están aprobados.

## Concepto
"Viaje de marketing": el plan es una ruta con **puertos** (cada sección es el "siguiente puerto"), **escalas** (cada servicio que se contrata: Escala 1 = plan, Escala 2 = gestión publicitaria, Escala 3+ = nuevos), **brújula**, **caminos** y un **imán** (el logo de COSMART es un imán). Referencia visual: la pieza "COSMART · Plan de marketing" de Vaneh (pasaporte, brújula, carteles de destinos, mar y pueblo tipo Santorini, flores rosas, ruta punteada roja con avión), **adaptada a fondo azul oscuro**.

## Paleta (fondo oscuro, texto claro siempre)
Fondo `#060F22` · superficie `#0C1A33` · borde `#1E3354` · texto `#F4F7FB` · acento azul `#3A8FC7` · acento coral `#E8554E`. Las ilustraciones deben leerse sobre `#060F22`.

## Los 4 slots
1. **hero-compas** (arriba a la derecha del título): brújula elegante. Aguja con inercia real (oscila y se asienta, no un vaivén mecánico). Tamaño 60–116 px de ancho.
2. **hero-ruta** (entre la bajada y los datos del encabezado): camino punteado de "Punto de partida" a "Meta del plan", con avión recorriéndolo, pines, y **escalas numeradas** (1, 2, y espacio para sumar más). Ancho fluido, máx. 640 px; con etiquetas HTML aparte. Debe verse bien a 390 px.
3. **icono-siguiente-puerto** (botón al final de cada sección, ~54×40 px): pequeño ícono náutico (ancla, barco o faro), con una animación sutil al hover.
4. **pie-puerto** (banda del pie de página, ancho completo): ilustración de puerto/costa/olas con tono de la pieza de referencia pero sobria. No debe tapar el texto del pie.

## Reglas de calidad
- Estilo coherente entre los 4 (mismo trazo, misma paleta); nada infantil ni "clip art".
- **Animaciones lentas y discretas** (3–10 s por ciclo), sin rebotes ni parpadeos.
- Respetar `prefers-reduced-motion: reduce` (sin animación).
- Formato preferido: SVG inline o con animación CSS/SMIL; Lottie solo si pesa menos de 100 KB. Peso total de los 4 < 200 KB.
- Responsive: probar a 390 px y 1280 px, sin scroll horizontal. Cualquier botón o link existente debe seguir funcionando (los 23 del menú, "Siguiente puerto", y los 2 links al Hub).
- Decorativos con `aria-hidden="true"`; la ruta con un `aria-label`.

## Entrega
Reemplazar cada comentario `SLOT ILUSTRACIÓN` por el SVG/HTML, y su CSS dentro del `<style>` existente. Actualizar la sección de la plantilla en `HANDOFF.md`.
