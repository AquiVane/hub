// Sección "Instagram" del admin: automatizaciones, panel de control, actividad y configuración.
import { getInstagram, setInstagramConfig, desconectarInstagram, getInstagramPosts, saveInstagramRegla, deleteInstagramRegla, repararSuscripcionInstagram } from './data.js?v=20';

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = d => new Date(d).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' });
let estado = null;
let reglaEditando = null;
let tabActual = null;
const F = { auto: { estado: 'todas', q: '', modo: '' }, panel: 'total', act: { regla: '', res: '', per: '7', q: '', vista: 'evento' } };
let pagAct = 1;
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
  igTab(!conectada() ? 'conf' : (tabActual || (['auto', 'panel', 'act', 'conf'].includes(guardada) ? guardada : 'auto')));
  const sel = $('igActRegla'); const v = F.act.regla;
  sel.innerHTML = '<option value="">Todas las reglas</option>' + (e.reglas || []).map(r => `<option value="${esc(r.id)}">${esc(r.nombre)}</option>`).join('');
  sel.value = v;
  pintarReglas(); pintarPanel(); pintarAct(); pintarDiag();
}

window.igTab = function (t) {
  tabActual = t; lsSet('igTab', t);
  document.querySelectorAll('#igTabs .ig-tab').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  ['auto', 'panel', 'act', 'conf'].forEach(x => { const el = $('igPane' + { auto: 'Auto', panel: 'Panel', act: 'Act', conf: 'Conf' }[x]); if (el) el.classList.toggle('hidden', x !== t); });
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
        <button class="btn btn-sm btn-secondary" onclick="igEliminar('${esc(r.id)}')">Eliminar</button>
      </div>
    </div>`).join('');
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
