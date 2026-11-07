// Sección "Instagram" del admin: respuestas automáticas a comentarios (reemplazo de ManyChat).
import { getInstagram, setInstagramConfig, desconectarInstagram, getInstagramPosts, saveInstagramRegla, deleteInstagramRegla } from './data.js?v=19';

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
let estado = null;
let reglaEditando = null;
const PLANTILLAS = { libro: {"nombre": "Libro: La P de precio", "modo": "dos-pasos", "mediaId": "4020982225636735346", "mediaInfo": "Reel del libro (elegí la publicación para confirmar)", "palabras": "Libro", "respuestasPublicas": ["Un gusto conocerte {nombre}, ya te estoy enviando el link a tu DM 🧲", "Hola {nombre}, encantada de tenerte por acá, te estoy mandando la info por mensaje privado🧭. Revisalo", "Claro {nombre}, un placer. Te envío por Mensaje privado la info. ⚓Miralo."], "dmTexto": "Hola {nombre}! Cómo estás? 🧲 Te doy la bienvenida a mi cuenta. Soy Vaneh, estratega de marketing digital y 🧭 te ayudo a darle estructura a tu negocio o servicio, un gusto que estés por acá.\nPreparé la info sobre negociación y fijación de precios para que puedas tener todo a mano.\nTocá el botón para obtenerla.", "confirmarBoton": "⚓Conocer + del libro", "exigirSeguir": true, "seguirTexto": "Fantástico, estoy haciendo esto exclusivo para mis seguidores y suscriptores.\nSeguime para que puedas crecer tu negocio o emprendimientos", "seguirBoton": "Ya te sigo ✅", "entregaTexto": "Gracias por seguirme y bienvenido/a a la comunidad!\nAhora sí, tocá el botón y descubrí cómo fijar y negociar precios de manera SMART y efectiva.\nTe regalo el 🧲 de la suerte para que atraigas todo lo que te merecés.\nTocá el botón", "botonTexto": "⚓Ver info Libro", "botonUrl": "https://training.cosmart.com.ar/precio", "seguimiento1Texto": "¿Pudiste acceder al link sin problema? 😊 Si necesitás algo, escribime por acá y te ayudo.", "seguimientoDemoraMin": 60, "encuestaTexto": "Aprovecho que te tengo por acá 🙌 Estoy pensando en abrir una suscripción muy económica dentro de Instagram para emprendedores y dueños de negocio como vos: contenido todos los días para aumentar tus ventas, de una profesional con más de 10 años de trayectoria en marketing digital, y con todos los videos grabados para verlos cuando quieras.\n\n¿Serías tan amable de contestarme estas dos preguntas? Tus respuestas me sirven mucho para evaluar si este esfuerzo tendría buena recepción.\n\n1️⃣ ¿Te interesaría estar en esa comunidad?\n2️⃣ ¿Te suscribirías por u$s 2 por mes?\n\nEmpecemos por la primera 👇", "encuesta2Texto": "¡Genial! 🙌 Y la segunda: ¿te suscribirías por u$s 2 por mes?", "encuestaGraciasTexto": "¡Gracias por tus respuestas! 💛 Y de paso ya aprendiste algo más: preguntarle a tu público antes de lanzar algo es una excelente manera de optimizar tu negocio. ¡Nos leemos!", "unaVezPorPersona": true} };

function aviso(msg, error) { const el = $('igAviso'); if (!el) return; el.textContent = msg; el.style.color = error ? '#fca5a5' : '#86efac'; el.style.display = msg ? 'block' : 'none'; }

window.cargarInstagram = async function () {
  try { estado = await getInstagram(); } catch (e) { aviso(e.message, true); return; }
  pintar();
};

function pintar() {
  const e = estado;
  $('igEstadoCuenta').innerHTML = e.conectada
    ? `<strong>@${esc(e.username)}</strong> conectada${e.tokenFecha ? ` · token del ${new Date(e.tokenFecha).toLocaleDateString('es-AR')} (se renueva solo)` : ''}`
    : 'Todavía no hay una cuenta conectada.';
  $('igWebhookUrl').value = e.webhookUrl || '';
  $('igVerifyToken').value = e.verifyToken || '(se genera al guardar)';
  $('igAppSecretEstado').textContent = e.appSecretCargado ? '✅ App Secret cargado' : '⚠️ Falta el App Secret';
  $('igBtnDesconectar').style.display = e.conectada ? '' : 'none';
  $('igReglasWrap').style.display = e.conectada && e.appSecretCargado ? '' : 'none';
  $('igPasos').open = !(e.conectada && e.appSecretCargado);
  pintarReglas(); pintarLogs();
}

