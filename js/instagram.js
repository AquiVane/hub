// Sección "Instagram" del admin: automatizaciones, panel de control, actividad y configuración.
import { getInstagram, setInstagramConfig, desconectarInstagram, getInstagramPosts, saveInstagramRegla, deleteInstagramRegla, repararSuscripcionInstagram, recuperarInstagram, getContactosInstagram, descargarContactosInstagram } from './data.js?v=23';

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = d => new Date(d).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
let estado = null;
let reglaEditando = null;
let tabActual = null;
const F = { auto: { estado: 'todas', q: '', modo: '' }, panel: 'total', act: { regla: '', res: '', per: '7', q: '', vista: 'evento' } };
let pagAct = 1;
const recAbiertos = new Set();
const recMsg = {};
let recTimer = null;
const POR_PAG = 25;
const PLANTILLAS = { libro: {"nombre": "Libro: La P de precio", "modo": "dos-pasos", "mediaId": "4020982225636735346", "mediaInfo": "Reel del libro (elegí la publicación para confirmar)", "palabras": "Libro", "respuestasPublicas": ["Un gusto conocerte {nombre}, ya te estoy enviando el link a tu DM 🧲", "Hola {nombre}, encantada de tenerte por acá, te estoy mandando la info por mensaje privado🧭. Revisalo", "Claro {nombre}, un placer. Te envío por Mensaje privado la info. ⚓Miralo."], "dmTexto": "Hola {nombre}! Cómo estás? 🧲 Te doy la bienvenida a mi cuenta. Soy Vaneh, estratega de marketing digital y 🧭 te ayudo a darle estructura a tu negocio o servicio, un gusto que estés por acá.\nPreparé la info sobre negociación y fijación de precios para que puedas tener todo a mano.\nTocá el botón para obtenerla.", "confirmarBoton": "⚓Conocer + del libro", "exigirSeguir": true, "seguirTexto": "Fantástico, estoy haciendo esto exclusivo para mis seguidores y suscriptores.\nSeguime para que puedas crecer tu negocio o emprendimientos", "seguirBoton": "Ya te sigo ✅", "entregaTexto": "Gracias por seguirme y bienvenido/a a la comunidad!\nAhora sí, tocá el botón y descubrí cómo fijar y negociar precios de manera SMART y efectiva.\nTe regalo el 🧲 de la suerte para que atraigas todo lo que te merecés.\nTocá el botón", "botonTexto": "⚓Ver info Libro", "botonUrl": "https://training.cosmart.com.ar/precio", "seguimiento1Texto": "¿Pudiste acceder al link sin problema? 😊 Si necesitás algo, escribime por acá y te ayudo.", "seguimientoDemoraMin": 60, "encuestaTexto": "Aprovecho que te tengo por acá 🙌 Estoy pensando en abrir una suscripción muy económica dentro de Instagram para emprendedores y dueños de negocio como vos: contenido todos los días para aumentar tus ventas, de una profesional con más de 10 años de trayectoria en marketing digital, y con todos los videos grabados para verlos cuando quieras.\n\n¿Serías tan amable de contestarme estas dos preguntas? Tus respuestas me sirven mucho para evaluar si este esfuerzo tendría buena recepción.\n\n1️⃣ ¿Te interesaría estar en esa comunidad?\n2️⃣ ¿Te suscribirías por u$s 2 por mes?\n\nEmpecemos por la primera 👇", "encuesta2Texto": "¡Genial! 🙌 Y la segunda: ¿te suscribirías por u$s 2 por mes?", "encuestaGraciasTexto": "¡Gracias por tus respuestas! 💛 Y de paso ya aprendiste algo más: preguntarle a tu público antes de lanzar algo es una excelente manera de optimizar tu negocio. ¡Nos leemos!", "unaVezPorPersona": true}, 'libro-directo': {"nombre": "Libro: La P de precio (directo)", "modo": "directo", "mediaId": "4020982225636735346", "mediaInfo": "Reel del libro (elegí la publicación para confirmar)", "palabras": "Libro", "respuestasPublicas": ["Un gusto conocerte {nombre}, ya te estoy enviando el link a tu DM 🧲", "Hola {nombre}, encantada de tenerte por acá, te estoy mandando la info por mensaje privado🧭. Revisalo", "Claro {nombre}, un placer. Te envío por Mensaje privado la info. ⚓Miralo."], "dmTexto": "Hola {nombre}! Cómo estás? \n\n🧲 Te doy la bienvenida a mi cuenta. Soy Vaneh, estratega de marketing digital y 🧭 te ayudo a darle estructura a tu negocio o servicio, un gusto que estés por acá.\n\nPreparé la info sobre negociación y fijación de precios para que puedas tener todo a mano.\nTocá el botón para obtenerla.", "botonTexto": "⚓Ver info Libro", "botonUrl": "https://training.cosmart.com.ar/precio", "unaVezPorPersona": true} };

