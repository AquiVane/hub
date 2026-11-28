# Handoff — Sesiones anteriores de Claude IA (27/04 → 04/08/2026)

> **Origen:** resumen de sesiones de chat (generado el 27/11/2026) que Vaneh pidió sumar a lo que ya tenemos (28/11/2026). Se excluyó a propósito todo lo personal (no va en repos).
> **Regla de prevalencia (pedido de Vaneh):** este documento es VIEJO. Si algo contradice a `HANDOFF.md` de este repo, de `cosmart-workers`, `training`, o a los `CLAUDE.md`, **prevalece lo más actualizado de esos**. Usar esto solo para contexto de clientes/proyectos que no esté en otro lado.

## Contradicciones ya detectadas (prevalece lo actual)
| Lo que dice lo viejo | Lo vigente |
|---|---|
| Stack: HTML estático en **GitHub Pages** | Desde el 22/10/2026 `hub` y `training` están en **Cloudflare Pages** (GitHub Pages no permite sitios comerciales). Ver `CLAUDE.md`. |
| Curso "Productos Ganadores" en `cosmart.com.ar/productos-ganadores`, $45.000 con bonus IA / $65.000 sin bonus, acceso en Wix | Ya migrado a `training` (`productos-ganadores.html`); catálogo y precio vigentes en `cosmart-workers/HANDOFF.md` ($45.000, e-book). Pago embebido, nunca sacar a la persona del checkout. |
| Landing de Productos Ganadores: integración con Mercado Pago pendiente (Checkout Pro / API) | Resuelto: pagos vía `mp-productos-ganadores` con Brick embebido + PayPal. |
| Formularios con Formspree; Brevo/Mailchimp para mails | Mails automáticos/transaccionales por `emailBase()` en `cosmart-workers`. Mailchimp sigue solo para campañas de clientes (ej. Ando). |
| Landings de shows/Germán con links a redes | Regla 25/10: nadie sale de la página con un clic; videos embebidos (ver `germanaquino/CLAUDE.md`). |
| Hub como herramienta interna de COSMART | Desde el 29/08 es **multi-tenant** (ver HANDOFF, sección MULTI-TENANCY). |
| Paleta con fondos arena/crema (`#F2EDE6`, `#F8F8F6`) | En Training, fondos nuevos nunca arena/crema/blanco (regla 28/10). |

## 0. Contexto general
- **Quién:** Vanesa Anahí Fernández (Vaneh), fundadora y CEO de COSMART (cosmart.com.ar), conglomerado digital en Buenos Aires. Fractional CMO.
- **Tono:** rioplatense informal (voseo). Clientes externos: formal, ordenado, con encabezados. Marca: "segura, cálida, precisa".
- **Reglas de trabajo:** hacer SOLO lo pedido; confirmar archivo/versión antes de editar; ediciones quirúrgicas; no cambiar colores/textos/layout no pedidos; código completo listo para pegar; evitar lenguaje que reste autoridad (ej. disculpas por demoras).
- **Stack:** Cloudflare (DNS/CDN/Workers) + NIC.ar; Zoho Mail; Mercado Pago / PayPal / transferencia.
- **Jira:** `conglomeradocosmart.atlassian.net`. Proyectos: VA (personal), PC (COSMART), ARBC (Ando), MC (Martín Cañeque), GA (Germán Aquino), MW (Minami World). Transición "Finalizada" = ID 41. Fecha de inicio en `customfield_10015`. Tipo "Gestor de proyectos" usa Tarea/Subtarea.
- **Branding COSMART:** logo en Barlow; web en Playfair Display (700/900) + DM Sans (300–600). Paleta: `#0D2B6B`, `#1A4DAA`, `#3A8FC7`, `#E02020`, `#FF3535`. El PNG del logo viene con fondo negro: quitarlo. Rojo sobre fondos de color resta legibilidad → rojo más oscuro en texto.

