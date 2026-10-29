// ─────────────────────────────────────────────────────────────────
//  MÉTRICAS WEB — sección del admin del Hub (solo agencia COSMART).
//  Todo lo que mide el sitio, en un solo lugar:
//    · Linktree (cosmart.com.ar/links): personas distintas, cuántas bajan, en qué
//      botones hacen clic y cuántas llegan a la página siguiente y se quedan.
//      (datos de hm.js vía GET /admin/hm/datos?vista=linktree)
//    · Tienda de Training: visitas, carrito, checkout y compras
//      (datos del core vía GET /admin/metricas-tienda)
//  Todo lo que viene de afuera se escapa con esc(): el colector es público.
// ─────────────────────────────────────────────────────────────────
import { getMapasCalor, getMetricasTienda } from '../js/data.js?v=6';

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = n => (Number(n) || 0).toLocaleString('es-AR');
const pc = (a, b) => (b ? Math.round((1000 * a) / b) / 10 : 0);
const pcTxt = n => (Math.round((Number(n) || 0) * 10) / 10).toLocaleString('es-AR') + '%';
const mmss = s => { s = Math.round(Number(s) || 0); return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`; };
const hoyAR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const sumarDias = (ymd, n) => new Date(Date.parse(ymd + 'T12:00:00Z') + n * 86400e3).toISOString().slice(0, 10);
const ls = {
  get: k => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
  set: (k, v) => { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) { /* sin storage */ } },
};

// Nombres legibles de los botones del Linktree (clave = data-link). Si falta alguno se muestra el texto del botón.
const NOMBRES_LINKTREE = {
  guiaIA: '5 formas de usar IA (gratis)', ebookIA: 'Ebook: Tu primera vez con la IA', guiaMarca: 'Guía: IA que habla como tu marca',
  ia: 'Curso completo de IA', guiaRuta: 'Tu primera ruta de marketing (gratis)', ebookPlan: 'Ebook: plan de marketing en una hoja',
  curso: 'Marketing + IA de 0 a 100', calendario: 'App Calendario de contenidos', plata: 'Plata en Orden',
  autodiag: 'Autodiagnóstico (gratis)', presencial: 'Capacitaciones presenciales', training: 'COSMART Training (tienda)',
  instagram: 'Instagram', tiktok: 'TikTok', asesoria: 'Asesoría', brujula: 'Brújula', claseGratis: 'Clase gratuita', guiaClase: 'Guía de la clase',
};

const S = {
  tab: ls.get('mw_tab') === 'tienda' ? 'tienda' : 'linktree',
  periodo: ls.get('mw_periodo') || '30',
  desde: ls.get('mw_desde'), // "contar desde" (día del lanzamiento real); pisa al período
  umbral: Number(ls.get('mw_umbral')) || 5,
  data: null, cargando: false, error: '', pedido: 0,
};
let ROOT = null;

function rango() {
  const hoy = hoyAR();
  if (S.desde) return { desde: S.desde, hasta: hoy };
  if (S.periodo === 'hoy') return { desde: hoy, hasta: hoy };
  const n = Number(S.periodo) || 30;
  return { desde: sumarDias(hoy, -(n - 1)), hasta: hoy };
}

async function cargar() {
  const mio = ++S.pedido;
  S.cargando = true; S.error = ''; pintar();
  try {
    const r = rango();
    const d = S.tab === 'linktree'
      ? await getMapasCalor({ vista: 'linktree', desde: r.desde, hasta: r.hasta, umbral: S.umbral })
      : await getMetricasTienda(S.desde ? { desde: S.desde } : { dias: S.periodo === 'hoy' ? 1 : S.periodo });
    if (mio !== S.pedido) return;
    S.data = d;
  } catch (e) {
    if (mio !== S.pedido) return;
    S.data = null; S.error = e.message || 'No se pudieron cargar los datos';
  }
  S.cargando = false; pintar();
}

// ── Piezas visuales ─────────────────────────────────────────────
const card = (valor, etiqueta, sub, color) => `<div class="card"><div class="card-body" style="padding:14px;">
  <div style="font-size:26px;font-weight:800;line-height:1.1;${color ? 'color:' + color + ';' : ''}">${valor}</div>
  <div style="font-size:12.5px;font-weight:600;margin-top:4px;">${etiqueta}</div>
  ${sub ? `<div class="text-muted" style="font-size:11.5px;margin-top:2px;">${sub}</div>` : ''}</div></div>`;

// Barra horizontal: etiqueta + número + % + barra
const barra = (etiqueta, n, total, nota, color) => {
  const p = Math.min(100, pc(n, total));
  return `<div style="margin-bottom:10px;">
    <div style="display:flex;justify-content:space-between;gap:8px;font-size:13px;flex-wrap:wrap;">
      <span style="min-width:0;overflow-wrap:anywhere;">${etiqueta}</span><strong>${nf(n)} <span class="text-muted" style="font-weight:600;">· ${pcTxt(p)}</span></strong></div>
    <div style="height:9px;border-radius:5px;background:var(--surface-sunken);margin-top:4px;"><div style="height:9px;border-radius:5px;background:${color || 'var(--primary)'};width:${Math.max(n ? 2 : 0, p)}%;"></div></div>
    ${nota ? `<div class="text-muted" style="font-size:11.5px;margin-top:3px;">${nota}</div>` : ''}</div>`;
};
const titulo = (t, sub) => `<div style="font-size:14px;font-weight:700;margin-bottom:${sub ? 2 : 12}px;">${t}</div>${sub ? `<div class="text-muted" style="font-size:12px;margin-bottom:12px;">${sub}</div>` : ''}`;
const panel = (html, extra = '') => `<div class="card" style="margin-bottom:14px;${extra}"><div class="card-body" style="padding:16px;">${html}</div></div>`;
const grid = (html, min = 150) => `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(${min}px,1fr));gap:12px;margin-bottom:14px;">${html}</div>`;
const vacio = t => `<div class="text-muted text-sm" style="padding:8px 0;">${t}</div>`;

