// Botón ▶ "Escuchá la explicación" para el Reporte Ejecutivo y el Dashboard.
// La explicación se arma SIN IA y sin backend: son frases fijas que se
// completan con los números reales que ya están cargados en pantalla
// (decisión de Vaneh, 11/10: todo gratis). La voz es la del navegador
// (SpeechSynthesis), preferentemente latinoamericana.
// Tono 'viaje' = branding COSMART (agencia 'cosmart'); 'neutro' = el resto.

const num = n => Number(n || 0).toLocaleString('es-AR');
const plural = (n, uno, varios) => (n === 1 ? uno : varios);
const top = obj => Object.entries(obj || {}).sort((a, b) => b[1] - a[1])[0] || null;

// d: { cliente, mes, total, publicados, aprobados, formatos:{}, ejes:{}, campActivas,
//      gastado, ingresos, roas, tareasPend, tareasOk }
// Devuelve un array de frases (cada una se lee por separado y se resalta).
export function armarNarracionReporte(d, tono) {
  const v = tono === 'viaje';
  const f = [];
  f.push(v ? `Hola, ¿cómo estás? Te cuento cómo va este tramo del viaje de ${d.cliente}.`
           : `Hola, te cuento cómo viene ${d.mes} para ${d.cliente}.`);
  if (!d.total) {
    f.push(v ? `Por ahora la ruta de ${d.mes} no tiene contenidos cargados.` : `Este mes todavía no hay contenidos cargados.`);
  } else {
    f.push(v
      ? `En la ruta de ${d.mes} hay ${d.total} ${plural(d.total, 'contenido', 'contenidos')}, y ${d.publicados} ${plural(d.publicados, 'ya llegó', 'ya llegaron')} a destino.`
      : `Hay ${d.total} ${plural(d.total, 'contenido planificado', 'contenidos planificados')} para el mes, y ${d.publicados} ${plural(d.publicados, 'ya fue publicado', 'ya fueron publicados')}.`);
    if (d.aprobados) f.push(`${d.aprobados} ${plural(d.aprobados, 'más está aprobado y listo', 'más están aprobados y listos')} para salir.`);
    const tf = top(d.formatos), te = top(d.ejes);
    if (tf) f.push(`El formato que más se usa es ${tf[0]}, con ${tf[1]}.`);
    if (te) f.push(`El eje de comunicación principal es ${te[0]}.`);
  }
  if (d.campActivas) {
    f.push(`Hay ${d.campActivas} ${plural(d.campActivas, 'campaña de pauta activa', 'campañas de pauta activas')}.`);
    if (d.gastado) f.push(`Hasta ahora se invirtieron ${num(d.gastado)} en pauta.`);
    if (d.gastado && d.ingresos) {
      const r = d.ingresos / d.gastado;
      f.push(`El retorno es de ${r.toFixed(1).replace('.', ',')} veces lo invertido.`);
      if (r < 2) f.push('Está por debajo de lo recomendado, así que conviene revisar la segmentación.');
    }
  }
  if (d.tareasPend || d.tareasOk) {
    f.push(`En tareas hay ${d.tareasPend} ${plural(d.tareasPend, 'pendiente', 'pendientes')} y ${d.tareasOk} ${plural(d.tareasOk, 'completada', 'completadas')}.`);
    if (d.tareasPend > 5) f.push('Conviene priorizar las pendientes para no acumular trabajo.');
  }
  f.push(v ? 'Seguimos recorriendo el camino hacia tu destino. Cualquier duda, escribinos.' : 'Cualquier duda, escribinos.');
  return f;
}