function pintarReglas() {
  const l = estado.reglas || [];
  $('igReglasLista').innerHTML = l.length ? l.map(r => `
    <div class="ig-card">
      <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
        <strong style="flex:1;min-width:140px;">${esc(r.nombre)}</strong>
        <span class="ig-tag" style="${r.activa ? 'background:#14532d;color:#bbf7d0;' : 'background:#334155;color:#cbd5e1;'}">${r.activa ? 'Activa' : 'Pausada'}</span>
      </div>
      <div class="ig-sub">${r.mediaId ? '📌 ' + esc(r.mediaInfo || r.mediaId) : '📌 Todos los posts y reels'} · ${r.palabras?.length ? 'Palabras: ' + esc(r.palabras.join(', ')) : 'Cualquier comentario'}</div>
      <div class="ig-sub">${r.modo === 'dos-pasos' ? 'En dos pasos' + (r.exigirSeguir ? ' (exige seguir)' : '') + ' · botón "' + esc(r.confirmarBoton) + '" → ' : 'Directo · '}${r.botonUrl ? esc(r.botonTexto) + ' → ' + esc(r.botonUrl) : 'sin botón'}</div>
      <div class="ig-sub">Coincidencias ${r.stats?.coincidencias || 0} · DMs enviados ${r.stats?.dms || 0}${r.modo === 'dos-pasos' ? ' · tocaron el botón ' + (r.stats?.confirmaciones || 0) : ''} · fallos ${r.stats?.fallos || 0}</div>
      ${r.encuestaTexto ? `<div class="ig-sub">Encuesta · Pregunta 1: Sí ${r.encuesta?.p1?.si || 0} / No ${r.encuesta?.p1?.no || 0} · Pregunta 2: Sí ${r.encuesta?.p2?.si || 0} / No ${r.encuesta?.p2?.no || 0}</div>` : ''}
      <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;">
        <button class="btn btn-sm btn-secondary" onclick="igEditar('${esc(r.id)}')">Editar</button>
        <button class="btn btn-sm btn-secondary" onclick="igAlternar('${esc(r.id)}')">${r.activa ? 'Pausar' : 'Activar'}</button>
        <button class="btn btn-sm btn-secondary" onclick="igEliminar('${esc(r.id)}')">Eliminar</button>
      </div>
    </div>`).join('') : '<p class="text-muted text-sm">Todavía no creaste ninguna regla.</p>';
}

function pintarLogs() {
  const l = estado.logs || [];
  $('igLogs').innerHTML = l.length ? l.slice(0, 50).map(x => {
    const color = (x.dm === 'enviado' || x.dm === 'entregado') ? '#86efac' : x.dm === 'saltado' ? '#cbd5e1' : '#fca5a5';
    return `<div class="ig-log"><span style="color:${color};font-weight:700;">${esc(x.dm)}</span> · ${new Date(x.t).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
      ${x.usuario ? ' · @' + esc(x.usuario) : ''}${x.regla ? ' · ' + esc(x.regla) : ''}
      ${x.texto ? `<div class="ig-sub">"${esc(x.texto)}"</div>` : ''}
      ${x.motivo ? `<div class="ig-sub" style="color:#fca5a5;">${esc(x.motivo)}</div>` : ''}
      ${x.publico ? `<div class="ig-sub">Respuesta pública: ${esc(x.publico)}</div>` : ''}</div>`;
  }).join('') : '<p class="text-muted text-sm">Cuando alguien comente, vas a ver acá qué pasó con cada comentario.</p>';
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
window.igEliminar = async function (id) {
  if (!confirm('¿Eliminar esta regla?')) return;
  try { await deleteInstagramRegla(id); await window.cargarInstagram(); } catch (e) { aviso(e.message, true); }
};

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

window.igGuardarRegla = async function () {
  const regla = {
    id: reglaEditando?.id, nombre: $('igFNombre').value, activa: reglaEditando?.activa !== false,
    mediaId: $('igFMediaId').value, mediaInfo: $('igFMediaInfo').value, palabras: $('igFPalabras').value,
    respuestasPublicas: $('igFPublicas').value, dmTexto: $('igFDm').value,
    modo: $('igFModo').value, confirmarBoton: $('igFConfirmar').value, entregaTexto: $('igFEntrega').value, seguimientoTexto: $('igFSeguimiento').value, seguimiento1Texto: $('igFSeg1').value, seguimientoDemoraMin: $('igFDemora').value, encuestaTexto: $('igFEnc1').value, encuesta2Texto: $('igFEnc2').value, encuestaGraciasTexto: $('igFGracias').value, exigirSeguir: $('igFExigir').checked, seguirTexto: $('igFSeguirTxt').value, seguirBoton: $('igFSeguirBtn').value,
    botonTexto: $('igFBotonTxt').value, botonUrl: $('igFBotonUrl').value, unaVezPorPersona: $('igFUnaVez').checked,
  };
  try { await saveInstagramRegla(regla); aviso('Regla guardada.'); window.igCerrarForm(); await window.cargarInstagram(); } catch (e) { aviso(e.message, true); }
};