// ── Linktree ────────────────────────────────────────────────────
function pintarLinktree(d) {
  const L = d.linktree;
  if (!L) return vacio('Sin datos del Linktree todavía.');
  const P = L.personas;
  if (!P) {
    return panel(titulo('Todavía no hay visitas medidas en el Linktree en este período') +
      `<p class="text-muted text-sm" style="line-height:1.6;">Si recién se publicó la medición, esperá a que entre gente (o probá cambiando el período).<br>
      Tus propias visitas no se cuentan si abriste <strong>cosmart.com.ar/links?hm_off=1</strong> en ese dispositivo.</p>`);
  }
  const hito = n => (L.scroll.hitos.find(h => h.pct === n) || { personas: 0 });
  const bajaron = hito(50).personas;
  const llegaron = L.destino.llegaron, perm = L.destino.permanecen;
  const umbral = L.umbral_seg;
  let h = '';

  h += grid(
    card(nf(P), 'Personas distintas', `${nf(L.visitas)} visitas en total`, 'var(--primary)') +
    card(nf(L.personas_nuevas), 'Vinieron por primera vez', `${nf(L.personas_recurrentes)} volvieron a entrar`) +
    card(nf(bajaron), 'Bajaron hasta la mitad o más', pcTxt(pc(bajaron, P)) + ' de las personas') +
    card(nf(L.personas_con_clic), 'Hicieron clic en un botón', pcTxt(L.pct_con_clic) + ' de las personas') +
    card(String(L.clics_por_persona).replace('.', ','), 'Clics por persona', 'entre quienes hicieron clic') +
    card(mmss(L.tiempo_prom_seg), 'Tiempo en el Linktree', 'tiempo real en pantalla'));

  // Embudo: de la gente que entra, cuánta avanza paso a paso
  const medidos = L.destino.personas_clic - L.destino.sin_medir;
  h += panel(titulo('El recorrido, paso a paso', 'De todas las personas que entraron, cuántas llegan a cada etapa.') +
    barra('Entraron al Linktree', P, P) +
    barra('Bajaron al menos hasta la mitad', bajaron, P, '', 'var(--primary)') +
    barra('Hicieron clic en algún botón', L.personas_con_clic, P, '', 'var(--primary)') +
    barra('Llegaron a la página siguiente', llegaron, P, medidos < L.personas_con_clic ? `Se mide solo en las páginas de COSMART que tienen el medidor (${nf(medidos)} de ${nf(L.personas_con_clic)} personas que hicieron clic fueron a una de ellas).` : '', '#16a34a') +
    barra(`Se quedaron más de ${umbral} segundos ahí`, perm, P, 'Es la gente que realmente se puso a mirar la página.', '#16a34a'));

  // Scroll
  h += panel(titulo('¿Cuánto bajan?', 'Porcentaje de personas que llegó, como mínimo, hasta esa altura del Linktree.') +
    L.scroll.hitos.map(x => barra(x.pct === 100 ? 'Llegaron hasta el final' : `Bajaron hasta el ${x.pct}%`, x.personas, P)).join(''));

  // Botones
  const filas = L.botones.map(b => {
    const nombre = NOMBRES_LINKTREE[b.clave] || b.txt || b.clave;
    const cuenta = b.destino_medido
      ? `<span style="color:#16a34a;font-weight:700;">${nf(b.llegaron)}</span> llegaron · <span style="color:#16a34a;font-weight:700;">${nf(b.permanecen)}</span> se quedaron +${umbral}s`
      : `<span class="text-muted">Destino sin medidor (no se puede saber)</span>`;
    return `<div style="padding:12px 0;border-top:1px solid var(--border);">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:baseline;">
        <div style="min-width:0;flex:1 1 200px;"><strong style="overflow-wrap:anywhere;">${esc(nombre)}</strong>
          <div class="text-muted" style="font-size:11.5px;overflow-wrap:anywhere;">${esc(b.href || b.clave)}</div></div>
        <div style="text-align:right;flex:0 0 auto;"><span style="font-size:20px;font-weight:800;color:var(--primary);">${nf(b.clics)}</span> <span class="text-muted" style="font-size:12px;">clics</span></div>
      </div>
      <div style="display:flex;gap:6px 16px;flex-wrap:wrap;font-size:12.5px;margin-top:6px;">
        <span><strong>${nf(b.personas)}</strong> personas (${pcTxt(pc(b.personas, P))})</span>
        <span><strong>${String(b.clics_por_persona).replace('.', ',')}</strong> clics por persona</span>
        ${b.personas_repiten ? `<span><strong>${nf(b.personas_repiten)}</strong> lo tocaron más de una vez</span>` : ''}
      </div>
      <div style="font-size:12.5px;margin-top:5px;">${cuenta}</div></div>`;
  }).join('');
  h += panel(titulo('¿En qué botones hacen clic?', 'Ordenados del más tocado al menos tocado. "Personas" = navegadores distintos; "clics por persona" muestra si lo tocan varias veces.') +
    (filas || vacio('Nadie hizo clic en un botón todavía.')) +
    `<div style="padding:12px 0 0;border-top:1px solid var(--border);font-size:12.5px;" class="text-muted">
      <strong style="color:inherit;">${nf(L.personas_sin_clic)}</strong> personas entraron y no tocaron ningún botón ·
      <strong style="color:inherit;">${nf(L.clics_fuera)}</strong> toques fuera de los botones (${nf(L.personas_clic_fuera)} personas: fotos, textos u otras partes que no llevan a ningún lado)</div>`);

  // Cantidad de clics por persona
  const dist = L.distribucion_clics || {};
  if (L.personas_con_clic) {
    h += panel(titulo('¿Cuántos botones toca cada persona?') +
      barra('Tocaron 1 botón', dist['1'] || 0, L.personas_con_clic) +
      barra('Tocaron 2 botones', dist['2'] || 0, L.personas_con_clic) +
      barra('Tocaron 3 o más', dist['3+'] || 0, L.personas_con_clic));
  }

  h += `<div class="card" style="margin-bottom:14px;"><div class="card-body" style="padding:14px;font-size:12.5px;line-height:1.65;">
    <strong>Cómo leer esto</strong><br>
    · <strong>Persona</strong> = un navegador distinto (id anónimo, sin datos personales). Si alguien entra desde el celular y desde la compu cuenta como dos.<br>
    · <strong>Tus visitas no cuentan</strong> si abriste una vez <a href="https://cosmart.com.ar/links?hm_off=1" target="_blank" rel="noopener" style="font-weight:700;">cosmart.com.ar/links?hm_off=1</a> en ese dispositivo (repetilo en cada celu o compu que uses). Para volver a medirte: <code>?hm_off=0</code>.<br>
    · <strong>"Se quedaron +${umbral}s"</strong> se confirma cuando la persona cierra o cambia de pestaña. Quien todavía está mirando la página no aparece hasta que se va.<br>
    · Los bots y previsualizadores de links se descartan solos.</div></div>`;
  return h;
}

