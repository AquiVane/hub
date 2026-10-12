// ─────────────────────────────────────────────────────────────────
//  MAPAS DE CALOR — sección del admin del Hub (solo agencia COSMART).
//  Muestra qué hace la gente en TODAS las páginas de COSMART: dónde hace
//  clic, hasta dónde baja, cuánto tiempo está, cuántas veces vuelve, de
//  dónde viene y a qué otra página pasa (y qué hace ahí).
//  Los datos los junta hm.js (tag en cada página) y los agrega el worker
//  marketing-hub (GET /admin/hm/datos). Ver HANDOFF.md ("Mapas de calor").
//  Todo lo que viene de afuera se escapa con esc(): el colector es público.
// ─────────────────────────────────────────────────────────────────
import { getMapasCalor } from '../js/data.js';
import { VERTICALES } from './mapas-calor-inventario.js';

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DIAS_ORDEN = [1, 2, 3, 4, 5, 6, 0]; // semana arranca el lunes
const FUENTES = ['directo', 'instagram', 'facebook', 'tiktok', 'google', 'buscador', 'email', 'youtube', 'whatsapp', 'linkedin', 'x', 'ia', 'interno', 'otros'];
const ANCHOS = { mobile: 390, tablet: 820, desktop: 1280 };
const TABS = [
  ['resumen', 'Resumen'], ['clics', 'Mapa de clics'], ['scroll', 'Scroll'], ['botones', 'Botones'],
  ['horarios', 'Días y horarios'], ['fuentes', 'Fuentes de tráfico'], ['recorrido', 'Recorrido'], ['paginas', 'Todas las páginas'],
];
// Qué pide cada pestaña al backend (kpis viene siempre)
const VISTAS_TAB = {
  resumen: 'resumen,paginas', clics: 'clics,botones', scroll: 'scroll', botones: 'botones',
  horarios: 'horarios,resumen', fuentes: 'fuentes', recorrido: 'recorrido', paginas: 'paginas',
};

const S = {
  f: { vertical: '', pagina: '', periodo: '30', desde: '', hasta: '', device: '', fuente: '', dow: '', hr: '', boton: '' },
  filtrosAbiertos: !(window.matchMedia && matchMedia('(max-width:768px)').matches),
  tab: 'resumen', data: {}, cargando: false, error: '', botonesLista: [], verNoMedidas: false,
  orden: { col: 'visitas', dir: -1 }, buscar: '', pedido: 0, mostrarFondo: true, capas: { zonas: true, botones: true },
};
let ROOT = null;