// d: { cliente, mes, total, publicados, programados, enProceso, formatos:{}, ejes:{},
//      tareasPend, tareasEnProceso, tareasListas }
export function armarNarracionDashboard(d, tono) {
  const v = tono === 'viaje';
  const f = [];
  f.push(v ? `Hola, ¿cómo estás? Mirá cómo viene el mapa de contenidos de ${d.cliente} en ${d.mes}.`
           : `Hola, te cuento cómo viene el calendario de contenidos de ${d.cliente} en ${d.mes}.`);
  if (!d.total) {
    f.push('Este mes todavía no hay contenidos con fecha de publicación.');
  } else {
    f.push(`Hay ${d.total} ${plural(d.total, 'contenido', 'contenidos')} en el mes.`);
    f.push(`${d.publicados} ${plural(d.publicados, 'está publicado', 'están publicados')}, ${d.programados} ${plural(d.programados, 'programado', 'programados')} y ${d.enProceso} ${plural(d.enProceso, 'en proceso', 'en proceso')}.`);
    const tf = top(d.formatos), te = top(d.ejes);
    if (tf && tf[1]) f.push(`El formato más usado es ${tf[0]}, con ${tf[1]}.`);
    if (te && te[0] !== 'Sin eje') f.push(`El eje que más aparece es ${te[0]}.`);
  }
  if (d.tareasPend || d.tareasEnProceso || d.tareasListas) {
    f.push(`En tareas hay ${d.tareasPend} sin empezar, ${d.tareasEnProceso} en progreso y ${d.tareasListas} ${plural(d.tareasListas, 'lista', 'listas')}.`);
  }
  f.push(v ? 'Seguimos avanzando hacia tu destino. Cualquier duda, escribinos.' : 'Cualquier duda, escribinos.');
  return f;
}

// ── Reproductor ──────────────────────────────────────────────────────────
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
const soportado = !!(synth && typeof SpeechSynthesisUtterance !== 'undefined');
const VELOCIDADES = [1.3, 1.6, 2, 1];
let sesionActual = 0; // invalida reproductores viejos al crear/detener uno nuevo

function elegirVoz() {
  const voces = synth.getVoices();
  const pref = [/es[-_]AR/i, /es[-_]MX/i, /es[-_]US/i, /es[-_]419/i, /es[-_](CO|CL|PE|UY|VE)/i];
  for (const re of pref) { const x = voces.find(vz => re.test(vz.lang)); if (x) return x; }
  return voces.find(vz => /^es/i.test(vz.lang) && !/es[-_]ES/i.test(vz.lang)) || voces.find(vz => /^es/i.test(vz.lang)) || null;
}

function inyectarEstilos() {
  if (document.getElementById('play-css')) return;
  const s = document.createElement('style');
  s.id = 'play-css';
  s.textContent = `
.play-card{background:var(--primary-dark,#0D2B6B);color:#fff;border-radius:12px;padding:14px 16px;margin-bottom:16px}
.play-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.play-title{font-weight:700;font-size:14px;flex:1;min-width:140px;color:#fff}
.play-btn{width:44px;height:44px;border-radius:50%;border:0;background:var(--danger,#E02020);color:#fff;display:grid;place-items:center;cursor:pointer;flex:none;font-size:16px}
.play-btn:focus-visible,.play-mini:focus-visible{outline:3px solid #fff;outline-offset:2px}
.play-mini{background:transparent;border:1px solid rgba(255,255,255,.55);color:#fff;border-radius:8px;padding:6px 12px;min-height:36px;cursor:pointer;font-size:13px}
.play-mini:hover{background:rgba(255,255,255,.12)}
.play-bar{flex-basis:100%;height:5px;background:rgba(255,255,255,.2);border-radius:3px;overflow:hidden}
.play-bar i{display:block;height:100%;width:0;background:#fff;transition:width .3s}
.play-texto{flex-basis:100%;font-size:14px;line-height:1.5;color:#fff;margin-top:6px}
.play-texto span{padding:1px 2px;border-radius:3px}
.play-texto span.on{background:#fff;color:var(--primary-dark,#0D2B6B)}
@media print{.play-card{display:none}}
.play-aviso{flex-basis:100%;font-size:11px;color:rgba(255,255,255,.8);margin-top:4px}
`;
  document.head.appendChild(s);
}