// ── Tienda de Training ──────────────────────────────────────────
function pintarTienda(d) {
  if (!d || !d.ok) return vacio('Sin datos de la tienda todavía.');
  const f = d.funnel || {};
  const base = f.page_view || 0;
  const ars = d.compras?.ars ? '$' + nf(d.compras.ars) : '';
  const usd = d.compras?.usd ? 'USD ' + nf(d.compras.usd) : '';
  let h = '';
  h += grid(
    card(nf(d.sesiones), 'Sesiones (personas que entraron)', `${nf(d.page_views)} páginas vistas`, 'var(--primary)') +
    card(pcTxt(d.tasa_conversion_pct), 'Conversión', 'de las sesiones terminan comprando') +
    card(mmss(d.duracion_promedio_seg), 'Tiempo en el sitio', 'duración promedio de una sesión') +
    card(nf(d.compras?.n), 'Compras', [ars, usd].filter(Boolean).join(' + ') || 'sin ventas en el período', '#16a34a') +
    card(nf(d.carritos_abandonados), 'Carritos abandonados', 'dejaron el mail y no compraron'));
  const pasos = [['Entraron a la tienda', f.page_view], ['Agregaron algo al carrito', f.add_to_cart], ['Dejaron su mail en el carrito', f.checkout_start], ['Compraron', f.purchase]];
  h += panel(titulo('Del ingreso a la compra', 'Sesiones que llegaron a cada etapa. Debajo de cada barra, qué porcentaje pasó desde la etapa anterior.') +
    pasos.map(([n, v], i) => barra(n, v || 0, base, i ? `${pcTxt(pc(v || 0, pasos[i - 1][1] || 0))} de quienes estaban en el paso anterior` : '', i === 3 ? '#16a34a' : 'var(--primary)')).join(''));
  const dias = d.por_dia || [];
  if (dias.length) {
    const max = Math.max(1, ...dias.map(x => x.sesiones));
    h += panel(titulo('Visitas por día', 'Sesiones distintas por día (hora de Argentina).') +
      `<div style="display:flex;align-items:flex-end;gap:4px;height:130px;overflow-x:auto;padding-bottom:4px;">` +
      dias.map(x => `<div title="${esc(x.dia)}: ${x.sesiones} sesiones" style="flex:1;min-width:22px;text-align:center;"><div style="font-size:10px;">${x.sesiones}</div><div style="height:${Math.max(3, Math.round(x.sesiones / max * 90))}px;background:var(--primary);border-radius:3px 3px 0 0;margin-top:2px;"></div><div class="text-muted" style="font-size:10px;margin-top:3px;">${esc(String(x.dia).slice(8))}/${esc(String(x.dia).slice(5, 7))}</div></div>`).join('') + '</div>');
  }
  h += `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;">
    ${panel(titulo('Más agregados al carrito') + ((d.top_productos || []).length ? d.top_productos.map(p => barra(esc(p.titulo || p.slug), p.n, d.top_productos[0].n)).join('') : vacio('Todavía nadie agregó nada al carrito.')), 'margin-bottom:0;')}
    ${panel(titulo('Páginas más vistas') + ((d.top_paginas || []).length ? d.top_paginas.map(p => barra(esc(p.path), p.page_views, d.top_paginas[0].page_views)).join('') : vacio('Sin datos.')), 'margin-bottom:0;')}
  </div>`;
  h += `<p class="text-muted" style="font-size:12px;margin:14px 0 0;line-height:1.6;">Esta medición cuenta bots solo hasta hoy: desde ahora se descartan solos, pero lo anterior no se puede separar. Si querés ver únicamente la gente real, elegí en "Contar desde" el día en que realmente lanzaste. Tus propias visitas a la tienda sí se cuentan (a diferencia del Linktree).</p>`;
  return h;
}