// ── Utilidades ──────────────────────────────────────────────────
export const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = n => (Number(n) || 0).toLocaleString('es-AR');
const pct = n => (Math.round((Number(n) || 0) * 10) / 10).toLocaleString('es-AR') + '%';
const mmss = s => { s = Math.round(Number(s) || 0); return s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`; };
const hoyAR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
const sumarDias = (ymd, n) => new Date(Date.parse(ymd + 'T12:00:00Z') + n * 86400e3).toISOString().slice(0, 10);
const vertDe = id => VERTICALES.find(v => v.id === id);
const hostDe = id => (vertDe(id)?.hosts || [])[0] || '';
const nombreVert = id => vertDe(id)?.nombre || id;
const infoPagina = (vertical, path) => vertDe(vertical)?.paginas.find(p => p.path === path);
const verticalDeHost = host => VERTICALES.find(v => v.hosts.includes(host))?.id || '';

function rango() {
  const f = S.f, hoy = hoyAR();
  if (f.periodo === 'custom') return { desde: f.desde || sumarDias(hoy, -29), hasta: f.hasta || hoy };
  if (f.periodo === 'hoy') return { desde: hoy, hasta: hoy };
  if (f.periodo === 'ayer') { const a = sumarDias(hoy, -1); return { desde: a, hasta: a }; }
  const n = Number(f.periodo) || 30;
  return { desde: sumarDias(hoy, -(n - 1)), hasta: hoy };
}
function paramsApi(vista) {
  const f = S.f, r = rango();
  const p = { vista, desde: r.desde, hasta: r.hasta };
  if (f.vertical) p.vertical = f.vertical;
  if (f.pagina) p.path = f.pagina;
  if (f.device) p.device = f.device;
  if (f.fuente) p.fuente = f.fuente;
  if (f.dow !== '') p.dow = f.dow;
  if (f.hr !== '') p.hr = f.hr;
  if (f.boton) p.boton = f.boton;
  return p;
}

// ── Carga ───────────────────────────────────────────────────────
// Sin página elegida, el mapa de clics no se pide (no tiene sentido): se pide el ranking de páginas para elegir.
function vistasPara(tab) {
  const sin = !S.f.pagina;
  if (tab === 'clics') return sin ? 'paginas' : 'clics,botones';
  if (tab === 'scroll') return sin ? 'scroll,paginas' : 'scroll';
  return VISTAS_TAB[tab];
}
async function cargar() {
  const mio = ++S.pedido;
  S.cargando = true; S.error = ''; pintarContenido();
  try {
    const d = await getMapasCalor(paramsApi(vistasPara(S.tab)));
    if (mio !== S.pedido) return; // llegó otra respuesta más nueva
    S.data = d;
    if (d.botones) S.botonesLista = d.botones;
  } catch (e) {
    if (mio !== S.pedido) return;
    S.error = e.message || 'No se pudieron cargar los datos';
  }
  S.cargando = false;
  pintarFiltros(); pintarKpis(); pintarContenido();
}

// ── Estructura base ─────────────────────────────────────────────
function armar() {
  ROOT.innerHTML = `
  <style>
    .mc-wrap{max-width:1280px}
    .mc-title{font-size:20px;font-weight:800;letter-spacing:.04em;color:var(--primary-dark)}
    .mc-sub{font-size:12px;color:var(--text-muted)}
    .mc-filtros{padding:10px 0 8px;border-bottom:1px solid var(--border-strong);margin-bottom:12px}
    .mc-fbtn{display:none;margin-bottom:8px}
    .mc-fila{display:flex;flex-wrap:wrap;gap:8px;align-items:flex-end}
    .mc-fila label{display:flex;flex-direction:column;gap:2px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:var(--text-muted)}
    .mc-fila select,.mc-fila input{font-size:12px;padding:5px 8px;min-width:104px;max-width:210px}
    .mc-chips{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
    .mc-chip{font-size:11px;background:var(--primary-light);color:var(--primary-dark);border-radius:999px;padding:3px 4px 3px 10px;display:inline-flex;gap:4px;align-items:center}
    .mc-chip button{border:0;background:rgba(13,43,107,.12);border-radius:50%;width:16px;height:16px;cursor:pointer;line-height:1;color:var(--primary-dark)}
    .mc-kpis{display:grid;grid-template-columns:repeat(8,1fr);gap:8px;margin-bottom:14px}
    .mc-kpi{background:var(--surface);border:1px solid var(--border-strong);border-radius:10px;padding:10px 12px;min-width:0}
    .mc-kpi b{display:block;font-size:20px;line-height:1.15;color:var(--primary-dark)}
    .mc-kpi span{font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;color:var(--text-muted)}
    .mc-kpi small{display:block;font-size:10.5px;color:var(--text-muted);margin-top:2px}
    .mc-tabs{display:flex;gap:2px;flex-wrap:wrap;margin-bottom:14px;background:var(--surface-sunken);border-radius:8px;padding:3px}
    .mc-tabs button{border:0;background:none;padding:7px 12px;font-size:12px;font-weight:600;border-radius:6px;color:var(--text-muted);cursor:pointer}
    .mc-tabs button.on{background:var(--surface);color:var(--primary);box-shadow:0 1px 3px rgba(0,0,0,.1)}
    .mc-card{background:var(--surface);border:1px solid var(--border-strong);border-radius:10px;padding:14px 16px;margin-bottom:14px}
    .mc-card h3{font-size:13px;font-weight:700;margin-bottom:10px;color:var(--text)}
    .mc-card p.n{font-size:12px;color:var(--text-muted);margin:-4px 0 10px}
    .mc-grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px}
    .mc-tabla{overflow-x:auto;-webkit-overflow-scrolling:touch}
    .mc-tabla table{min-width:620px}
    .mc-tabla th.s{cursor:pointer;user-select:none}
    .mc-tabla tr.cl{cursor:pointer}
    .mc-barra{height:8px;background:var(--surface-sunken);border-radius:4px;overflow:hidden;min-width:60px}
    .mc-barra i{display:block;height:100%;background:var(--primary);border-radius:4px}
    .mc-vacio{padding:34px 12px;text-align:center;color:var(--text-muted);font-size:13px}
    .mc-aviso{background:#fffbeb;border:1px solid #fde68a;color:#92400e;border-radius:8px;padding:10px 12px;font-size:12px;margin-bottom:12px}
    .mc-err{background:var(--danger-bg);color:var(--danger-text);border-radius:8px;padding:10px 12px;font-size:12px;margin-bottom:12px}
    .mc-ins{display:flex;gap:10px;align-items:flex-start;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px}
    .mc-ins:last-child{border-bottom:0}
    .mc-tag{flex:none;font-size:10px;font-weight:800;text-transform:uppercase;border-radius:4px;padding:2px 6px}
    .mc-tag.r{background:#fee2e2;color:#b91c1c}.mc-tag.a{background:#fef3c7;color:#92400e}.mc-tag.v{background:#d1fae5;color:#047857}
    .mc-pill{display:inline-block;font-size:10px;font-weight:700;border-radius:999px;padding:1px 8px;background:var(--surface-sunken);color:var(--text-muted)}
    .mc-heat{position:relative;margin:0 auto;border:1px solid var(--border-strong);border-radius:8px;overflow:hidden;background:#e5e7eb}
    .mc-heat .in{position:absolute;left:0;top:0;transform-origin:0 0}
    .mc-heat iframe{display:block;border:0;background:#fff;pointer-events:none}
    .mc-heat canvas{position:absolute;left:0;top:0;pointer-events:none}
    .mc-btn{position:absolute;border:2px solid var(--c);border-radius:12px;pointer-events:auto;cursor:pointer;box-shadow:0 0 0 4px color-mix(in srgb,var(--c) 30%,transparent),0 0 26px 6px color-mix(in srgb,var(--c) 70%,transparent);animation:mcLuz 2.4s ease-in-out infinite;background:color-mix(in srgb,var(--c) 10%,transparent)}
    .mc-btn:hover{background:color-mix(in srgb,var(--c) 28%,transparent)}
    .mc-btn .t{position:absolute;right:-2px;top:-14px;transform:translateY(-100%);background:var(--c);color:#111;font:800 15px/1 'DM Sans',sans-serif;border-radius:8px;padding:6px 10px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,.35)}
    .mc-btn .t b{background:#111;color:#fff;border-radius:50%;display:inline-block;min-width:22px;height:22px;line-height:22px;text-align:center;margin-right:6px;font-size:13px}
    @keyframes mcLuz{0%,100%{filter:brightness(1)}50%{filter:brightness(1.35) saturate(1.25)}}
    @media(prefers-reduced-motion:reduce){.mc-btn{animation:none}}
    .mc-capas{display:flex;gap:14px;flex-wrap:wrap;align-items:center;font-size:12px}
    .mc-capas label{display:flex;gap:6px;align-items:center;cursor:pointer}
    .mc-ptos{display:inline-block;width:12px;height:12px;border-radius:50%;background:var(--c);margin-right:6px;vertical-align:-1px}
    .mc-leyenda{height:10px;border-radius:5px;background:linear-gradient(90deg,#1d4ed8,#06b6d4,#22c55e,#facc15,#ef4444);max-width:260px}
    .mc-hgrid{display:grid;grid-template-columns:44px repeat(24,minmax(18px,1fr));gap:2px;font-size:10px;min-width:640px}
    .mc-hgrid .c{height:24px;border-radius:3px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:#0b1b44}
    .mc-hgrid .c.sel{outline:2px solid var(--danger)}
    .mc-hgrid .l{display:flex;align-items:center;font-weight:700;color:var(--text-muted)}
    .mc-hgrid .h{text-align:center;color:var(--text-muted)}
    .mc-bars{display:flex;align-items:flex-end;gap:3px;height:140px}
    .mc-bars div{flex:1;background:var(--primary);border-radius:3px 3px 0 0;min-width:4px;position:relative}
    .mc-bars div.s{background:#93c5fd}
    .mc-seg{display:inline-flex;border:1px solid var(--border-strong);border-radius:8px;overflow:hidden}
    .mc-seg button{border:0;background:var(--surface);padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer;color:var(--text-muted)}
    .mc-seg button.on{background:var(--primary);color:#fff}
    @media(max-width:1100px){.mc-kpis{grid-template-columns:repeat(4,1fr)}}
    @media(max-width:768px){.mc-fbtn{display:inline-flex}.mc-fila.cerrado{display:none}.mc-kpis{grid-template-columns:repeat(2,1fr)}.mc-grid2{grid-template-columns:1fr}.mc-fila select,.mc-fila input{max-width:none;min-width:0;width:100%}.mc-fila label{flex:1 1 44%}}
  </style>
  <div class="mc-wrap">
    <div class="mb-20 flex items-center gap-8" style="flex-wrap:wrap">
      <div><h2 class="mc-title">MAPAS DE CALOR</h2><div class="mc-sub">Qué hace la gente en todas las páginas de COSMART: dónde toca, hasta dónde baja, cuánto se queda, de dónde viene y adónde va.</div></div>
      <button class="btn btn-secondary btn-sm" style="margin-left:auto" id="mcRefrescar">Actualizar</button>
    </div>
    <div class="mc-filtros"><button class="btn btn-secondary btn-sm mc-fbtn" id="mcFbtn"></button><div class="mc-fila" id="mcFiltros"></div><div class="mc-chips" id="mcChips"></div></div>
    <div id="mcKpis" class="mc-kpis"></div>
    <div class="mc-tabs" id="mcTabs"></div>
    <div id="mcContenido"></div>
  </div>`;
  ROOT.querySelector('#mcRefrescar').onclick = () => cargar();
  ROOT.querySelector('#mcTabs').innerHTML = TABS.map(([k, n]) => `<button data-t="${k}" class="${k === S.tab ? 'on' : ''}">${esc(n)}</button>`).join('');
  ROOT.querySelector('#mcTabs').onclick = e => { const b = e.target.closest('button[data-t]'); if (b) irATab(b.dataset.t); };
  pintarFiltros();
}
function irATab(t) {
  S.tab = t;
  // Los mapas se ven por dispositivo (el diseño cambia): si no se eligió, arranca en mobile
  if ((t === 'clics' || t === 'scroll') && !S.f.device) S.f.device = 'mobile';
  ROOT.querySelectorAll('#mcTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  pintarFiltros(); cargar();
}

// ── Filtros ─────────────────────────────────────────────────────
function opcionesPagina() {
  const sel = S.f.pagina, vs = S.f.vertical ? VERTICALES.filter(v => v.id === S.f.vertical) : VERTICALES;
  const vistos = new Set();
  let html = `<option value="">Todas las páginas</option>`;
  for (const v of vs) {
    const ops = v.paginas.filter(p => p.medida).map(p => {
      vistos.add(v.id + '|' + p.path);
      const val = v.id + '|' + p.path;
      return `<option value="${esc(val)}" ${sel === p.path && S.f.vertical === v.id ? 'selected' : ''}>${esc(p.path)} — ${esc(p.titulo.slice(0, 48))}</option>`;
    }).join('');
    if (ops) html += `<optgroup label="${esc(v.nombre)}">${ops}</optgroup>`;
  }
  // Páginas que aparecen en los datos pero no están en el inventario
  const nuevas = (S.data.paginas || []).filter(p => { const v = verticalDeHost(p.host); return v && (!S.f.vertical || v === S.f.vertical) && !vistos.has(v + '|' + p.path); });
  if (nuevas.length) html += `<optgroup label="Nuevas (no están en el inventario)">${nuevas.map(p => `<option value="${esc(verticalDeHost(p.host) + '|' + p.path)}">${esc(p.host + p.path)}</option>`).join('')}</optgroup>`;
  return html;
}
function pintarFiltros() {
  if (!ROOT) return;
  const f = S.f, el = ROOT.querySelector('#mcFiltros');
  el.classList.toggle('cerrado', !S.filtrosAbiertos);
  const activos = ['vertical', 'pagina', 'device', 'fuente', 'dow', 'hr', 'boton'].filter(k => f[k] !== '').length;
  const fb = ROOT.querySelector('#mcFbtn'); fb.textContent = (S.filtrosAbiertos ? 'Ocultar filtros' : 'Mostrar filtros') + (activos ? ` (${activos} activos)` : ''); fb.onclick = () => { S.filtrosAbiertos = !S.filtrosAbiertos; pintarFiltros(); };
  const opt = (v, t, sel) => `<option value="${esc(v)}" ${String(sel) === String(v) ? 'selected' : ''}>${esc(t)}</option>`;
  el.innerHTML = `
    <label>Vertical<select id="fVert">${opt('', 'Todas las verticales', f.vertical)}${VERTICALES.map(v => opt(v.id, v.nombre, f.vertical)).join('')}</select></label>
    <label style="min-width:210px">Página<select id="fPag">${opcionesPagina()}</select></label>
    <label>Período<select id="fPer">${[['hoy', 'Hoy'], ['ayer', 'Ayer'], ['7', 'Últimos 7 días'], ['14', 'Últimos 14 días'], ['30', 'Últimos 30 días'], ['90', 'Últimos 90 días'], ['365', 'Último año'], ['custom', 'Personalizado…']].map(([v, t]) => opt(v, t, f.periodo)).join('')}</select></label>
    ${f.periodo === 'custom' ? `<label>Desde<input type="date" id="fDesde" value="${esc(rango().desde)}"></label><label>Hasta<input type="date" id="fHasta" value="${esc(rango().hasta)}"></label>` : ''}
    <label>Dispositivo<select id="fDev">${[['', 'Todos'], ['mobile', 'Celular'], ['tablet', 'Tablet'], ['desktop', 'Computadora']].map(([v, t]) => opt(v, t, f.device)).join('')}</select></label>
    <label>Fuente de tráfico<select id="fFue">${opt('', 'Todas', f.fuente)}${FUENTES.map(x => opt(x, x[0].toUpperCase() + x.slice(1), f.fuente)).join('')}</select></label>
    <label>Día<select id="fDow">${opt('', 'Todos', f.dow)}${DIAS_ORDEN.map(d => opt(d, DIAS[d], f.dow)).join('')}</select></label>
    <label>Hora (ARG)<select id="fHr">${opt('', 'Todas', f.hr)}${Array.from({ length: 24 }, (_, h) => opt(h, String(h).padStart(2, '0') + ':00', f.hr)).join('')}</select></label>
    <label style="min-width:170px">Botón<select id="fBot">${opt('', 'Todos los botones', f.boton)}${S.botonesLista.slice(0, 60).map(b => opt(b.el, (b.txt || b.el).slice(0, 38), f.boton)).join('')}${f.boton && !S.botonesLista.some(b => b.el === f.boton) ? opt(f.boton, f.boton.slice(0, 38), f.boton) : ''}</select></label>
    <button class="btn btn-secondary btn-sm" id="fLimpiar">Limpiar</button>`;
  const on = (id, fn) => { const x = el.querySelector(id); if (x) x.onchange = fn; };
  on('#fVert', e => { f.vertical = e.target.value; f.pagina = ''; f.boton = ''; cargar(); });
  on('#fPag', e => { const [v, p] = String(e.target.value).split('|'); f.vertical = v || f.vertical; f.pagina = p || ''; f.boton = ''; cargar(); });
  on('#fPer', e => { f.periodo = e.target.value; if (f.periodo === 'custom') { const r = rango(); f.desde = r.desde; f.hasta = r.hasta; } pintarFiltros(); cargar(); });
  on('#fDesde', e => { f.desde = e.target.value; cargar(); });
  on('#fHasta', e => { f.hasta = e.target.value; cargar(); });
  on('#fDev', e => { f.device = e.target.value; cargar(); });
  on('#fFue', e => { f.fuente = e.target.value; cargar(); });
  on('#fDow', e => { f.dow = e.target.value; cargar(); });
  on('#fHr', e => { f.hr = e.target.value; cargar(); });
  on('#fBot', e => { f.boton = e.target.value; cargar(); });
  el.querySelector('#fLimpiar').onclick = () => { S.f = { vertical: '', pagina: '', periodo: '30', desde: '', hasta: '', device: (S.tab === 'clics' || S.tab === 'scroll') ? 'mobile' : '', fuente: '', dow: '', hr: '', boton: '' }; pintarFiltros(); cargar(); };
  // chips con lo que está filtrado
  const chips = [];
  if (f.vertical) chips.push(['vertical', 'Vertical: ' + nombreVert(f.vertical)]);
  if (f.pagina) chips.push(['pagina', 'Página: ' + f.pagina]);
  if (f.device) chips.push(['device', 'Dispositivo: ' + ({ mobile: 'celular', tablet: 'tablet', desktop: 'computadora' }[f.device])]);
  if (f.fuente) chips.push(['fuente', 'Fuente: ' + f.fuente]);
  if (f.dow !== '') chips.push(['dow', 'Día: ' + DIAS[f.dow]]);
  if (f.hr !== '') chips.push(['hr', 'Hora: ' + String(f.hr).padStart(2, '0') + ':00']);
  if (f.boton) chips.push(['boton', 'Botón: ' + (S.botonesLista.find(b => b.el === f.boton)?.txt || f.boton).slice(0, 30)]);
  const r = rango();
  ROOT.querySelector('#mcChips').innerHTML = `<span class="mc-sub" style="align-self:center">${esc(r.desde === r.hasta ? r.desde : r.desde + ' → ' + r.hasta)}</span>` +
    chips.map(([k, t]) => `<span class="mc-chip">${esc(t)}<button data-k="${k}" aria-label="Quitar filtro">×</button></span>`).join('');
  ROOT.querySelector('#mcChips').onclick = e => { const b = e.target.closest('button[data-k]'); if (!b) return; const k = b.dataset.k; S.f[k] = ''; if (k === 'vertical') S.f.pagina = ''; pintarFiltros(); cargar(); };
}

// ── KPIs ────────────────────────────────────────────────────────
function pintarKpis() {
  const k = S.data.kpis, el = ROOT.querySelector('#mcKpis');
  if (!k) { el.innerHTML = ''; return; }
  const vuelven = k.visitantes ? (100 * k.recurrentes / k.visitantes) : 0;
  const caja = (n, v, sub) => `<div class="mc-kpi"><span>${esc(n)}</span><b>${v}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</div>`;
  el.innerHTML = caja('Visitas a la página', nf(k.visitas), 'páginas vistas') + caja('Sesiones', nf(k.sesiones), 'veces que entraron') +
    caja('Visitantes únicos', nf(k.visitantes), 'personas distintas') + caja('Vuelven', pct(vuelven), nf(k.recurrentes) + ' ya habían entrado antes') +
    caja('Tiempo en pantalla', mmss(k.tiempo_prom_seg), 'promedio por visita') + caja('Scroll promedio', pct(k.scroll_prom), 'hasta dónde baja') +
    caja('Rebote', pct(k.rebote_pct), 'se fue sin hacer nada') + caja('Clics por visita', String(k.clics_por_visita).replace('.', ','), nf(k.clics) + ' clics en total');
}

// ── Contenido por pestaña ───────────────────────────────────────
function vacio(msg) { return `<div class="mc-card"><div class="mc-vacio">${msg}</div></div>`; }
function pintarContenido() {
  const el = ROOT.querySelector('#mcContenido');
  if (S.error) {
    const sinBackend = /404|no encontrad|HM_DB|Failed to fetch/i.test(S.error);
    el.innerHTML = `<div class="mc-err"><b>No se pudieron cargar los datos.</b> ${esc(S.error)}${sinBackend ? '<br>Es probable que el worker <code>marketing-hub</code> todavía no tenga desplegada la parte de Mapas de calor (ver HANDOFF).' : ''}</div>`;
    return;
  }
  if (S.cargando && !S.data.kpis) { el.innerHTML = `<div class="mc-card"><div class="mc-vacio">Cargando datos…</div></div>`; return; }
  const k = S.data.kpis;
  if (k && k.visitas === 0 && S.tab !== 'paginas') {
    el.innerHTML = `<div class="mc-aviso"><b>Todavía no hay visitas con estos filtros.</b> Si es la primera vez, el tag <code>hm.js</code> recién se está sumando a las páginas: los datos empiezan a aparecer apenas la gente las visite. Probá con otro período o quitá filtros.</div>` + (S.tab === 'resumen' ? '' : '');
    if (S.tab !== 'resumen') return;
  }
  const f = { resumen: tResumen, clics: tClics, scroll: tScroll, botones: tBotones, horarios: tHorarios, fuentes: tFuentes, recorrido: tRecorrido, paginas: tPaginas }[S.tab];
  el.innerHTML = (S.cargando ? '<div class="mc-sub" style="margin-bottom:8px">Actualizando…</div>' : '') + f();
  const post = { clics: postClics, scroll: postScroll, horarios: postHorarios, fuentes: postFuentes, botones: postBotones, recorrido: postRecorrido, paginas: postPaginas, resumen: postResumen }[S.tab];
  if (post) post(el);
}

// --- Resumen ---
function insights() {
  const out = [], ps = (S.data.paginas || []).filter(p => p.visitas >= 20);
  for (const p of ps) {
    const nombre = `${p.path} (${nombreVert(verticalDeHost(p.host))})`;
    if (p.rebote_pct >= 65) out.push(['r', `<b>${esc(nombre)}</b>: el ${pct(p.rebote_pct)} se va sin hacer nada. Revisá el primer pantallazo y el botón principal.`, p.visitas]);
    else if (p.scroll_prom && p.scroll_prom < 30) out.push(['a', `<b>${esc(nombre)}</b>: en promedio solo baja hasta el ${pct(p.scroll_prom)}. Lo importante está muy abajo.`, p.visitas]);
    if (p.visitas >= 40 && p.con_clic / p.visitas < 0.08) out.push(['a', `<b>${esc(nombre)}</b>: solo el ${pct(100 * p.con_clic / p.visitas)} toca algo. ¿El botón se ve y dice qué pasa al tocarlo?`, p.visitas]);
    if (p.con_accion && p.visitas >= 20 && p.con_accion / p.visitas >= 0.15) out.push(['v', `<b>${esc(nombre)}</b>: el ${pct(100 * p.con_accion / p.visitas)} hace una acción (formulario/descarga). Está funcionando.`, p.visitas]);
  }
  return out.sort((a, b) => b[2] - a[2]).slice(0, 8);
}
function tResumen() {
  const dias = S.data.dias || [], dev = S.data.dispositivos || [];
  const max = Math.max(1, ...dias.map(d => d.pv));
  const barras = dias.length ? `<div class="mc-bars">${dias.map(d => `<div title="${esc(d.d)} — ${d.pv} visitas · ${d.sesiones} sesiones" style="height:${Math.max(3, 100 * d.pv / max)}%"></div>`).join('')}</div>
    <div class="mc-sub" style="display:flex;justify-content:space-between;margin-top:4px"><span>${esc(dias[0].d)}</span><span>${esc(dias[dias.length - 1].d)}</span></div>` : '<div class="mc-vacio">Sin visitas en el período</div>';
  const totDev = dev.reduce((a, d) => a + d.pv, 0) || 1;
  const devH = dev.map(d => `<div style="margin-bottom:8px"><div class="flex" style="justify-content:space-between;font-size:12px"><span>${esc({ mobile: 'Celular', tablet: 'Tablet', desktop: 'Computadora' }[d.device] || d.device)}</span><b>${pct(100 * d.pv / totDev)}</b></div><div class="mc-barra"><i style="width:${100 * d.pv / totDev}%"></i></div></div>`).join('') || '<div class="mc-vacio">—</div>';
  const ins = insights();
  return `<div class="mc-grid2"><div class="mc-card"><h3>Visitas por día</h3>${barras}</div><div class="mc-card"><h3>Desde qué dispositivo entran</h3>${devH}</div></div>
    <div class="mc-card"><h3>Qué optimizar primero</h3><p class="n">Se calcula con las páginas que tuvieron al menos 20 visitas en el período.</p>
    ${ins.length ? ins.map(([t, h]) => `<div class="mc-ins"><span class="mc-tag ${t}">${{ r: 'Urgente', a: 'Mejorar', v: 'Va bien' }[t]}</span><span>${h}</span></div>`).join('') : '<div class="mc-vacio">Todavía no hay suficientes datos para recomendar (hacen falta páginas con 20+ visitas).</div>'}</div>`;
}
function postResumen() { /* sin interacciones */ }

// --- Mapas (clics / scroll) ---
function necesitaPagina(nombre) {
  const top = (S.data.paginas || []).slice(0, 12);
  return `<div class="mc-card"><h3>${esc(nombre)}: elegí una página</h3><p class="n">El mapa se dibuja sobre la página real, así que hay que elegir una (vertical + página arriba) o tocar una de estas.</p>
    <div class="mc-tabla"><table class="data-table"><thead><tr><th>Página</th><th>Vertical</th><th>Visitas</th><th></th></tr></thead><tbody>
    ${(S.data.paginas || top).slice(0, 15).map(p => `<tr><td>${esc(p.path)}</td><td>${esc(nombreVert(verticalDeHost(p.host)))}</td><td>${nf(p.visitas)}</td><td><button class="btn btn-secondary btn-sm" data-pag="${esc(verticalDeHost(p.host) + '|' + p.path)}">Ver mapa</button></td></tr>`).join('') || '<tr><td colspan="4" class="mc-vacio">Todavía no hay páginas con visitas.</td></tr>'}
    </tbody></table></div></div>`;
}
function selectorDevice() {
  return `<div class="mc-seg" id="mcDev">${[['mobile', 'Celular'], ['tablet', 'Tablet'], ['desktop', 'Computadora']].map(([v, t]) => `<button data-d="${v}" class="${S.f.device === v ? 'on' : ''}">${t}</button>`).join('')}</div>`;
}
function colorLuz(t) { // 0..1 -> color de la paleta (azul poco, rojo mucho)
  const c = paleta()(Math.round(Math.min(1, Math.max(0, t)) * 255)); return `rgb(${c[0]},${c[1]},${c[2]})`;
}
// Luces sobre cada botón/enlace tocado: más rojo = más clics. Se ubican con el rectángulo que mide hm.js.
function lucesBotones(ancho_disp) {
  const lista = (S.data.botones || []).filter(b => b.rect), max = Math.max(1, ...lista.map(b => b.clics));
  return lista.map((b, i) => {
    const r = b.rect, t = b.clics / max, n = (S.data.botones || []).indexOf(b) + 1;
    return `<div class="mc-btn" data-el="${esc(b.el)}" title="${esc((b.txt || b.el) + ' — ' + b.clics + ' clics')}" style="left:${Math.round(r.x * ancho_disp)}px;top:${r.y}px;width:${Math.max(24, Math.round(r.w * ancho_disp))}px;height:${Math.max(24, r.h)}px;--c:${colorLuz(0.2 + 0.8 * t)}"><span class="t"><b>${n}</b>${nf(b.clics)} clics · ${pct(b.ctr)}</span></div>`;
  }).join('');
}
function marcoPagina(alto, ancho, ancho_disp, conBotones) {
  const v = S.f.vertical, host = hostDe(v), esc_ = Math.min(1, ancho / ancho_disp);
  const url = `https://${host}${S.f.pagina === '/' ? '/' : S.f.pagina}?hm_off=1`;
  const custom = window.__mcFondo ? window.__mcFondo(host, S.f.pagina, ancho_disp, alto, S.f.device) : null; // gancho solo para la vista previa de ejemplo
  const fondo = !S.mostrarFondo ? `<div style="width:100%;height:100%;background:#f3f4f6"></div>`
    : custom || `<iframe src="${esc(url)}" width="${ancho_disp}" height="${alto}" scrolling="no" loading="lazy" title="Página"></iframe>`;
  return `<div class="mc-heat" id="mcHeat" style="width:${Math.round(ancho_disp * esc_)}px;height:${Math.round(alto * esc_)}px">
    <div class="in" style="width:${ancho_disp}px;height:${alto}px;transform:scale(${esc_})">
      ${fondo}
      <canvas id="mcCanvas" style="${S.capas.zonas ? '' : 'display:none'}"></canvas>
      <div id="mcLuces" style="${S.capas.botones && conBotones ? '' : 'display:none'}">${conBotones ? lucesBotones(ancho_disp) : ''}</div></div></div>`;
}
const anchoDisponible = () => Math.max(300, Math.min(1000, (ROOT.querySelector('#mcContenido')?.clientWidth || 900) - 40));
function paleta() {
  const c = document.createElement('canvas'); c.width = 256; c.height = 1; const x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 256, 0);
  [[0, '#1d4ed8'], [.3, '#06b6d4'], [.55, '#22c55e'], [.78, '#facc15'], [1, '#ef4444']].forEach(([o, col]) => g.addColorStop(o, col));
  x.fillStyle = g; x.fillRect(0, 0, 256, 1);
  const d = x.getImageData(0, 0, 256, 1).data; return i => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];
}
export function pintarCalor(canvas, puntos, w, h, radio) {
  canvas.width = w; canvas.height = h;
  const capa = document.createElement('canvas'); capa.width = w; capa.height = h;
  const lc = capa.getContext('2d'), max = Math.max(1, ...puntos.map(p => p.n));
  for (const p of puntos) {
    const x = p.x * w, y = p.y + 5, a = Math.min(1, 0.18 + 0.82 * Math.sqrt(p.n / max));
    const g = lc.createRadialGradient(x, y, 0, x, y, radio);
    g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    lc.fillStyle = g; lc.beginPath(); lc.arc(x, y, radio, 0, 6.2832); lc.fill();
  }
  const img = lc.getImageData(0, 0, w, h), d = img.data, pal = paleta();
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3]; if (!a) continue;
    const c = pal(a); d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = Math.min(225, 40 + a * 0.85);
  }
  canvas.getContext('2d').putImageData(img, 0, 0);
}
function tClics() {
  const c = S.data.clics;
  if (!S.f.pagina) return necesitaPagina('Mapa de clics');
  if (!c) return vacio('Cargando…');
  const ancho_disp = ANCHOS[S.f.device] || 390, alto = Math.max(700, Math.min(9000, c.alto_prom || 3000));
  const bots = S.data.botones || [], max = Math.max(1, ...bots.map(b => b.clics));
  const url = `https://${hostDe(S.f.vertical)}${S.f.pagina}`;
  return `<div class="mc-card"><div class="flex items-center gap-8" style="flex-wrap:wrap;margin-bottom:10px">${selectorDevice()}
      <div class="mc-capas"><label><input type="checkbox" id="mcCapaZonas" ${S.capas.zonas ? 'checked' : ''}> Zonas calientes</label><label><input type="checkbox" id="mcCapaBot" ${S.capas.botones ? 'checked' : ''}> Botones iluminados</label><label><input type="checkbox" id="mcFondo" ${S.mostrarFondo ? 'checked' : ''}> Página de fondo</label></div>
      <span class="mc-sub" style="margin-left:auto">${nf(c.total)} clics en ${nf(c.visitas)} visitas · <a href="${esc(url)}?hm_off=1" target="_blank" rel="noopener">abrir ${esc(S.f.pagina)} ↗</a></span></div>
    ${c.total === 0 ? '<div class="mc-aviso">Todavía no hay clics registrados para esta página con estos filtros.</div>' : ''}
    ${S.f.boton ? `<div class="mc-aviso" style="background:#eff6ff;border-color:#bfdbfe;color:#1e3a8a">Mostrando solo los clics del botón <b>${esc((bots.find(b => b.el === S.f.boton)?.txt || S.f.boton).slice(0, 50))}</b>. <a href="#" id="mcQuitarBoton">Ver todos</a></div>` : ''}
    ${marcoPagina(alto, anchoDisponible(), ancho_disp, true)}
    <div class="flex items-center gap-8" style="margin-top:10px;justify-content:center"><span class="mc-sub">Pocos clics</span><div class="mc-leyenda" style="flex:1"></div><span class="mc-sub">Muchos clics</span></div>
    <p class="mc-sub" style="text-align:center;margin-top:6px">Diseño de ${esc({ mobile: 'celular', tablet: 'tablet', desktop: 'computadora' }[S.f.device] || '')}. <b>Luces de colores</b>: cuanto más rojo, más tocan esa zona o ese botón. Tocá un botón iluminado para ver solo sus clics. Si hay manchas donde no hay botón, la gente intenta tocar algo que no es un botón.</p></div>
    <div class="mc-card"><h3>Botones iluminados (en el mismo orden que los números del mapa)</h3>${bots.length ? `<div class="mc-tabla"><table class="data-table"><thead><tr><th>#</th><th>Botón / enlace</th><th>Clics</th><th></th><th>Visitas que lo tocan</th><th>Dónde está</th></tr></thead><tbody>
      ${bots.slice(0, 15).map((b, i) => `<tr class="cl" data-boton="${esc(b.el)}"><td><span class="mc-ptos" style="--c:${colorLuz(0.2 + 0.8 * b.clics / max)}"></span><b>${i + 1}</b></td><td><b>${esc(b.txt || '(sin texto)')}</b><div class="mc-sub">${esc(b.el.split(':')[0])}${b.href ? ' → ' + esc(b.href) : ''}</div></td><td><b>${nf(b.clics)}</b></td><td style="width:90px"><div class="mc-barra"><i style="width:${100 * b.clics / max}%;background:${colorLuz(0.2 + 0.8 * b.clics / max)}"></i></div></td><td>${pct(b.ctr)}</td><td class="mc-sub">a ${nf(b.y_prom)} px del tope</td></tr>`).join('')}</tbody></table></div>` : '<div class="mc-vacio">Todavía no hay clics en botones o enlaces con estos filtros.</div>'}</div>`;
}
function postClics(el) {
  el.querySelectorAll('button[data-pag]').forEach(b => b.onclick = () => seleccionarPagina(b.dataset.pag));
  el.querySelector('#mcDev')?.addEventListener('click', e => { const b = e.target.closest('button[data-d]'); if (b) { S.f.device = b.dataset.d; pintarFiltros(); cargar(); } });
  const fondo = el.querySelector('#mcFondo'); if (fondo) fondo.onchange = () => { S.mostrarFondo = fondo.checked; pintarContenido(); };
  const cz = el.querySelector('#mcCapaZonas'); if (cz) cz.onchange = () => { S.capas.zonas = cz.checked; const cv = el.querySelector('#mcCanvas'); if (cv) cv.style.display = cz.checked ? '' : 'none'; };
  const cb = el.querySelector('#mcCapaBot'); if (cb) cb.onchange = () => { S.capas.botones = cb.checked; const l = el.querySelector('#mcLuces'); if (l) l.style.display = cb.checked ? '' : 'none'; };
  el.querySelector('#mcQuitarBoton')?.addEventListener('click', e => { e.preventDefault(); S.f.boton = ''; pintarFiltros(); cargar(); });
  el.querySelectorAll('.mc-btn').forEach(d => d.onclick = () => { S.f.boton = d.dataset.el; pintarFiltros(); cargar(); });
  const cv = el.querySelector('#mcCanvas'), c = S.data.clics;
  if (cv && c) pintarCalor(cv, c.puntos, ANCHOS[S.f.device] || 390, Math.max(700, Math.min(9000, c.alto_prom || 3000)), (S.f.device === 'desktop' ? 42 : 30));
  postBotones(el);
}
function seleccionarPagina(val) { const [v, p] = val.split('|'); S.f.vertical = v; S.f.pagina = p; S.f.boton = ''; if ((S.tab === 'clics' || S.tab === 'scroll') && !S.f.device) S.f.device = 'mobile'; pintarFiltros(); cargar(); }

function tScroll() {
  const s = S.data.scroll;
  if (!s) return vacio('Cargando…');
  const prof = s.profundidad;
  let caida = null;
  for (let i = 1; i < prof.length; i++) { const d = prof[i - 1].porcentaje - prof[i].porcentaje; if (!caida || d > caida.d) caida = { d, desde: prof[i - 1].pct, hasta: prof[i].pct }; }
  const barras = prof.map(p => `<div style="display:grid;grid-template-columns:70px 1fr 120px;gap:10px;align-items:center;margin-bottom:6px;font-size:12px">
      <span>Llegan al ${p.pct}%</span><div class="mc-barra" style="height:14px"><i style="width:${p.porcentaje}%;background:hsl(${Math.round(2 + 2.2 * p.porcentaje)},75%,48%)"></i></div><span><b>${pct(p.porcentaje)}</b> <span class="mc-sub">(${nf(p.visitas)})</span></span></div>`).join('');
  const mapa = S.f.pagina && s.visitas ? `<div class="mc-card"><h3>Mapa de scroll sobre la página</h3>
      <div class="flex items-center gap-8" style="margin-bottom:10px">${selectorDevice()}<label style="font-size:12px;display:flex;gap:6px;align-items:center"><input type="checkbox" id="mcFondo" ${S.mostrarFondo ? 'checked' : ''}> Mostrar la página de fondo</label></div>
      ${marcoPagina(Math.max(700, Math.min(9000, s.alto_prom || 3000)), anchoDisponible(), ANCHOS[S.f.device] || 390, false)}
      <div class="flex items-center gap-8" style="margin-top:10px;justify-content:center"><span class="mc-sub">Casi nadie lo vio</span><div class="mc-leyenda" style="flex:1"></div><span class="mc-sub">Todos lo vieron</span></div></div>` : '';
  return `<div class="mc-card"><h3>Hasta dónde baja la gente</h3><p class="n">Porcentaje de visitas que llegó a cada tramo de la página. Alto promedio de la página: ${nf(s.alto_prom)} px.</p>${barras}
    ${caida && caida.d >= 8 ? `<div class="mc-aviso" style="margin-top:10px">La mayor caída está entre el <b>${caida.desde}%</b> y el <b>${caida.hasta}%</b> de la página (${pct(caida.d)} menos). Es el lugar donde conviene poner el botón o un gancho.</div>` : ''}</div>${mapa}
    ${!S.f.pagina ? '<div class="mc-aviso">Elegí una página arriba para ver además el mapa de scroll dibujado sobre la página real.</div>' : ''}`;
}
function postScroll(el) {
  el.querySelector('#mcDev')?.addEventListener('click', e => { const b = e.target.closest('button[data-d]'); if (b) { S.f.device = b.dataset.d; pintarFiltros(); cargar(); } });
  const fondo = el.querySelector('#mcFondo'); if (fondo) fondo.onchange = () => { S.mostrarFondo = fondo.checked; pintarContenido(); };
  const cv = el.querySelector('#mcCanvas'), s = S.data.scroll;
  if (!cv || !s) return;
  const w = ANCHOS[S.f.device] || 390, h = Math.max(700, Math.min(9000, s.alto_prom || 3000));
  cv.width = w; cv.height = h; const ctx = cv.getContext('2d'), pal = paleta();
  const alcance = y => { // % de visitas que llegó a la altura y (interpolado)
    const p = 100 * y / h, pr = s.profundidad;
    if (p <= pr[0].pct) return 100 * (1 - (1 - pr[0].porcentaje / 100) * (p / pr[0].pct));
    for (let i = 1; i < pr.length; i++) if (p <= pr[i].pct) { const a = pr[i - 1], b = pr[i], t = (p - a.pct) / (b.pct - a.pct); return a.porcentaje + (b.porcentaje - a.porcentaje) * t; }
    return pr[pr.length - 1].porcentaje;
  };
  for (let y = 0; y < h; y += 8) { const r = alcance(y), c = pal(Math.round(Math.min(255, Math.max(0, r * 2.55)))); ctx.fillStyle = `rgba(${c[0]},${c[1]},${c[2]},.42)`; ctx.fillRect(0, y, w, 8); }
  ctx.font = '700 13px sans-serif'; ctx.textAlign = 'right';
  [25, 50, 75, 100].forEach(p => { const y = Math.min(h - 6, h * p / 100); ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(w - 128, y - 18, 126, 18); ctx.fillStyle = '#fff'; ctx.fillText(`${p}% · ${pct(alcance(h * p / 100 - 1))}`, w - 8, y - 4); });
}

// --- Botones ---
function tablaBotones(lista, compacta) {
  if (!lista.length) return '<div class="mc-vacio">Todavía no hay clics en botones o enlaces con estos filtros.</div>';
  const max = Math.max(1, ...lista.map(b => b.clics));
  return `<div class="mc-tabla"><table class="data-table"><thead><tr><th>Botón / enlace</th>${compacta ? '' : '<th>Va a</th>'}<th>Clics</th><th></th><th>Visitas que lo tocan</th><th>Dónde está</th></tr></thead><tbody>
    ${lista.map(b => `<tr class="cl" data-boton="${esc(b.el)}"><td><b>${esc(b.txt || '(sin texto)')}</b><div class="mc-sub">${esc(b.el.split(':')[0])}</div></td>${compacta ? '' : `<td class="mc-sub">${esc(b.href || '—')}</td>`}
      <td><b>${nf(b.clics)}</b></td><td style="width:90px"><div class="mc-barra"><i style="width:${100 * b.clics / max}%"></i></div></td><td>${pct(b.ctr)}</td><td class="mc-sub">a ${nf(b.y_prom)} px del tope</td></tr>`).join('')}
    </tbody></table></div>`;
}
function tBotones() {
  const b = S.data.botones || [], a = S.data.acciones || [];
  return `<div class="mc-card"><h3>Botones y enlaces más tocados</h3><p class="n">Tocá una fila para filtrar todo el panel por ese botón (por ejemplo, ver en el mapa de clics dónde está o de qué fuente vienen los que lo tocan).</p>${tablaBotones(b, false)}</div>
    <div class="mc-card"><h3>Acciones</h3><p class="n">Envíos de formulario, descargas y eventos propios (window.hm.event).</p>
    ${a.length ? `<div class="mc-tabla"><table class="data-table"><thead><tr><th>Acción</th><th>Veces</th><th>Visitas</th></tr></thead><tbody>${a.map(x => `<tr><td>${esc(x.name)}</td><td>${nf(x.n)}</td><td>${nf(x.visitas)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="mc-vacio">Todavía no se registraron acciones.</div>'}</div>`;
}
function postBotones(el) {
  el.querySelectorAll('tr[data-boton]').forEach(tr => tr.onclick = () => { S.f.boton = tr.dataset.boton; pintarFiltros(); cargar(); });
  el.querySelectorAll('button[data-pag]').forEach(b => b.onclick = () => seleccionarPagina(b.dataset.pag));
}

// --- Días y horarios ---
function tHorarios() {
  const h = S.data.horarios || [], grid = {};
  let max = 1; const porDia = Array(7).fill(0), porHora = Array(24).fill(0);
  h.forEach(r => { grid[r.dow + '-' + r.hr] = r; max = Math.max(max, r.pv); porDia[r.dow] += r.pv; porHora[r.hr] += r.pv; });
  const color = n => { const t = n / max; return n ? `rgba(26,77,170,${0.12 + 0.88 * Math.sqrt(t)})` : 'var(--surface-sunken)'; };
  const celdas = DIAS_ORDEN.map(d => `<div class="l">${DIAS[d]}</div>` + Array.from({ length: 24 }, (_, hr) => { const r = grid[d + '-' + hr], n = r ? r.pv : 0, sel = String(S.f.dow) === String(d) && String(S.f.hr) === String(hr);
    return `<div class="c ${sel ? 'sel' : ''}" data-d="${d}" data-h="${hr}" style="background:${color(n)};color:${n / max > 0.55 ? '#fff' : '#0b1b44'}" title="${DIAS[d]} ${String(hr).padStart(2, '0')}:00 — ${n} visitas">${n || ''}</div>`; }).join('')).join('');
  const mejorD = porDia.indexOf(Math.max(...porDia)), mejorH = porHora.indexOf(Math.max(...porHora));
  const total = porDia.reduce((a, b) => a + b, 0);
  return `<div class="mc-card"><h3>Cuándo entra la gente (hora de Argentina)</h3><p class="n">Cada cuadro es una franja de una hora; cuanto más oscuro, más visitas. Tocá un cuadro para filtrar todo el panel por ese día y hora (de nuevo para quitarlo).</p>
    <div class="mc-tabla"><div class="mc-hgrid"><div></div>${Array.from({ length: 24 }, (_, hr) => `<div class="h">${hr}</div>`).join('')}${celdas}</div></div>
    ${total ? `<div class="mc-aviso" style="margin-top:12px;background:#eff6ff;border-color:#bfdbfe;color:#1e3a8a">Mejor día: <b>${['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'][mejorD]}</b> (${pct(100 * porDia[mejorD] / total)} de las visitas) · Mejor horario: <b>${String(mejorH).padStart(2, '0')}:00 a ${String(mejorH).padStart(2, '0')}:59</b> (${pct(100 * porHora[mejorH] / total)}). Programá publicaciones y anuncios en esas franjas.</div>` : ''}</div>
    <div class="mc-grid2"><div class="mc-card"><h3>Por día de la semana</h3>${DIAS_ORDEN.map(d => `<div style="display:grid;grid-template-columns:40px 1fr 60px;gap:8px;align-items:center;font-size:12px;margin-bottom:6px"><span>${DIAS[d]}</span><div class="mc-barra"><i style="width:${total ? 100 * porDia[d] / Math.max(...porDia) : 0}%"></i></div><b>${nf(porDia[d])}</b></div>`).join('')}</div>
    ${tResumenDias()}</div>`;
}
function tResumenDias() {
  const dias = S.data.dias || []; if (!dias.length) return '<div class="mc-card"><h3>Visitas por día</h3><div class="mc-vacio">Sin datos</div></div>';
  const max = Math.max(1, ...dias.map(d => d.pv));
  return `<div class="mc-card"><h3>Visitas por fecha</h3><div class="mc-bars">${dias.map(d => `<div title="${esc(d.d)} — ${d.pv} visitas · ${d.sesiones} sesiones" style="height:${Math.max(3, 100 * d.pv / max)}%"></div>`).join('')}</div>
    <div class="mc-sub" style="display:flex;justify-content:space-between;margin-top:4px"><span>${esc(dias[0].d)}</span><span>${esc(dias[dias.length - 1].d)}</span></div></div>`;
}
function postHorarios(el) {
  el.querySelectorAll('.mc-hgrid .c').forEach(c => c.onclick = () => {
    const d = c.dataset.d, h = c.dataset.h;
    if (String(S.f.dow) === d && String(S.f.hr) === h) { S.f.dow = ''; S.f.hr = ''; } else { S.f.dow = d; S.f.hr = h; }
    pintarFiltros(); cargar();
  });
}

// --- Fuentes ---
function tFuentes() {
  const f = S.data.fuentes || [], camp = S.data.campanias || [], tot = f.reduce((a, r) => a + r.pv, 0) || 1;
  return `<div class="mc-card"><h3>De dónde viene la gente</h3><p class="n">Instagram, TikTok, Google, mails, directo… Tocá una fuente para filtrar todo el panel. "Interno" = venía de otra página nuestra (mirá la pestaña Recorrido).</p>
    ${f.length ? `<div class="mc-tabla"><table class="data-table"><thead><tr><th>Fuente</th><th>Visitas</th><th></th><th>Sesiones</th><th>Personas</th><th>Tiempo</th><th>Scroll</th><th>Tocan algo</th><th>Hacen una acción</th></tr></thead><tbody>
    ${f.map(r => `<tr class="cl" data-f="${esc(r.fuente)}"><td><b>${esc(r.fuente)}</b></td><td>${nf(r.pv)}</td><td style="width:90px"><div class="mc-barra"><i style="width:${100 * r.pv / tot}%"></i></div></td><td>${nf(r.sesiones)}</td><td>${nf(r.visitantes)}</td><td>${mmss(r.dur_prom_seg)}</td><td>${pct(r.scroll_prom)}</td><td>${pct(100 * r.con_clic / (r.pv || 1))}</td><td>${pct(100 * r.con_accion / (r.pv || 1))}</td></tr>`).join('')}</tbody></table></div>` : '<div class="mc-vacio">Sin datos</div>'}</div>
    <div class="mc-card"><h3>Campañas y enlaces con utm</h3>${camp.length ? `<div class="mc-tabla"><table class="data-table"><thead><tr><th>Fuente</th><th>Medio</th><th>Campaña</th><th>Visitas</th><th>Sesiones</th></tr></thead><tbody>${camp.map(c => `<tr><td>${esc(c.fuente)}</td><td>${esc(c.medio)}</td><td>${esc(c.campania || '—')}</td><td>${nf(c.pv)}</td><td>${nf(c.sesiones)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="mc-vacio">Cuando uses links con utm_source / utm_medium / utm_campaign (por ejemplo en anuncios o mails), van a aparecer acá.</div>'}</div>`;
}
function postFuentes(el) { el.querySelectorAll('tr[data-f]').forEach(tr => tr.onclick = () => { S.f.fuente = tr.dataset.f; pintarFiltros(); cargar(); }); }

// --- Recorrido ---
function tRecorrido() {
  const r = S.data.recorrido; if (!r) return vacio('Cargando…');
  const sig = r.siguientes || [], ant = r.anteriores || [], acc = r.acciones_destino || [], tot = r.total || 0;
  const sesTot = sig.reduce((a, x) => a + x.sesiones, 0) + (r.terminan_ahi || 0) || 1;
  const nomDest = (host, path) => { const v = verticalDeHost(host); return `<b>${esc(path)}</b><div class="mc-sub">${esc(v ? nombreVert(v) : host)}</div>`; };
  const accionesDe = (host, path) => acc.filter(a => a.host === host && a.path === path).slice(0, 4).map(a => `<span class="mc-pill" title="${esc(a.txt || '')}">${a.type === 'event' ? '⚡ ' : '👆 '}${esc((a.txt || a.que).slice(0, 28))} ×${a.n}</span>`).join(' ') || '<span class="mc-sub">—</span>';
  return `<div class="mc-card"><h3>${S.f.pagina ? 'Adónde pasa la gente desde ' + esc(S.f.pagina) : 'Adónde pasa la gente después (todas las páginas filtradas)'}</h3>
    <p class="n">Dentro de la misma sesión, la página que visitan a continuación y qué hacen ahí. ${r.terminan_ahi ? `<b>${nf(r.terminan_ahi)}</b> sesiones (${pct(100 * r.terminan_ahi / sesTot)}) terminan en la página sin seguir.` : ''}</p>
    ${sig.length ? `<div class="mc-tabla"><table class="data-table"><thead><tr><th>Página a la que pasan</th><th>Sesiones</th><th>% del total</th><th>Tiempo ahí</th><th>Scroll ahí</th><th>Tocan algo</th><th>Hacen una acción</th><th>Qué hacen ahí</th></tr></thead><tbody>
    ${sig.map(x => `<tr><td>${nomDest(x.host, x.path)}</td><td><b>${nf(x.sesiones)}</b></td><td>${pct(100 * x.sesiones / sesTot)}</td><td>${mmss(x.tiempo_prom_seg)}</td><td>${pct(x.scroll_prom)}</td><td>${pct(100 * x.con_clic / x.sesiones)}</td><td>${pct(100 * x.con_accion / x.sesiones)}</td><td style="max-width:320px;line-height:1.9">${accionesDe(x.host, x.path)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="mc-vacio">Todavía nadie pasó de estas páginas a otra de COSMART en la misma sesión.</div>'}</div>
    <div class="mc-grid2"><div class="mc-card"><h3>De qué página vienen</h3>${ant.length ? `<div class="mc-tabla"><table class="data-table"><thead><tr><th>Página anterior</th><th>Sesiones</th></tr></thead><tbody>${ant.map(x => `<tr><td>${nomDest(x.host, x.path)}</td><td>${nf(x.sesiones)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="mc-vacio">Entran directo a esta página.</div>'}</div>
    <div class="mc-card"><h3>Adónde salen (fuera de COSMART)</h3>${(r.salidas || []).length ? `<div class="mc-tabla"><table class="data-table"><thead><tr><th>Destino</th><th>Veces</th></tr></thead><tbody>${r.salidas.map(x => `<tr><td>${esc(x.destino)}</td><td>${nf(x.n)}</td></tr>`).join('')}</tbody></table></div>` : '<div class="mc-vacio">Sin salidas registradas.</div>'}</div></div>`;
}
function postRecorrido() { /* sin interacciones */ }

// --- Todas las páginas ---
function filasPaginas() {
  const datos = new Map((S.data.paginas || []).map(p => [verticalDeHost(p.host) + '|' + p.path, p]));
  const filas = [], vistos = new Set();
  for (const v of VERTICALES) {
    if (S.f.vertical && v.id !== S.f.vertical) continue;
    for (const p of v.paginas) {
      const k = v.id + '|' + p.path, d = datos.get(k); vistos.add(k);
      if (!p.medida && !S.verNoMedidas) continue;
      filas.push({ k, v: v.id, vn: v.nombre, path: p.path, titulo: p.titulo, tipo: p.tipo, medida: p.medida, motivo: p.motivo, indexada: p.indexada, d: d || null });
    }
  }
  for (const [k, d] of datos) if (!vistos.has(k)) filas.push({ k, v: verticalDeHost(d.host), vn: nombreVert(verticalDeHost(d.host)) || d.host, path: d.path, titulo: '(página nueva, no está en el inventario)', tipo: 'Nueva', medida: true, indexada: true, d, nueva: true });
  return filas;
}
function estadoPagina(d) {
  if (!d || d.visitas < 20) return ['', 'Pocos datos'];
  if (d.rebote_pct >= 65) return ['r', 'Urgente'];
  if (d.rebote_pct >= 45 || d.scroll_prom < 30 || d.con_clic / d.visitas < 0.08) return ['a', 'Mejorar'];
  return ['v', 'Va bien'];
}
function tPaginas() {
  const q = S.buscar.toLowerCase();
  let filas = filasPaginas().filter(f => !q || (f.path + ' ' + f.titulo + ' ' + f.vn + ' ' + f.tipo).toLowerCase().includes(q));
  const { col, dir } = S.orden, val = f => ({ visitas: f.d?.visitas || 0, sesiones: f.d?.sesiones || 0, tiempo: f.d?.tiempo_prom_seg || 0, scroll: f.d?.scroll_prom || 0, rebote: f.d?.rebote_pct || 0, path: f.path, vertical: f.vn }[col]);
  filas.sort((a, b) => { const x = val(a), y = val(b); return (typeof x === 'string' ? x.localeCompare(y) : x - y) * dir; });
  const th = (c, t) => `<th class="s" data-c="${c}">${t}${col === c ? (dir < 0 ? ' ▼' : ' ▲') : ''}</th>`;
  const conDatos = filas.filter(f => f.d).length;
  return `<div class="mc-card"><div class="flex items-center gap-8" style="flex-wrap:wrap;margin-bottom:10px"><h3 style="margin:0">Todas las páginas de COSMART</h3>
      <span class="mc-sub">${nf(filas.length)} páginas · ${nf(conDatos)} con visitas en el período</span>
      <input id="mcBuscar" class="form-control" placeholder="🔎 Buscar página, vertical o tipo…" value="${esc(S.buscar)}" style="margin-left:auto;width:230px;font-size:12px;padding:4px 8px">
      <label style="font-size:12px;display:flex;gap:6px;align-items:center"><input type="checkbox" id="mcNoMed" ${S.verNoMedidas ? 'checked' : ''}> Mostrar las que no se miden</label></div>
    <p class="n">Tocá una fila para ver su mapa de clics. Las páginas privadas y redirecciones no llevan el tag de medición (se pueden mostrar con el interruptor).</p>
    <div class="mc-tabla"><table class="data-table"><thead><tr>${th('vertical', 'Vertical')}${th('path', 'Página')}<th>Tipo</th>${th('visitas', 'Visitas')}${th('sesiones', 'Sesiones')}${th('tiempo', 'Tiempo')}${th('scroll', 'Scroll')}${th('rebote', 'Rebote')}<th>Tocan algo</th><th>Acción</th><th>Estado</th></tr></thead><tbody>
    ${filas.map(f => { const d = f.d, [cls, txt] = estadoPagina(d);
      return `<tr class="cl" data-k="${esc(f.k)}" ${f.medida ? '' : 'style="opacity:.55"'}><td>${esc(f.vn)}</td><td><b>${esc(f.path)}</b><div class="mc-sub">${esc(f.titulo.slice(0, 60))}${f.indexada === false ? ' · noindex' : ''}${f.motivo ? ' · ' + esc(f.motivo) : ''}</div></td><td><span class="mc-pill">${esc(f.tipo)}</span></td>
      <td>${d ? `<b>${nf(d.visitas)}</b>` : '—'}</td><td>${d ? nf(d.sesiones) : '—'}</td><td>${d ? mmss(d.tiempo_prom_seg) : '—'}</td><td>${d ? pct(d.scroll_prom) : '—'}</td><td>${d ? pct(d.rebote_pct) : '—'}</td>
      <td>${d && d.visitas ? pct(100 * d.con_clic / d.visitas) : '—'}</td><td>${d && d.visitas ? pct(100 * d.con_accion / d.visitas) : '—'}</td><td>${cls ? `<span class="mc-tag ${cls}">${txt}</span>` : `<span class="mc-sub">${f.medida ? txt : 'No se mide'}</span>`}</td></tr>`; }).join('') || '<tr><td colspan="11" class="mc-vacio">No hay páginas con esa búsqueda.</td></tr>'}</tbody></table></div></div>`;
}
function postPaginas(el) {
  el.querySelectorAll('tr[data-k]').forEach(tr => tr.onclick = e => { if (e.target.closest('input')) return; S.tab = 'clics'; if (!S.f.device) S.f.device = 'mobile'; ROOT.querySelectorAll('#mcTabs button').forEach(b => b.classList.toggle('on', b.dataset.t === 'clics')); seleccionarPagina(tr.dataset.k); });
  el.querySelectorAll('th[data-c]').forEach(th => th.onclick = () => { const c = th.dataset.c; S.orden = { col: c, dir: S.orden.col === c ? -S.orden.dir : (c === 'path' || c === 'vertical' ? 1 : -1) }; pintarContenido(); });
  const b = el.querySelector('#mcBuscar'); if (b) { b.oninput = () => { S.buscar = b.value; const pos = b.selectionStart; pintarContenido(); const n = ROOT.querySelector('#mcBuscar'); n.focus(); n.setSelectionRange(pos, pos); }; }
  const nm = el.querySelector('#mcNoMed'); if (nm) nm.onchange = () => { S.verNoMedidas = nm.checked; pintarContenido(); };
}

// ── Entrada ─────────────────────────────────────────────────────
let iniciado = false;
export function loadMapasCalor() {
  ROOT = document.getElementById('mcRoot'); if (!ROOT) return;
  if (!iniciado) { iniciado = true; armar(); }
  cargar();
}
window.loadMapasCalor = loadMapasCalor;