function aviso(msg, error) { const el = $('igAviso'); if (!el) return; el.textContent = msg; el.style.color = error ? '#fca5a5' : '#86efac'; el.style.display = msg ? 'block' : 'none'; if (msg && !error) setTimeout(() => { if (el.textContent === msg) el.style.display = 'none'; }, 3500); }
const lsGet = k => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch {} };
const hoyAR = () => new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10);

window.cargarInstagram = async function () {
  try { estado = await getInstagram(); } catch (e) { aviso(e.message, true); return; }
  pintarTodo();
};

function conectada() { return !!(estado && estado.conectada && estado.appSecretCargado); }

function pintarTodo() {
  const e = estado;
  $('igEstadoCuenta').innerHTML = e.conectada
    ? `<strong>@${esc(e.username)}</strong> conectada${e.tokenFecha ? ` · token del ${new Date(e.tokenFecha).toLocaleDateString('es-AR')}` : ''}`
    : 'Todavía no hay una cuenta conectada.';
  $('igWebhookUrl').value = e.webhookUrl || '';
  $('igVerifyToken').value = e.verifyToken || '(se genera al guardar)';
  $('igAppSecretEstado').textContent = e.appSecretCargado ? '✅ App Secret cargado' : '⚠️ Falta el App Secret';
  $('igBtnDesconectar').style.display = e.conectada ? '' : 'none';
  $('igPasos').open = !conectada();
  document.querySelectorAll('#igTabs .ig-tab').forEach(b => { b.style.display = (!conectada() && b.dataset.tab !== 'conf') ? 'none' : ''; });
  const guardada = lsGet('igTab');
  igTab(!conectada() ? 'conf' : (tabActual || (['auto', 'panel', 'act', 'ct', 'conf'].includes(guardada) ? guardada : 'auto')));
  const sel = $('igActRegla'); const v = F.act.regla;
  sel.innerHTML = '<option value="">Todas las reglas</option>' + (e.reglas || []).map(r => `<option value="${esc(r.id)}">${esc(r.nombre)}</option>`).join('');
  sel.value = v;
  const rsel = $('igCtRegla'); const rv = rsel.value;
  rsel.innerHTML = '<option value="">Todas las reglas</option>' + [...new Set((e.reglas || []).map(r => r.nombre))].map(n => `<option value="${esc(n)}">${esc(n)}</option>`).join(''); rsel.value = rv;
  pintarReglas(); pintarPanel(); pintarAct(); pintarDiag();
}

window.igTab = function (t) {
  tabActual = t; lsSet('igTab', t);
  document.querySelectorAll('#igTabs .ig-tab').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  ['auto', 'panel', 'act', 'ct', 'conf'].forEach(x => { const el = $('igPane' + { auto: 'Auto', panel: 'Panel', act: 'Act', ct: 'Ct', conf: 'Conf' }[x]); if (el) el.classList.toggle('hidden', x !== t); });
  if (t === 'ct') igCtCargar(true);
};