## 1. Ando Reciclaje (cliente — Jira ARBC)
Contactos: Barbie/Bárbara (coordinación, newsletter), Jorge (recurrentes, WhatsApp), Pablo (puntuales, WhatsApp), Marcelo (web en Duda). Landing: andoreciclaje.com/reciclado_para_empresas. Verde `#2BA62B` (mails `#4aa21e`), Poppins Bold + Raleway Light.
- **27/04** Google Ads: cuenta limpia de Ando bajo el MCC de COSMART; Búsqueda, Argentina, sin Display; keywords B2B; 15 títulos + 4 descripciones; objetivo "Vistas de página".
- **13/05** Secuencia de mails 1, 2, 4, 5 con feedback de Barbie; mail 4 con 6 objeciones. Pendiente: dato real del 30% de reducción de costos, respuesta automática de WhatsApp.
- **18/05** Mailchimp: journey "Secuencia Leads COSMART" (Duda → Make → Mailchimp), 6 mails (días 0/2/5/8/12/16), dos CTA de WhatsApp (Jorge/Pablo), sin `*|FNAME|*`.
- **13/06** Estructura Jira ARBC (marzo–dic 2026 con subtareas) + Word de entregables pendientes (flujo post-contacto, Meta TOF/MOF, LinkedIn, GA4, guía de newsletter IA, plantillas WhatsApp).
- **15/06** Reporte Feb–Jun 2026 (.docx) + 4 visuales + anexo guía newsletter. ARBC-62 sin tocar; ARBC-37 (pago Meta) "en curso".
- **16/06** Mail de facturación de junio (PC-37). Capacitaciones IA pasadas a julio.
- **25/06** Newsletter HTML Mailchimp (verdes, header blanco, SVG, mobile; logo desde `lirp.cdn-website.com`).
- **15/07** Resumen ejecutivo 2 págs: "visibilidad" (no "conseguir clientes"), 3 plataformas (Google, LinkedIn, Meta), sin "en criollo".
- **30/07** Resumen de julio; Jira ARBC-13/14/15. Jira no es tiempo real: conciliar con Vaneh.
- **04/08** LinkedIn: geo zona norte (Vicente López, San Isidro, San Fernando, Tigre, San Martín, Escobar, Malvinas Argentinas) + Buenos Aires y alrededores; Message Ad "Quiero mi diagnóstico gratuito"; Insight Tag en Duda; conversión "Potencial cliente". **Pendiente: vincular la conversión al conjunto de anuncios antes de lanzar.**

## 2. Lambo Energy (cliente — contratada como marketer)
- **27/07** Plan de ejecución en HTML con pestañas (Lambo Energy zero azúcar + Lambo H2O, jul–dic 2026, lanzamiento septiembre): posicionamiento (gimnasio, JTBD), personas, embudo, canales + trade marketing, briefs para IA (Google Flow/Veo, Seedance), calendario de agosto, 10 variantes de anuncio, compliance (Meta/Google/TikTok/ANMAT/Ley 27.642), PUV, KPIs.
- Claves: contraparte Fernando (Alar); producción 100% IA; pádel secundario (80% fitness); licencia Lamborghini comprada; honorarios en USD; precio lo decide Lambo; objetivos SMART los define el cliente; trade marketing = sugerencia.

## 3. Martín Cañeque / Pharus (Jira MC)
- **18/05** Plan de marca personal (.docx), resumen ejecutivo, calendario para Azul (.xlsx). 3 pilares: rescate de empresas, liderazgo, gestión vía Pharus. Presupuesto ARS 200.000 ≈ USD 133; meta IG 2.500 seguidores a fin de 2026; el libro no se destaca los primeros 6 meses. Pendiente: carga masiva en Jira MC vía script Python + token API Atlassian (Business no importa CSV).
- **21/06** Excel presupuesto LinkedIn Pharus Centroamérica (RD, Panamá, Costa Rica): InMail recomendado; amplificación + Follower Ads desde el mes 3.
- **02/07** Política de privacidad pharus.com.ar (~1.750 caracteres, Ley 25.326). Pendiente: email de contacto y fecha.
- Contacto: Azul (diseño y video, presupuesto propio).

## 4. Libro "Liderar con amor" (facturado aparte)
Diálogo por videollamada Martín (Buenos Aires) ↔ Peter Callahan (Las Vegas). Skill dedicada: `liderar-con-amor`.
- **11/05** Introducción final (.docx Times New Roman 12, margen izq. 3 cm / der. 1 cm, justificado). Opcional: reincorporar "a él lo hacía feliz".
- **15/05** Cap. 5 "Efectos en las nuevas generaciones" (tesis pp. 80–86), 8 autores, 3 fuentes web en azul. Reglas: `Martín —`, tuteo estricto, Martín nunca usa "yo" antes de verbo, subtítulos internos, título visible, mín. 10.000 palabras reales, sin párrafos repetidos. **Incompleto: no llegó a 10.000 palabras; completar y verificar conteo.**

## 5. Minami World / Dani Rivers (Jira MW)
- **26/05** Primera campaña Meta saga MINAMI (meta 10 ventas el primer mes): doble capa (anime/otaku ∩ lectura), mujeres 18–35, Argentina (~3,2–3,8 M); 3 presupuestos ($42k/$70k/$98k ARS mes). Landing v1→v4 (negro puro, botones verdes).
- **05/07** `MW14_Plan_Accion_Campanas.docx` (Awareness desde 16/07, Conversión desde 30/07, 60/40, Advantage+) + calendario editorial IG/TikTok. Pendiente confirmar con Dani: títulos, sinopsis, precios, URL landing, monto Pack 1, nombres de personajes; Valeria Martínez revisa (MW-19).

## 6. Germán Aquino (Jira GA)
- **01/05** shows.cosmart.com.ar: Show A (Depredador con Luz), B (Bailarín con Luz), C (Germán en Vivo) + combos 15% off; precios ocultos (selector social/corporativo), seña 50% por transferencia, calendario con fechas bloqueadas. Paleta `#0a0a08`/`#d4c4a8`/`#2d4a2d`/`#7fff7f`; Cormorant Garamond + Jost. Reparto: Vale 10%, Vaneh 20%, Ger el resto.
- **17–18/05** CV web (sin DNI, talent@cosmart.com.ar); Zoho Mail info@cosmart.com.ar; germanaquino.com.ar en GitHub Pages + NIC.ar → Cloudflare.
- **15/06** Auditoría SEO + implementación (schema Person/Service, 4 páginas nuevas, sitemap, robots). Verificar alta en Search Console.
- **15/06** Propuesta comercial del show de canto para salones; shows LED "próximamente" (trajes sin adquirir).