export function detenerPlay() {
  sesionActual++;
  if (soportado) { try { synth.cancel(); } catch (e) {} }
}

// Inserta el reproductor al principio de `host`. `frases`: array de strings.
export function montarPlay(host, frases) {
  if (!host) return;
  inyectarEstilos();
  detenerPlay();
  const miSesion = sesionActual;
  let idx = 0, reproduciendo = false, pausado = false, vel = VELOCIDADES[0];

  const card = document.createElement('div');
  card.className = 'play-card';
  card.innerHTML = `
    <div class="play-row">
      <button type="button" class="play-btn" aria-label="Reproducir explicación">▶</button>
      <div class="play-title">Escuchá la explicación</div>
      <button type="button" class="play-mini play-stop">Detener</button>
      <button type="button" class="play-mini play-vel" aria-label="Velocidad">${vel}x</button>
      <div class="play-bar" aria-hidden="true"><i></i></div>
      <div class="play-texto" aria-live="polite"></div>
      <div class="play-aviso">Explicación generada automáticamente por inteligencia artificial a partir de los datos del panel; puede cometer errores. Ante cualquier duda, consultá los números.</div>
    </div>`;
  const btn = card.querySelector('.play-btn'), stop = card.querySelector('.play-stop'), velBtn = card.querySelector('.play-vel');
  const barra = card.querySelector('.play-bar i'), texto = card.querySelector('.play-texto');
  const spans = frases.map(t => { const s = document.createElement('span'); s.textContent = t + ' '; texto.appendChild(s); return s; });
  const marcar = i => spans.forEach((s, k) => s.classList.toggle('on', k === i));
  const icono = () => {
    btn.textContent = reproduciendo && !pausado ? '⏸' : '▶';
    btn.setAttribute('aria-label', reproduciendo && !pausado ? 'Pausar explicación' : 'Reproducir explicación');
  };
  const vigente = () => miSesion === sesionActual;
  const reset = () => { try { synth.cancel(); } catch (e) {} reproduciendo = false; pausado = false; idx = 0; marcar(-1); barra.style.width = '0'; icono(); };

  function hablar() {
    if (!vigente()) return;
    if (idx >= frases.length) { marcar(-1); barra.style.width = '100%'; reproduciendo = false; pausado = false; idx = 0; icono(); return; }
    marcar(idx); barra.style.width = (idx / frases.length * 100) + '%';
    const u = new SpeechSynthesisUtterance(frases[idx]);
    const voz = elegirVoz();
    if (voz) { u.voice = voz; u.lang = voz.lang; } else { u.lang = 'es-AR'; }
    u.rate = vel;
    u.onend = () => { if (vigente() && reproduciendo && !pausado) { idx++; hablar(); } };
    u.onerror = e => { if (e.error !== 'canceled' && e.error !== 'interrupted' && vigente()) { reset(); texto.textContent = 'No se pudo reproducir el audio en este navegador.'; } };
    synth.speak(u);
  }

  btn.addEventListener('click', () => {
    if (!soportado) { texto.textContent = 'Tu navegador no tiene voz integrada. Probá desde Chrome o Safari.'; return; }
    if (!reproduciendo) { reproduciendo = true; pausado = false; icono(); synth.cancel(); hablar(); }
    else if (!pausado) { pausado = true; synth.cancel(); icono(); }
    else { pausado = false; icono(); hablar(); }
  });
  stop.addEventListener('click', reset);
  velBtn.addEventListener('click', () => {
    vel = VELOCIDADES[(VELOCIDADES.indexOf(vel) + 1) % VELOCIDADES.length];
    velBtn.textContent = vel + 'x';
    if (reproduciendo && !pausado) { synth.cancel(); hablar(); }
  });
  if (soportado) synth.getVoices();

  host.insertBefore(card, host.firstChild);
}