// ── Estructura ──────────────────────────────────────────────────
function armar() {
  ROOT.innerHTML = `
    <div class="mb-20 flex items-center gap-8" style="flex-wrap:wrap;">
      <h2 style="font-size:18px;font-weight:700;">Métricas web</h2>
      <span class="text-muted text-sm">Lo que pasa en las páginas de COSMART, todo en un solo lugar</span>
    </div>
    <div class="seg" id="mwTabs" style="margin-bottom:14px;max-width:100%;flex-wrap:wrap;">
      <button class="seg-btn" data-t="linktree">Linktree · cosmart.com.ar/links</button>
      <button class="seg-btn" data-t="tienda">Tienda de Training</button>
    </div>
    <div style="display:flex;gap:10px;align-items:flex-end;flex-wrap:wrap;margin-bottom:16px;">
      <label style="font-size:12px;font-weight:700;display:flex;flex-direction:column;gap:3px;">Período
        <select id="mwPeriodo" class="form-control form-control-sm" style="min-width:130px;">
          <option value="hoy">Hoy</option><option value="7">Últimos 7 días</option><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option>
        </select></label>
      <label style="font-size:12px;font-weight:700;display:flex;flex-direction:column;gap:3px;">Contar desde (lanzamiento real)
        <input id="mwDesde" type="date" class="form-control form-control-sm" style="min-width:150px;"></label>
      <label id="mwUmbralWrap" style="font-size:12px;font-weight:700;display:flex;flex-direction:column;gap:3px;">Se queda más de
        <select id="mwUmbral" class="form-control form-control-sm" style="min-width:110px;">
          <option value="4">4 segundos</option><option value="5">5 segundos</option><option value="10">10 segundos</option><option value="30">30 segundos</option>
        </select></label>
      <button class="btn btn-secondary btn-sm" id="mwLimpiar" style="display:none;">Quitar fecha</button>
      <button class="btn btn-secondary btn-sm" id="mwRefrescar" style="margin-left:auto;">Actualizar</button>
    </div>
    <div id="mwError" class="text-muted text-sm" style="display:none;margin-bottom:12px;color:var(--danger);"></div>
    <div id="mwCuerpo"></div>
    <div style="margin-top:6px;"><button class="btn btn-secondary btn-sm" id="mwIrCalor">Ver mapas de calor de todas las páginas →</button></div>`;
  const q = s => ROOT.querySelector(s);
  q('#mwTabs').addEventListener('click', e => {
    const b = e.target.closest('[data-t]'); if (!b || b.dataset.t === S.tab) return;
    S.tab = b.dataset.t; ls.set('mw_tab', S.tab); S.data = null; cargar();
  });
  q('#mwPeriodo').addEventListener('change', e => { S.periodo = e.target.value; ls.set('mw_periodo', S.periodo); S.desde = ''; ls.set('mw_desde', ''); cargar(); });
  q('#mwDesde').addEventListener('change', e => { S.desde = e.target.value || ''; ls.set('mw_desde', S.desde); cargar(); });
  q('#mwUmbral').addEventListener('change', e => { S.umbral = Number(e.target.value) || 5; ls.set('mw_umbral', String(S.umbral)); cargar(); });
  q('#mwLimpiar').addEventListener('click', () => { S.desde = ''; ls.set('mw_desde', ''); cargar(); });
  q('#mwRefrescar').addEventListener('click', () => cargar());
  q('#mwIrCalor').addEventListener('click', () => window.showSection && window.showSection('mapas-calor'));
}

