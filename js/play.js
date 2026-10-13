// Botón ▶ "Escuchá la explicación" para el Reporte Ejecutivo y el Dashboard.
// La explicación se arma SIN IA y sin backend: son frases fijas que se
// completan con los números reales que ya están cargados en pantalla
// (decisión de Vaneh, 11/10: todo gratis). La voz es la del navegador
// (SpeechSynthesis), preferentemente latinoamericana.
// Tono 'viaje' = para clientes de la agencia COSMART; 'neutro' = el resto.
// Estética: identidad "Al Día Voz" (Claude Design, 12/10) -- NADA de azul COSMART.

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

// ── Reproductor (estética Al Día Voz) ───────────────────────────────────
const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
const soportado = !!(synth && typeof SpeechSynthesisUtterance !== 'undefined');
const VELOCIDADES = [1.3, 1.6, 2, 1];
const CHARS_POR_SEG = 15; // estimación de lectura a velocidad 1 (la voz del navegador no informa duración)
let sesionActual = 0; // invalida reproductores viejos al crear/detener uno nuevo

function elegirVoz() {
  const voces = synth.getVoices();
  const pref = [/es[-_]AR/i, /es[-_]MX/i, /es[-_]US/i, /es[-_]419/i, /es[-_](CO|CL|PE|UY|VE)/i];
  for (const re of pref) { const x = voces.find(vz => re.test(vz.lang)); if (x) return x; }
  return voces.find(vz => /^es/i.test(vz.lang) && !/es[-_]ES/i.test(vz.lang)) || voces.find(vz => /^es/i.test(vz.lang)) || null;
}

const mmss = s => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

function inyectarEstilos() {
  if (document.getElementById('av-css')) return;
  if (!document.getElementById('av-fonts')) {
    const l = document.createElement('link');
    l.id = 'av-fonts'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Gabarito:wght@500;700;800&family=Figtree:wght@400;500;600;700&display=swap';
    document.head.appendChild(l);
  }
  const s = document.createElement('style');
  s.id = 'av-css';
  // Tokens aislados en .av-card (no pisan las variables del Hub).
  s.textContent = `
.av-card{--av-bg:#FFFFFF;--av-line:#E8DCD0;--av-ink:#2A1E18;--av-sub:#6B5B50;--av-body:#4E4038;--av-track:#F1E6D8;--av-chip-bg:#FBEBC6;--av-chip-fg:#6F4600;--av-btn-ink:#2A1E18;--av-accent:#E2A33A;--av-ghost:#9A6512;
  background:var(--av-bg);border:1px solid var(--av-line);border-radius:24px;padding:22px;display:flex;flex-direction:column;gap:16px;margin-bottom:16px;font-family:'Figtree',system-ui,sans-serif;color:var(--av-ink);max-width:560px}
@media (prefers-color-scheme:dark){html:not([data-theme="light"]) .av-card:not([data-tema="claro"]){--av-bg:#29201A;--av-line:#3E3128;--av-ink:#FFFFFF;--av-sub:rgba(255,255,255,.85);--av-body:#FFFFFF;--av-track:#3E3128;--av-chip-bg:#5C4312;--av-chip-fg:#FFFFFF;--av-btn-ink:#1C1511;--av-ghost:#E2A33A}}
html[data-theme="dark"] .av-card:not([data-tema="claro"]),.av-card[data-tema="oscuro"]{--av-bg:#29201A;--av-line:#3E3128;--av-ink:#FFFFFF;--av-sub:rgba(255,255,255,.85);--av-body:#FFFFFF;--av-track:#3E3128;--av-chip-bg:#5C4312;--av-chip-fg:#FFFFFF;--av-btn-ink:#1C1511;--av-ghost:#E2A33A}
.av-top{display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap}
.av-et{font:600 13px 'Figtree',sans-serif;color:var(--av-sub)}
.av-chip{font:600 12px 'Figtree',sans-serif;background:var(--av-chip-bg);color:var(--av-chip-fg);padding:5px 10px;border-radius:99px}
.av-main{display:flex;gap:16px;align-items:center}
.av-btn{flex:none;width:64px;height:64px;border-radius:32px;border:0;cursor:pointer;background:var(--av-accent);color:var(--av-btn-ink);font:700 24px 'Figtree',sans-serif;display:flex;align-items:center;justify-content:center;padding:0}
.av-btn:hover{filter:brightness(1.05)}
.av-btn:focus-visible,.av-mini:focus-visible{outline:3px solid var(--av-ghost);outline-offset:2px}
.av-txt{display:flex;flex-direction:column;gap:4px;min-width:0}
.av-titulo{font:800 22px/1.15 'Gabarito',sans-serif;letter-spacing:-.02em;color:var(--av-ink)}
.av-estado{font-size:14px;color:var(--av-sub)}
.av-track{height:8px;border-radius:4px;background:var(--av-track);overflow:hidden}
.av-track i{display:block;height:8px;border-radius:4px;background:var(--av-accent);width:0;transition:width .25s linear}
.av-frag{margin:0;font-size:15px;line-height:1.5;color:var(--av-body);min-height:3em}
.av-ctrl{display:flex;gap:10px;flex-wrap:wrap}
.av-mini{background:transparent;border:1.5px solid var(--av-ghost);color:var(--av-ghost);border-radius:12px;padding:0 16px;min-height:44px;font:600 14px 'Figtree',sans-serif;cursor:pointer}
html[data-theme="dark"] .av-mini,.av-card[data-tema="oscuro"] .av-mini{color:#FFFFFF;border-color:#FFFFFF}
.av-aviso{font-size:12px;color:var(--av-sub);line-height:1.4}
@media print{.av-card{display:none}}
@media (prefers-reduced-motion:reduce){.av-track i{transition:none}}
@media (max-width:420px){.av-card{padding:18px}.av-titulo{font-size:20px}}
`;
  document.head.appendChild(s);
}