// ── Automatizaciones ──────────────────────────────────────────
window.igFiltroAuto = function (k, v) {
  F.auto[k] = v;
  if (k === 'estado') document.querySelectorAll('#igSegEstado button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  pintarReglas();
};

function pintarReglas() {
  const f = F.auto, q = f.q.trim().toLowerCase();
  const todas = estado.reglas || [];
  const l = todas.filter(r => (f.estado === 'todas' || (f.estado === 'activas' ? r.activa : !r.activa))
    && (!f.modo || (r.modo || 'directo') === f.modo)
    && (!q || (r.nombre || '').toLowerCase().includes(q) || (r.palabras || []).join(' ').toLowerCase().includes(q)));
  $('igReglasLista').innerHTML = !todas.length ? '<p class="text-muted text-sm">Todavía no creaste ninguna regla. Tocá “+ Nueva regla”.</p>'
    : !l.length ? '<p class="text-muted text-sm">Ninguna regla coincide con el filtro.</p>'
    : l.map(r => `
    <div class="ig-card">
      <div style="display:flex;gap:10px;align-items:center;">
        <strong style="flex:1;min-width:0;font-size:16px;word-break:break-word;">${esc(r.nombre)}</strong>
        <span style="font-size:12px;color:#cbd5e1;">${r.activa ? 'Activa' : 'Pausada'}</span>
        <label class="ig-sw" title="Prender / apagar"><input type="checkbox" ${r.activa ? 'checked' : ''} onchange="igAlternar('${esc(r.id)}', this)"><span></span></label>
      </div>
      <div class="ig-sub">📌 ${r.mediaId ? esc(r.mediaInfo || r.mediaId) : 'Todos los posts y reels'} · ${r.palabras?.length ? 'Palabras: ' + esc(r.palabras.join(', ')) : 'Cualquier comentario'}</div>
      <div class="ig-sub">${r.modo === 'dos-pasos' ? 'En dos pasos' + (r.exigirSeguir ? ' (exige seguir)' : '') + ' · botón "' + esc(r.confirmarBoton) + '" → ' : 'Directo · '}${r.botonUrl ? esc(r.botonTexto) + ' → ' + esc(r.botonUrl) : 'sin botón'}</div>
      <div class="ig-sub">Coincidencias ${r.stats?.coincidencias || 0} · Mensajes ${r.stats?.dms || 0}${r.modo === 'dos-pasos' ? ' · Recursos entregados ' + (r.stats?.confirmaciones || 0) : ''} · Fallos ${r.stats?.fallos || 0}</div>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
        <button class="btn btn-sm btn-secondary" onclick="igEditar('${esc(r.id)}')">Editar</button>
        <button class="btn btn-sm btn-secondary" onclick="igDuplicar('${esc(r.id)}')">Duplicar</button>
        ${r.mediaId ? `<button class="btn btn-sm btn-secondary" onclick="igRecToggle('${esc(r.id)}')">Recuperar comentarios</button>` : ''}
        <button class="btn btn-sm btn-secondary" onclick="igEliminar('${esc(r.id)}')">Eliminar</button>
      </div>
      <div id="igRec-${esc(r.id)}" style="display:${recAbiertos.has(r.id) ? '' : 'none'};margin-top:12px;border-top:1px solid #1A4DAA;padding-top:12px;"></div>
    </div>`).join('');
  l.forEach(r => { if (recAbiertos.has(r.id)) pintarRec(r.id); });
  clearTimeout(recTimer);
  const _rec = Object.values(estado.recuperaciones || {});
  if (_rec.some(x => x && (x.estado === 'buscando' || x.estado === 'corriendo'))) recTimer = setTimeout(() => { if (tabActual === 'auto') window.cargarInstagram(); }, _rec.some(x => x && x.estado === 'buscando') ? 4000 : 30000);
}

window.igAlternar = async function (id, input) {
  const r = (estado.reglas || []).find(x => x.id === id); if (!r) return;
  const nuevo = input.checked; input.disabled = true;
  try { await saveInstagramRegla({ ...r, activa: nuevo }); r.activa = nuevo; aviso(nuevo ? 'Regla activada.' : 'Regla pausada.'); }
  catch (e) { input.checked = !nuevo; aviso(e.message, true); }
  input.disabled = false; pintarReglas();
};
window.igEliminar = async function (id) {
  if (!confirm('¿Eliminar esta regla?')) return;
  try { await deleteInstagramRegla(id); await window.cargarInstagram(); } catch (e) { aviso(e.message, true); }
};
window.igDuplicar = function (id) {
  const r = (estado.reglas || []).find(x => x.id === id); if (!r) return;
  reglaEditando = { ...r, id: undefined, nombre: (r.nombre || 'Regla') + ' (copia)', activa: false, stats: undefined, encuesta: undefined };
  abrirForm();
};
window.igNuevaRegla = function () { reglaEditando = {}; abrirForm(); };
window.igEditar = function (id) { reglaEditando = (estado.reglas || []).find(r => r.id === id) || {}; abrirForm(); };

function abrirForm() {
  const r = reglaEditando;
  $('igFormWrap').style.display = '';
  $('igFNombre').value = r.nombre || '';
  $('igFMediaId').value = r.mediaId || '';
  $('igFMediaInfo').value = r.mediaInfo || '';
  $('igFMediaTxt').textContent = r.mediaId ? '📌 ' + (r.mediaInfo || r.mediaId) : '📌 Todos los posts y reels';
  $('igFPalabras').value = (r.palabras || []).join(', ');
  $('igFPublicas').value = (r.respuestasPublicas || []).join('\n');
  $('igFDm').value = r.dmTexto || '';
  $('igFBotonTxt').value = r.botonTexto || '';
  $('igFBotonUrl').value = r.botonUrl || '';
  $('igFUnaVez').checked = r.unaVezPorPersona !== false;
  $('igFModo').value = r.modo === 'dos-pasos' ? 'dos-pasos' : 'directo';
  $('igFConfirmar').value = r.confirmarBoton || '';
  $('igFEntrega').value = r.entregaTexto || '';
  $('igFSeguimiento').value = r.seguimientoTexto || '';
  $('igFExigir').checked = !!r.exigirSeguir;
  $('igFSeguirTxt').value = r.seguirTexto || '';
  $('igFSeguirBtn').value = r.seguirBoton || '';
  $('igFSeg1').value = r.seguimiento1Texto || '';
  $('igFDemora').value = r.seguimientoDemoraMin || '';
  $('igFEnc1').value = r.encuestaTexto || '';
  $('igFEnc2').value = r.encuesta2Texto || '';
  $('igFGracias').value = r.encuestaGraciasTexto || '';
  $('igFPlantilla').value = '';
  window.igCambiarModo();
  $('igPostsGrid').innerHTML = '';
  $('igFormWrap').scrollIntoView({ behavior: 'smooth', block: 'start' });
}
window.igCambiarModo = function () {
  const dos = $('igFModo').value === 'dos-pasos';
  $('igFPaso2').style.display = dos ? '' : 'none';
  $('igFSeguirWrap').style.display = dos && $('igFExigir').checked ? '' : 'none';
  $('igFDmLabel').textContent = dos ? 'Primer mensaje (SIN link; lleva el botón de confirmación). Podés usar {nombre}' : 'Mensaje privado (DM). Podés usar {nombre}';
  $('igFBotonLabel').textContent = dos ? 'Texto del botón final con el link (máx. 20)' : 'Texto del botón (máx. 20)';
};
window.igUsarPlantilla = function () {
  const t = PLANTILLAS[$('igFPlantilla').value]; if (!t) return;
  reglaEditando = { ...t, palabras: [t.palabras], id: undefined };
  abrirForm(); $('igFPlantilla').value = '';
};
window.igCerrarForm = function () { $('igFormWrap').style.display = 'none'; reglaEditando = null; };
window.igGuardarRegla = async function () {
  const regla = {
    id: reglaEditando?.id, nombre: $('igFNombre').value, activa: reglaEditando ? reglaEditando.activa !== false : true,
    mediaId: $('igFMediaId').value, mediaInfo: $('igFMediaInfo').value, palabras: $('igFPalabras').value,
    respuestasPublicas: $('igFPublicas').value, dmTexto: $('igFDm').value,
    modo: $('igFModo').value, confirmarBoton: $('igFConfirmar').value, entregaTexto: $('igFEntrega').value, seguimientoTexto: $('igFSeguimiento').value,
    seguimiento1Texto: $('igFSeg1').value, seguimientoDemoraMin: $('igFDemora').value, encuestaTexto: $('igFEnc1').value, encuesta2Texto: $('igFEnc2').value, encuestaGraciasTexto: $('igFGracias').value,
    exigirSeguir: $('igFExigir').checked, seguirTexto: $('igFSeguirTxt').value, seguirBoton: $('igFSeguirBtn').value,
    botonTexto: $('igFBotonTxt').value, botonUrl: $('igFBotonUrl').value, unaVezPorPersona: $('igFUnaVez').checked,
  };
  try { await saveInstagramRegla(regla); aviso('Regla guardada.'); window.igCerrarForm(); await window.cargarInstagram(); } catch (e) { aviso(e.message, true); }
};


// ── Recuperar comentarios sin respuesta ───────────────────────
window.igRecToggle = function (id) {
  const el = $('igRec-' + id); if (!el) return;
  if (recAbiertos.has(id)) { recAbiertos.delete(id); el.style.display = 'none'; return; }
  recAbiertos.add(id); el.style.display = ''; pintarRec(id); el.scrollIntoView({ behavior: 'smooth', block: 'center' });
};
function pintarRec(id) {
  const el = $('igRec-' + id); if (!el) return;
  const st = (estado.recuperaciones || {})[id];
  const m = recMsg[id];
  const msgHtml = m ? `<div style="margin:0 0 10px;padding:10px;border-radius:8px;font-weight:700;font-size:13px;background:${m.error ? '#7f1d1d' : '#14532d'};color:#fff;">${m.cargando ? '⏳ ' : ''}${esc(m.txt)}</div>` : '';
  if (!st) {
    el.innerHTML = msgHtml + `<div class="ig-sub" style="margin:0 0 8px;">Busca en tu publicación los comentarios que tienen la palabra de esta regla y <b>todavía no recibieron respuesta tuya</b>, para mandarles el mensaje de a poco.</div>
      <button class="btn btn-primary btn-sm" onclick="igRecAccion('${esc(id)}','escanear',this)">Buscar comentarios sin respuesta</button>`;
    return;
  }
  if (st.estado === 'buscando') {
    el.innerHTML = msgHtml + `<div style="padding:10px;border-radius:8px;font-weight:700;font-size:13px;background:#14532d;color:#fff;">⏳ Buscando comentarios en tu publicación… sigue en segundo plano, podés dejar esta pantalla abierta: se actualiza sola.</div>`;
    return;
  }
  if (st.estado === 'error') {
    el.innerHTML = msgHtml + `<div style="padding:10px;border-radius:8px;font-weight:700;font-size:13px;background:#7f1d1d;color:#fff;word-break:break-word;">No se pudo buscar: ${esc(st.motivo || 'error desconocido')}</div>
      <div style="margin-top:8px;"><button class="btn btn-primary btn-sm" onclick="igRecAccion('${esc(id)}','escanear',this)">Volver a buscar</button> <button class="btn btn-secondary btn-sm" onclick="igRecAccion('${esc(id)}','cancelar',this)">Descartar</button></div>`;
    return;
  }
  const r = st.resumen || {};
  const hechos = (st.enviados || 0) + (st.fallos || 0) + (st.saltados || 0) + (st.vencidos || 0);
  const pct = st.total ? Math.round(hechos * 100 / st.total) : 100;
  const nombres = { listo: 'Listo para empezar', corriendo: 'Enviando…', pausada: 'En pausa', terminada: 'Terminado' };
  el.innerHTML = msgHtml + `
    <div class="ig-sub" style="margin:0 0 6px;color:#fff;font-size:13px;">Encontré <b>${r.conPalabra || 0}</b> comentarios con la palabra en esta publicación: <b>${r.yaRespondidos || 0}</b> ya tenían respuesta tuya, <b>${r.yaAtendidos || 0}</b> ya los atendió el sistema y <b>${r.fueraDeVentana || 0}</b> son de hace más de 7 días (Instagram no permite mandarles mensaje privado). Quedan <b>${st.total || 0}</b> para enviar.</div>
    <div class="ig-sub" style="margin:0 0 4px;color:#fff;"><b>${nombres[st.estado] || st.estado}</b> · enviados ${st.enviados || 0} de ${st.total || 0}${st.fallos ? ' · fallos ' + st.fallos : ''}${st.saltados ? ' · saltados ' + st.saltados : ''}${st.vencidos ? ' · vencidos ' + st.vencidos : ''}</div>
    <div style="background:#060F22;border-radius:999px;height:10px;overflow:hidden;margin-bottom:8px;"><div style="width:${pct}%;height:100%;background:#22c55e;"></div></div>
    ${st.motivo ? `<div class="ig-sub" style="color:#fca5a5;">${esc(st.motivo)}</div>` : ''}
    <div class="ig-fil" style="margin:8px 0 0;">
      ${st.estado !== 'corriendo' && st.estado !== 'terminada' && st.total > (st.pos || 0) ? `
        <select id="igRecRitmo-${esc(id)}" class="form-control">${[10, 20, 40, 60, 120].map(n => `<option value="${n}" ${n === (st.porHora || 20) ? 'selected' : ''}>${n} por hora</option>`).join('')}</select>
        <button class="btn btn-primary btn-sm" onclick="igRecIniciar('${esc(id)}',this)">${st.estado === 'pausada' ? 'Reanudar' : 'Empezar a enviar'}</button>` : ''}
      ${st.estado === 'corriendo' ? `<button class="btn btn-secondary btn-sm" onclick="igRecAccion('${esc(id)}','pausar',this)">Pausar</button>` : ''}
      ${st.estado !== 'corriendo' ? `<button class="btn btn-secondary btn-sm" onclick="igRecAccion('${esc(id)}','escanear',this)">Volver a buscar</button>
        <button class="btn btn-secondary btn-sm" onclick="igRecAccion('${esc(id)}','cancelar',this)">Descartar</button>` : ''}
    </div>`;
}
window.igRecAccion = async function (id, accion, btn) {
  if (accion === 'cancelar' && !confirm('¿Descartar esta búsqueda? Lo ya enviado no se deshace.')) return;
  if (btn) btn.disabled = true;
  recMsg[id] = { cargando: true, txt: accion === 'escanear' ? 'Iniciando la búsqueda…' : 'Procesando…' };
  pintarRec(id);
  try {
    await recuperarInstagram(id, accion);
    recMsg[id] = accion === 'escanear' ? null : { txt: accion === 'pausar' ? 'Envío pausado.' : 'Listo.' };
    if (!recMsg[id]) delete recMsg[id];
    await window.cargarInstagram();
  } catch (e) { recMsg[id] = { error: true, txt: 'No se pudo: ' + e.message }; pintarRec(id); }
  if (btn) btn.disabled = false;
};
window.igRecIniciar = async function (id, btn) {
  const sel = $('igRecRitmo-' + id); btn.disabled = true;
  recMsg[id] = { cargando: true, txt: 'Empezando el envío…' }; pintarRec(id);
  try {
    await recuperarInstagram(id, 'iniciar', { porHora: sel ? sel.value : 20 });
    recMsg[id] = { txt: 'Empezó el envío. Podés cerrar esta pantalla: sigue solo.' };
    await window.cargarInstagram();
  } catch (e) { recMsg[id] = { error: true, txt: 'No se pudo: ' + e.message }; pintarRec(id); btn.disabled = false; }
};

// ── Panel de control ──────────────────────────────────────────
window.igFiltroPanel = function (v) {
  F.panel = v;
  document.querySelectorAll('#igSegPanel button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  pintarPanel();
};
function sumaPeriodo(per) {
  const st = estado.stats || { total: {}, dias: {} };
  if (per === 'total') return { ...st.total };
  const dias = Object.keys(st.dias).sort();
  const hoy = hoyAR();
  const desde = per === 'hoy' ? hoy : new Date(Date.now() - 3 * 3600000 - (Number(per) - 1) * 86400000).toISOString().slice(0, 10);
  const r = {};
  dias.filter(d => d >= desde && d <= hoy).forEach(d => Object.entries(st.dias[d]).forEach(([k, n]) => { r[k] = (r[k] || 0) + n; }));
  return r;
}
const pct = (a, b) => (a + b) ? Math.round(a * 100 / (a + b)) + '%' : '—';
function pintarPanel() {
  const t = sumaPeriodo(F.panel); const g = k => t[k] || 0;
  const toques = g('entregas') + g('pidieronSeguir');
  const k = (n, l) => `<div class="ig-kpi"><b>${n}</b><span>${l}</span></div>`;
  $('igKpis').innerHTML = k(g('comentarios'), 'Comentarios atendidos') + k(g('dmEnviados'), 'Mensajes privados enviados') + k(g('respuestasPublicas'), 'Respuestas públicas')
    + k(toques, 'Tocaron el botón') + k(g('entregas'), 'Recursos entregados') + k(g('pidieronSeguir'), 'Se les pidió seguirte')
    + k(g('seguimientos'), 'Mensajes “a la hora”') + k(g('saltados'), 'Saltados (ya lo habían recibido)') + k(g('fallos'), 'Fallos');
  $('igPanelNota').textContent = 'Los números cuentan desde que se activó el panel (7/11/2026).';
  $('igEncuesta').innerHTML = (g('encuestas') || g('p1si') || g('p1no')) ? `
    <div class="ig-kpis" style="margin:0;">
      ${k(g('encuestas'), 'Encuestas enviadas')}${k(g('p1si') + g('p1no'), 'Respondieron la pregunta 1')}
      ${k(g('p1si') + ' (' + pct(g('p1si'), g('p1no')) + ')', 'Pregunta 1: Sí')}${k(g('p1no'), 'Pregunta 1: No')}
      ${k(g('p2si') + ' (' + pct(g('p2si'), g('p2no')) + ')', 'Pregunta 2: Sí')}${k(g('p2no'), 'Pregunta 2: No')}
    </div>` : '<p class="ig-sub">Todavía no hay respuestas de encuesta en este período.</p>';
  // barras de los últimos 14 días
  const st = estado.stats || { dias: {} }; const dias = [];
  for (let i = 13; i >= 0; i--) dias.push(new Date(Date.now() - 3 * 3600000 - i * 86400000).toISOString().slice(0, 10));
  const max = Math.max(1, ...dias.map(d => (st.dias[d]?.comentarios || 0)));
  $('igBars').innerHTML = dias.map(d => `<div class="${d === hoyAR() ? 'hoy' : ''}" style="height:${Math.max(2, Math.round((st.dias[d]?.comentarios || 0) * 100 / max))}%" title="${d}: ${st.dias[d]?.comentarios || 0}"></div>`).join('');
  $('igBarLbl').innerHTML = dias.map(d => `<span>${d.slice(8)}</span>`).join('');
  const rs = estado.reglas || [];
  $('igPorRegla').innerHTML = rs.length ? `<table class="ig-tbl"><thead><tr><th>Regla</th><th>Coinc.</th><th>Mensajes</th><th>Entregas</th><th>Fallos</th><th>P1 Sí/No</th><th>P2 Sí/No</th></tr></thead><tbody>` + rs.map(r => `<tr><td>${esc(r.nombre)}${r.activa ? '' : ' <span class="ig-tag">pausada</span>'}</td><td>${r.stats?.coincidencias || 0}</td><td>${r.stats?.dms || 0}</td><td>${r.stats?.confirmaciones || 0}</td><td>${r.stats?.fallos || 0}</td><td>${r.encuesta?.p1?.si || 0}/${r.encuesta?.p1?.no || 0}</td><td>${r.encuesta?.p2?.si || 0}/${r.encuesta?.p2?.no || 0}</td></tr>`).join('') + '</tbody></table>' : '<p class="ig-sub">Sin reglas todavía.</p>';
}

// ── Actividad ─────────────────────────────────────────────────
window.igFiltroAct = function (k, v) {
  F.act[k] = v; pagAct = 1;
  if (k === 'vista') document.querySelectorAll('#igSegVista button').forEach(b => b.classList.toggle('on', b.dataset.v === v));
  pintarAct();
};
window.igVerMas = function () { pagAct++; pintarAct(); };
function logsFiltrados() {
  const f = F.act, q = f.q.trim().toLowerCase();
  const desde = f.per === 'todo' ? 0 : (f.per === 'hoy' ? new Date(hoyAR() + 'T03:00:00Z').getTime() : Date.now() - Number(f.per) * 86400000);
  return (estado.logs || []).filter(x => new Date(x.t).getTime() >= desde
    && (!f.regla || x.reglaId === f.regla) && (!f.res || x.dm === f.res)
    && (!q || (x.usuario || '').toLowerCase().includes(q) || (x.texto || '').toLowerCase().includes(q)));
}
const colorDe = dm => (dm === 'enviado' || dm === 'entregado' || dm === 'respuesta') ? '#86efac' : (dm === 'saltado' || dm === 'aviso' || dm === 'pidió seguir') ? '#cbd5e1' : '#fca5a5';
const lineaLog = x => `<div class="ig-log"><span style="color:${colorDe(x.dm)};font-weight:700;">${esc(x.dm)}</span> · ${fmt(x.t)}${x.usuario ? ' · @' + esc(x.usuario) : ''}${x.regla ? ' · ' + esc(x.regla) : ''}
  ${x.texto ? `<div class="ig-sub">"${esc(x.texto)}"</div>` : ''}${x.motivo ? `<div class="ig-sub" style="color:#fca5a5;">${esc(x.motivo)}</div>` : ''}${x.publico ? `<div class="ig-sub">${esc(x.publico)}</div>` : ''}</div>`;
function pintarAct() {
  const l = logsFiltrados();
  $('igActCuenta').textContent = `${l.length} evento${l.length === 1 ? '' : 's'} con estos filtros`;
  let html = '', total = 0;
  if (F.act.vista === 'persona') {
    const m = new Map();
    l.forEach(x => { const k = x.uid || x.usuario || '—'; if (!m.has(k)) m.set(k, { usuario: x.usuario, ev: [] }); const g = m.get(k); if (!g.usuario && x.usuario) g.usuario = x.usuario; g.ev.push(x); });
    const gs = [...m.values()]; total = gs.length;
    html = gs.slice(0, pagAct * POR_PAG).map(g => `<details class="ig-user"><summary>${g.usuario ? '@' + esc(g.usuario) : 'Usuario sin nombre'} · ${g.ev.length} evento${g.ev.length === 1 ? '' : 's'} · último ${fmt(g.ev[0].t)}</summary><div style="margin-top:8px;">${g.ev.map(lineaLog).join('')}</div></details>`).join('');
  } else { total = l.length; html = l.slice(0, pagAct * POR_PAG).map(lineaLog).join(''); }
  $('igLogs').innerHTML = html || '<p class="text-muted text-sm">No hay actividad con estos filtros.</p>';
  $('igMas').style.display = total > pagAct * POR_PAG ? '' : 'none';
  if (total > pagAct * POR_PAG) $('igMas').textContent = `Ver más (${total - pagAct * POR_PAG} restantes)`;
}


// ── Contactos ─────────────────────────────────────────────────
let ctItems = [], ctCursor = null, ctTimer = null, ctCargando = false;
const ST = { enviado: ['Mensaje enviado', '#86efac'], pendiente: ['Pendiente de envío', '#fde68a'], 'respondido-previo': ['Ya respondido antes', '#cbd5e1'], vencido: ['Más de 7 días', '#cbd5e1'], 'falló': ['Falló el envío', '#fca5a5'] };
window.igCtFiltro = function () { clearTimeout(ctTimer); ctTimer = setTimeout(() => igCtCargar(true), 350); };
window.igCtMas = function () { igCtCargar(false); };
async function igCtCargar(reiniciar) {
  if (ctCargando) return; ctCargando = true;
  if (reiniciar) { ctItems = []; ctCursor = null; $('igCtTabla').innerHTML = '<p class="ig-sub" style="color:#fff;">Cargando contactos…</p>'; }
  try {
    const r = await getContactosInstagram({ q: $('igCtQ').value.trim(), estado: $('igCtEstado').value, regla: $('igCtRegla').value, cursor: reiniciar ? '' : (ctCursor || '') });
    ctItems = ctItems.concat(r.items || []); ctCursor = r.cursor;
    pintarCt(r.total);
  } catch (e) { $('igCtTabla').innerHTML = `<p class="ig-sub" style="color:#fca5a5;">${esc(e.message)}</p>`; }
  ctCargando = false;
}
function pintarCt(total) {
  const fila = m => { const [txt, col] = ST[m.st] || [m.st, '#cbd5e1']; return `<tr>
    <td><a href="https://www.instagram.com/${esc(m.u)}/" target="_blank" rel="noopener" style="color:#8DB4FF;">@${esc(m.u)}</a></td>
    <td>${m.t1 ? fmt(m.t1) : ''}</td><td>${m.n || 1}</td><td style="color:${col};font-weight:700;">${esc(txt)}${m.mo ? '<div class="ig-sub" style="color:#fca5a5;">' + esc(m.mo) + '</div>' : ''}</td>
    <td style="text-align:left;">${esc(m.rg)}</td><td>${esc(m.p1 || '—')}</td><td>${esc(m.p2 || '—')}</td></tr>`; };
  $('igCtTabla').innerHTML = ctItems.length ? `<table class="ig-tbl"><thead><tr><th>Usuario</th><th>Último comentario</th><th>Coment.</th><th style="text-align:left;">Mensaje</th><th style="text-align:left;">Regla</th><th>P1</th><th>P2</th></tr></thead><tbody>${ctItems.map(fila).join('')}</tbody></table>` : '<p class="ig-sub" style="color:#fff;">Todavía no hay contactos con estos filtros. Se arma sola cuando alguien comenta o cuando usás “Recuperar comentarios”.</p>';
  $('igCtCuenta').textContent = `${total || 0} contactos en total · mostrando ${ctItems.length}`;
  $('igCtMas').style.display = ctCursor ? '' : 'none';
}
window.igCtDescargar = async function () {
  const b = $('igCtDescargar'); b.disabled = true; const t = b.textContent; b.textContent = 'Preparando…';
  try { await descargarContactosInstagram(); aviso('Descarga lista: contactos al día de este momento.'); }
  catch (e) { aviso(e.message, true); }
  b.disabled = false; b.textContent = t;
};

// ── Configuración ─────────────────────────────────────────────
function pintarDiag() {
  const l = estado.diagnostico || [];
  $('igDiag').innerHTML = l.length ? l.map(d => `<div class="ig-log">${new Date(d.t).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'medium' })} · ${esc((d.campos || []).join(', ') || 'sin campos')}
      <div class="ig-sub">cuenta ${d.cuentaMapeada ? 'reconocida' : '<b style="color:#fca5a5;">NO reconocida (' + esc(d.entryId) + ')</b>'} · firma ${d.firmaValida ? 'válida' : '<b style="color:#fca5a5;">inválida</b>'}</div></div>`).join('') : '<p class="text-muted text-sm">Todavía no llegó ningún aviso de Instagram.</p>';
}
window.igGuardarConexion = async function () {
  const token = $('igToken').value.trim(), appSecret = $('igAppSecret').value.trim(), igUserId = $('igIgId').value.trim();
  if (!token && !appSecret) { aviso('Pegá el token y/o el App Secret.', true); return; }
  aviso('Verificando con Instagram…');
  try {
    await setInstagramConfig({ token, appSecret, igUserId });
    $('igToken').value = ''; $('igAppSecret').value = ''; $('igIgId').value = '';
    aviso('Guardado.'); await window.cargarInstagram();
  } catch (e) { aviso(e.message, true); }
};

window.igDesconectar = async function () {
  if (!confirm('¿Desconectar la cuenta? Las reglas se conservan pero dejan de responder.')) return;
  try { await desconectarInstagram(); aviso('Cuenta desconectada.'); await window.cargarInstagram(); } catch (e) { aviso(e.message, true); }
};

window.igCopiar = function (id) { const el = $(id); el.select(); try { navigator.clipboard.writeText(el.value); aviso('Copiado.'); } catch { document.execCommand('copy'); } };

window.igNuevaRegla = function () { reglaEditando = {}; abrirForm(); };
window.igEditar = function (id) { reglaEditando = (estado.reglas || []).find(r => r.id === id) || {}; abrirForm(); };
window.igAlternar = async function (id) {
  const r = (estado.reglas || []).find(x => x.id === id); if (!r) return;
  try { await saveInstagramRegla({ ...r, activa: !r.activa }); await window.cargarInstagram(); } catch (e) { aviso(e.message, true); }
};

window.igElegirPost = async function () {
  $('igPostsGrid').innerHTML = '<p class="text-muted text-sm">Cargando tus últimas publicaciones…</p>';
  try {
    const { posts } = await getInstagramPosts();
    $('igPostsGrid').innerHTML = `<div class="ig-post" onclick="igUsarPost('','')"><div class="ig-post-img" style="display:flex;align-items:center;justify-content:center;font-size:24px;">∞</div><div class="ig-sub">Todos</div></div>` +
      posts.map(p => `<div class="ig-post" onclick="igUsarPost('${esc(p.id)}','${esc((p.caption || p.tipo || 'Post').replace(/['\n]/g, ' ').slice(0, 60))}')">
        <div class="ig-post-img">${p.img ? `<img src="${esc(p.img)}" alt="" loading="lazy">` : ''}</div><div class="ig-sub">${esc(p.caption || p.tipo)}</div></div>`).join('');
  } catch (e) { $('igPostsGrid').innerHTML = ''; aviso(e.message, true); }
};

window.igUsarPost = function (id, info) {
  $('igFMediaId').value = id; $('igFMediaInfo').value = info;
  $('igFMediaTxt').textContent = id ? '📌 ' + info : '📌 Todos los posts y reels';
  $('igPostsGrid').innerHTML = '';
};

window.igReparar = async function () {
  const el = $('igReparoRes'); el.textContent = 'Consultando a Instagram…';
  try {
    const r = await repararSuscripcionInstagram();
    const f = a => (a && a.length ? a.join(', ') : 'ninguno');
    el.innerHTML = `${r.consultaOk ? '' : '<b style="color:#fca5a5;">No pude consultar: ' + esc(r.errorConsulta) + '</b><br>'}Estaba suscripta a: <b>${esc(f(r.camposAntes))}</b><br>` +
      (r.faltaban && r.faltaban.length ? `Faltaban: <b>${esc(r.faltaban.join(', '))}</b> → ${r.reparoOk ? '<b style="color:#86efac;">reparado</b>' : '<b style="color:#fca5a5;">no se pudo: ' + esc(r.errorReparo) + '</b>'}<br>Ahora: <b>${esc(f(r.camposDespues))}</b>` : '<b style="color:#86efac;">No faltaba ninguno.</b>');
  } catch (e) { el.innerHTML = '<b style="color:#fca5a5;">' + esc(e.message) + '</b>'; }
};