function pintar() {
  if (!ROOT) return;
  const q = s => ROOT.querySelector(s);
  ROOT.querySelectorAll('#mwTabs .seg-btn').forEach(b => b.classList.toggle('active', b.dataset.t === S.tab));
  q('#mwPeriodo').value = S.periodo; q('#mwPeriodo').disabled = !!S.desde;
  q('#mwDesde').value = S.desde; q('#mwDesde').max = hoyAR();
  q('#mwUmbral').value = String(S.umbral);
  q('#mwUmbralWrap').style.display = S.tab === 'linktree' ? '' : 'none';
  q('#mwLimpiar').style.display = S.desde ? '' : 'none';
  const err = q('#mwError');
  err.style.display = S.error ? 'block' : 'none';
  err.textContent = S.error ? 'No se pudieron cargar los números: ' + S.error : '';
  q('#mwCuerpo').innerHTML = S.cargando && !S.data
    ? vacio('Cargando…')
    : (S.data ? (S.tab === 'linktree' ? pintarLinktree(S.data) : pintarTienda(S.data)) : '');
  q('#mwCuerpo').style.opacity = S.cargando ? '.55' : '1';
}

window.loadMetricasWeb = function () {
  ROOT = document.getElementById('mwRoot');
  if (!ROOT) return;
  if (!ROOT.dataset.listo) { armar(); ROOT.dataset.listo = '1'; }
  cargar();
};