export function detenerPlay() {
  sesionActual++;
  if (soportado) { try { synth.cancel(); } catch (e) {} }
}

// Inserta el reproductor al principio de `host`.
// opciones: { etiqueta: 'Reporte de octubre', tema: 'claro'|'oscuro' (solo para previews) }
export function montarPlay(host, frases, opciones = {}) {
  if (!host) return;
  inyectarEstilos();
  detenerPlay();
  const miSesion = sesionActual;
  let idx = 0, reproduciendo = false, pausado = false, vel = VELOCIDADES[0], t0 = 0, timer = null;

  const card = document.createElement('div');
  card.className = 'av-card';
  if (opciones.tema) card.dataset.tema = opciones.tema;
  card.innerHTML = `
    <div class="av-top"><span class="av-et"></span><span class="av-chip">Al Día Voz</span></div>
    <div class="av-main">
      <button type="button" class="av-btn" aria-label="Escuchar reporte">▶</button>
      <div class="av-txt"><b class="av-titulo">Escuchá tu reporte</b><span class="av-estado" aria-live="polite"></span></div>
    </div>
    <div class="av-track" aria-hidden="true"><i></i></div>
    <p class="av-frag" aria-live="off"></p>
    <div class="av-ctrl">
      <button type="button" class="av-mini av-stop">Detener</button>
      <button type="button" class="av-mini av-vel" aria-label="Velocidad">${vel}x</button>
    </div>
    <span class="av-aviso">Explicación generada automáticamente por inteligencia artificial a partir de los datos del panel; puede cometer errores. Ante cualquier duda, consultá los números.</span>`;
  card.querySelector('.av-et').textContent = opciones.etiqueta || 'Reporte';
  const btn = card.querySelector('.av-btn'), stop = card.querySelector('.av-stop'), velBtn = card.querySelector('.av-vel');
  const barra = card.querySelector('.av-track i'), estado = card.querySelector('.av-estado'), frag = card.querySelector('.av-frag');

  const cps = () => CHARS_POR_SEG * vel;
  const dur = f => f.length / cps();
  const total = () => frases.reduce((a, f) => a + dur(f), 0);
  const previo = () => frases.slice(0, idx).reduce((a, f) => a + dur(f), 0);
  const vigente = () => miSesion === sesionActual;
  const parar = () => { if (timer) { clearInterval(timer); timer = null; } };

  function pintar() {
    const T = total();
    const el = reproduciendo && !pausado ? previo() + Math.min((performance.now() - t0) / 1000, dur(frases[idx] || '')) : previo();
    barra.style.width = Math.min(100, T ? el / T * 100 : 0) + '%';
    if (reproduciendo || pausado) estado.textContent = (pausado ? 'En pausa' : 'Reproduciendo') + ' · ' + mmss(el) + ' / ' + mmss(T);
    else estado.textContent = 'Te lo explico en palabras simples · ' + mmss(T);
    frag.textContent = frases[Math.min(idx, frases.length - 1)] || '';
    btn.textContent = reproduciendo && !pausado ? '❚❚' : '▶';
    btn.setAttribute('aria-label', reproduciendo && !pausado ? 'Pausar' : 'Escuchar reporte');
  }
  const reset = () => { try { synth.cancel(); } catch (e) {} parar(); reproduciendo = false; pausado = false; idx = 0; pintar(); };

  function hablar() {
    if (!vigente()) { parar(); return; }
    if (idx >= frases.length) { parar(); reproduciendo = false; pausado = false; idx = 0; pintar(); barra.style.width = '100%'; estado.textContent = 'Listo · ' + mmss(total()); return; }
    t0 = performance.now(); pintar();
    if (!timer) timer = setInterval(() => { if (!vigente()) { parar(); return; } pintar(); }, 250);
    const u = new SpeechSynthesisUtterance(frases[idx]);
    const voz = elegirVoz();
    if (voz) { u.voice = voz; u.lang = voz.lang; } else { u.lang = 'es-AR'; }
    u.rate = vel;
    u.onend = () => { if (vigente() && reproduciendo && !pausado) { idx++; hablar(); } };
    u.onerror = e => { if (e.error !== 'canceled' && e.error !== 'interrupted' && vigente()) { reset(); estado.textContent = 'No se pudo reproducir el audio en este navegador.'; } };
    synth.speak(u);
  }

  btn.addEventListener('click', () => {
    if (!soportado) { estado.textContent = 'Tu navegador no tiene voz integrada. Probá desde Chrome o Safari.'; return; }
    if (!reproduciendo) { reproduciendo = true; pausado = false; synth.cancel(); hablar(); }
    else if (!pausado) { pausado = true; synth.cancel(); parar(); pintar(); }
    else { pausado = false; hablar(); }
  });
  stop.addEventListener('click', reset);
  velBtn.addEventListener('click', () => {
    vel = VELOCIDADES[(VELOCIDADES.indexOf(vel) + 1) % VELOCIDADES.length];
    velBtn.textContent = vel + 'x';
    if (reproduciendo && !pausado) { synth.cancel(); hablar(); } else pintar();
  });
  if (soportado) synth.getVoices();
  pintar();
  host.insertBefore(card, host.firstChild);
}
