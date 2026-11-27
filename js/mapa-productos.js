// Mapa de productos propio (cuentas de emprendedor): cada emprendedor carga SUS productos,
// a mano o con ayuda de la IA. Datos: /data/_cosmart/productos (tipo libre, aislado por agencia
// en el servidor: el agencyId sale de la sesión, nunca de acá).
import { WORKER_URL } from './firebase.js';
import { getSessionToken } from './auth.js';

const CLIENTE = '_cosmart';
const TIPO = 'productos';
const ESTADOS = ['Activo', 'En desarrollo', 'Pausado', 'Discontinuado'];
const COLOR_ESTADO = { 'Activo': '#16a34a', 'En desarrollo': '#d97706', 'Pausado': '#64748b', 'Discontinuado': '#dc2626' };

const hdr = () => ({ 'Content-Type': 'application/json', 'Authorization': `Bearer ${getSessionToken()}` });
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nuevoId = () => 'pr' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

async function leer() {
  const r = await fetch(`${WORKER_URL}/data/${CLIENTE}/${TIPO}`, { headers: hdr() });
  if (!r.ok) throw new Error('No pude cargar tus productos. Probá de nuevo.');
  const d = await r.json().catch(() => []);
  return Array.isArray(d) ? d : [];
}
async function guardar(lista) {
  const r = await fetch(`${WORKER_URL}/data/${CLIENTE}/${TIPO}`, { method: 'POST', headers: hdr(), body: JSON.stringify(lista) });
  if (!r.ok) throw new Error('No se pudo guardar. Probá de nuevo.');
}

// Saca de la respuesta de la IA el primer arreglo JSON que encuentre y lo normaliza.
export function parsearProductosIA(texto) {
  const t = String(texto || '');
  const ini = t.indexOf('['), fin = t.lastIndexOf(']');
  if (ini < 0 || fin <= ini) return [];
  let arr;
  try { arr = JSON.parse(t.slice(ini, fin + 1)); } catch (e) { return []; }
  if (!Array.isArray(arr)) return [];
  return arr.filter(p => p && typeof p === 'object' && String(p.nombre || '').trim()).slice(0, 30).map(p => ({
    nombre: String(p.nombre).trim().slice(0, 120),
    categoria: String(p.categoria || 'General').trim().slice(0, 60) || 'General',
    descripcion: String(p.descripcion || '').trim().slice(0, 400),
    precio: String(p.precio == null ? '' : p.precio).trim().slice(0, 40),
    estado: ESTADOS.includes(p.estado) ? p.estado : 'Activo',
  }));
}

const PROMPT_IA = (desc) => `Armá el catálogo de productos o servicios de este emprendimiento a partir de lo que cuenta la persona. ` +
  `Respondé SOLO con un arreglo JSON (sin texto antes ni después, sin markdown), máximo 12 elementos, cada uno con las claves: ` +
  `"nombre", "categoria", "descripcion" (una frase), "precio" (texto; vacío si no lo dijo), "estado" (uno de: Activo, En desarrollo, Pausado, Discontinuado). ` +
  `No inventes precios ni productos que no se desprendan de lo que cuenta.\n\nLo que cuenta:\n${desc}`;