## 7. COSMART — marca, hub y verticales
- **17/05** ComuniCOS: planes en USD (Transatlántico/Yate/Jet/Velero; CM Bala/Expreso/Tranvía; SM Sónico/Turbo/Planeador), descuentos 10%/20%. MPG: planes Señal/Órbita/Constelación + ManyChat (Satélite/Estrella/Galaxia), Calendly, nombre "MPG · Agencia de Comunicación Digital".
- **17/05** Bot Ale.G (MPG): sin saldo de API → bot hardcodeado por keywords, gratis, voz irreverente ("no nos gusta trabajar"). Adjuntar siempre el index.html actual al retomar.
- **18/05** Rumbo Voraz (publicidad digital por admisión, cupo mensual): v1–v3 (editorial `#FAFAF8`, Cormorant + Inter). Pendiente feedback v3. BienSmart (bien.cosmart.com.ar).
- **18/05** Revisión hub cosmart.com.ar (B2B): tagline "Vendé más, liderá mejor, escalá con estrategia. Crecimiento inteligente.", "Todo en un mismo lugar", sin Shop, BienSmart = liderazgo + autocuidado, Training = capacitación, Shows & Talent más abajo. Dos sesiones cortadas sin entregar HTML: verificar si se aplicó.
- **25/05** Firma HTML Zoho (vB18, 2 columnas, 460 px). El interlineado de Zoho no se resuelve por código.
- **07/06** Tipografías por vertical: MPG (DM Sans + Bricolage), ComuniCOS (Nunito Sans + DM Sans), Shows (Cormorant + Jost), Desing (Space Grotesk + Space Mono), Talent (Cormorant + Outfit). Pendiente: manual de marca.
- **21/06** Propuesta capacitación digital para Kiara (Secretaría de la Mujer y la Diversidad, Cutral-Có): 7 módulos + liderazgo. Tarifario: Módulo 1 USD 100 (oferta), módulo USD 350, mentoría USD 82 / pack 4 USD 274, taller presencial USD 350 + viáticos. TC referencia $1.495 hasta dic 2026. Enviar tarifario si hay interés.

## 8. Curso "Productos Ganadores" (histórico; ver contradicciones)
- **14/06** Módulos nuevos 09b, 09c, 17a, 26b + anexo de IA; 6 briefs/captions (secuencia 3→1→5→2→4→6); prompts de imagen en Drive (doc `13_b7TR-NcdimKb5ENI5sWDUt0Xih_ML4Pmybq_IK4Eo`); Canva DAHMBRNEMS4. Pendiente: pieza 3 reordenar páginas; piezas 2 y 4 sin diseño; pieza 6 sin fecha de cierre.

## 9. EUFORIA / 10. LinkVault
- **EUFORIA** (29/05): React en Vercel (`euforia-ugc.vercel.app`, repo `AquiVane/euforia-ugc`, Root `euforia-app`) + Supabase. Pendiente: logo del nav más grande; dominio euforia.cosmart.com.ar.
- **LinkVault** (27/05): Vercel + Supabase (`linkvault-six-gold.vercel.app`), v2 con espacios, tags, tableros por cliente. Pendiente: recuperación de contraseña; Supabase pausado → "Resume project".

## 11. VAMA + monotributo
- **18/07** Actividades: 731001 (principal), 479101 (VAMA), 749002 (Talent). Puntos de venta: 1 COSMART, 2 TALENT COSMART (Factura en Línea), 3 VAMA (Web Services). Si RCEL no los muestra en 24 h → Presentaciones Digitales.
- **19/07** INPI sin conflictos en clases 18 y 25 (ojo Valente Publicitaria en 35). vamatienda.com.ar registrado (redes @vama.tienda). Dropshipping: Modalyst vs Dropi; sin Tiendanube. Global66 para pasar USD de PayPal. Pendiente: registrar clases 18 y 25 en INPI (plan 1/08); DNS a Cloudflare.

## 12. Pendientes abiertos (a re-validar contra lo actual)
1. Ando/LinkedIn: vincular conversión al conjunto de anuncios.
2. Libro cap. 5: completar 10.000 palabras.
3. Minami World: datos reales de Dani.
4. Hub cosmart.com.ar: confirmar si se aplicó la revisión.
5. Rumbo Voraz feedback v3; BienSmart landing.
6. Curso: piezas 2, 4, 6.
7. EUFORIA: dominio + logo nav.
8. LinkVault: contraseña + Supabase.
9. VAMA: INPI 18/25 + DNS.
10. Pharus: email y fecha en privacidad.
11. Jira MC: carga masiva.
12. Germán Aquino: web SEO subida y en Search Console.
13. Capacitación Cutral-Có: tarifario a Kiara.
14. Manual de marca COSMART.