export async function montarMapaProductos(host, { preguntarClaude } = {}) {
  if (!host) return;
  let lista = [];
  let editando = null; // id o 'nuevo'
  let propuestos = null; // sugerencias de la IA pendientes de confirmar
  let msg = '';

  const css = `<style>
  .mpp{display:flex;flex-direction:column;gap:14px}
  .mpp-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center}
  .mpp-bar h2{margin:0;flex:1 1 200px;font-size:18px}
  .mpp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,250px),1fr));gap:12px}
  .mpp-cat{font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--text-muted,#64748b);font-weight:700;margin:6px 0 -4px}
  .mpp-card{background:var(--surface,#fff);border:1px solid var(--border,#d7dee9);border-radius:12px;padding:14px;display:flex;flex-direction:column;gap:6px;min-width:0}
  .mpp-card b{font-size:15px;overflow-wrap:anywhere}
  .mpp-card p{margin:0;font-size:13px;color:var(--text-muted,#64748b);overflow-wrap:anywhere}
  .mpp-pill{align-self:flex-start;font-size:11px;font-weight:700;color:#fff;border-radius:999px;padding:2px 9px}
  .mpp-acc{display:flex;gap:6px;flex-wrap:wrap;margin-top:4px}
  .mpp-form{background:var(--surface,#fff);border:1px solid var(--border,#d7dee9);border-radius:12px;padding:14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr));gap:10px}
  .mpp-form .full{grid-column:1/-1}
  .mpp-form label{font-size:12px;font-weight:600;display:block;margin-bottom:3px}
  .mpp-vacio{text-align:center;padding:28px 12px;color:var(--text-muted,#64748b);border:1px dashed var(--border,#d7dee9);border-radius:12px}
  .mpp-msg{font-size:13px}
  .mpp-sug{display:flex;gap:8px;align-items:flex-start;padding:8px 0;border-top:1px solid var(--border,#d7dee9)}
  .mpp-sug:first-child{border-top:none}
  </style>`;

  function formHtml(p) {
    return `<div class="mpp-form" id="mp-form">
      <div><label for="mp-nombre">Nombre *</label><input id="mp-nombre" class="form-control" value="${esc(p.nombre)}" maxlength="120"></div>
      <div><label for="mp-cat">Categoría</label><input id="mp-cat" class="form-control" value="${esc(p.categoria)}" maxlength="60" placeholder="Ej: Línea básica, Servicios"></div>
      <div><label for="mp-precio">Precio</label><input id="mp-precio" class="form-control" value="${esc(p.precio)}" maxlength="40" placeholder="Opcional"></div>
      <div><label for="mp-estado">Estado</label><select id="mp-estado" class="form-control">${ESTADOS.map(e => `<option${e === p.estado ? ' selected' : ''}>${e}</option>`).join('')}</select></div>
      <div class="full"><label for="mp-desc">Descripción</label><textarea id="mp-desc" class="form-control" rows="2" maxlength="400">${esc(p.descripcion)}</textarea></div>
      <div class="full"><label for="mp-link">Link (opcional)</label><input id="mp-link" class="form-control" value="${esc(p.link || '')}" maxlength="300" placeholder="https://"></div>
      <div class="full mpp-acc"><button class="btn btn-primary" type="button" data-mp="guardar">Guardar</button><button class="btn btn-secondary" type="button" data-mp="cancelar">Cancelar</button></div>
    </div>`;
  }

  function tarjetas() {
    if (!lista.length) return `<div class="mpp-vacio">Todavía no cargaste productos.<br>Agregalos a mano o pedile a la IA que arme el mapa a partir de lo que contás de tu emprendimiento.</div>`;
    const porCat = {};
    lista.forEach(p => { (porCat[p.categoria || 'General'] = porCat[p.categoria || 'General'] || []).push(p); });
    return Object.keys(porCat).sort().map(cat => `<div class="mpp-cat">${esc(cat)} · ${porCat[cat].length}</div><div class="mpp-grid">${porCat[cat].map(p => `
      <div class="mpp-card">
        <span class="mpp-pill" style="background:${COLOR_ESTADO[p.estado] || '#64748b'}">${esc(p.estado || 'Activo')}</span>
        <b>${esc(p.nombre)}</b>
        ${p.descripcion ? `<p>${esc(p.descripcion)}</p>` : ''}
        ${p.precio ? `<p><b style="font-size:13px">${esc(p.precio)}</b></p>` : ''}
        ${/^https?:\/\//i.test(p.link || '') ? `<p><a href="${esc(p.link)}" target="_blank" rel="noopener">Ver link</a></p>` : ''}
        <div class="mpp-acc"><button class="btn btn-secondary btn-sm" type="button" data-mp="editar" data-id="${esc(p.id)}">Editar</button><button class="btn btn-secondary btn-sm" type="button" data-mp="borrar" data-id="${esc(p.id)}">Borrar</button></div>
      </div>`).join('')}</div>`).join('');
  }

  function iaHtml() {
    if (propuestos) {
      return `<div class="mpp-form" style="display:block"><b>La IA propone ${propuestos.length} producto${propuestos.length === 1 ? '' : 's'}</b>
        <p class="mpp-msg" style="margin:4px 0 8px">Destildá los que no quieras. Después los podés editar.</p>
        ${propuestos.map((p, i) => `<label class="mpp-sug"><input type="checkbox" data-sug="${i}" checked style="margin-top:3px"><span><b>${esc(p.nombre)}</b> <span style="color:var(--text-muted,#64748b);font-size:12px">· ${esc(p.categoria)}${p.precio ? ' · ' + esc(p.precio) : ''}</span><br><span style="font-size:13px">${esc(p.descripcion)}</span></span></label>`).join('')}
        <div class="mpp-acc" style="margin-top:10px"><button class="btn btn-primary" type="button" data-mp="agregar-ia">Agregar seleccionados</button><button class="btn btn-secondary" type="button" data-mp="descartar-ia">Descartar</button></div></div>`;
    }
    return `<div class="mpp-form" id="mp-ia" style="display:none"><div class="full"><label for="mp-ia-texto">Contale a la IA qué vendés o hacés</label>
      <textarea id="mp-ia-texto" class="form-control" rows="4" maxlength="2000" placeholder="Ej: Hago velas de soja aromáticas en tres tamaños, un kit de regalo y talleres presenciales de velas los sábados…"></textarea></div>
      <div class="full mpp-acc"><button class="btn btn-primary" type="button" data-mp="generar-ia">✨ Generar mapa</button><button class="btn btn-secondary" type="button" data-mp="cerrar-ia">Cancelar</button></div></div>`;
  }

  function pintar() {
    const p = editando === 'nuevo' ? { nombre: '', categoria: '', descripcion: '', precio: '', estado: 'Activo', link: '' } : lista.find(x => x.id === editando);
    host.innerHTML = css + `<div class="mpp">
      <div class="mpp-bar"><h2>Mapa de productos</h2>
        <button class="btn btn-primary" type="button" data-mp="nuevo">+ Agregar producto</button>
        <button class="btn btn-secondary" type="button" data-mp="abrir-ia">✨ Cargar con IA</button></div>
      <div class="mpp-msg" id="mp-msg" role="status">${esc(msg)}</div>
      ${editando && p ? formHtml(p) : ''}
      ${iaHtml()}
      ${tarjetas()}
    </div>`;
  }

  async function persistir(nuevaLista, ok) {
    msg = 'Guardando…'; host.querySelector('#mp-msg') && (host.querySelector('#mp-msg').textContent = msg);
    try { await guardar(nuevaLista); lista = nuevaLista; msg = ok || 'Guardado.'; }
    catch (e) { msg = e.message; }
    pintar();
  }

  host.onclick = async (ev) => {
    const b = ev.target.closest('[data-mp]');
    if (!b || !host.contains(b)) return;
    const acc = b.dataset.mp, id = b.dataset.id;
    if (acc === 'nuevo') { editando = 'nuevo'; propuestos = null; msg = ''; pintar(); host.querySelector('#mp-nombre')?.focus(); }
    else if (acc === 'editar') { editando = id; msg = ''; pintar(); host.querySelector('#mp-nombre')?.focus(); }
    else if (acc === 'cancelar') { editando = null; msg = ''; pintar(); }
    else if (acc === 'guardar') {
      const nombre = host.querySelector('#mp-nombre').value.trim();
      if (!nombre) { msg = 'Poné el nombre del producto.'; pintar(); return; }
      const item = {
        id: editando === 'nuevo' ? nuevoId() : editando,
        nombre, categoria: host.querySelector('#mp-cat').value.trim() || 'General',
        precio: host.querySelector('#mp-precio').value.trim(), estado: host.querySelector('#mp-estado').value,
        descripcion: host.querySelector('#mp-desc').value.trim(), link: host.querySelector('#mp-link').value.trim(),
      };
      const nueva = editando === 'nuevo' ? [...lista, item] : lista.map(x => x.id === item.id ? item : x);
      editando = null;
      await persistir(nueva, 'Producto guardado.');
    }
    else if (acc === 'borrar') {
      const p = lista.find(x => x.id === id);
      if (!p || !confirm(`¿Borrar "${p.nombre}" del mapa?`)) return;
      await persistir(lista.filter(x => x.id !== id), 'Producto borrado.');
    }
    else if (acc === 'abrir-ia') { editando = null; propuestos = null; msg = ''; pintar(); const f = host.querySelector('#mp-ia'); if (f) { f.style.display = 'grid'; f.querySelector('textarea').focus(); } }
    else if (acc === 'cerrar-ia') { msg = ''; pintar(); }
    else if (acc === 'descartar-ia') { propuestos = null; msg = ''; pintar(); }
    else if (acc === 'generar-ia') {
      const texto = host.querySelector('#mp-ia-texto').value.trim();
      if (texto.length < 15) { msg = 'Contale un poco más a la IA para que arme el mapa.'; pintar(); const f = host.querySelector('#mp-ia'); if (f) f.style.display = 'grid'; return; }
      if (typeof preguntarClaude !== 'function') { msg = 'La IA no está disponible acá.'; pintar(); return; }
      b.disabled = true; b.textContent = 'Pensando…';
      try {
        const r = await preguntarClaude(PROMPT_IA(texto), [], false);
        const sug = parsearProductosIA(r && r.respuesta);
        if (!sug.length) { msg = 'La IA no devolvió productos que pueda usar. Probá de nuevo o cargalos a mano.'; pintar(); return; }
        propuestos = sug; msg = '';
      } catch (e) {
        msg = (e && e.message) || 'No se pudo consultar a la IA. Revisá en Configuración que esté conectada, o cargá los productos a mano.';
      }
      pintar();
    }
    else if (acc === 'agregar-ia') {
      const marcados = [...host.querySelectorAll('[data-sug]')].filter(c => c.checked).map(c => propuestos[+c.dataset.sug]);
      if (!marcados.length) { msg = 'No marcaste ningún producto.'; pintar(); return; }
      const nuevos = marcados.map(p => ({ id: nuevoId(), ...p, link: '' }));
      propuestos = null;
      await persistir([...lista, ...nuevos], `Se agregaron ${nuevos.length} producto${nuevos.length === 1 ? '' : 's'}.`);
    }
  };

  host.innerHTML = '<div class="empty-state"><p>Cargando tus productos…</p></div>';
  try { lista = await leer(); } catch (e) { msg = e.message; }
  pintar();
}
