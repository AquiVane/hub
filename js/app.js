import { requireAuth, logoutUser, changePassword } from './auth.js';
import {
  getClientData, saveClientData, getContenidos, saveContenido, deleteContenido, saveContenidosBulk,
  getTareas, saveTarea, deleteTarea,
  getCampanas, saveCampana, deleteCampana, saveCampanasBulk,
  getMetricas, saveMetricasData, getHomeData, saveHomeData,
  getIdeas, saveIdea, deleteIdea,
  getPlan, savePlan,
  uploadArchivo, abrirArchivo
} from './data.js';

// ── Bootstrap ──────────────────────────────────────────
const user = requireAuth();
if (!user) throw new Error('No auth');

const params = new URLSearchParams(window.location.search);
const clientId = params.get('client') || user.clientId;
if (!clientId) { window.location.href = '../admin/index.html'; }

let STATE = { contenidos: [], tareas: [], campanas: [], metricas: {}, ideas: [], client: {}, links: [] };
let currentSection = 'home';
let _tareasView = 'kanban';
let _tareasBusqueda = '';
let _tareasFiltroAsignado = ''; // '' = todos, '_sin_asignar' = sin asignar, o el email de un colaborador/usuario del equipo
let editingContenido = null;
let editingTarea = null;
let editingCampana = null;

window.cerrarSesionYVolver = function() {
  localStorage.removeItem('mh_session_token');
  localStorage.removeItem('mh_user');
  window.location.href = '/login.html';
};

// ── Init ───────────────────────────────────────────────
async function init() {
  try {
    document.getElementById('logoutBtn').addEventListener('click', logoutUser);

    STATE.client = await getClientData(clientId) || { id: clientId, nombre: clientId };
    document.getElementById('sb-client-name').textContent = STATE.client.nombre || STATE.client.name || clientId;
    document.getElementById('sb-client-ig').textContent = STATE.client.instagram || '';

    // Logo upload
    document.getElementById('client-logo-input').addEventListener('change', async e => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async ev => {
        const logo = ev.target.result;
        if (!STATE.home) STATE.home = { prioridades: [], todos: [], links: [], webTareas: [], archivos: [] };
        STATE.home.logoEmpresa = logo;
        applyClientLogo(logo);
        await saveHomeData(clientId, STATE.home);
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    });

    await loadAllData();
    window.STATE = STATE; // necesario para inline handlers en módulos ES
    if (STATE.home.logoEmpresa) applyClientLogo(STATE.home.logoEmpresa);
    if ((STATE.plan && STATE.plan.html) || user.role !== 'client') document.getElementById('nav-plan').classList.remove('hidden');
    setupNav();
    const openTipo = params.get('open');
    const openId = params.get('id');
    if (openTipo === 'contenido' && openId && STATE.contenidos.some(c => c.id === openId)) {
      renderSection('contenidos');
      openContenidoModalById(openId);
    } else if (openTipo === 'tarea' && openId && STATE.tareas.some(t => t.id === openId)) {
      renderSection('tareas');
      openTareaModal(openId);
    } else {
      renderSection('home');
    }
    setTimeout(() => refreshIcons(), 100);
  } catch (err) {
    const content = document.getElementById('main-content');
    const esPermisos = err.message === 'Sin permisos' || err.message === 'No autorizado';
    if (content) content.innerHTML = `<div class="empty-state"><div class="empty-state-icon">⚠️</div><h3>Error al cargar</h3><p style="max-width:340px;">${err.message || 'Error desconocido. Revisá la consola del navegador.'}</p>
      ${esPermisos ? `<p style="max-width:340px;font-size:13px;color:var(--text-muted);margin-top:8px;">Esta sesión no tiene acceso a este cliente. Puede que este navegador tenga guardada una cuenta distinta a la tuya.</p>` : ''}
      <div style="display:flex;gap:8px;margin-top:16px;">
        <button class="btn btn-primary" onclick="location.reload()">Reintentar</button>
        ${esPermisos ? `<button class="btn btn-secondary" onclick="window.cerrarSesionYVolver()">Cerrar sesión y volver a entrar</button>` : ''}
      </div>
    </div>`;
    console.error('[init] Error:', err);
  }
}

async function loadAllData() {
  const [cont, tareas, campanas, metricas, home, ideas, plan] = await Promise.all([
    getContenidos(clientId), getTareas(clientId), getCampanas(clientId),
    getMetricas(clientId), getHomeData(clientId), getIdeas(clientId), getPlan(clientId)
  ]);
  STATE.contenidos = cont;
  STATE.tareas = tareas;
  STATE.campanas = campanas;
  STATE.metricas = metricas;
  STATE.home = home || { prioridades: [], todos: [], links: [], webTareas: [], archivos: [] };
  STATE.ideas = ideas;
  STATE.plan = plan || { html: '' };
  // Links guardados antes de que existiera el campo `id` (o cargados a mano
  // en Firestore) llegan sin id -- eso hace que openLinkModal('undefined')
  // matchee cualquier link sin id en vez del que se clickeó, y el modal
  // termina mostrándose como "Nuevo link" en vez de editar el correcto.
  // Les asignamos un id estable acá para que el botón de editar siempre
  // abra el link correcto.
  let _linkIdSeed = Date.now();
  let _linksSinId = false;
  STATE.links = (home?.links || []).map(l => {
    if (l.id) return l;
    _linksSinId = true;
    return { ...l, id: ++_linkIdSeed };
  });
  STATE.home.links = STATE.links;
  if (_linksSinId) saveHomeData(clientId, STATE.home).catch(() => {});
  updateBadges();
}

function applyClientLogo(src) {
  const img = document.getElementById('sb-client-logo');
  const placeholder = document.getElementById('sb-client-logo-placeholder');
  const hint = document.querySelector('.client-logo-upload-hint');
  img.src = src;
  img.style.cssText = 'display:block;width:100%;height:100%;object-fit:cover;border-radius:50%;';
  if (placeholder) placeholder.style.display = 'none';
  if (hint) hint.style.display = 'none';
}

function codigoDesdeNombre(nombre) {
  const palabras = (nombre || '').split(/[^a-zA-ZÀ-ÿ]+/).filter(Boolean);
  if (!palabras.length) return '';
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
  return (palabras[0][0] + palabras[1][0]).toUpperCase();
}
function codigoCliente() {
  return STATE.client?.codigo || codigoDesdeNombre(STATE.client?.nombre || STATE.client?.name || clientId);
}
function codigoTarea(t) {
  if (!t.numero) return '';
  return `${codigoCliente()}-${String(t.numero).padStart(2, '0')}`;
}

function tareasVisibles(lista) {
  if (user.role !== 'client') return lista;
  return lista.filter(t => t.visibleParaCliente === true);
}

function updateBadges() {
  const pending = tareasVisibles(STATE.tareas).filter(t => t.estado !== 'Listo').length;
  document.getElementById('badge-tareas').textContent = pending;
  if (typeof updateBnavBadge === 'function') updateBnavBadge();
}

// ── Nav ────────────────────────────────────────────────
function setupNav() {
  document.querySelectorAll('.nav-item[data-section]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderSection(btn.dataset.section);
    });
  });
}

function renderSection(sec) {
  currentSection = sec;
  document.querySelectorAll('.nav-item[data-section]').forEach(b => {
    b.classList.toggle('active', b.dataset.section === sec);
  });
  // Sincronizar bottom nav y FAB en mobile
  if (typeof updateBottomNav === 'function') updateBottomNav(sec);
  if (typeof updateFab === 'function') updateFab(sec);
  const titles = { home: 'Inicio', dashboard: 'Dashboard Editorial', contenidos: 'Contenidos', tareas: 'Tareas', pauta: 'Pauta Digital', links: 'Links y Archivos', web: 'Sitio Web', plan: 'Plan de ejecución', instrucciones: 'Instrucciones' };
  const subs = { home: 'Resumen y prioridades del mes', dashboard: 'Calendario editorial y métricas de contenido', contenidos: 'Gestión de contenidos para redes sociales', tareas: 'Tareas internas del equipo', pauta: 'Campañas y métricas de pauta digital', links: 'Atajos rápidos y documentos clave del cliente', web: 'Gestión del sitio web: contenidos, arreglos y métricas', plan: 'Plan estratégico del cliente', instrucciones: 'Guía de uso del Marketing Hub' };
  document.getElementById('topbar-title').textContent = titles[sec];
  document.getElementById('topbar-sub').textContent = subs[sec];

  const actions = document.getElementById('topbar-actions');
  actions.innerHTML = '';

  const content = document.getElementById('main-content');

  if (sec === 'home') {
    const rptBtn = document.createElement('button');
    rptBtn.className = 'btn btn-secondary';
    rptBtn.textContent = '📊 Reporte';
    rptBtn.onclick = () => openReporteModal();
    actions.appendChild(rptBtn);
    const newBtn = document.createElement('button');
    newBtn.className = 'btn btn-primary';
    newBtn.textContent = '+ Nuevo contenido';
    newBtn.onclick = () => openContenidoModal(null);
    actions.appendChild(newBtn);
    renderHome(content); setTimeout(refreshIcons, 50);
  }
  else if (sec === 'dashboard') { renderDashboard(content); setTimeout(refreshIcons, 50); }
  else if (sec === 'contenidos') {
    const rptBtn = document.createElement('button');
    rptBtn.className = 'btn btn-secondary';
    rptBtn.textContent = '📊 Reporte';
    rptBtn.onclick = () => openReporteModal();
    actions.appendChild(rptBtn);
    const importBtn = document.createElement('button');
    importBtn.className = 'btn btn-secondary';
    importBtn.textContent = '📥 Importar Excel';
    importBtn.onclick = () => openImportModal();
    actions.appendChild(importBtn);
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = '+ Nuevo contenido';
    btn.onclick = () => openContenidoModal(null);
    actions.appendChild(btn);
    renderContenidos(content);
    setTimeout(refreshIcons, 50);
  }
  else if (sec === 'tareas') {
    const searchInput = document.createElement('input');
    searchInput.type = 'text';
    searchInput.className = 'form-control';
    searchInput.placeholder = '🔎 Buscar tarea...';
    searchInput.style.cssText = 'width:160px;font-size:12px;padding:6px 10px;';
    searchInput.value = _tareasBusqueda;
    searchInput.oninput = (e) => { _tareasBusqueda = e.target.value.trim().toLowerCase(); refreshTareasView(); };
    actions.appendChild(searchInput);
    const filtroAsignado = document.createElement('select');
    filtroAsignado.className = 'form-control';
    filtroAsignado.style.cssText = 'width:auto;font-size:12px;padding:6px 10px;';
    filtroAsignado.innerHTML = '<option value="">👤 Todos</option>' + opcionesFiltroAsignadoTareas() + '<option value="_sin_asignar">Sin asignar</option>';
    filtroAsignado.value = _tareasFiltroAsignado;
    filtroAsignado.onchange = (e) => { _tareasFiltroAsignado = e.target.value; refreshTareasView(); };
    actions.appendChild(filtroAsignado);
    const viewKanbanBtn = document.createElement('button');
    viewKanbanBtn.className = 'btn btn-sm ' + (_tareasView === 'kanban' ? 'btn-primary' : 'btn-secondary');
    viewKanbanBtn.innerHTML = '<i data-lucide="columns" style="width:14px;height:14px;"></i> Kanban';
    viewKanbanBtn.onclick = () => { _tareasView = 'kanban'; renderSection('tareas'); };
    actions.appendChild(viewKanbanBtn);
    const viewCalBtn = document.createElement('button');
    viewCalBtn.className = 'btn btn-sm ' + (_tareasView === 'calendario' ? 'btn-primary' : 'btn-secondary');
    viewCalBtn.innerHTML = '<i data-lucide="calendar" style="width:14px;height:14px;"></i> Calendario de tareas';
    viewCalBtn.onclick = () => { _tareasView = 'calendario'; renderSection('tareas'); };
    actions.appendChild(viewCalBtn);
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = '+ Nueva tarea';
    btn.onclick = () => openTareaModal(null);
    actions.appendChild(btn);
    if (_tareasView === 'calendario') renderTareasCalendario(content);
    else renderTareas(content);
    setTimeout(refreshIcons, 50);
  }
  else if (sec === 'pauta') {
    const importBtn = document.createElement('button');
    importBtn.className = 'btn btn-secondary';
    importBtn.textContent = '📥 Importar Excel';
    importBtn.onclick = () => openImportCampanasModal();
    actions.appendChild(importBtn);
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = '+ Nueva campaña';
    btn.onclick = () => openCampanaModal(null);
    actions.appendChild(btn);
    renderPauta(content);
    setTimeout(refreshIcons, 50);
  }
  else if (sec === 'links') {
    const linkBtn = document.createElement('button');
    linkBtn.className = 'btn btn-secondary';
    linkBtn.textContent = '+ Nuevo link';
    linkBtn.onclick = () => openLinkModal(null);
    actions.appendChild(linkBtn);
    const archivoBtn = document.createElement('button');
    archivoBtn.className = 'btn btn-primary';
    archivoBtn.textContent = '+ Nuevo archivo';
    archivoBtn.onclick = () => openArchivoModal(null);
    actions.appendChild(archivoBtn);
    content.innerHTML = `
      <div class="links-archivos-split">
        <div class="links-archivos-col">
          <h3 class="links-archivos-col-title"><i data-lucide="link" style="width:15px;height:15px;"></i> Links</h3>
          <div id="links-col-body"></div>
        </div>
        <div class="links-archivos-col">
          <h3 class="links-archivos-col-title"><i data-lucide="folder-open" style="width:15px;height:15px;"></i> Archivos</h3>
          <div id="archivos-col-body"></div>
        </div>
      </div>
    `;
    renderLinks(document.getElementById('links-col-body'));
    renderArchivos(document.getElementById('archivos-col-body'));
    setTimeout(refreshIcons, 50);
  }
  else if (sec === 'web') {
    const siteUrl = STATE.client.website || STATE.client.sitioWeb;
    if (siteUrl) {
      const verBtn = document.createElement('a');
      verBtn.className = 'btn btn-secondary';
      verBtn.textContent = '🌐 Ver sitio web';
      verBtn.href = siteUrl.startsWith('http') ? siteUrl : 'https://' + siteUrl;
      verBtn.target = '_blank';
      actions.appendChild(verBtn);
    }
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = '+ Nueva tarea web';
    btn.onclick = () => openWebTaskModal(null);
    actions.appendChild(btn);
    renderWeb(content);
    setTimeout(refreshIcons, 50);
  }
  else if (sec === 'plan') {
    if (user.role !== 'client') {
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.textContent = STATE.plan?.html ? '↻ Actualizar plan' : '+ Cargar plan';
      btn.onclick = openPlanModal;
      actions.appendChild(btn);
    }
    renderPlan(content);
  }
  else if (sec === 'instrucciones') {
    renderInstrucciones(content);
    setTimeout(refreshIcons, 50);
  }
}

function renderPlan(container) {
  const html = (STATE.plan && STATE.plan.html) || '';
  if (!html) {
    container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📄</div><h3>Sin plan cargado</h3><p>${user.role !== 'client' ? 'Usá "+ Cargar plan" arriba para subir el HTML del plan de ejecución.' : 'Todavía no hay un plan de ejecución para este cliente.'}</p></div>`;
    return;
  }
  container.innerHTML = `<iframe id="plan-frame" style="width:100%;min-height:calc(100vh - 160px);border:none;border-radius:12px;background:#0b0b0f;" sandbox="allow-same-origin allow-scripts allow-popups"></iframe>`;
  const frame = document.getElementById('plan-frame');
  frame.srcdoc = html;
  frame.addEventListener('load', () => {
    try {
      const doc = frame.contentDocument;
      const resize = () => { frame.style.height = doc.documentElement.scrollHeight + 'px'; };
      resize();
      new ResizeObserver(resize).observe(doc.body);

      // El menú interno del plan usa anchors (#seccion). Como el iframe no
      // tiene scroll propio (mide el alto exacto del contenido), el salto
      // nativo del navegador termina llevando a la página entera al tope
      // del iframe (el header) en vez de a la sección clickeada. Corregimos
      // scrolleando la página exterior a la posición real de esa sección.
      const irASeccion = () => {
        const hash = frame.contentWindow.location.hash;
        if (!hash) return;
        let target;
        try { target = doc.querySelector(hash); } catch (e) { return; }
        if (!target) return;
        const rect = target.getBoundingClientRect();
        const frameRect = frame.getBoundingClientRect();
        const destino = window.scrollY + frameRect.top + rect.top - 80;
        window.scrollTo({ top: destino, behavior: 'smooth' });
      };
      frame.contentWindow.addEventListener('hashchange', irASeccion);
    } catch (e) {}
  });
}

window.openPlanModal = function() {
  document.getElementById('plan-file-input').value = '';
  document.getElementById('plan-file-name').textContent = '';
  document.getElementById('planSaveBtn').disabled = true;
  window._planHtmlPendiente = null;
  document.getElementById('planModal').classList.remove('hidden');
};

document.getElementById('plan-file-input')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    window._planHtmlPendiente = reader.result;
    document.getElementById('plan-file-name').textContent = `✓ ${file.name} (${(file.size / 1024).toFixed(0)} KB)`;
    document.getElementById('planSaveBtn').disabled = false;
  };
  reader.onerror = () => alert('No se pudo leer el archivo.');
  reader.readAsText(file);
});

document.getElementById('closePlanModal')?.addEventListener('click', () => document.getElementById('planModal').classList.add('hidden'));
document.getElementById('closePlanModal2')?.addEventListener('click', () => document.getElementById('planModal').classList.add('hidden'));
document.getElementById('planSaveBtn')?.addEventListener('click', async () => {
  if (!window._planHtmlPendiente) return;
  const btn = document.getElementById('planSaveBtn');
  btn.disabled = true; btn.textContent = 'Guardando...';
  try {
    await savePlan(clientId, window._planHtmlPendiente);
    STATE.plan = { html: window._planHtmlPendiente };
    document.getElementById('nav-plan').classList.remove('hidden');
    document.getElementById('planModal').classList.add('hidden');
    renderSection('plan');
  } catch (e) {
    alert('Error al guardar el plan: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar';
  }
});

// ──────────────────────────────────────────────────────
// DASHBOARD EDITORIAL
// ──────────────────────────────────────────────────────
let dashYear = new Date().getFullYear();
let dashMonth = new Date().getMonth(); // 0-based

function buildPieChart(tipos, COLORS, sideExtraHtml) {
  const entries = Object.entries(tipos).filter(function(e){ return e[1] > 0; }).sort(function(a,b){ return b[1]-a[1]; });
  if (!entries.length) {
    if (!sideExtraHtml) return '';
    return '<div class="dash-card" style="margin-top:14px;">'
      + '<div class="dash-card-title">Distribución por tipo</div>'
      + '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">'
      + '<div style="font-size:12px;color:var(--text-muted);">Sin datos este mes</div>'
      + sideExtraHtml
      + '</div></div>';
  }
  var totalT = entries.reduce(function(s,e){ return s+e[1]; }, 0);
  var angle = -Math.PI/2;
  var CX=90, CY=90, R=70;
  var paths='', labels='', legend='';
  entries.forEach(function(entry, i) {
    var lbl = entry[0], val = entry[1];
    var slice = (val/totalT)*Math.PI*2;
    var x1 = CX + R*Math.cos(angle), y1 = CY + R*Math.sin(angle);
    var x2 = CX + R*Math.cos(angle+slice), y2 = CY + R*Math.sin(angle+slice);
    var large = slice > Math.PI ? 1 : 0;
    var midA = angle + slice/2;
    var lx = +(CX + R*0.65*Math.cos(midA)).toFixed(1);
    var ly = +(CY + R*0.65*Math.sin(midA)).toFixed(1);
    var pct = Math.round(val/totalT*100);
    var col = COLORS[i % COLORS.length];
    paths += '<path d="M'+CX+','+CY+' L'+x1.toFixed(1)+','+y1.toFixed(1)+' A'+R+','+R+' 0 '+large+',1 '+x2.toFixed(1)+','+y2.toFixed(1)+' Z" fill="'+col+'" stroke="#fff" stroke-width="1.5"/>';
    if (pct >= 8) labels += '<text x="'+lx+'" y="'+ly+'" text-anchor="middle" dominant-baseline="middle" font-size="11" fill="#fff" font-weight="700">'+pct+'%</text>';
    legend += '<div style="display:flex;align-items:center;gap:5px;font-size:11px;"><span style="width:10px;height:10px;border-radius:2px;flex-shrink:0;background:'+col+';display:inline-block;"></span>'+lbl+' ('+val+')</div>';
    angle += slice;
  });
  return '<div class="dash-card" style="margin-top:14px;">'
    + '<div class="dash-card-title">Distribución por tipo</div>'
    + '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">'
    + '<svg viewBox="0 0 180 180" width="130" height="130" style="flex-shrink:0;">'+paths+labels+'</svg>'
    + '<div style="display:flex;flex-direction:column;gap:4px;">'+legend+'</div>'
    + (sideExtraHtml || '')
    + '</div></div>';
}

function renderDashboard(container) {
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const DIAS = ['L','M','Mi','J','V','S','D'];
  const yearStr = dashYear;
  const monthStr = String(dashMonth + 1).padStart(2, '0');
  const prefix = `${yearStr}-${monthStr}`;

  const conts = STATE.contenidos.filter(c => c.fechaPub && c.fechaPub.startsWith(prefix));

  // ── STAT PILLS ──
  const total = conts.length;
  const publicados = conts.filter(c => c.estado === 'Publicado').length;
  const programados = conts.filter(c => c.estado === 'Programado').length;
  const enProceso = conts.filter(c => ['En proceso','Revisión','Aprobado'].includes(c.estado)).length;

  // ── TAREAS (general + sitio web) — resumen chico, va al lado del gráfico de torta ──
  const tareasActivas = tareasVisibles(STATE.tareas).filter(t => !t.archivado);
  const tareasPendientes = tareasActivas.filter(t => t.estado === 'Sin empezar').length;
  const tareasEnProceso = tareasActivas.filter(t => t.estado === 'En progreso').length;
  const tareasListas = tareasActivas.filter(t => t.estado === 'Listo').length;
  const webTareas = STATE.home.webTareas || [];
  const webPendientes = webTareas.filter(t => t.estado === 'Pendiente').length;
  const webEnProceso = webTareas.filter(t => t.estado === 'En proceso' || t.estado === 'En revisión').length;
  const webListas = webTareas.filter(t => t.estado === 'Listo').length;
  const tareasResumenHtml = `
    <div style="display:flex;flex-direction:column;gap:8px;margin-left:auto;min-width:150px;">
      <div>
        <div class="dash-card-title" style="margin-bottom:4px;">Tareas</div>
        <div style="display:flex;gap:8px;font-size:11px;flex-wrap:wrap;">
          <span style="color:#94a3b8;">${tareasPendientes} sin empezar</span>
          <span style="color:#f59e0b;">${tareasEnProceso} en progreso</span>
          <span style="color:#10b981;">${tareasListas} listas</span>
        </div>
      </div>
      <div>
        <div class="dash-card-title" style="margin-bottom:4px;">Tareas sitio web</div>
        <div style="display:flex;gap:8px;font-size:11px;flex-wrap:wrap;">
          <span style="color:#94a3b8;">${webPendientes} pendientes</span>
          <span style="color:#f59e0b;">${webEnProceso} en proceso</span>
          <span style="color:#10b981;">${webListas} listas</span>
        </div>
      </div>
    </div>`;

  // ── FORMATO breakdown ──
  const formatos = { Imagen: 0, Video: 0, Reel: 0, Carrusel: 0, Story: 0, GIF: 0 };
  conts.forEach(c => { const fmts = Array.isArray(c.formato) ? c.formato : (c.formato ? [c.formato] : []); fmts.forEach(f => { formatos[f] = (formatos[f]||0)+1; }); });
  const maxFormato = Math.max(1, ...Object.values(formatos));

  // ── TIPO breakdown ──
  const tipos = {};
  conts.forEach(c => { const t = c.tipo || 'Sin tipo'; tipos[t] = (tipos[t]||0)+1; });
  const maxTipo = Math.max(1, ...Object.values(tipos));

  // ── EJE breakdown ──
  const ejes = {};
  conts.forEach(c => { const e = c.eje || 'Sin eje'; ejes[e] = (ejes[e]||0)+1; });
  const maxEje = Math.max(1, ...Object.values(ejes));

  // ── FRECUENCIA SEMANAL ──
  // Build weeks: group days of month into S1..S4 by week-of-month
  const daysInMonth = new Date(dashYear, dashMonth + 1, 0).getDate();
  // For each week (S1-S4), collect Mon-Sun buckets
  const weeks = [[], [], [], []]; // each: [L,M,Mi,J,V,S,D] count
  for (let w = 0; w < 4; w++) weeks[w] = [0,0,0,0,0,0,0];
  // day 1..daysInMonth
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(dashYear, dashMonth, d);
    const dow = (date.getDay() + 6) % 7; // 0=Mon..6=Sun
    const weekIdx = Math.min(3, Math.floor((d - 1) / 7));
    const dateStr = `${yearStr}-${monthStr}-${String(d).padStart(2,'0')}`;
    const count = conts.filter(c => c.fechaPub === dateStr).length;
    weeks[weekIdx][dow] += count;
  }

  // ── BAR CHART helper ──
  const COLORS = ['#3A8FC7','#1A4DAA','#10b981','#f59e0b','#ec4899','#8b5cf6','#e02020'];
  function barRows(data, maxVal) {
    return Object.entries(data).filter(([,v]) => v > 0).sort((a,b) => b[1]-a[1]).map(([label, val], i) =>
      `<div class="dash-bar-row">
        <div class="dash-bar-label">${label}</div>
        <div class="dash-bar-track"><div class="dash-bar-fill" style="width:${Math.round(val/maxVal*100)}%;background:${COLORS[i%COLORS.length]}"></div></div>
        <div class="dash-bar-val">${val}</div>
      </div>`
    ).join('');
  }

  function freqCell(n) {
    if (n === 0) return `<td><span class="freq-cell-0">·</span></td>`;
    const cls = n === 1 ? 'freq-cell-1' : n === 2 ? 'freq-cell-2' : n === 3 ? 'freq-cell-3' : 'freq-cell-many';
    return `<td><span class="${cls}">${n}</span></td>`;
  }

  const freqRows = weeks.map((week, wi) => {
    const weekTotal = week.reduce((s,v) => s+v, 0);
    if (wi > 0 && weeks.slice(0,wi).every(w => w.reduce((s,v)=>s+v,0) === 0) && weekTotal === 0) return '';
    return `
      <tr>
        <td class="cat-label week-sep" style="color:var(--primary);font-weight:700;">S${wi+1}</td>
        ${week.map(n => `<td class="week-sep">${n > 0 ? `<span class="${n===1?'freq-cell-1':n===2?'freq-cell-2':n===3?'freq-cell-3':'freq-cell-many'}">${n}</span>` : '<span class="freq-cell-0">·</span>'}</td>`).join('')}
        <td class="week-sep" style="font-weight:700;color:var(--primary);font-size:11px;">${weekTotal}</td>
      </tr>`;
  }).join('');

  container.innerHTML = `
    <div class="dash-header">
      <div>
        <div class="dash-title">Dashboard Calendario Editorial</div>
        <div class="dash-meta">Cliente: <strong>${STATE.client.nombre || STATE.client.name || clientId}</strong></div>
      </div>
      <div class="dash-month-nav">
        <button onclick="dashNavMonth(-1)">‹</button>
        <div class="dash-month-label">${MESES[dashMonth]} ${dashYear}</div>
        <button onclick="dashNavMonth(1)">›</button>
      </div>
    </div>

    <div class="dash-stat-row">
      <div class="dash-stat-pill"><div class="dash-stat-pill-val">${total}</div><div class="dash-stat-pill-label">Total del mes</div></div>
      <div class="dash-stat-pill"><div class="dash-stat-pill-val" style="color:#22c55e">${publicados}</div><div class="dash-stat-pill-label">Publicados</div></div>
      <div class="dash-stat-pill"><div class="dash-stat-pill-val" style="color:#3b82f6">${programados}</div><div class="dash-stat-pill-label">Programados</div></div>
      <div class="dash-stat-pill"><div class="dash-stat-pill-val" style="color:#f59e0b">${enProceso}</div><div class="dash-stat-pill-label">En proceso</div></div>
    </div>

    <div class="dash-layout">
      <div>
        <div class="dash-card">
          <div class="dash-card-title">Frecuencia de contenidos</div>
          <table class="freq-grid">
            <thead>
              <tr>
                <th class="week-header">Semana</th>
                ${DIAS.map(d => `<th>${d}</th>`).join('')}
                <th>Tot.</th>
              </tr>
            </thead>
            <tbody>
              ${freqRows || `<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:20px;font-size:12px;">Sin contenidos este mes</td></tr>`}
              <tr style="border-top:2px solid var(--border);">
                <td class="cat-label" style="font-weight:700;color:var(--text-muted);">Total</td>
                ${[0,1,2,3,4,5,6].map(d => {
                  const tot = weeks.reduce((s,w) => s+w[d], 0);
                  return `<td style="font-weight:${tot?'700':'400'};color:${tot?'var(--primary)':'#cbd5e1'};font-size:11px;">${tot||'·'}</td>`;
                }).join('')}
                <td style="font-weight:700;color:var(--primary);font-size:12px;">${total}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- Gráfico de torta por tipo -->
        ${buildPieChart(tipos, COLORS, tareasResumenHtml)}
        ${renderTrabajoRealizado()}
      </div>

      <div>
        <div class="dash-card">
          <div class="dash-card-title">Formato de contenidos</div>
          ${Object.values(formatos).some(v=>v>0) ? barRows(formatos, maxFormato) : '<div style="font-size:12px;color:var(--text-muted)">Sin datos</div>'}
        </div>
        <div class="dash-card">
          <div class="dash-card-title">Eje de comunicación</div>
          ${Object.keys(ejes).length ? barRows(ejes, maxEje) : '<div style="font-size:12px;color:var(--text-muted)">Sin datos</div>'}
        </div>
        <div class="dash-card">
          <div class="dash-card-title">Tipo de contenido</div>
          ${Object.keys(tipos).length ? barRows(tipos, maxTipo) : '<div style="font-size:12px;color:var(--text-muted)">Sin datos</div>'}
        </div>
      </div>
    </div>
  `;
}

function getTrabajoRealizadoMes(year, month) {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`;
  const inicioMes = new Date(year, month, 1);
  const finMes = new Date(year, month + 1, 0);
  const items = [];
  const tareasBase = tareasVisibles(STATE.tareas);
  // Una tarea recurrente ya reactivada (ver reactivarTareasRecurrentes en
  // el worker) vuelve a tener completadoEn en null -- el completado de
  // este mes puede vivir en historialCompletados en vez del campo "en
  // vivo". Pedido de Vaneh: ese historial tiene que verse acá y en el
  // informe mensual, si no "no hay cómo mostrarlo" una vez que se
  // reactiva. El historial no se filtra por visibleParaCliente porque es
  // un hecho pasado (si se completó, en su momento sí se mostró).
  tareasBase.forEach(t => {
    const fechas = [];
    if (t.estado === 'Listo' && t.completadoEn) fechas.push(t.completadoEn);
    (t.historialCompletados || []).forEach(f => fechas.push(f));
    fechas.filter(f => f && f.startsWith(prefix)).forEach(f =>
      items.push({ tipo: 'Tarea', icon: '✅', titulo: t.titulo, fecha: f }));
  });
  // Subtareas completadas -- avance parcial de una tarea que puede seguir
  // abierta (no hace falta esperar a que TODA la tarea cierre para que el
  // cliente vea que se está avanzando), pedido explícito de Vaneh. A
  // propósito NO usa tareasBase/tareasVisibles acá: una tarea interna
  // (visibleParaCliente=false) puede seguir sin mostrarse entera, pero el
  // avance de sus subtareas sí tiene que verse -- si no, marcar una
  // subtarea de una tarea todavía no marcada "visible para el cliente"
  // nunca aparecía en Trabajo realizado.
  STATE.tareas.filter(t => !t.archivado).forEach(t => (t.subtareas || []).forEach(s => {
    const fechasSub = [];
    if (s.done && s.completadoEn) fechasSub.push(s.completadoEn);
    (s.historialCompletados || []).forEach(f => fechasSub.push(f));
    fechasSub.filter(f => f && f.startsWith(prefix)).forEach(f =>
      items.push({ tipo: 'Subtarea', icon: '✅', titulo: `${s.titulo} — de "${t.titulo}"`, fecha: f }));
  }));
  (STATE.home.webTareas || []).filter(t => t.estado === 'Listo' && t.completadoEn && t.completadoEn.startsWith(prefix)).forEach(t =>
    items.push({ tipo: 'Sitio web', icon: '🌐', titulo: t.titulo, fecha: t.completadoEn }));
  STATE.contenidos.filter(c => c.estado === 'Publicado' && c.fechaPub && c.fechaPub.startsWith(prefix)).forEach(c =>
    items.push({ tipo: 'Contenido', icon: '📣', titulo: c.titulo, fecha: c.fechaPub }));
  (STATE.campanas || []).filter(camp => {
    if (!camp.fechaInicio) return false;
    const ini = new Date(camp.fechaInicio + 'T00:00:00');
    const fin = camp.fechaFin ? new Date(camp.fechaFin + 'T00:00:00') : ini;
    return ini <= finMes && fin >= inicioMes;
  }).forEach(camp =>
    items.push({ tipo: 'Pauta', icon: '📈', titulo: camp.nombre, fecha: camp.fechaInicio, rango: `${fmtDate(camp.fechaInicio)} → ${camp.fechaFin ? fmtDate(camp.fechaFin) : 'en curso'}` }));
  items.sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  return items;
}

function renderTrabajoRealizado() {
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const items = getTrabajoRealizadoMes(dashYear, dashMonth);
  const visibles = items.slice(0, 7);
  const rowHtml = (it) => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:15px;flex-shrink:0;">${it.icon}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${it.titulo || ''}</div>
        <div style="font-size:11px;color:var(--text-muted);">${it.tipo}${it.rango ? ' · ' + it.rango : (it.fecha ? ' · ' + fmtDate(it.fecha) : '')}</div>
      </div>
    </div>`;
  return `
    <div class="dash-card" style="margin-top:16px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
        <div class="dash-card-title" style="margin-bottom:0;">Trabajo realizado — ${MESES[dashMonth]} ${dashYear}</div>
      </div>
      ${items.length ? `
        <div>${visibles.map(rowHtml).join('')}</div>
        ${items.length > 7 ? `
          <button class="btn btn-secondary btn-sm" style="width:100%;margin-top:10px;font-weight:700;" onclick="verTodoTrabajoRealizado()">
            👉 Tocá para ver el total de tareas (${items.length})
          </button>` : ''}
      ` : `<p style="font-size:12px;color:var(--text-muted);padding:8px 0;">Sin trabajo completado en este mes todavía.</p>`}
    </div>`;
}

window.verTodoTrabajoRealizado = function() {
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const items = getTrabajoRealizadoMes(dashYear, dashMonth);
  const modal = document.createElement('div');
  modal.className = 'modal-overlay';
  modal.id = 'trabajoRealizadoModal';
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  modal.innerHTML = `
    <div class="modal" style="max-width:520px;max-height:80vh;display:flex;flex-direction:column;">
      <div class="modal-header">
        <h3>Trabajo realizado — ${MESES[dashMonth]} ${dashYear}</h3>
        <button class="modal-close" onclick="document.getElementById('trabajoRealizadoModal').remove()">×</button>
      </div>
      <div class="modal-body" style="overflow-y:auto;">
        ${items.map(it => `
          <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);">
            <span style="font-size:15px;flex-shrink:0;">${it.icon}</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:13px;font-weight:600;">${it.titulo || ''}</div>
              <div style="font-size:11px;color:var(--text-muted);">${it.tipo}${it.rango ? ' · ' + it.rango : (it.fecha ? ' · ' + fmtDate(it.fecha) : '')}</div>
            </div>
          </div>
        `).join('') || '<p style="font-size:12px;color:var(--text-muted);">Sin trabajo completado en este mes.</p>'}
      </div>
    </div>`;
  document.body.appendChild(modal);
};

window.dashNavMonth = function(dir) {
  dashMonth += dir;
  if (dashMonth < 0) { dashMonth = 11; dashYear--; }
  if (dashMonth > 11) { dashMonth = 0; dashYear++; }
  const content = document.getElementById('main-content');
  renderDashboard(content);
};

// ──────────────────────────────────────────────────────
// HOME
// ──────────────────────────────────────────────────────
function renderHome(container) {
  const { prioridades = [], todos = [] } = STATE.home || {};
  const hoy = new Date();
  const mesStr = hoy.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  const diaStr = hoy.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });

  const pubMes = STATE.contenidos.filter(c => c.fechaPub && c.fechaPub.startsWith(hoy.toISOString().slice(0,7))).length;
  const aprobados = STATE.contenidos.filter(c => c.estado === 'Aprobado').length;
  const enProceso = STATE.contenidos.filter(c => c.estado === 'En proceso').length;
  const publicados = STATE.contenidos.filter(c => c.estado === 'Publicado').length;

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px;">
      ${[
        { label: 'Contenidos este mes', val: pubMes, icon: 'calendar' },
        { label: 'En proceso', val: enProceso, icon: 'pen-line' },
        { label: 'Aprobados', val: aprobados, icon: 'check-circle' },
        { label: 'Publicados', val: publicados, icon: 'send' },
      ].map(m => `
        <div class="card" style="padding:16px;">
          <i data-lucide="${m.icon}" class="stat-icon"></i>
          <div style="font-size:24px;font-weight:800;">${m.val}</div>
          <div style="font-size:12px;color:var(--text-muted);">${m.label}</div>
        </div>
      `).join('')}
    </div>

    <div class="home-grid">
      <!-- Prioridades del mes -->
      <div class="card">
        <div class="card-header">
          <i data-lucide="star" style="width:15px;height:15px;color:#f59e0b;stroke-width:1.75;"></i>
          <h2>Prioridades de ${mesStr}</h2>
          <button class="btn btn-secondary btn-sm" onclick="editPrioridades()" style="margin-left:auto;">Editar</button>
        </div>
        <div class="card-body">
          ${prioridades.length ? `
            <ul class="priorities-list" id="prio-list">
              ${prioridades.map((p,i) => `
                <li class="priority-item">
                  <span class="priority-dot"></span>
                  <span>${p}</span>
                </li>
              `).join('')}
            </ul>
          ` : `<p class="text-muted text-sm">Sin prioridades cargadas. Hacé clic en "Editar".</p>`}
        </div>
      </div>

      <!-- To-do del día -->
      <div class="card">
        <div class="card-header">
          <i data-lucide="check-square" style="width:15px;height:15px;color:var(--accent);stroke-width:1.75;"></i>
          <h2>To-do — ${diaStr}</h2>
          <button class="btn btn-secondary btn-sm" onclick="addTodoItem()" style="margin-left:auto;">+ Agregar</button>
        </div>
        <div class="card-body">
          <div id="todo-list">
            ${(() => {
              const tareasPend = tareasVisibles(STATE.tareas).filter(t => t.estado === 'Sin empezar' && !t.archivado);
              const allItems = [
                ...todos.map(t => ({ type:'todo', ...t })),
                ...tareasPend.map(t => ({ type:'tarea', id: t.id, text: t.titulo, done: false, tarea: t }))
              ];
              if (!allItems.length) return `<p class="text-muted text-sm">Sin tareas pendientes.</p>`;
              return allItems.map(item => {
                if (item.type === 'tarea') return `
                  <div class="todo-item" style="border-left:3px solid #3b82f6;padding-left:8px;">
                    <button onclick="event.stopPropagation();toggleTareaListo('${item.id}')" title="Marcar como hecha" style="flex-shrink:0;width:16px;height:16px;border-radius:50%;border:2px solid #cbd5e1;background:transparent;cursor:pointer;padding:0;margin-right:2px;"></button>
                    <span style="font-size:10px;color:#3b82f6;font-weight:700;margin-right:4px;">TAREA</span>
                    <label style="flex:1;cursor:pointer;" onclick="openTareaModal('${item.id}')">${item.text}</label>
                    ${item.tarea.vencimiento ? `<span style="font-size:10px;color:${new Date(item.tarea.vencimiento+'T00:00:00')<new Date()?'#dc2626':'var(--text-muted)'};">📅${item.tarea.vencimiento}</span>` : ''}
                  </div>`;
                return `
                  <div class="todo-item ${item.done ? 'done' : ''}" data-id="${item.id}">
                    <input type="checkbox" ${item.done ? 'checked' : ''} onchange="toggleTodo(${item.id})">
                    <label onclick="toggleTodo(${item.id})">${item.text}</label>
                    <button onclick="removeTodo(${item.id})" style="background:none;border:none;color:#cbd5e1;cursor:pointer;font-size:16px;padding:0 4px;" title="Eliminar">×</button>
                  </div>`;
              }).join('');
            })()}
          </div>
        </div>
      </div>
    </div>

    <!-- Contenidos próximos -->
    <div class="card">
      <div class="card-header">
        <i data-lucide="calendar" style="width:15px;height:15px;color:var(--accent);stroke-width:1.75;"></i>
        <h2>Próximas publicaciones</h2>
      </div>
      <div class="card-body" style="padding:0;">
        ${(() => {
          const hoyStr = hoy.toISOString().split('T')[0];
          const proximos = STATE.contenidos
            .filter(c => c.fechaPub >= hoyStr && c.estado !== 'Publicado')
            .sort((a,b) => a.fechaPub > b.fechaPub ? 1 : -1)
            .slice(0, 5);
          if (!proximos.length) return `<div class="empty-state" style="padding:24px;"><p>No hay contenidos programados próximamente.</p></div>`;
          return `<div style="overflow-x:auto;"><table class="data-table">
            <thead><tr><th>Fecha</th><th>Título</th><th>Plataforma</th><th>Estado</th><th></th></tr></thead>
            <tbody>${proximos.map(c => `
              <tr>
                <td>${fmtDate(c.fechaPub)}</td>
                <td style="font-weight:500;">${c.titulo}</td>
                <td>${(c.plataformas||[]).map(p => platBadge(p)).join(' ')}</td>
                <td>${statusBadge(c.estado)}</td>
                <td><button class="btn btn-secondary btn-sm" onclick="openContenidoModalById('${c.id}')">Editar</button></td>
              </tr>
            `).join('')}</tbody>
          </table></div>`;
        })()}
      </div>
    </div>
    ${(() => {
      const archivadas = STATE.tareas.filter(t => t.archivado);
      return archivadas.length ? `
        <div style="text-align:right;margin-top:12px;">
          <button class="btn btn-secondary btn-sm" onclick="renderSection('tareas');document.querySelector('[data-section=tareas]').click();" style="font-size:11px;color:var(--text-muted);">
            📦 Ver tareas archivadas (${archivadas.length})
          </button>
        </div>
      ` : '';
    })()}

    <!-- Sitio Web widget -->
    ${(() => {
      const wt = STATE.home.webTareas || [];
      const pend = wt.filter(t => t.estado !== 'Listo');
      if (!wt.length) return `
        <div class="card" style="margin-top:16px;">
          <div class="card-header">
            <i data-lucide="globe" style="width:15px;height:15px;color:#64748b;stroke-width:1.75;"></i>
            <h2>Sitio Web</h2>
            <button class="btn btn-secondary btn-sm" onclick="renderSection('web');document.querySelector('[data-section=web]').click();" style="margin-left:auto;">Ver todo</button>
          </div>
          <div class="card-body" style="padding:12px 20px;">
            <button class="btn btn-primary btn-sm" onclick="openWebTaskModal(null)">+ Cargar primera tarea web</button>
          </div>
        </div>`;
      return `
        <div class="card" style="margin-top:16px;">
          <div class="card-header">
            <i data-lucide="globe" style="width:15px;height:15px;color:#64748b;stroke-width:1.75;"></i>
            <h2>Sitio Web <span style="font-size:12px;font-weight:400;color:var(--text-muted);">${pend.length} pendiente${pend.length!==1?'s':''}</span></h2>
            <button class="btn btn-secondary btn-sm" onclick="document.querySelector('[data-section=web]').click();" style="margin-left:auto;">Ver todo</button>
            <button class="btn btn-primary btn-sm" onclick="openWebTaskModal(null)">+</button>
          </div>
          <div style="overflow-x:auto;">
            <table class="data-table">
              <thead><tr><th>Tarea</th><th>Categoría</th><th>Estado</th><th>Vence</th><th></th></tr></thead>
              <tbody>${pend.slice(0,5).map(t => `
                <tr>
                  <td style="font-weight:500;">${t.titulo}</td>
                  <td><span style="font-size:11px;padding:2px 7px;border-radius:10px;background:#f1f5f9;color:var(--text-muted);">${t.categoria||'Otro'}</span></td>
                  <td>${t.estado}</td>
                  <td style="font-size:12px;color:var(--text-muted);">${t.vencimiento ? fmtDate(t.vencimiento) : '—'}</td>
                  <td><button class="btn btn-secondary btn-sm" onclick="openWebTaskModal('${t.id}')">✏️</button></td>
                </tr>`).join('')}
              </tbody>
            </table>
          </div>
        </div>`;
    })()}
  `;
}

window.editPrioridades = function() {
  const { prioridades = [] } = STATE.home || {};
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:480px;">
      <div class="modal-header">
        <h3>⭐ Editar prioridades</h3>
        <button class="modal-close" id="_closePrioModal">×</button>
      </div>
      <div class="modal-body">
        <p style="font-size:13px;color:var(--text-muted);margin-bottom:10px;">Una prioridad por línea. Enter agrega una nueva línea.</p>
        <textarea id="_prioTextarea" class="form-control" rows="6" style="resize:vertical;">${prioridades.join('\n')}</textarea>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="_cancelPrioBtn">Cancelar</button>
        <button class="btn btn-primary" id="_savePrioBtn">Guardar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const ta = document.getElementById('_prioTextarea');
  ta.focus();
  ta.setSelectionRange(ta.value.length, ta.value.length);
  const close = () => overlay.remove();
  document.getElementById('_closePrioModal').addEventListener('click', close);
  document.getElementById('_cancelPrioBtn').addEventListener('click', close);
  document.getElementById('_savePrioBtn').addEventListener('click', () => {
    STATE.home.prioridades = ta.value.split('\n').map(s => s.trim()).filter(Boolean);
    saveHomeData(clientId, STATE.home);
    close();
    renderSection('home');
  });
};

window.toggleTodo = async function(id) {
  const t = STATE.home.todos.find(x => x.id === id);
  if (!t) return;
  t.done = !t.done;
  await saveHomeData(clientId, STATE.home);
  renderSection('home');
};

window.removeTodo = async function(id) {
  STATE.home.todos = STATE.home.todos.filter(x => x.id !== id);
  await saveHomeData(clientId, STATE.home);
  renderSection('home');
};

window.addTodoItem = function() {
  openTareaModal(null);
};

// ──────────────────────────────────────────────────────
// CONTENIDOS
// ──────────────────────────────────────────────────────
let activeContTab = 'banco';

function renderContenidos(container) {
  container.innerHTML = `
    <div class="mb-16">
      <div class="tabs" id="cont-tabs">
        <button class="tab-btn ${activeContTab==='banco'?'active':''}" data-tab="banco">Banco de contenidos</button>
        <button class="tab-btn ${activeContTab==='calendario'?'active':''}" data-tab="calendario">Calendario de contenidos</button>
        <button class="tab-btn ${activeContTab==='estados'?'active':''}" data-tab="estados">Kanban</button>
        <button class="tab-btn ${activeContTab==='feed-ig'?'active':''}" data-tab="feed-ig">Feed IG</button>
        <button class="tab-btn ${activeContTab==='muro-fb'?'active':''}" data-tab="muro-fb">Muro FB</button>
        <button class="tab-btn ${activeContTab==='stories'?'active':''}" data-tab="stories">Stories IG</button>
        <button class="tab-btn ${activeContTab==='ideas'?'active':''}" data-tab="ideas">Banco de ideas</button>
        <button class="tab-btn ${activeContTab==='proceso'?'active':''}" data-tab="proceso">En proceso</button>
        <button class="tab-btn ${activeContTab==='metricas'?'active':''}" data-tab="metricas">Métricas</button>
      </div>
    </div>
    <div id="cont-tab-body"></div>
  `;

  document.querySelectorAll('#cont-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#cont-tabs .tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeContTab = btn.dataset.tab;
      renderContTab(activeContTab);
    });
  });

  renderContTab(activeContTab);
}

function renderContTab(tab) {
  const body = document.getElementById('cont-tab-body');
  if (!body) return;

  if (tab === 'banco') renderBancoContenidos(body);
  else if (tab === 'calendario') renderCalendario(body);
  else if (tab === 'estados') renderKanbanContenidos(body);
  else if (tab === 'feed-ig') renderFeedIG(body);
  else if (tab === 'muro-fb') renderMuroFB(body);
  else if (tab === 'stories') renderStories(body);
  else if (tab === 'ideas') renderIdeas(body);
  else if (tab === 'proceso') renderEnProceso(body);
  else if (tab === 'metricas') renderMetricasContenidos(body);
}

// ─ Banco de contenidos (tabla desktop + cards mobile) ─
function mesAnioLabel(fechaYYYYMM) {
  const label = new Date(fechaYYYYMM + '-01T00:00:00').toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function bancoCardHtml(c) {
  return `
    <div class="content-card" onclick="openContenidoModalById('${c.id}')">
      <div class="content-card-top">
        <span class="content-card-fecha">${c.fechaPub ? fmtDate(c.fechaPub) : 'Sin fecha'}</span>
        ${statusBadge(c.estado)}
      </div>
      <div class="content-card-titulo">${c.titulo}</div>
      <div class="content-card-meta">
        ${(c.plataformas || []).map(p => platBadge(p)).join('')}
        ${c.formato ? `<span style="font-size:10px;background:#f1f5f9;border-radius:4px;padding:2px 7px;color:var(--text-muted);">${Array.isArray(c.formato)?c.formato[0]:c.formato}</span>` : ''}
        ${c.eje ? `<span style="font-size:10px;background:#f1f5f9;border-radius:4px;padding:2px 7px;color:var(--text-muted);">${c.eje}</span>` : ''}
      </div>
    </div>
  `;
}

function bancoRowHtml(c) {
  return `
    <tr data-id="${c.id}" onclick="openContenidoModalById('${c.id}')" style="cursor:pointer;" class="banco-row">
      <td><input type="date" value="${c.fechaPub||''}" class="banco-date-input" onclick="event.stopPropagation()" onchange="bancoUpdateFecha('${c.id}', this.value)" style="border:none;background:transparent;font-size:12px;color:var(--text);cursor:pointer;width:120px;"></td>
      <td style="font-weight:500;min-width:160px;">${c.titulo}</td>
      <td>${(c.plataformas||[]).map(p => platBadge(p)).join(' ')}</td>
      <td onclick="event.stopPropagation()">
        <select class="banco-estado-select" onchange="bancoUpdateEstado('${c.id}', this.value)" style="border:none;background:transparent;font-size:12px;color:var(--text);cursor:pointer;font-weight:600;">
          ${['Idea','En proceso','En revisión','Aprobado','Programado','Publicado'].map(op => `<option value="${op}" ${c.estado===op?'selected':''}>${op}</option>`).join('')}
        </select>
      </td>
      <td style="font-size:12px;">${Array.isArray(c.formato)?c.formato.join(', '):(c.formato||'')}</td>
      <td style="font-size:12px;">${c.eje||''}</td>
      <td>${firstLink(c.linkDrive) ? `<a class="drive-link" href="${firstLink(c.linkDrive)}" target="_blank" onclick="event.stopPropagation()" title="${firstLink(c.linkDrive)}">↗</a>` : ''}</td>
      <td class="text-sm text-muted" style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.notas||''}</td>
      <td onclick="event.stopPropagation()" style="white-space:nowrap;">
        ${c.estado === 'En revisión' ? `
          <button class="btn btn-sm" style="background:#10b981;color:#fff;border:none;padding:3px 8px;" onclick="aprobarContenido('${c.id}')">✓</button>
          <button class="btn btn-sm" style="background:#ef4444;color:#fff;border:none;padding:3px 8px;" onclick="rechazarContenido('${c.id}')">✗</button>
        ` : ''}
      </td>
    </tr>
  `;
}

function bancoMesGroupHtml(label, items, abierto) {
  return `
    <details class="banco-mes-group" ${abierto ? 'open' : ''}>
      <summary class="banco-mes-header">${label} <span class="banco-mes-count">${items.length}</span></summary>
      <div class="banco-cards-mobile">${items.map(bancoCardHtml).join('')}</div>
      <div class="banco-table-desktop">
        <p class="table-scroll-hint">← deslizá para ver más →</p>
        <div class="table-wrapper table-scroll-wrap">
          <table class="data-table">
            <thead>
              <tr><th>Fecha pub.</th><th>Título</th><th>Plataforma</th><th>Estado</th><th>Formato</th><th>Eje</th><th>Drive</th><th>Notas</th><th></th></tr>
            </thead>
            <tbody>${items.map(bancoRowHtml).join('')}</tbody>
          </table>
        </div>
      </div>
    </details>
  `;
}

function renderBancoContenidos(container) {
  const activos = STATE.contenidos.filter(c => !c.archivado);
  const archivados = STATE.contenidos.filter(c => c.archivado);
  const all = [...activos].sort((a, b) => (a.fechaPub || 'zzz') > (b.fechaPub || 'zzz') ? 1 : -1);

  const hoy = new Date();
  const anioActual = String(hoy.getFullYear());
  const claveActual = `${anioActual}-${String(hoy.getMonth()+1).padStart(2,'0')}`;

  const grupos = new Map();
  all.forEach(c => {
    const clave = c.fechaPub ? c.fechaPub.slice(0, 7) : 'sin-fecha';
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(c);
  });
  const clavesConFecha = [...grupos.keys()].filter(c => c !== 'sin-fecha').sort((a, b) => a.localeCompare(b));
  const anios = [...new Set(clavesConFecha.map(c => c.slice(0, 4)))];

  const sinFechaHtml = grupos.has('sin-fecha')
    ? bancoMesGroupHtml('📌 Sin fecha', grupos.get('sin-fecha'), true)
    : '';

  const aniosHtml = anios.map(anio => {
    const clavesDelAnio = clavesConFecha.filter(c => c.slice(0, 4) === anio);
    const totalAnio = clavesDelAnio.reduce((n, c) => n + grupos.get(c).length, 0);
    const abiertoAnio = anio === anioActual;
    return `
      <details class="banco-anio-group" ${abiertoAnio ? 'open' : ''}>
        <summary class="banco-anio-header">${anio} <span class="banco-mes-count">${totalAnio}</span></summary>
        <div class="banco-anio-body">
          ${clavesDelAnio.map(clave => bancoMesGroupHtml(mesAnioLabel(clave), grupos.get(clave), clave === claveActual)).join('')}
        </div>
      </details>
    `;
  }).join('');

  container.innerHTML = `
    ${all.length ? sinFechaHtml + aniosHtml : `<div class="empty-state"><p>Sin contenidos aún.</p></div>`}
    ${archivados.length ? `
      <div style="margin-top:24px;">
        <button class="btn btn-secondary btn-sm" onclick="this.nextElementSibling.classList.toggle('hidden');this.textContent=this.textContent.includes('Ver')?'▲ Ocultar archivados':'▼ Ver archivados (${archivados.length})'">▼ Ver archivados (${archivados.length})</button>
        <div class="hidden" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;">
          ${archivados.map(c => `
            <div class="card" style="padding:10px 14px;opacity:0.7;min-width:200px;">
              <div style="font-size:13px;font-weight:600;margin-bottom:4px;">📦 ${c.titulo}</div>
              <div style="font-size:11px;color:var(--text-muted);">${c.fechaPub ? fmtDate(c.fechaPub) : 'Sin fecha'}</div>
              <div style="display:flex;gap:4px;margin-top:6px;">
                <button class="btn btn-secondary btn-sm" onclick="desarchivarContenido('${c.id}')">Restaurar</button>
                <button class="btn btn-danger btn-sm" onclick="eliminarContenidoDirecto('${c.id}')">🗑</button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;
}

window.bancoUpdateFecha = async function(id, fecha) {
  const c = STATE.contenidos.find(x => x.id === id);
  if (!c) return;
  c.fechaPub = fecha || null;
  await saveContenido(clientId, c);
  const i = STATE.contenidos.findIndex(x => x.id === id);
  STATE.contenidos[i] = c;
};

window.bancoUpdateEstado = async function(id, estado) {
  const c = STATE.contenidos.find(x => x.id === id);
  if (!c) return;
  c.estado = estado;
  const saved = await saveContenido(clientId, c);
  const i = STATE.contenidos.findIndex(x => x.id === id);
  STATE.contenidos[i] = saved;
  renderContTab(activeContTab);
  if (currentSection === 'home') renderSection('home');
};

// ─ Calendario ─
function renderCalendario(container) {
  const hoy = new Date();
  let viewYear = hoy.getFullYear(), viewMonth = hoy.getMonth();

  function drawCal() {
    const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();

    let cells = '';
    let day = 1;
    let nextDay = 1;
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

    for (let i = 0; i < totalCells; i++) {
      let cellDate, isOther = false;
      if (i < firstDay) { cellDate = new Date(viewYear, viewMonth - 1, daysInPrev - firstDay + i + 1); isOther = true; }
      else if (day > daysInMonth) { cellDate = new Date(viewYear, viewMonth + 1, nextDay++); isOther = true; }
      else { cellDate = new Date(viewYear, viewMonth, day++); }

      const dateStr = cellDate.toISOString().split('T')[0];
      const isToday = dateStr === hoy.toISOString().split('T')[0];
      const dayConts = STATE.contenidos.filter(c => c.fechaPub === dateStr && !c.archivado);

      cells += `<div class="cal-day${isOther ? ' other-month' : ''}${isToday ? ' today' : ''}">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div class="cal-day-num" ${!isOther ? `onclick="openContenidoModal({fechaPub:'${dateStr}'})" style="cursor:pointer;" title="Agregar contenido"` : ''}>${cellDate.getDate()}</div>
          ${!isOther ? `<button onclick="openContenidoModal({fechaPub:'${dateStr}'})" style="background:none;border:none;color:#cbd5e1;cursor:pointer;font-size:16px;line-height:1;padding:0 4px;border-radius:3px;" title="Agregar contenido" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='#cbd5e1'">+</button>` : ''}
        </div>
        ${dayConts.map(c => `
          <div class="cal-event" style="background:${statusColor(c.estado)}22;color:${statusColor(c.estado)};"
               onclick="openContenidoModalById('${c.id}')" title="${c.titulo}">
            ${(c.plataformas||[]).map(p=>platIcon(p)).join('')} ${c.titulo}
          </div>
        `).join('')}
      </div>`;
    }

    container.innerHTML = `
      <div class="card">
        <div class="card-body">
          <div class="cal-nav">
            <button class="cal-btn" id="cal-prev">‹</button>
            <div class="cal-month">${monthName.charAt(0).toUpperCase()+monthName.slice(1)}</div>
            <button class="cal-btn" id="cal-next">›</button>
          </div>
          <div class="cal-grid">
            ${['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map(d => `<div class="cal-day-header">${d}</div>`).join('')}
            ${cells}
          </div>
        </div>
      </div>
    `;
    document.getElementById('cal-prev').onclick = () => { if (--viewMonth < 0) { viewMonth=11; viewYear--; } drawCal(); };
    document.getElementById('cal-next').onclick = () => { if (++viewMonth > 11) { viewMonth=0; viewYear++; } drawCal(); };
  }
  drawCal();
}

// ─ Kanban Estados ─
function renderKanbanContenidos(container) {
  const cols = [
    { key: 'Idea', label: 'Idea', cls: 's-idea' },
    { key: 'En proceso', label: 'En proceso', cls: 's-proceso' },
    { key: 'En revisión', label: 'En revisión', cls: 's-revision' },
    { key: 'Aprobado', label: 'Aprobado', cls: 's-aprobado' },
    { key: 'Programado', label: 'Programado', cls: 's-programado' },
    { key: 'Publicado', label: 'Publicado', cls: 's-publicado' },
  ];

  container.innerHTML = `<div class="kanban-board" id="kanban-cont">${cols.map(col => {
    const items = STATE.contenidos.filter(c => c.estado === col.key && !c.archivado);
    return `
      <div class="kanban-col" data-col="${col.key}">
        <div class="kanban-col-header">
          <span class="kanban-col-dot" style="background:${statusColor(col.key)};"></span>
          <span class="col-title">${col.label}</span>
          <span class="col-count">${items.length}</span>
        </div>
        <div class="kanban-cards" data-col="${col.key}">
          ${items.map(c => `
            <div class="kanban-card" draggable="true" data-id="${c.id}">
              <div class="kanban-card-title">${c.titulo}</div>
              <div class="kanban-card-meta">${(c.plataformas||[]).map(p=>platBadge(p)).join(' ')}</div>
              ${c.fechaPub ? `<div class="kanban-card-date">${fmtDate(c.fechaPub)}</div>` : ''}
              <div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap;">
                <button class="btn btn-secondary btn-sm" onclick="openContenidoModalById('${c.id}')">Editar</button>
                <button class="btn btn-secondary btn-sm" onclick="openPreview('${c.id}')">Preview</button>
                ${col.key === 'En revisión' ? `
                  <button class="btn btn-sm" style="background:#10b981;color:#fff;border:none;" onclick="aprobarContenido('${c.id}')">✓ Aprobar</button>
                  <button class="btn btn-sm" style="background:#ef4444;color:#fff;border:none;" onclick="rechazarContenido('${c.id}')">✗ Rechazar</button>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
        <button class="kanban-add-btn" onclick="openContenidoModal({estado:'${col.key}'})">+ Agregar</button>
      </div>
    `;
  }).join('')}</div>`;

  initKanbanDrag('#kanban-cont', STATE.contenidos.filter(c => !c.archivado), async (id, newCol) => {
    const c = STATE.contenidos.find(x => x.id === id);
    if (!c) return;
    c.estado = newCol;
    await saveContenido(clientId, c);
    renderContTab('estados');
  });
}

// ─ Feed IG ─
let _igFilter = 'Aprobado';
const FEED_FILTERS = [
  { val: 'todas', label: 'Todas' },
  { val: 'Sin empezar', label: 'Sin empezar' },
  { val: 'En proceso', label: 'En proceso' },
  { val: 'En revisión', label: 'En revisión' },
  { val: 'Aprobado', label: 'Aprobadas' },
  { val: 'Publicado', label: 'Publicadas' },
];

window.setIgFilter = function(val) { _igFilter = val; renderContTab('feed-ig'); };

function renderFeedIG(container) {
  const all = STATE.contenidos
    .filter(c => (c.plataformas||[]).includes('Instagram') && !normUbicacion(c.ubicacion||[]).includes('Story'))
    .sort((a,b) => (a.fechaPub||'') < (b.fechaPub||'') ? -1 : 1); // ASC: próximos primero

  const filtered = _igFilter === 'todas' ? all : all.filter(c => c.estado === _igFilter);
  const feedItems = filtered.slice(0, 9);

  const client = STATE.client;
  const filterBtns = FEED_FILTERS.map(f =>
    `<button onclick="setIgFilter('${f.val}')" style="padding:4px 10px;border-radius:20px;border:1px solid ${_igFilter===f.val?'var(--primary)':'var(--border)'};background:${_igFilter===f.val?'var(--primary)':'transparent'};color:${_igFilter===f.val?'#fff':'var(--text-muted)'};font-size:11px;cursor:pointer;font-weight:${_igFilter===f.val?'600':'400'}">${f.label}</button>`
  ).join('');

  container.innerHTML = `
    <div style="margin-bottom:14px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
      <span style="font-size:12px;color:var(--text-muted);margin-right:4px;">Filtrar:</span>
      ${filterBtns}
      <span style="margin-left:auto;font-size:12px;color:var(--text-muted);">${filtered.length} contenido${filtered.length!==1?'s':''}</span>
    </div>
    <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start;">
      <div class="phone-device">
        <div class="phone-screen">
          <div style="padding:10px 12px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:10px;">
            <div class="ig-avatar"></div>
            <div>
              <div style="font-weight:700;font-size:13px;">${client.instagram||'@cuenta'}</div>
              <div style="font-size:10px;color:#666;">${all.filter(c=>c.estado==='Publicado').length} publicaciones</div>
            </div>
          </div>
          <div class="feed-grid">
            ${feedItems.map(c => {
              const thumb = firstLink(c.linkDrive) ? driveThumb(firstLink(c.linkDrive)) : '';
              const imgTag = thumb ? `<img src="${thumb}" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex';">` : '';
              return `
              <div class="feed-cell" onclick="openContenidoModalById('${c.id}')" title="${c.titulo}">
                ${imgTag}
                <div class="feed-cell-empty" style="${thumb?'display:none':''};">${platIcon('Instagram')}</div>
                <div class="feed-cell-overlay">
                  <div style="font-size:9px;font-weight:600;line-height:1.2;">${c.titulo}</div>
                  <div style="margin-top:3px;">${statusDot(c.estado)}</div>
                </div>
              </div>`;
            }).join('')}
            ${Array(Math.max(0, 9 - feedItems.length)).fill(0).map(() =>
              `<div class="feed-cell"><div class="feed-cell-empty" style="color:#e2e8f0;font-size:20px;">+</div></div>`
            ).join('')}
          </div>
        </div>
        <div class="phone-label">Feed Instagram</div>
      </div>

      <div style="flex:1;min-width:280px;">
        <h3 style="font-size:14px;font-weight:600;margin-bottom:12px;">Posts de Instagram (Feed)</h3>
        ${filtered.length ? filtered.map(c => {
          const thumb = firstLink(c.linkDrive) ? driveThumb(firstLink(c.linkDrive)) : '';
          return `
          <div class="card" style="padding:10px 14px;margin-bottom:8px;display:flex;align-items:center;gap:10px;">
            ${thumb ? `<img src="${thumb}" style="width:44px;height:44px;object-fit:cover;border-radius:6px;flex-shrink:0;" onerror="this.style.display='none'">` : `<div style="width:44px;height:44px;border-radius:6px;background:var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:18px;">${platIcon('Instagram')}</div>`}
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.titulo}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${fmtDate(c.fechaPub)||'Sin fecha'} · ${Array.isArray(c.formato)?c.formato.join(', '):(c.formato||'—')}</div>
            </div>
            ${statusBadge(c.estado)}
            <button class="btn btn-secondary btn-sm" onclick="openContenidoModalById('${c.id}')">✏️</button>
          </div>`;
        }).join('') : `<div class="empty-state"><p>No hay contenidos con ese filtro.</p></div>`}
      </div>
    </div>
  `;
}

// ─ Muro FB ─
let _fbFilter = 'Aprobado';
window.setFbFilter = function(val) { _fbFilter = val; renderContTab('muro-fb'); };

function renderMuroFB(container) {
  const all = STATE.contenidos
    .filter(c => (c.plataformas||[]).includes('Facebook') && !normUbicacion(c.ubicacion||[]).includes('Story'))
    .sort((a,b) => (a.fechaPub||'') < (b.fechaPub||'') ? -1 : 1);
  const fbItems = _fbFilter === 'todas' ? all : all.filter(c => c.estado === _fbFilter);

  const filterBtns = FEED_FILTERS.map(f =>
    `<button onclick="setFbFilter('${f.val}')" style="padding:4px 10px;border-radius:20px;border:1px solid ${_fbFilter===f.val?'var(--primary)':'var(--border)'};background:${_fbFilter===f.val?'var(--primary)':'transparent'};color:${_fbFilter===f.val?'#fff':'var(--text-muted)'};font-size:11px;cursor:pointer;">${f.label}</button>`
  ).join('');

  container.innerHTML = `
    <div style="margin-bottom:14px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
      <span style="font-size:12px;color:var(--text-muted);margin-right:4px;">Filtrar:</span>${filterBtns}
    </div>
    <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start;">
      <div class="phone-device" style="width:300px;">
        <div class="phone-screen" style="background:#f0f2f5;">
          <div style="padding:8px;background:#1877f2;color:white;font-weight:700;font-size:14px;display:flex;align-items:center;gap:8px;">
            📘 ${STATE.client.facebook || STATE.client.nombre || 'Página'}
          </div>
          ${fbItems.slice(0,3).map(c => `
            <div class="fb-preview" style="margin-bottom:4px;">
              <div class="fb-header">
                <div class="fb-avatar">${(STATE.client.nombre||'C')[0]}</div>
                <div>
                  <div class="fb-name">${STATE.client.facebook || STATE.client.nombre || 'Página'}</div>
                  <div class="fb-time">${fmtDate(c.fechaPub)} · 🌐</div>
                </div>
              </div>
              <div class="fb-text">${(c.copy||c.titulo||'').slice(0,80)}${(c.copy||'').length>80?'...':''}</div>
              <div class="fb-image">${firstLink(c.linkDrive)?`<img src="${driveThumb(firstLink(c.linkDrive))}" onerror="this.style.display='none'" style="width:100%;height:100%;object-fit:cover;">`:'📘'}</div>
            </div>
          `).join('')}
        </div>
        <div class="phone-label">Muro Facebook</div>
      </div>

      <div style="flex:1;min-width:280px;">
        <h3 style="font-size:14px;font-weight:600;margin-bottom:12px;">Posts de Facebook</h3>
        ${fbItems.length ? fbItems.map(c => {
          const thumb = firstLink(c.linkDrive) ? driveThumb(firstLink(c.linkDrive)) : '';
          return `
          <div class="card" style="padding:10px 14px;margin-bottom:8px;display:flex;align-items:center;gap:10px;">
            ${thumb ? `<img src="${thumb}" style="width:44px;height:44px;object-fit:cover;border-radius:6px;flex-shrink:0;" onerror="this.style.display='none'">` : `<div style="width:44px;height:44px;border-radius:6px;background:var(--border);flex-shrink:0;display:flex;align-items:center;justify-content:center;">📘</div>`}
            <div style="flex:1;min-width:0;">
              <div style="font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.titulo}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${fmtDate(c.fechaPub)||'Sin fecha'} · ${Array.isArray(c.formato)?c.formato.join(', '):(c.formato||'—')}</div>
            </div>
            ${statusBadge(c.estado)}
            <button class="btn btn-secondary btn-sm" onclick="openContenidoModalById('${c.id}')">✏️</button>
          </div>`;
        }).join('') : `<div class="empty-state"><p>No hay posts con ese filtro.</p></div>`}
      </div>
    </div>
  `;
}

// ─ Stories ─
let _storiesFilter = 'todas';
window.setStoriesFilter = function(val) { _storiesFilter = val; renderContTab('stories-ig'); };

function renderStories(container) {
  const all = STATE.contenidos.filter(c =>
    (c.plataformas||[]).includes('Instagram') && normUbicacion(c.ubicacion||[]).includes('Story')
  ).sort((a,b) => (a.fechaPub||'') < (b.fechaPub||'') ? -1 : 1);

  const stories = _storiesFilter === 'todas' ? all : all.filter(c => c.estado === _storiesFilter);

  const filterBtns = FEED_FILTERS.map(f =>
    `<button onclick="setStoriesFilter('${f.val}')" style="padding:4px 10px;border-radius:20px;border:1px solid ${_storiesFilter===f.val?'var(--primary)':'var(--border)'};background:${_storiesFilter===f.val?'var(--primary)':'transparent'};color:${_storiesFilter===f.val?'#fff':'var(--text-muted)'};font-size:11px;cursor:pointer;">${f.label}</button>`
  ).join('');

  container.innerHTML = `
    <div style="margin-bottom:14px;display:flex;flex-wrap:wrap;gap:6px;align-items:center;">
      <span style="font-size:12px;color:var(--text-muted);margin-right:4px;">Filtrar:</span>${filterBtns}
      <span style="margin-left:auto;font-size:12px;color:var(--text-muted);">${stories.length} story${stories.length!==1?'s':''}</span>
    </div>
    <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;">
      ${stories.length ? stories.map(c => {
        const thumb = firstLink(c.linkDrive) ? driveThumb(firstLink(c.linkDrive)) : '';
        return `
        <div>
          <div class="phone-device" style="width:170px;">
            <div class="phone-screen" style="min-height:300px;">
              <div class="story-preview">
                ${thumb ? `<img src="${thumb}" style="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;" onerror="this.style.display='none'">` : '<div class="story-preview-empty">▯</div>'}
                <div class="story-bar"><div class="story-bar-seg active"></div><div class="story-bar-seg"></div><div class="story-bar-seg"></div></div>
                <div class="story-user"><div class="story-avatar"></div><span class="story-uname">${STATE.client.instagram||'@cuenta'}</span></div>
                <div class="story-caption">${(c.copy||c.titulo||'').slice(0,60)}</div>
              </div>
            </div>
          </div>
          <div class="phone-label" style="margin-top:6px;">${c.titulo.slice(0,22)}</div>
          <div style="text-align:center;margin-top:4px;">${statusBadge(c.estado)}</div>
          <div style="text-align:center;margin-top:6px;">
            <button class="btn btn-secondary btn-sm" onclick="openContenidoModalById('${c.id}')">✏️ Editar</button>
          </div>
        </div>`;
      }).join('')
      : `<div class="empty-state"><div class="empty-state-icon">▯</div><h3>Sin stories</h3><p>Agregá contenidos con ubicación "Story" e Instagram.</p></div>`}
    </div>
  `;
}

// ─ Banco de ideas ─
function renderIdeas(container) {
  container.innerHTML = `
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
      <h3 style="font-size:15px;font-weight:600;">Ideas de contenido</h3>
      <button class="btn btn-primary btn-sm" onclick="openIdeaModal(null)">+ Nueva idea</button>
    </div>
    ${STATE.ideas.length ? `
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px;">
        ${STATE.ideas.map(i => `
          <div class="card" style="padding:14px;">
            <div style="font-weight:600;font-size:13px;margin-bottom:8px;">${i.titulo}</div>
            <div style="margin-bottom:6px;">${(i.plataformas||[]).map(p=>platBadge(p)).join(' ')}</div>
            ${i.formato ? `<div style="font-size:12px;color:var(--text-muted);">Formato: ${i.formato}</div>` : ''}
            ${i.notas ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${i.notas}</div>` : ''}
            <div style="display:flex;gap:6px;margin-top:10px;">
              <button class="btn btn-primary btn-sm" onclick="promoverIdea('${i.id}')">→ Contenido</button>
              <button class="btn btn-secondary btn-sm" onclick="openIdeaModal('${i.id}')">Editar</button>
              <button class="btn btn-danger btn-sm" onclick="eliminarIdea('${i.id}')" title="Eliminar">🗑</button>
            </div>
          </div>
        `).join('')}
      </div>
    ` : `<div class="empty-state"><div class="empty-state-icon">💡</div><h3>Sin ideas</h3><p>Guardá ideas de contenido para trabajarlas después.</p></div>`}
  `;
}

let _editingIdea = null;
window.openIdeaModal = function(id) {
  _editingIdea = id ? STATE.ideas.find(i => i.id === id) : null;
  const i = _editingIdea || {};
  document.getElementById('idea-modal-title').textContent = _editingIdea ? 'Editar idea' : 'Nueva idea';
  document.getElementById('if-titulo').value = i.titulo || '';
  document.getElementById('if-notas').value = i.notas || '';
  document.getElementById('if-formato').value = i.formato || 'Imagen';
  document.querySelectorAll('.idea-plat-check').forEach(cb => {
    cb.checked = (i.plataformas || ['Instagram','Facebook']).includes(cb.value);
  });
  document.getElementById('ideaModal').classList.remove('hidden');
};

window.eliminarIdea = async function(id) {
  if (!confirm('¿Eliminar esta idea?')) return;
  await deleteIdea(clientId, id);
  STATE.ideas = STATE.ideas.filter(i => i.id !== id);
  renderContTab('ideas');
};

window.promoverIdea = async function(id) {
  const idea = STATE.ideas.find(i => i.id === id);
  if (!idea) return;
  const nuevo = { titulo: idea.titulo, plataformas: idea.plataformas||[], formato: idea.formato||'', estado: 'En proceso', notas: idea.notas||'', eje:'', tipo:'', objetivo:'', fechaPub:'', ubicacion:'Feed', cuenta: STATE.client.instagram||'' };
  const saved = await saveContenido(clientId, nuevo);
  STATE.contenidos.push(saved);
  STATE.ideas = STATE.ideas.filter(i => i.id !== id);
  await deleteIdea(clientId, id).catch(() => {});
  renderContTab('banco');
  activeContTab = 'banco';
  document.querySelectorAll('#cont-tabs .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab==='banco'));
};

// ─ En proceso y revisión ─
function renderEnProceso(container) {
  const items = STATE.contenidos.filter(c => ['En proceso','En revisión'].includes(c.estado));
  container.innerHTML = `
    <h3 style="font-size:14px;font-weight:600;margin-bottom:12px;">En proceso y en revisión (${items.length})</h3>
    ${items.length ? `
      <div class="table-wrapper">
        <table class="data-table">
          <thead><tr><th>Título</th><th>Plataforma</th><th>Estado</th><th>Fecha pub.</th><th>Notas</th><th></th></tr></thead>
          <tbody>${items.map(c => `
            <tr>
              <td style="font-weight:500;">${c.titulo}</td>
              <td>${(c.plataformas||[]).map(p=>platBadge(p)).join(' ')}</td>
              <td>${statusBadge(c.estado)}</td>
              <td>${fmtDate(c.fechaPub)}</td>
              <td class="text-sm text-muted">${c.notas||''}</td>
              <td><button class="btn btn-secondary btn-sm" onclick="openContenidoModalById('${c.id}')">Editar</button></td>
            </tr>
          `).join('')}</tbody>
        </table>
      </div>
    ` : `<div class="empty-state"><p>No hay contenidos en proceso o revisión.</p></div>`}
  `;
}

// ─ Métricas ─
const METRICAS_FIELDS = [
  { key:'seguidores_ig',   label:'Seguidores IG',      icon:'📸', type:'number' },
  { key:'crecimiento_ig',  label:'Crecimiento IG',     icon:'📈', type:'text', placeholder:'+150' },
  { key:'seguidores_fb',   label:'Seguidores FB',      icon:'📘', type:'number' },
  { key:'crecimiento_fb',  label:'Crecimiento FB',     icon:'📈', type:'text', placeholder:'+40' },
  { key:'alcance_mensual', label:'Alcance mensual',    icon:'📡', type:'number' },
  { key:'impresiones',     label:'Impresiones',        icon:'👁', type:'number' },
  { key:'tasa_engagement', label:'Engagement rate',    icon:'❤️', type:'text', placeholder:'3.2%' },
  { key:'publicaciones',   label:'Publicaciones',      icon:'📋', type:'number' },
  { key:'visitas_perfil',  label:'Visitas al perfil',  icon:'🧑', type:'number' },
  { key:'clics_link',      label:'Clics en link bio',  icon:'🔗', type:'number' },
  { key:'historias_views', label:'Vistas historias',   icon:'🎞', type:'number' },
  { key:'guardados',       label:'Guardados',          icon:'🔖', type:'number' },
];

function renderMetricasContenidos(container) {
  const m = STATE.metricas || {};
  const cards = METRICAS_FIELDS.filter(f => m[f.key]);
  container.innerHTML = `
    ${cards.length ? `
    <div class="metrics-grid" style="margin-bottom:24px;">
      ${cards.map(f => `
        <div class="metric-card">
          <div style="font-size:20px;margin-bottom:4px;">${f.icon}</div>
          <div class="metric-label">${f.label}</div>
          <div class="metric-value">${fmtNum(m[f.key])}</div>
        </div>
      `).join('')}
    </div>` : ''}
    <div class="card">
      <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;">
        <h2>📊 Métricas del mes</h2>
        <button class="btn btn-primary btn-sm" onclick="saveMetricas(this)">Guardar métricas</button>
      </div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;">
          ${METRICAS_FIELDS.map(f => `
            <div class="form-group">
              <label style="font-size:12px;">${f.icon} ${f.label}</label>
              <input type="${f.type}" class="form-control form-control-sm"
                     value="${m[f.key]||''}"
                     placeholder="${f.placeholder||'0'}"
                     oninput="STATE.metricas['${f.key}']=this.value"
                     style="font-size:13px;">
            </div>
          `).join('')}
        </div>
        <div style="margin-top:16px;text-align:right;">
          <button class="btn btn-primary" onclick="saveMetricas(this)">💾 Guardar métricas</button>
        </div>
      </div>
    </div>
  `;
}

window.saveMetricas = async function(btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }
  try {
    await saveMetricasData(clientId, STATE.metricas);
    renderContTab('metricas');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💾 Guardar métricas'; }
  }
};

// ──────────────────────────────────────────────────────
// PREVIEW SOCIAL
// ──────────────────────────────────────────────────────
window.openPreview = function(id) {
  const c = STATE.contenidos.find(x => x.id === id);
  if (!c) return;
  const client = STATE.client;
  const ig = client.instagram || '@cuenta';
  const fbName = client.facebook || client.nombre || 'Página';
  const imgHtml = firstLink(c.linkDrive)
    ? `<img src="${driveThumb(firstLink(c.linkDrive))}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'">`
    : '';
  const copy = c.copy || c.titulo || '';
  const plats = c.plataformas || [];

  document.getElementById('preview-modal-title').textContent = `Vista previa — ${c.titulo}`;

  const previews = [];

  if (plats.includes('Instagram') && !normUbicacion(c.ubicacion).includes('Story')) previews.push(`
    <div>
      <div class="phone-device" style="width:260px;">
        <div class="phone-screen">
          <div class="ig-preview">
            <div class="ig-header">
              <div class="ig-avatar"></div>
              <div>
                <div class="ig-username">${ig}</div>
                <div style="font-size:10px;color:#666;">Buenos Aires</div>
              </div>
              <div class="ig-more">···</div>
            </div>
            <div class="ig-image">${imgHtml || '📸'}</div>
            <div class="ig-actions">❤️ 💬 ➤</div>
            <div class="ig-likes">128 Me gusta</div>
            <div class="ig-caption"><strong>${ig}</strong> ${copy.slice(0,120)}${copy.length>120?'...':''}</div>
          </div>
        </div>
      </div>
      <div class="phone-label">Instagram Feed</div>
    </div>
  `);

  if (plats.includes('Instagram') && normUbicacion(c.ubicacion).includes('Story')) previews.push(`
    <div>
      <div class="phone-device" style="width:200px;">
        <div class="phone-screen">
          <div class="story-preview">
            ${imgHtml || '<div class="story-preview-empty">▯</div>'}
            <div class="story-bar">
              <div class="story-bar-seg active"></div>
              <div class="story-bar-seg"></div>
            </div>
            <div class="story-user">
              <div class="story-avatar"></div>
              <span class="story-uname">${ig}</span>
            </div>
            <div class="story-caption">${copy.slice(0,60)}</div>
          </div>
        </div>
      </div>
      <div class="phone-label">Instagram Story</div>
    </div>
  `);

  if (plats.includes('Facebook')) previews.push(`
    <div>
      <div class="phone-device" style="width:260px;">
        <div class="phone-screen">
          <div class="fb-preview">
            <div class="fb-header">
              <div class="fb-avatar">${fbName[0]}</div>
              <div>
                <div class="fb-name">${fbName}</div>
                <div class="fb-time">${fmtDate(c.fechaPub)} · 🌐</div>
              </div>
            </div>
            <div class="fb-text">${copy.slice(0,150)}${copy.length>150?'...':''}</div>
            <div class="fb-image" style="height:160px;">${imgHtml || '📘'}</div>
            <div class="fb-reactions">👍 ❤️  24 · 3 comentarios</div>
            <div class="fb-actions">
              <button class="fb-action-btn">👍 Me gusta</button>
              <button class="fb-action-btn">💬 Comentar</button>
              <button class="fb-action-btn">↗ Compartir</button>
            </div>
          </div>
        </div>
      </div>
      <div class="phone-label">Facebook</div>
    </div>
  `);

  if (plats.includes('LinkedIn')) previews.push(`
    <div>
      <div class="phone-device" style="width:260px;">
        <div class="phone-screen">
          <div class="li-preview">
            <div class="li-header">
              <div class="li-avatar">${fbName[0]}</div>
              <div>
                <div class="li-name">${fbName}</div>
                <div class="li-title">Empresa · Buenos Aires</div>
                <div class="li-time">${fmtDate(c.fechaPub)} · 🌐</div>
              </div>
            </div>
            <div class="li-text">${copy.slice(0,200)}${copy.length>200?'...':''}</div>
            <div class="li-image" style="height:120px;">${imgHtml || '💼'}</div>
            <div class="li-stats">👍 ❤️ 18 · 4 comentarios</div>
            <div class="li-actions">
              <button class="li-action-btn">👍 Recomendar</button>
              <button class="li-action-btn">💬 Comentar</button>
              <button class="li-action-btn">↗ Compartir</button>
            </div>
          </div>
        </div>
      </div>
      <div class="phone-label">LinkedIn</div>
    </div>
  `);

  document.getElementById('preview-modal-body').innerHTML = `
    <div style="margin-bottom:16px;">
      <div style="font-size:13px;color:var(--text-muted);margin-bottom:4px;">Copy del post:</div>
      <div style="font-size:13px;padding:10px 12px;background:#f8fafc;border-radius:6px;line-height:1.5;">${copy||'(sin copy)'}</div>
    </div>
    <div class="phone-mockup-wrap">${previews.join('')}</div>
    ${!previews.length ? `<div class="empty-state"><p>Seleccioná una plataforma en el contenido para ver la vista previa.</p></div>` : ''}
    <div style="margin-top:16px;display:flex;gap:8px;">
      <button class="btn btn-secondary" onclick="openContenidoModalById('${c.id}');closePreviewModal();">✏️ Editar</button>
      <div style="margin-left:auto;">${statusBadge(c.estado)}</div>
    </div>
  `;

  document.getElementById('previewModal').classList.remove('hidden');
};

window.closePreviewModal = function() { document.getElementById('previewModal').classList.add('hidden'); };
document.getElementById('closePreviewModal').addEventListener('click', closePreviewModal);

// ──────────────────────────────────────────────────────
// MODAL CONTENIDO
// ──────────────────────────────────────────────────────

// Platform → allowed ubicaciones
const PLAT_UBIC = {
  Instagram: ['Feed', 'Story', 'Reel', 'Carrusel'],
  Facebook: ['Feed', 'Story', 'Reel'],
  LinkedIn: ['Feed'],
  'Twitter / X': ['Feed'],
  TikTok: ['Feed', 'Story'],
  YouTube: ['Feed', 'Shorts'],
  'Sitio Web': ['Página', 'Banner'],
  Blog: ['Artículo', 'Banner'],
};

// Platform → allowed formatos
const PLAT_FORMAT = {
  Instagram: ['Imagen', 'Video', 'Reel', 'Carrusel', 'Story', 'GIF'],
  Facebook: ['Imagen', 'Video', 'Carrusel', 'Story', 'GIF'],
  LinkedIn: ['Imagen', 'Video', 'Carrusel', 'Documento'],
  'Twitter / X': ['Imagen', 'Video', 'GIF'],
  TikTok: ['Video'],
  YouTube: ['Video'],
  'Sitio Web': ['Imagen', 'Video', 'GIF', 'Documento'],
  Blog: ['Imagen', 'Video', 'GIF', 'Documento'],
};

function updatePlatFilters() {
  const selectedPlats = Array.from(document.querySelectorAll('.plat-check:checked')).map(cb => cb.value);

  // Compute union of allowed ubicaciones/formatos
  const ubicSet = new Set();
  const fmtSet = new Set();
  selectedPlats.forEach(p => {
    (PLAT_UBIC[p] || []).forEach(u => ubicSet.add(u));
    (PLAT_FORMAT[p] || []).forEach(f => fmtSet.add(f));
  });

  const prevUbic = Array.from(document.querySelectorAll('.ubic-check:checked')).map(cb => cb.value);
  const prevFmt = Array.from(document.querySelectorAll('.fmt-check:checked')).map(cb => cb.value);

  const ubicDiv = document.getElementById('ubic-dynamic');
  const fmtDiv = document.getElementById('formato-dynamic');

  if (ubicSet.size === 0) {
    ubicDiv.innerHTML = '<span style="font-size:11px;color:var(--text-muted);">Seleccioná plataforma primero</span>';
    fmtDiv.innerHTML = '<span style="font-size:11px;color:var(--text-muted);">Seleccioná plataforma primero</span>';
    return;
  }

  ubicDiv.innerHTML = [...ubicSet].map(u =>
    `<label class="check-label"><input type="checkbox" value="${u}" class="ubic-check"${prevUbic.includes(u) ? ' checked' : ''}> ${u}</label>`
  ).join('');

  fmtDiv.innerHTML = [...fmtSet].map(f =>
    `<label class="check-label"><input type="checkbox" value="${f}" class="fmt-check"${prevFmt.includes(f) ? ' checked' : ''}> ${f}</label>`
  ).join('');
}

// Multiple drive links
let _driveLinks = [];
let _refLinks = [];

function renderDriveLinks(type) {
  const arr = type === 'drive' ? _driveLinks : _refLinks;
  const container = document.getElementById(type === 'drive' ? 'drive-links-list' : 'ref-links-list');
  container.innerHTML = arr.map((url, i) => `
    <div style="display:flex;gap:6px;margin-bottom:6px;align-items:center;">
      <input type="url" class="form-control" value="${url}" placeholder="https://drive.google.com/..." oninput="updateDriveLink('${type}',${i},this.value)" style="flex:1;">
      ${url ? `<a href="${url}" target="_blank" style="font-size:12px;color:var(--accent);white-space:nowrap;text-decoration:none;" title="Abrir">↗</a>` : ''}
      <button type="button" onclick="removeDriveLink('${type}',${i})" style="background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px;line-height:1;padding:0 2px;" title="Quitar">×</button>
    </div>
  `).join('');
}

window.addDriveLink = function(type) {
  if (type === 'drive') _driveLinks.push('');
  else _refLinks.push('');
  renderDriveLinks(type);
};
window.updateDriveLink = function(type, idx, val) {
  if (type === 'drive') _driveLinks[idx] = val;
  else _refLinks[idx] = val;
};
window.removeDriveLink = function(type, idx) {
  if (type === 'drive') _driveLinks.splice(idx, 1);
  else _refLinks.splice(idx, 1);
  renderDriveLinks(type);
};

// Image paste/upload
let _imgList = [];

function renderImgThumbs() {
  const wrap = document.getElementById('img-thumbnails');
  if (!wrap) return;
  wrap.innerHTML = _imgList.map((item, i) => {
    const f = typeof item === 'string' ? { src: item, name: '', isImage: true } : item;
    const preview = f.isImage
      ? `<img src="${f.src}" style="width:72px;height:72px;object-fit:cover;border-radius:6px;">`
      : `<div style="width:72px;height:72px;border-radius:6px;background:#f1f5f9;display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:10px;color:#64748b;padding:4px;text-align:center;overflow:hidden;"><span style="font-size:24px;">📄</span><span style="margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;width:100%;">${f.name}</span></div>`;
    return `<div style="position:relative;">${preview}<button type="button" onclick="removeImg(${i})" style="position:absolute;top:-6px;right:-6px;background:#E02020;color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center;">×</button></div>`;
  }).join('');
  const ph = document.querySelector('.img-paste-placeholder');
  if (ph) ph.style.display = _imgList.length ? 'none' : '';
}

window.removeImg = function(i) { _imgList.splice(i, 1); renderImgThumbs(); };

function addImgFromFile(file) {
  if (!file) return;
  const MAX = 50 * 1024 * 1024; // 50 MB
  if (file.size > MAX) {
    alert(`"${file.name}" pesa más de 50 MB. Subilo a Google Drive y pegá el link en el campo de Drive.`);
    return;
  }
  const reader = new FileReader();
  const isImage = file.type.startsWith('image/');
  reader.onload = e => {
    _imgList.push({ src: e.target.result, name: file.name, isImage });
    renderImgThumbs();
  };
  reader.readAsDataURL(file);
}

// Populate cuenta select from client data
function populateCuentaSelect(selected) {
  const sel = document.getElementById('cf-cuenta');
  sel.innerHTML = '<option value="">Seleccionar cuenta...</option>';
  const accounts = [];
  if (STATE.client.instagram) accounts.push({ label: `Instagram: @${STATE.client.instagram}`, val: STATE.client.instagram });
  if (STATE.client.facebook) accounts.push({ label: `Facebook: ${STATE.client.facebook}`, val: STATE.client.facebook });
  if (STATE.client.youtube) accounts.push({ label: `YouTube: ${STATE.client.youtube}`, val: STATE.client.youtube });
  if (STATE.client.tiktok) accounts.push({ label: `TikTok: @${STATE.client.tiktok}`, val: STATE.client.tiktok });
  if (!accounts.length) accounts.push({ label: STATE.client.nombre || STATE.client.name || clientId, val: STATE.client.nombre || clientId });
  accounts.push({ label: 'Multicuenta', val: 'multicuenta' });
  accounts.push({ label: 'Otra / personalizar...', val: '__custom__' });
  accounts.forEach(a => {
    const opt = document.createElement('option');
    opt.value = a.val; opt.textContent = a.label;
    sel.appendChild(opt);
  });
  if (selected) sel.value = selected;
  const customInput = document.getElementById('cf-cuenta-custom');
  sel.onchange = () => {
    customInput.style.display = sel.value === '__custom__' ? '' : 'none';
    if (sel.value === '__custom__') customInput.focus();
  };
  customInput.style.display = (selected && !accounts.find(a => a.val === selected)) ? '' : 'none';
}

window.openContenidoModal = function(defaults = {}) {
  defaults = defaults || {};
  editingContenido = defaults?.id ? STATE.contenidos.find(c => c.id === defaults.id) : null;
  const c = editingContenido || {};

  document.getElementById('modal-cont-title').textContent = editingContenido ? 'Editar contenido' : 'Nuevo contenido';
  document.getElementById('cf-titulo').value = c.titulo || '';
  document.getElementById('cf-fecha').value = c.fechaPub || defaults.fechaPub || '';
  document.getElementById('cf-estado').value = c.estado || defaults.estado || 'Idea';
  document.getElementById('cf-eje').value = c.eje || 'Institucional';
  document.getElementById('cf-tipo').value = c.tipo || 'Informativo';
  document.getElementById('cf-objetivo').value = c.objetivo || 'Notoriedad';
  document.getElementById('cf-copy').value = c.copy || '';
  document.getElementById('cf-notas').value = c.notas || '';
  setTimeout(() => {
    const df = document.getElementById('cf-duracion');
    if (df) df.value = c.duracion || '';
    updateDuracionVisibility();
  }, 80);

  // Cuenta
  populateCuentaSelect(c.cuenta || STATE.client.instagram || '');

  // Plataformas
  document.querySelectorAll('.plat-check').forEach(cb => {
    cb.checked = (c.plataformas || defaults.plataformas || []).includes(cb.value);
  });
  updatePlatFilters();

  // Ubicacion & Formato — set after filters rendered
  const ubicArr = Array.isArray(c.ubicacion) ? c.ubicacion : (c.ubicacion ? [c.ubicacion] : defaults.ubicacion || []);
  const fmtArr = Array.isArray(c.formato) ? c.formato : (c.formato ? [c.formato] : []);
  setTimeout(() => {
    document.querySelectorAll('.ubic-check').forEach(cb => cb.checked = ubicArr.includes(cb.value));
    document.querySelectorAll('.fmt-check').forEach(cb => cb.checked = fmtArr.includes(cb.value));
  }, 30);

  // Dimensiones
  const dimArr = Array.isArray(c.dimensiones) ? c.dimensiones : [];
  document.querySelectorAll('.dim-check').forEach(cb => cb.checked = dimArr.includes(cb.value));

  // Pauta
  const pautaVal = c.pauta || 'organico';
  const pautaRadio = document.querySelector(`input[name="cf-pauta"][value="${pautaVal}"]`);
  if (pautaRadio) pautaRadio.checked = true;
  document.getElementById('pauta-hint').style.display = pautaVal !== 'organico' ? '' : 'none';

  // Multiple links
  _driveLinks = Array.isArray(c.linkDrive) ? [...c.linkDrive] : (c.linkDrive ? [c.linkDrive] : []);
  _refLinks = Array.isArray(c.linkDriveRef) ? [...c.linkDriveRef] : (c.linkDriveRef ? [c.linkDriveRef] : []);
  renderDriveLinks('drive');
  renderDriveLinks('ref');

  // Images
  _imgList = Array.isArray(c.imagenes) ? [...c.imagenes] : [];
  renderImgThumbs();

  const contAsignado = document.getElementById('cont-asignado');
  if (contAsignado) contAsignado.innerHTML = getAsignarOptions(c.asignado?.email || '');
  renderAsignadoVisto('cont-asignado', c);
  if (editingContenido) marcarAsignacionVista(c, saveContenido, STATE.contenidos).then(() => renderAsignadoVisto('cont-asignado', c));

  document.getElementById('deleteContenidoBtn').style.display = editingContenido ? '' : 'none';
  const archBtn = document.getElementById('archiveContenidoBtn');
  archBtn.style.display = editingContenido ? '' : 'none';
  archBtn.textContent = c.archivado ? 'Restaurar' : 'Archivar';
  renderComments('cont', c.comentarios || []);
  document.getElementById('cont-comment-input').value = '';
  const _cnote = document.getElementById('cont-new-note');
  if (_cnote) _cnote.style.display = editingContenido ? 'none' : '';
  const _cinputWrap = document.getElementById('cont-comment-input-wrap');
  if (_cinputWrap) _cinputWrap.style.display = editingContenido ? '' : 'none';
  document.getElementById('contenidoModal').classList.remove('hidden');
};

window.openContenidoModalById = function(id) { openContenidoModal({ id }); };

function closeContenidoModal() { document.getElementById('contenidoModal').classList.add('hidden'); }
document.getElementById('closeContenidoModal').addEventListener('click', closeContenidoModal);
document.getElementById('closeContenidoModal2').addEventListener('click', closeContenidoModal);

// Platform checkboxes → update formats
document.getElementById('plat-checks').addEventListener('change', () => { updatePlatFilters(); updateDuracionVisibility(); });

function updateDuracionVisibility() {
  setTimeout(() => {
    const videoFormats = ['Reel','Video','TikTok','Story','YouTube','Short'];
    const hasVideo = Array.from(document.querySelectorAll('.fmt-check:checked')).some(cb => videoFormats.some(v => cb.value.includes(v)));
    const g = document.getElementById('cf-duracion-group');
    if (g) g.style.display = hasVideo ? '' : 'none';
  }, 60);
}

// Pauta radios → show/hide hint
document.querySelectorAll('input[name="cf-pauta"]').forEach(r => {
  r.addEventListener('change', () => {
    document.getElementById('pauta-hint').style.display = r.value !== 'organico' ? '' : 'none';
  });
});

// Image paste & file pick — upload via button onclick in HTML, paste via Ctrl+V listener below
document.getElementById('img-file-input').addEventListener('change', e => {
  [...e.target.files].forEach(addImgFromFile);
  e.target.value = '';
});
document.addEventListener('paste', e => {
  const contenidoOpen = !document.getElementById('contenidoModal').classList.contains('hidden');
  const tareaOpen = !document.getElementById('tareaModal').classList.contains('hidden');
  if (!contenidoOpen && !tareaOpen) return;
  // Si el foco está en el editor RTE de tarea, dejar que el navegador maneje el paste de texto
  if (tareaOpen && document.activeElement && document.activeElement.id === 'tf-notas') {
    const items = e.clipboardData?.items || [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        addTareaImgFromFile(item.getAsFile());
        return;
      }
    }
    return; // texto normal: el browser lo inserta solo
  }
  const items = e.clipboardData?.items || [];
  for (const item of items) {
    if (item.type.startsWith('image/')) {
      e.preventDefault();
      if (contenidoOpen) addImgFromFile(item.getAsFile());
      else addTareaImgFromFile(item.getAsFile());
      return;
    }
  }
});

document.getElementById('saveContenidoBtn').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  if (btn.disabled) return;
  const titulo = document.getElementById('cf-titulo').value.trim();
  if (!titulo) { alert('El título es obligatorio.'); document.getElementById('cf-titulo').focus(); return; }

  const cuentaSel = document.getElementById('cf-cuenta');
  const cuentaCustom = document.getElementById('cf-cuenta-custom');
  const cuenta = cuentaSel.value === '__custom__' ? cuentaCustom.value.trim() : cuentaSel.value;
  if (!cuenta) { alert('Seleccioná o ingresá una cuenta.'); cuentaSel.focus(); return; }

  const plats = Array.from(document.querySelectorAll('.plat-check:checked')).map(cb => cb.value);
  if (!plats.length) { alert('Seleccioná al menos una plataforma.'); return; }

  const formatos = Array.from(document.querySelectorAll('.fmt-check:checked')).map(cb => cb.value);
  if (!formatos.length) { alert('Seleccioná al menos un formato.'); return; }
  btn.disabled = true; btn.textContent = 'Guardando…';

  const ubicacion = Array.from(document.querySelectorAll('.ubic-check:checked')).map(cb => cb.value);
  const dimensiones = Array.from(document.querySelectorAll('.dim-check:checked')).map(cb => cb.value);
  const pauta = document.querySelector('input[name="cf-pauta"]:checked')?.value || 'organico';
  const contAsignadoEl = document.getElementById('cont-asignado');
  const contAsignadoEmail = contAsignadoEl ? contAsignadoEl.value : '';
  const contAsignadoNombre = contAsignadoEl ? (contAsignadoEl.selectedOptions[0]?.dataset.nombre || '') : '';
  const prevContAsignadoEmail = editingContenido?.asignado?.email || '';

  const obj = {
    ...(editingContenido || {}),
    titulo,
    fechaPub: document.getElementById('cf-fecha').value,
    estado: document.getElementById('cf-estado').value,
    cuenta,
    plataformas: plats,
    ubicacion,
    formato: formatos,
    dimensiones,
    eje: document.getElementById('cf-eje').value,
    tipo: document.getElementById('cf-tipo').value,
    objetivo: document.getElementById('cf-objetivo').value,
    copy: document.getElementById('cf-copy').value,
    pauta,
    linkDrive: _driveLinks.filter(Boolean),
    linkDriveRef: _refLinks.filter(Boolean),
    imagenes: _imgList,
    notas: document.getElementById('cf-notas').value,
    comentarios: editingContenido?.comentarios || [],
    asignado: contAsignadoEmail ? (contAsignadoEmail === prevContAsignadoEmail
      ? { ...editingContenido.asignado, email: contAsignadoEmail, nombre: contAsignadoNombre }
      : { email: contAsignadoEmail, nombre: contAsignadoNombre, asignadoPor: { email: user.email, nombre: user.name || user.email } }) : null,
  };

  try {
    const saved = await saveContenido(clientId, obj);
    if (editingContenido) {
      const i = STATE.contenidos.findIndex(c => c.id === saved.id);
      STATE.contenidos[i] = saved;
    } else {
      STATE.contenidos.push(saved);
    }
    notifyAsignacion('contenido', saved, prevContAsignadoEmail);
    closeContenidoModal();
    renderContTab(activeContTab);
    if (currentSection === 'home') renderSection('home');
  } finally {
    const b = document.getElementById('saveContenidoBtn');
    if (b) { b.disabled = false; b.textContent = 'Guardar'; }
  }
});

document.getElementById('deleteContenidoBtn').addEventListener('click', async () => {
  if (!editingContenido || !confirm('¿Eliminar este contenido?')) return;
  await deleteContenido(clientId, editingContenido.id);
  STATE.contenidos = STATE.contenidos.filter(c => c.id !== editingContenido.id);
  closeContenidoModal();
  renderContTab(activeContTab);
});
document.getElementById('archiveContenidoBtn').addEventListener('click', async () => {
  if (!editingContenido) return;
  editingContenido.archivado = !editingContenido.archivado;
  const saved = await saveContenido(clientId, editingContenido);
  const i = STATE.contenidos.findIndex(c => c.id === editingContenido.id);
  if (i > -1) STATE.contenidos[i] = saved;
  closeContenidoModal();
  renderContTab(activeContTab);
});

window.desarchivarContenido = async function(id) {
  const c = STATE.contenidos.find(x => x.id === id);
  if (!c) return;
  c.archivado = false;
  const saved = await saveContenido(clientId, c);
  const i = STATE.contenidos.findIndex(x => x.id === id);
  if (i > -1) STATE.contenidos[i] = saved;
  renderContTab(activeContTab);
};

window.eliminarContenidoDirecto = async function(id) {
  if (!confirm('¿Eliminar este contenido?')) return;
  await deleteContenido(clientId, id);
  STATE.contenidos = STATE.contenidos.filter(c => c.id !== id);
  renderContTab(activeContTab);
};

// ──────────────────────────────────────────────────────
// IMPORTAR CONTENIDOS DESDE EXCEL
// ──────────────────────────────────────────────────────
const IMPORT_ESTADOS = ['Idea', 'En proceso', 'En revisión', 'Aprobado', 'Programado', 'Publicado'];
const IMPORT_PAUTA_MAP = {
  'solo organico': 'organico',
  'si dark post': 'dark',
  'si dark + organico': 'dark-organico',
  'si dark organico': 'dark-organico',
  organico: 'organico',
  dark: 'dark',
  'dark-organico': 'dark-organico',
};
// header normalizado (sin acentos, minúscula) -> campo del contenido
const IMPORT_HEADER_MAP = {
  'titulo del contenido': 'titulo',
  titulo: 'titulo',
  'fecha de publicacion': 'fechaPub',
  fecha: 'fechaPub',
  estado: 'estado',
  cuenta: 'cuenta',
  plataformas: 'plataformas',
  plataforma: 'plataformas',
  ubicacion: 'ubicacion',
  formato: 'formato',
  dimensiones: 'dimensiones',
  dimension: 'dimensiones',
  'eje de comunicacion': 'eje',
  eje: 'eje',
  'tipo de contenido': 'tipo',
  tipo: 'tipo',
  objetivo: 'objetivo',
  'copy / texto del post': 'copy',
  'copy texto del post': 'copy',
  copy: 'copy',
  pauta: 'pauta',
  'link pieza terminada': 'linkDrive',
  'link material de referencia': 'linkDriveRef',
  'notas internas': 'notas',
  notas: 'notas',
};

const ACCENT_MAP = { á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ñ: 'n', ü: 'u' };

function normalizeHeader(h) {
  return String(h || '')
    .toLowerCase()
    .replace(/[áéíóúñü]/g, ch => ACCENT_MAP[ch] || ch)
    .replace(/[^a-z0-9/ ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function importParseFecha(val) {
  if (!val) return '';
  if (val instanceof Date) {
    const y = val.getFullYear(), m = String(val.getMonth() + 1).padStart(2, '0'), d = String(val.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const s = String(val).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
  return s;
}

function importSplitMulti(val) {
  if (!val) return [];
  return String(val).split(',').map(s => s.trim()).filter(Boolean);
}

function importParsePauta(val) {
  const norm = normalizeHeader(val).replace(/–|—/g, '-');
  return IMPORT_PAUTA_MAP[norm] || 'organico';
}

let _importRows = []; // filas parseadas y válidas, listas para importar

function openImportModal() {
  _importRows = [];
  document.getElementById('import-file-input').value = '';
  document.getElementById('import-status').textContent = '';
  document.getElementById('import-preview').innerHTML = '';
  document.getElementById('confirmImportBtn').disabled = true;
  document.getElementById('importContenidoModal').classList.remove('hidden');
  loadXLSXLib();
}
window.openImportModal = openImportModal;

let _xlsxLoadPromise = null;
function loadXLSXLib() {
  if (window.XLSX) return Promise.resolve();
  if (_xlsxLoadPromise) return _xlsxLoadPromise;
  _xlsxLoadPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://unpkg.com/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
  return _xlsxLoadPromise;
}

function closeImportModal() {
  document.getElementById('importContenidoModal').classList.add('hidden');
}
document.getElementById('closeImportModal').addEventListener('click', closeImportModal);
document.getElementById('closeImportModal2').addEventListener('click', closeImportModal);

document.getElementById('import-file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const statusEl = document.getElementById('import-status');
  const previewEl = document.getElementById('import-preview');
  const confirmBtn = document.getElementById('confirmImportBtn');
  previewEl.innerHTML = '';
  confirmBtn.disabled = true;
  _importRows = [];
  if (!file) return;

  statusEl.textContent = 'Leyendo archivo…';
  try {
    await loadXLSXLib();
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const sheetName = wb.SheetNames.find(n => normalizeHeader(n) === 'contenidos') || wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!raw.length) { statusEl.textContent = 'El archivo no tiene filas.'; return; }

    const headerRow = raw[0].map(normalizeHeader);
    const fieldByCol = headerRow.map(h => IMPORT_HEADER_MAP[h] || null);

    const valid = [];
    const errores = [];
    for (let r = 1; r < raw.length; r++) {
      const dataRow = raw[r];
      if (!dataRow || dataRow.every(v => v === '' || v == null)) continue; // fila vacía
      const obj = {};
      fieldByCol.forEach((field, ci) => {
        if (field) obj[field] = dataRow[ci];
      });

      const titulo = String(obj.titulo || '').trim();
      const cuenta = String(obj.cuenta || '').trim();
      const plataformas = importSplitMulti(obj.plataformas);
      const formato = importSplitMulti(obj.formato);

      if (!titulo || !cuenta || !plataformas.length || !formato.length) {
        errores.push(`Fila ${r + 1}: faltan datos obligatorios (título, cuenta, plataformas o formato).`);
        continue;
      }

      const estadoRaw = String(obj.estado || '').trim();
      const estado = IMPORT_ESTADOS.includes(estadoRaw) ? estadoRaw : 'Idea';

      valid.push({
        titulo,
        fechaPub: importParseFecha(obj.fechaPub),
        estado,
        cuenta,
        plataformas,
        ubicacion: importSplitMulti(obj.ubicacion),
        formato,
        dimensiones: importSplitMulti(obj.dimensiones),
        eje: String(obj.eje || '').trim(),
        tipo: String(obj.tipo || '').trim(),
        objetivo: String(obj.objetivo || '').trim(),
        copy: String(obj.copy || '').trim(),
        pauta: importParsePauta(obj.pauta),
        linkDrive: importSplitMulti(obj.linkDrive),
        linkDriveRef: importSplitMulti(obj.linkDriveRef),
        notas: String(obj.notas || '').trim(),
        comentarios: [],
        asignado: null,
      });
    }

    _importRows = valid;
    statusEl.textContent = `${valid.length} contenido(s) listos para importar${errores.length ? ` · ${errores.length} fila(s) con error` : ''}.`;

    previewEl.innerHTML = `
      ${valid.length ? `<div class="table-wrapper table-scroll-wrap"><table class="data-table">
        <thead><tr><th>Fecha</th><th>Título</th><th>Plataformas</th><th>Estado</th><th>Cuenta</th></tr></thead>
        <tbody>
          ${valid.map(c => `<tr><td>${c.fechaPub || '—'}</td><td>${c.titulo}</td><td>${c.plataformas.join(', ')}</td><td>${c.estado}</td><td>${c.cuenta}</td></tr>`).join('')}
        </tbody>
      </table></div>` : ''}
      ${errores.length ? `<div style="margin-top:10px;padding:10px 12px;background:#fef2f2;border-radius:6px;font-size:12px;color:#991b1b;">${errores.join('<br>')}</div>` : ''}
    `;
    confirmBtn.disabled = !valid.length;
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'No se pudo leer el archivo. Verificá que sea un .xlsx válido.';
  }
});

document.getElementById('confirmImportBtn').addEventListener('click', async () => {
  if (!_importRows.length) return;
  const btn = document.getElementById('confirmImportBtn');
  btn.disabled = true; btn.textContent = 'Importando…';
  try {
    const saved = await saveContenidosBulk(clientId, _importRows);
    STATE.contenidos.push(...saved);
    closeImportModal();
    renderContTab(activeContTab);
    if (currentSection === 'home') renderSection('home');
  } catch (err) {
    console.error(err);
    alert('Hubo un error al importar. Probá de nuevo.');
  } finally {
    btn.disabled = false; btn.textContent = 'Importar';
  }
});

window.toggleTareaVisibleCliente = async function(id) {
  if (user.role === 'client') return; // el cliente no puede tocar esto
  const t = STATE.tareas.find(x => x.id === id);
  if (!t) return;
  t.visibleParaCliente = t.visibleParaCliente === true ? false : true;
  const saved = await saveTarea(clientId, t);
  const i = STATE.tareas.findIndex(x => x.id === id);
  STATE.tareas[i] = saved;
  refreshTareasView();
  if (currentSection === 'home') renderSection('home');
};

window.toggleTareaListo = async function(id) {
  const t = STATE.tareas.find(x => x.id === id);
  if (!t) return;
  t.estado = t.estado === 'Listo' ? 'Sin empezar' : 'Listo';
  if (t.estado === 'Listo') { t.visibleParaCliente = true; t.completadoEn = new Date().toISOString().split('T')[0]; } // al terminarla, el cliente la puede ver
  else t.completadoEn = null;
  const saved = await saveTarea(clientId, t);
  const i = STATE.tareas.findIndex(x => x.id === id);
  STATE.tareas[i] = saved;
  updateBadges();
  refreshTareasView();
  if (currentSection === 'home') renderSection('home');
};

// ──────────────────────────────────────────────────────
// TAREAS
// ──────────────────────────────────────────────────────
function refreshTareasView() {
  const el = document.getElementById('main-content');
  if (!el) return;
  if (_tareasView === 'calendario') renderTareasCalendario(el);
  else renderTareas(el);
}

function renderTareas(container) {
  const cols = [
    { key: 'Sin empezar', label: 'Sin empezar', color: '#94a3b8' },
    { key: 'En progreso', label: 'En progreso', color: '#3b82f6' },
    { key: 'Listo', label: 'Listo', color: '#10b981' },
  ];
  let tareasBase = tareasVisibles(STATE.tareas);
  if (_tareasBusqueda) tareasBase = tareasBase.filter(t => (t.titulo || '').toLowerCase().includes(_tareasBusqueda));
  if (_tareasFiltroAsignado) tareasBase = tareasBase.filter(t =>
    _tareasFiltroAsignado === '_sin_asignar' ? !t.asignado?.email : t.asignado?.email === _tareasFiltroAsignado);
  const archivadas = tareasBase.filter(t => t.archivado);

  container.innerHTML = `<div class="kanban-board" id="kanban-tareas">${cols.map(col => {
    const items = tareasBase.filter(t => t.estado === col.key && !t.archivado);
    return `
      <div class="kanban-col" data-col="${col.key}" style="flex:1;max-width:none;">
        <div class="kanban-col-header">
          <span class="kanban-col-dot" style="background:${col.color};"></span>
          <span class="col-title">${col.label}</span>
          <span class="col-count">${items.length}</span>
        </div>
        <div class="kanban-cards" data-col="${col.key}">
          ${items.map(t => {
            const esProy = !!t.esProyecto;
            const muted = esProy ? 'rgba(255,255,255,.75)' : 'var(--text-muted)';
            const vencido = t.vencimiento && new Date(t.vencimiento+'T00:00:00') < new Date() && t.estado !== 'Listo';
            const vencColor = vencido ? (esProy ? '#fecdd3' : '#dc2626') : muted;
            return `
            <div class="kanban-card" draggable="true" data-id="${t.id}" onclick="if(!this._dragged)openTareaModal('${t.id}')" ondragstart="this._dragged=true" ondragend="setTimeout(()=>{this._dragged=false},200)" style="${esProy ? 'background:var(--primary-dark);border-color:var(--primary-dark);' : ''}">
              <div style="display:flex;align-items:flex-start;gap:8px;">
                <button onclick="event.stopPropagation();toggleTareaListo('${t.id}')" title="${t.estado === 'Listo' ? 'Marcar como no hecha' : 'Marcar como hecha'}" style="flex-shrink:0;margin-top:2px;width:18px;height:18px;border-radius:50%;border:2px solid ${t.estado === 'Listo' ? '#10b981' : '#cbd5e1'};background:${t.estado === 'Listo' ? '#10b981' : 'transparent'};color:#fff;font-size:11px;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;">${t.estado === 'Listo' ? '✓' : ''}</button>
                <div class="kanban-card-title" style="${t.estado === 'Listo' ? `text-decoration:line-through;color:${muted};` : (esProy ? 'color:#fff;' : '')}">${esProy ? '🔷 ' : ''}${t.numero ? `<span style="color:${muted};font-weight:400;">#${codigoTarea(t)}</span> ` : ''}${t.titulo}</div>
              </div>
              ${t.prioridad ? `<div style="margin-top:4px;"><span style="font-size:10px;padding:2px 7px;border-radius:10px;background:${t.prioridad==='Alta'?'#fee2e2':t.prioridad==='Media'?'#fff7ed':'#f1f5f9'};color:${t.prioridad==='Alta'?'#dc2626':t.prioridad==='Media'?'#b45309':'#64748b'};font-weight:700;">${t.prioridad}</span></div>` : ''}
              ${t.vencimiento ? `<div style="font-size:11px;margin-top:4px;color:${vencColor};">📅 Vence: ${fmtDate(t.vencimiento)}${t.hora ? ` · ${t.hora}` : ''}</div>` : ''}
              ${t.notas ? `<div style="font-size:11px;color:${muted};margin-top:4px;">${t.notas}</div>` : ''}
              ${t.recurrencia ? `<div style="font-size:10px;margin-top:4px;"><span style="padding:2px 7px;background:#fef9c3;color:#a16207;border-radius:10px;font-weight:600;">↻ ${t.recurrencia}</span></div>` : ''}
              ${t.linkRef ? `<a href="${t.linkRef}" target="_blank" onclick="event.stopPropagation();" style="font-size:10px;color:${esProy ? '#93c5fd' : 'var(--accent)'};display:block;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;">🔗 ${t.linkRef}</a>` : ''}
              ${t.subtareas?.length ? (() => {
                const done = t.subtareas.filter(s=>s.done).length;
                const total = t.subtareas.length;
                const pct = Math.round(done/total*100);
                return `<div style="margin-top:6px;">
                  <div style="display:flex;justify-content:space-between;font-size:10px;color:${muted};margin-bottom:3px;"><span>${done}/${total} subtareas</span><span>${pct}%</span></div>
                  <div style="height:3px;background:${esProy ? 'rgba(255,255,255,.25)' : '#e2e8f0'};border-radius:2px;"><div style="height:3px;background:${esProy ? '#60a5fa' : '#10b981'};border-radius:2px;width:${pct}%;"></div></div>
                </div>`;
              })() : ''}
              <div style="display:flex;gap:4px;margin-top:8px;">
                <button class="btn btn-secondary btn-sm" onclick="openTareaModal('${t.id}')">Editar</button>
                ${user.role !== 'client' ? `<button class="btn btn-secondary btn-sm" onclick="event.stopPropagation();toggleTareaVisibleCliente('${t.id}')" title="${t.visibleParaCliente === true ? 'Visible para el cliente — click para ocultarla (tarea interna)' : 'Tarea interna — el cliente no la ve. Click para mostrársela.'}">${t.visibleParaCliente === true ? '👁' : '🔒'}</button>` : ''}
                <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();eliminarTareaDirecta('${t.id}')" title="Eliminar">×</button>
              </div>
            </div>
          `;}).join('')}
        </div>
        <button class="kanban-add-btn" onclick="openTareaModal(null,'${col.key}')">+ Agregar</button>
      </div>
    `;
  }).join('')}</div>
  ${archivadas.length ? `
    <div style="margin-top:24px;">
      <button class="btn btn-secondary btn-sm" onclick="this.nextElementSibling.classList.toggle('hidden');this.textContent=this.textContent.includes('Ver')?'▲ Ocultar archivadas':'▼ Ver archivadas (${archivadas.length})'">▼ Ver archivadas (${archivadas.length})</button>
      <div class="hidden" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px;">
        ${archivadas.map(t => `
          <div class="card" style="padding:10px 14px;opacity:0.7;min-width:200px;">
            <div style="font-size:13px;font-weight:600;margin-bottom:4px;">📦 ${t.titulo}</div>
            <div style="display:flex;gap:4px;margin-top:6px;">
              <button class="btn btn-secondary btn-sm" onclick="desarchivarTarea('${t.id}')">Restaurar</button>
              <button class="btn btn-danger btn-sm" onclick="eliminarTareaDirecta('${t.id}')">🗑</button>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  ` : ''}`;

  initKanbanDrag('#kanban-tareas', STATE.tareas.filter(t => !t.archivado), async (id, newCol) => {
    const t = STATE.tareas.find(x => x.id === id);
    if (!t || t.estado === newCol) return;
    t.estado = newCol;
    if (newCol === 'Listo') { t.visibleParaCliente = true; t.completadoEn = new Date().toISOString().split('T')[0]; }
    else t.completadoEn = null;
    updateBadges();
    refreshTareasView();
    saveTarea(clientId, t).catch(() => {});
  });
}

function renderTareasCalendario(container) {
  const hoy = new Date();
  let viewYear = hoy.getFullYear(), viewMonth = hoy.getMonth();
  let tareasBase = tareasVisibles(STATE.tareas).filter(t => !t.archivado);
  if (_tareasBusqueda) tareasBase = tareasBase.filter(t => (t.titulo || '').toLowerCase().includes(_tareasBusqueda));
  if (_tareasFiltroAsignado) tareasBase = tareasBase.filter(t =>
    _tareasFiltroAsignado === '_sin_asignar' ? !t.asignado?.email : t.asignado?.email === _tareasFiltroAsignado);

  function drawCal() {
    const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrev = new Date(viewYear, viewMonth, 0).getDate();

    let cells = '';
    let day = 1;
    let nextDay = 1;
    const totalCells = Math.ceil((firstDay + daysInMonth) / 7) * 7;

    for (let i = 0; i < totalCells; i++) {
      let cellDate, isOther = false;
      if (i < firstDay) { cellDate = new Date(viewYear, viewMonth - 1, daysInPrev - firstDay + i + 1); isOther = true; }
      else if (day > daysInMonth) { cellDate = new Date(viewYear, viewMonth + 1, nextDay++); isOther = true; }
      else { cellDate = new Date(viewYear, viewMonth, day++); }

      const dateStr = cellDate.toISOString().split('T')[0];
      const isToday = dateStr === hoy.toISOString().split('T')[0];
      const dayProyectos = tareasBase.filter(t => t.esProyecto && t.fechaInicio && t.vencimiento && dateStr >= t.fechaInicio && dateStr <= t.vencimiento);
      const dayTareas = tareasBase.filter(t => !t.esProyecto && t.vencimiento === dateStr);

      cells += `<div class="cal-day${isOther ? ' other-month' : ''}${isToday ? ' today' : ''}">
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <div class="cal-day-num">${cellDate.getDate()}</div>
          ${!isOther ? `<button onclick="openTareaModal(null)" style="background:none;border:none;color:#cbd5e1;cursor:pointer;font-size:16px;line-height:1;padding:0 4px;border-radius:3px;" title="Nueva tarea" onmouseover="this.style.color='var(--primary)'" onmouseout="this.style.color='#cbd5e1'">+</button>` : ''}
        </div>
        ${dayProyectos.map(t => `
          <div class="cal-event" style="background:var(--primary-dark);color:#fff;font-weight:600;${t.estado === 'Listo' ? 'text-decoration:line-through;opacity:.6;' : ''}"
               onclick="openTareaModal('${t.id}')" title="${t.titulo}">
            🔷 ${t.numero ? `#${codigoTarea(t)} ` : ''}${t.titulo}
          </div>
        `).join('')}
        ${dayTareas.map(t => `
          <div class="cal-event" style="background:#3b82f622;color:#3b82f6;${t.estado === 'Listo' ? 'text-decoration:line-through;opacity:.6;' : ''}"
               onclick="openTareaModal('${t.id}')" title="${t.titulo}">
            ✅ ${t.numero ? `#${codigoTarea(t)} ` : ''}${t.titulo}
          </div>
        `).join('')}
      </div>`;
    }

    container.innerHTML = `
      <div class="card">
        <div class="card-body">
          <div class="cal-nav">
            <button class="cal-btn" id="cal-tareas-prev">‹</button>
            <div class="cal-month">${monthName.charAt(0).toUpperCase()+monthName.slice(1)}</div>
            <button class="cal-btn" id="cal-tareas-next">›</button>
          </div>
          <div class="cal-grid">
            ${['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map(d => `<div class="cal-day-header">${d}</div>`).join('')}
            ${cells}
          </div>
        </div>
      </div>
    `;
    document.getElementById('cal-tareas-prev').onclick = () => { if (--viewMonth < 0) { viewMonth=11; viewYear--; } drawCal(); };
    document.getElementById('cal-tareas-next').onclick = () => { if (++viewMonth > 11) { viewMonth=0; viewYear++; } drawCal(); };
  }
  drawCal();
}

// ── Rich Text Editor helpers ──
let _tareaImgList = [];
let _tareaSubtareasPendientes = [];
let _tareaArchivosPendientes = []; // ids de STATE.home.archivos adjuntados a esta tarea

window.rteCmd = function(cmd) {
  if (/^h[1-3]$/.test(cmd)) {
    document.getElementById('tf-notas').focus();
    document.execCommand('formatBlock', false, cmd);
    return;
  }
  document.getElementById('tf-notas').focus();
  document.execCommand(cmd, false, null);
};

window.rteColor = function(color) {
  document.getElementById('tf-notas').focus();
  document.execCommand('foreColor', false, color);
};

function renderTareaImgThumbs() {
  const container = document.getElementById('tarea-img-thumbs');
  if (!container) return;
  container.innerHTML = _tareaImgList.map((src, i) => `
    <div style="position:relative;display:inline-block;">
      <img src="${src}" style="width:72px;height:72px;object-fit:cover;border-radius:6px;border:1px solid var(--border);">
      <button onclick="removeTareaImg(${i})" style="position:absolute;top:-6px;right:-6px;background:#ef4444;color:#fff;border:none;border-radius:50%;width:18px;height:18px;cursor:pointer;font-size:11px;line-height:18px;padding:0;">×</button>
    </div>
  `).join('');
}

window.removeTareaImg = function(i) {
  _tareaImgList.splice(i, 1);
  renderTareaImgThumbs();
};

function addTareaImgFromFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  if (_tareaImgList.length >= 3) { alert('M\u00e1ximo 3 im\u00e1genes por tarea.'); return; }
  if (file.size > 4 * 1024 * 1024) { alert('La imagen supera 4 MB. Sub\u00edla a Drive y peg\u00e1 el link.'); return; }
  const reader = new FileReader();
  reader.onload = e => { _tareaImgList.push(e.target.result); renderTareaImgThumbs(); };
  reader.readAsDataURL(file);
}

// \u2500\u2500 Archivos adjuntos de una tarea -- viven en STATE.home.archivos (la
// misma lista que "Links y Archivos"), ac\u00e1 solo se guarda el id. Subir un
// archivo lo guarda YA en Archivos (persiste al toque, no espera a que se
// guarde la tarea) -- as\u00ed queda centralizado y no duplicado por tarea.
function renderTareaArchivosChips() {
  const box = document.getElementById('tarea-archivos-list');
  if (!box) return;
  const archivos = STATE.home.archivos || [];
  box.innerHTML = _tareaArchivosPendientes.map((id, i) => {
    const a = archivos.find(x => String(x.id) === String(id));
    if (!a) return '';
    const abrir = a.subido ? `abrirArchivoSubido('${a.id}')` : `window.open('${(a.url || '').replace(/'/g, "\\'")}','_blank')`;
    return `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:#f8fafc;border:1px solid var(--border);border-radius:6px;">
      <i data-lucide="${ARCHIVO_ICONS[a.tipo] || 'file'}" style="width:14px;height:14px;color:var(--primary);flex-shrink:0;stroke-width:1.75;"></i>
      <span style="flex:1;font-size:12.5px;cursor:pointer;color:var(--primary);text-decoration:underline;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" onclick="${abrir}">${a.titulo}</span>
      <button type="button" onclick="quitarTareaArchivo(${i})" style="background:none;border:none;color:#cbd5e1;cursor:pointer;font-size:15px;padding:0 2px;flex-shrink:0;" title="Quitar de esta tarea (el archivo sigue en Links y Archivos)">\u00d7</button>
    </div>`;
  }).join('') || '<p style="font-size:12px;color:var(--text-muted);">Sin archivos adjuntos.</p>';
  setTimeout(refreshIcons, 30);
}

window.quitarTareaArchivo = function(i) {
  _tareaArchivosPendientes.splice(i, 1);
  renderTareaArchivosChips();
};

document.getElementById('tarea-archivo-input')?.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (file.size > 50 * 1024 * 1024) { alert('El archivo supera los 50 MB. Para archivos m\u00e1s pesados us\u00e1 un link de Drive/Dropbox desde "Links y Archivos".'); return; }
  try {
    const subido = await uploadArchivo(clientId, file);
    if (!STATE.home.archivos) STATE.home.archivos = [];
    const obj = {
      id: Date.now(), titulo: file.name, desc: '',
      tipo: tipoDesdeArchivo(subido.filename), subido: true,
      key: subido.key, filename: subido.filename, size: subido.size,
    };
    STATE.home.archivos.push(obj);
    await saveHomeData(clientId, STATE.home);
    _tareaArchivosPendientes.push(obj.id);
    renderTareaArchivosChips();
    if (currentSection === 'links') renderArchivos(document.getElementById('archivos-col-body'));
  } catch (err) {
    alert('Error al subir el archivo: ' + err.message);
  }
});

// Subir una carpeta entera desde una tarea -- mismo mecanismo que el botón
// de Links y Archivos (sube TODO a STATE.home.archivos, agrupado en una
// carpeta con el nombre elegido), pero además deja los accesos directos
// enganchados a esta tarea, igual que "Adjuntar archivo" con uno solo.
document.getElementById('tarea-archivo-folder-input')?.addEventListener('change', async (e) => {
  const files = [...e.target.files].filter(f => !f.name.startsWith('.'));
  e.target.value = '';
  if (!files.length) return;
  const folderName = (files[0].webkitRelativePath || files[0].name).split('/')[0] || 'Carpeta subida';
  const statusEl = document.getElementById('tarea-archivo-folder-status');
  if (!STATE.home.archivos) STATE.home.archivos = [];
  if (!STATE.home.archivoCarpetas) STATE.home.archivoCarpetas = [];
  if (!STATE.home.archivoCarpetas.includes(folderName)) STATE.home.archivoCarpetas.push(folderName);

  let ok = 0, saltados = 0;
  const nuevosIds = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (statusEl) statusEl.textContent = `Subiendo ${i + 1}/${files.length}: ${file.name}…`;
    if (file.size > 50 * 1024 * 1024) { saltados++; continue; }
    try {
      const subido = await uploadArchivo(clientId, file);
      const obj = {
        id: Date.now() + i, titulo: file.name, desc: '',
        tipo: tipoDesdeArchivo(subido.filename), subido: true,
        key: subido.key, filename: subido.filename, size: subido.size,
        carpeta: folderName,
      };
      STATE.home.archivos.push(obj);
      nuevosIds.push(obj.id);
      ok++;
    } catch (err) { saltados++; }
  }
  if (statusEl) statusEl.textContent = 'Guardando...';
  try {
    await saveHomeData(clientId, STATE.home);
  } catch (err) {
    alert('Se subieron los archivos pero no se pudo guardar la lista: ' + err.message);
  }
  _tareaArchivosPendientes.push(...nuevosIds);
  if (statusEl) statusEl.textContent = '';
  renderTareaArchivosChips();
  if (currentSection === 'links') renderArchivos(document.getElementById('archivos-col-body'));
  if (saltados) alert(`Se subieron ${ok} archivo${ok !== 1 ? 's' : ''}. ${saltados} se saltearon (pesan más de 50 MB o falló la subida).`);
});

window.openTareaModal = function(id, defaultEstado) {
  if (id && user.role === 'client') {
    const tCheck = STATE.tareas.find(t => t.id === id);
    if (tCheck && tCheck.visibleParaCliente !== true) return; // tarea interna (default), el cliente no puede abrirla
  }
  editingTarea = id ? STATE.tareas.find(t => t.id === id) : null;
  const t = editingTarea || {};
  document.getElementById('tarea-modal-title').textContent = editingTarea ? `Editar tarea${t.numero ? ' #' + codigoTarea(t) : ''}` : 'Nueva tarea';
  document.getElementById('tf-titulo').value = t.titulo || '';
  document.getElementById('tf-estado').value = t.estado || defaultEstado || 'Sin empezar';
  document.getElementById('tf-prioridad').value = t.prioridad || 'Media';
  document.getElementById('tf-vencimiento').value = t.vencimiento || '';
  document.getElementById('tf-hora').value = t.hora || '';
  document.getElementById('tf-notas').innerHTML = t.notas || '';
  const tfVisibleCliente = document.getElementById('tf-visible-cliente');
  if (tfVisibleCliente) {
    tfVisibleCliente.checked = t.visibleParaCliente === true;
    const wrap = tfVisibleCliente.closest('.form-group');
    if (wrap) wrap.style.display = user.role === 'client' ? 'none' : '';
  }
  const tfEsProyecto = document.getElementById('tf-es-proyecto');
  if (tfEsProyecto) tfEsProyecto.checked = t.esProyecto === true;
  document.getElementById('tf-fecha-inicio').value = t.fechaInicio || '';
  toggleTfEsProyecto();
  document.getElementById('tf-recurrencia').value = t.recurrencia || '';
  document.getElementById('tf-link').value = t.linkRef || '';
  // Imágenes
  _tareaImgList = t.imagenes ? [...t.imagenes] : [];
  renderTareaImgThumbs();
  // Archivos adjuntos (referencias a STATE.home.archivos, no el archivo en sí)
  _tareaArchivosPendientes = t.archivosAdjuntos ? [...t.archivosAdjuntos] : [];
  renderTareaArchivosChips();
  document.getElementById('deleteTareaBtn').style.display = editingTarea ? '' : 'none';
  document.getElementById('archiveTareaBtn').style.display = editingTarea ? '' : 'none';
  const tfAsignado = document.getElementById('tf-asignado');
  if (tfAsignado) tfAsignado.innerHTML = getAsignarOptions(t.asignado?.email || '');
  renderAsignadoVisto('tf-asignado', t);
  if (editingTarea) marcarAsignacionVista(t, saveTarea, STATE.tareas).then(() => renderAsignadoVisto('tf-asignado', t));

  // dias-semana
  const diasGroup = document.getElementById('dias-semana-group');
  diasGroup.style.display = (t.recurrencia === 'dias-semana') ? '' : 'none';
  document.querySelectorAll('.dia-check').forEach(cb => {
    cb.checked = (t.diasSemana || []).includes(cb.value);
  });

  // Subtareas — disponibles también al crear una tarea nueva
  document.getElementById('subtareas-section').style.display = '';
  const stAsignadoInput = document.getElementById('st-asignado-input');
  if (stAsignadoInput) stAsignadoInput.innerHTML = getAsignarOptions('');
  document.getElementById('st-titulo-input').value = '';
  _tareaSubtareasPendientes = t.subtareas ? [...t.subtareas] : [];
  renderSubtareas(_tareaSubtareasPendientes);

  renderComments('tarea', t.comentarios || []);
  document.getElementById('tarea-comment-input').value = '';
  const _tnote = document.getElementById('tarea-new-note');
  if (_tnote) _tnote.style.display = editingTarea ? 'none' : '';
  const _tinputWrap = document.getElementById('tarea-comment-input-wrap');
  if (_tinputWrap) _tinputWrap.style.display = editingTarea ? '' : 'none';
  const avisoBorrador = document.getElementById('tarea-borrador-aviso');
  if (avisoBorrador) avisoBorrador.style.display = 'none';
  document.getElementById('tareaModal').classList.remove('hidden');
  restaurarBorradorTarea(id || null);
};

// ── Borrador de tarea (localStorage) ─────────────────────────
// Título, descripción y el comentario que se esté escribiendo se pierden
// si se cierra el modal sin tocar "Guardar" -- Vaneh lo reportó
// explícitamente (02/09). No es un autoguardado real contra el servidor
// (eso ya existe para subtareas/archivos, ver más arriba); esto es un
// borrador LOCAL del navegador, para no perder lo tipeado si se cierra
// el modal sin querer o se aprieta "Cancelar".
function tareaDraftKey(id) { return `hub_draft_tarea_${clientId}_${id || 'nueva'}`; }

function guardarBorradorTarea() {
  const modal = document.getElementById('tareaModal');
  if (!modal || modal.classList.contains('hidden')) return;
  const draft = {
    titulo: document.getElementById('tf-titulo').value,
    notas: document.getElementById('tf-notas').innerHTML,
    comentario: document.getElementById('tarea-comment-input')?.value || '',
    // Las subtareas de una tarea EXISTENTE ya se autoguardan solas contra
    // el servidor apenas se tildan (ver toggleSubtarea) -- el servidor
    // manda. Guardarlas también acá era contraproducente: un borrador
    // viejo de una sesión de prueba anterior (nunca se borra hasta
    // apretar "Guardar") terminaba PISANDO el progreso real ya guardado
    // apenas se reabría la tarea (bug reportado por Vaneh, 02/09 -- las
    // subtareas volvían a aparecer sin tildar). Para una tarea NUEVA (sin
    // guardar todavía) sí hace falta, porque ahí no hay nada persistido.
    subtareas: editingTarea ? undefined : _tareaSubtareasPendientes,
  };
  try { localStorage.setItem(tareaDraftKey(editingTarea?.id), JSON.stringify(draft)); } catch (e) {}
}

function limpiarBorradorTarea(id) {
  try { localStorage.removeItem(tareaDraftKey(id)); } catch (e) {}
}

function restaurarBorradorTarea(id) {
  let draft;
  try {
    const raw = localStorage.getItem(tareaDraftKey(id));
    if (!raw) return;
    draft = JSON.parse(raw);
  } catch (e) { return; }
  const tituloEl = document.getElementById('tf-titulo');
  const notasEl = document.getElementById('tf-notas');
  const comentEl = document.getElementById('tarea-comment-input');
  let cambios = false;
  if (draft.titulo && draft.titulo !== tituloEl.value) { tituloEl.value = draft.titulo; cambios = true; }
  if (draft.notas && draft.notas !== notasEl.innerHTML) { notasEl.innerHTML = draft.notas; cambios = true; }
  if (comentEl && draft.comentario) { comentEl.value = draft.comentario; cambios = true; }
  // Solo para una tarea NUEVA -- en una existente las subtareas ya viven
  // guardadas en el servidor (autoguardado), restaurar acá un borrador
  // viejo pisaría progreso real ya persistido. Ver guardarBorradorTarea.
  if (!id && Array.isArray(draft.subtareas) && JSON.stringify(draft.subtareas) !== JSON.stringify(_tareaSubtareasPendientes)) {
    _tareaSubtareasPendientes = draft.subtareas;
    renderSubtareas(_tareaSubtareasPendientes);
    cambios = true;
  }
  if (!cambios) return;
  const aviso = document.getElementById('tarea-borrador-aviso');
  if (aviso) {
    aviso.style.display = 'flex';
    aviso.querySelector('button').onclick = () => { limpiarBorradorTarea(id); openTareaModal(id || null); };
  }
}

['tf-titulo', 'tarea-comment-input'].forEach(idEl => {
  document.getElementById(idEl)?.addEventListener('input', guardarBorradorTarea);
});
document.getElementById('tf-notas')?.addEventListener('input', guardarBorradorTarea);

function renderSubtareas(subtareas) {
  const list = document.getElementById('subtareas-list');
  list.innerHTML = subtareas.map((s, i) => `
    <div style="display:flex;align-items:flex-start;gap:8px;padding:6px 10px;background:${s.done?'#f0fdf4':'#f8fafc'};border-radius:6px;border:1px solid ${s.done?'#bbf7d0':'var(--border)'};">
      <input type="checkbox" ${s.done?'checked':''} onchange="toggleSubtarea(${i})" style="flex-shrink:0;margin-top:3px;">
      <span style="flex:1;min-width:0;font-size:13px;word-break:break-word;overflow-wrap:anywhere;${s.done?'text-decoration:line-through;color:var(--text-muted);':''}">${s.titulo}</span>
      <select onchange="reasignarSubtarea(${i}, this)" style="font-size:10px;color:var(--primary);font-weight:600;max-width:120px;border:none;background:transparent;cursor:pointer;flex-shrink:0;">${getAsignarOptions(s.asignado?.email || '')}</select>
      <button onclick="deleteSubtarea(${i})" style="background:none;border:none;color:#cbd5e1;cursor:pointer;font-size:16px;padding:0 2px;flex-shrink:0;" title="Eliminar">×</button>
    </div>
  `).join('') || '<p style="font-size:12px;color:var(--text-muted);">Sin subtareas. Agregá una.</p>';
}

window.reasignarSubtarea = function(idx, sel) {
  if (!_tareaSubtareasPendientes[idx]) return;
  const email = sel.value;
  const nombre = sel.selectedOptions[0]?.dataset.nombre || '';
  _tareaSubtareasPendientes[idx].asignado = email ? { email, nombre } : null;
  guardarBorradorTarea();
};

window.agregarSubtareaInline = function() {
  const tituloEl = document.getElementById('st-titulo-input');
  const asignadoEl = document.getElementById('st-asignado-input');
  const titulo = tituloEl.value.trim();
  if (!titulo) return;
  const email = asignadoEl.value;
  const nombre = asignadoEl.selectedOptions[0]?.dataset.nombre || '';
  _tareaSubtareasPendientes.push({ titulo, done: false, asignado: email ? { email, nombre } : null });
  renderSubtareas(_tareaSubtareasPendientes);
  guardarBorradorTarea();
  tituloEl.value = '';
  tituloEl.focus();
};

window.toggleTfEsProyecto = function() {
  const checked = document.getElementById('tf-es-proyecto').checked;
  document.getElementById('tf-fecha-inicio-group').classList.toggle('hidden', !checked);
  document.getElementById('tf-vencimiento-label').textContent = checked ? 'Fecha de finalización' : 'Fecha de vencimiento';
};

window.toggleSubtarea = async function(idx) {
  if (!_tareaSubtareasPendientes[idx]) return;
  const s = _tareaSubtareasPendientes[idx];
  s.done = !s.done;
  // completadoEn en la subtarea (no solo el booleano "done") es lo que
  // permite que aparezca en "Trabajo realizado" del mes en el Home del
  // cliente -- sin fecha no hay forma de saber en qué mes se hizo.
  s.completadoEn = s.done ? new Date().toISOString().split('T')[0] : null;
  renderSubtareas(_tareaSubtareasPendientes);
  guardarBorradorTarea();
  if (!editingTarea) return; // tarea nueva, todavía sin guardar -- nada que persistir aún
  // Autoguardado: si esto esperara al botón "Guardar" de toda la tarea,
  // tildar una subtarea se perdía en cuanto se cerraba el modal sin
  // acordarse de guardar (reportado por Vaneh, 02/09 -- "marqué una
  // subtarea hecha y no aparece en el listado del cliente"). Además, si
  // con este cambio quedaron TODAS las subtareas hechas, la tarea pasa
  // sola a "Listo" para que se refleje en el resumen de Tareas del Home.
  editingTarea.subtareas = [..._tareaSubtareasPendientes];
  const todasHechas = editingTarea.subtareas.length > 0 && editingTarea.subtareas.every(s => s.done);
  if (todasHechas) {
    editingTarea.estado = 'Listo';
    editingTarea.visibleParaCliente = true;
    editingTarea.completadoEn = editingTarea.completadoEn || new Date().toISOString().split('T')[0];
    const estadoSel = document.getElementById('tf-estado');
    if (estadoSel) estadoSel.value = 'Listo';
  }
  try {
    const saved = await saveTarea(clientId, editingTarea);
    const i = STATE.tareas.findIndex(t => t.id === saved.id);
    if (i > -1) STATE.tareas[i] = saved;
    editingTarea = saved;
    updateBadges();
    if (currentSection === 'tareas') refreshTareasView();
  } catch (e) { /* si falla la conexión, el check sigue visible en el modal y se reintenta al guardar la tarea entera */ }
};

window.deleteSubtarea = function(idx) {
  _tareaSubtareasPendientes.splice(idx, 1);
  renderSubtareas(_tareaSubtareasPendientes);
  guardarBorradorTarea();
};

function closeTareaModal() { document.getElementById('tareaModal').classList.add('hidden'); }
document.getElementById('closeTareaModal').addEventListener('click', closeTareaModal);
document.getElementById('closeTareaModal2').addEventListener('click', closeTareaModal);

// Área de imágenes en tarea
const tareaImgArea = document.getElementById('tarea-img-area');
const tareaImgInput = document.getElementById('tarea-img-input');
// click en el área no abre el explorador — el botón "📎 Subir archivo" lo maneja
// Ctrl+V se captura en el listener global de paste
if (tareaImgInput) {
  tareaImgInput.addEventListener('change', e => {
    [...e.target.files].forEach(addTareaImgFromFile);
    e.target.value = '';
  });
}

document.getElementById('saveTareaBtn').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  if (btn.disabled) return;
  const titulo = document.getElementById('tf-titulo').value.trim();
  if (!titulo) { alert('El título es obligatorio.'); return; }
  const draftIdAlGuardar = editingTarea?.id || null;
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    const recurrencia = document.getElementById('tf-recurrencia').value;
    const diasSemana = recurrencia === 'dias-semana'
      ? Array.from(document.querySelectorAll('.dia-check:checked')).map(cb => cb.value)
      : [];
    const tfAsignadoEl = document.getElementById('tf-asignado');
    const tfAsignadoEmail = tfAsignadoEl ? tfAsignadoEl.value : '';
    const tfAsignadoNombre = tfAsignadoEl ? (tfAsignadoEl.selectedOptions[0]?.dataset.nombre || '') : '';
    const prevTfAsignadoEmail = editingTarea?.asignado?.email || '';
    const tfAsignadoObj = tfAsignadoEmail ? (tfAsignadoEmail === prevTfAsignadoEmail
      ? { ...editingTarea.asignado, email: tfAsignadoEmail, nombre: tfAsignadoNombre }
      : { email: tfAsignadoEmail, nombre: tfAsignadoNombre, asignadoPor: { email: user.email, nombre: user.name || user.email } }) : null;
    const tfVisibleClienteEl = document.getElementById('tf-visible-cliente');
    const tfEstadoVal = document.getElementById('tf-estado').value;
    const tfVisibleCliente = tfEstadoVal === 'Listo' ? true : (tfVisibleClienteEl ? tfVisibleClienteEl.checked : false);
    const tfCompletadoEn = tfEstadoVal === 'Listo' ? (editingTarea?.estado === 'Listo' ? editingTarea.completadoEn : new Date().toISOString().split('T')[0]) : null;
    const numero = editingTarea?.numero || (Math.max(0, ...STATE.tareas.map(t => t.numero || 0)) + 1);
    const esProyectoVal = document.getElementById('tf-es-proyecto')?.checked === true;
    const obj = { ...(editingTarea||{}), numero, titulo, estado: tfEstadoVal, prioridad: document.getElementById('tf-prioridad').value, vencimiento: document.getElementById('tf-vencimiento').value || null, hora: document.getElementById('tf-hora').value || null, fechaInicio: esProyectoVal ? (document.getElementById('tf-fecha-inicio').value || null) : null, notas: document.getElementById('tf-notas').innerHTML, recurrencia: recurrencia || null, diasSemana, linkRef: document.getElementById('tf-link').value || null, subtareas: [..._tareaSubtareasPendientes], imagenes: [..._tareaImgList], archivosAdjuntos: [..._tareaArchivosPendientes], comentarios: editingTarea?.comentarios || [], asignado: tfAsignadoObj, visibleParaCliente: tfVisibleCliente, completadoEn: tfCompletadoEn, esProyecto: esProyectoVal };
    const saved = await Promise.race([
      saveTarea(clientId, obj),
      new Promise((_, rej) => setTimeout(() => rej(new Error('Tiempo de espera agotado. Verificá tu conexión.')), 15000)),
    ]);
    if (editingTarea) { const i = STATE.tareas.findIndex(t => t.id === saved.id); STATE.tareas[i] = saved; }
    else STATE.tareas.push(saved);
    notifyAsignacion('tarea', saved, prevTfAsignadoEmail);
    limpiarBorradorTarea(draftIdAlGuardar);
    closeTareaModal();
    updateBadges();
    if (currentSection === 'tareas') refreshTareasView();
    else renderSection('home');
  } catch (err) {
    alert('Error al guardar: ' + err.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar';
  }
});

document.getElementById('deleteTareaBtn').addEventListener('click', async () => {
  if (!editingTarea || !confirm('¿Eliminar esta tarea?')) return;
  await deleteTarea(clientId, editingTarea.id);
  limpiarBorradorTarea(editingTarea.id);
  STATE.tareas = STATE.tareas.filter(t => t.id !== editingTarea.id);
  closeTareaModal();
  updateBadges();
  refreshTareasView();
});

document.getElementById('archiveTareaBtn').addEventListener('click', async () => {
  if (!editingTarea) return;
  editingTarea.archivado = true;
  await saveTarea(clientId, editingTarea);
  const i = STATE.tareas.findIndex(t => t.id === editingTarea.id);
  STATE.tareas[i] = editingTarea;
  closeTareaModal();
  updateBadges();
  refreshTareasView();
});

window.eliminarTareaDirecta = async function(id) {
  if (!confirm('¿Eliminar esta tarea?')) return;
  await deleteTarea(clientId, id);
  STATE.tareas = STATE.tareas.filter(t => t.id !== id);
  updateBadges();
  refreshTareasView();
};

window.desarchivarTarea = async function(id) {
  const t = STATE.tareas.find(x => x.id === id);
  if (!t) return;
  t.archivado = false;
  await saveTarea(clientId, t);
  updateBadges();
  refreshTareasView();
};

// ──────────────────────────────────────────────────────
// PAUTA
// ──────────────────────────────────────────────────────
let activePautaTab = 'todas';

function renderPauta(container) {
  const plats = ['Todas', 'Meta Ads', 'Google Ads', 'TikTok Ads', 'LinkedIn Ads'];
  const filtered = activePautaTab === 'todas' ? STATE.campanas
    : STATE.campanas.filter(c => c.plataforma === activePautaTab);
  const total = filtered.reduce((s,c) => s + (c.presupuesto||0), 0);
  const gastado = filtered.reduce((s,c) => s + (c.gastado||0), 0);
  const activas = filtered.filter(c => c.estado === 'Activa').length;
  const roasTotal = gastado ? filtered.reduce((s,c)=>s+(c.ingresos||0),0) / gastado : 0;

  // Presupuesto asignado a mano desde el panel admin (sección Procesos) --
  // avisa si las campañas cargadas suman más de lo que se asignó.
  const presupuesto = STATE.client?.presupuesto;
  const asignado = activePautaTab === 'todas' ? presupuesto?.total : presupuesto?.porPlataforma?.[activePautaTab];
  const excedeAsignado = asignado > 0 && total > asignado;

  container.innerHTML = `
    <div class="tabs" id="pauta-tabs" style="margin-bottom:16px;">
      ${plats.map(p => `<button class="tab-btn ${activePautaTab===(p==='Todas'?'todas':p)?'active':''}" data-tab="${p==='Todas'?'todas':p}">${p}</button>`).join('')}
    </div>

    ${excedeAsignado ? `<div class="card" style="padding:12px 16px;margin-bottom:16px;background:#fef2f2;border-color:#fecaca;">
      <p style="font-size:13px;color:#dc2626;font-weight:600;margin:0;">⚠️ Las campañas ${activePautaTab === 'todas' ? '' : `de ${activePautaTab} `}suman $${fmtNum(total)} de presupuesto, pero el presupuesto asignado es de $${fmtNum(asignado)}.</p>
    </div>` : ''}

    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px;">
      ${[
        { label: 'Campañas activas', val: activas, icon: 'activity' },
        { label: 'Presupuesto total', val: '$'+fmtNum(total), icon: 'dollar-sign' },
        { label: 'Gastado', val: '$'+fmtNum(gastado), icon: 'credit-card' },
        { label: 'ROAS promedio', val: roasTotal ? roasTotal.toFixed(2)+'x' : '—', icon: 'trending-up' },
      ].map(m => `<div class="card" style="padding:16px;"><i data-lucide="${m.icon}" style="width:20px;height:20px;color:var(--accent);stroke-width:1.5;margin-bottom:8px;"></i><div style="font-size:22px;font-weight:800;">${m.val}</div><div style="font-size:12px;color:var(--text-muted);">${m.label}</div></div>`).join('')}
    </div>

    ${filtered.length ? filtered.map(c => {
      const pct = c.presupuesto ? Math.round((c.gastado||0)/c.presupuesto*100) : 0;
      const statusCol = c.estado==='Activa'?'#10b981':c.estado==='Pausada'?'#f59e0b':'#94a3b8';
      return `
        <div class="campaign-card">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
            <div class="campaign-name" style="flex:1;">${c.nombre}</div>
            <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;background:${statusCol}22;color:${statusCol};">${c.estado}</span>
            <span style="font-size:12px;color:var(--text-muted);">${c.plataforma||''}</span>
            <button class="btn btn-secondary btn-sm" onclick="openCampanaModal('${c.id}')">Editar</button>
          </div>
          <div class="campaign-stats">
            ${[
              { label:'Presupuesto', val: '$'+fmtNum(c.presupuesto) },
              { label:'Gastado', val: '$'+fmtNum(c.gastado) },
              { label:'ROAS', val: c.roas ? `<span style="color:${c.roas>=(c.roasEq||1.5)?'#10b981':'#ef4444'};font-weight:800;">${c.roas}x</span>` : '—' },
              { label:'ROAS equilibrio', val: c.roasEq ? c.roasEq+'x' : '—' },
              { label:'Impresiones', val: fmtNum(c.impresiones) },
              { label:'Alcance', val: fmtNum(c.alcance) },
              { label:'Clics', val: fmtNum(c.clics) },
              { label:'CPC', val: c.cpc ? '$'+c.cpc : '—' },
              { label:'CPM', val: c.cpm ? '$'+c.cpm : '—' },
              { label:'CTR', val: c.ctr ? c.ctr+'%' : '—' },
              { label:'Visitas destino', val: fmtNum(c.visitas) },
              { label:'Conversiones', val: fmtNum(c.conversiones) },
              { label:'Período', val: `${fmtDate(c.fechaInicio)} → ${fmtDate(c.fechaFin)}` },
            ].map(s => `<div><div class="campaign-stat-label">${s.label}</div><div class="campaign-stat-val">${s.val||'—'}</div></div>`).join('')}
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(pct,100)}%;"></div></div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${pct}% del presupuesto ejecutado</div>
        </div>
      `;
    }).join('')
    : `<div class="empty-state"><i data-lucide="trending-up" style="width:40px;height:40px;color:#cbd5e1;stroke-width:1;margin-bottom:12px;"></i><h3>Sin campañas</h3><p>${activePautaTab==='todas'?'Agregá tu primera campaña.':'Sin campañas de '+activePautaTab+'.'}</p></div>`}

    <div class="card" style="margin-top:16px;padding:14px 16px;background:#f0fdf4;border:1px solid #bbf7d0;">
      <div style="font-size:12px;color:#166534;line-height:1.6;">
        <strong>Conectar automáticamente:</strong> Próximamente podrás sincronizar Meta Ads, Google Ads y TikTok Ads directamente desde el hub, sin cargar datos manualmente.
        Por ahora cargá los datos de tu reporte de Ads Manager — el equipo COSMART puede ayudarte con esto.
      </div>
    </div>
  `;

  document.querySelectorAll('#pauta-tabs .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activePautaTab = btn.dataset.tab;
      renderPauta(document.getElementById('main-content'));
      setTimeout(refreshIcons, 50);
    });
  });
}

// ──────────────────────────────────────────────────────
// LINKS
// ──────────────────────────────────────────────────────
window.setLinkCatFilter = function(cat) {
  window._linkCatFilter = cat;
  renderLinks(document.getElementById('links-col-body'));
  setTimeout(refreshIcons, 30);
};

function renderLinks(container) {
  const links = STATE.links || [];
  const cats = ['Todas', ...new Set(links.map(l => l.categoria).filter(Boolean))];
  if (!window._linkCatFilter) window._linkCatFilter = 'Todas';
  const filter = window._linkCatFilter;
  const visible = filter === 'Todas' ? links : links.filter(l => l.categoria === filter);

  container.innerHTML = `
    ${cats.length > 1 ? `
    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;align-items:center;">
      ${cats.map(c => `
        <button onclick="setLinkCatFilter('${c.replace(/'/g,"\\'")}')"
          style="padding:4px 12px;border-radius:999px;border:1.5px solid ${c===filter?'var(--primary)':'var(--border)'};
          background:${c===filter?'var(--primary)':'transparent'};color:${c===filter?'#fff':'var(--text-muted)'};
          font-size:12px;font-weight:600;cursor:pointer;transition:all .15s;">${c}</button>
      `).join('')}
    </div>` : ''}
    ${visible.length ? `
      <div class="links-grid" id="links-sortable">
        ${visible.map(l => `
          <div class="link-card" draggable="true" data-link-id="${l.id}"
            style="cursor:grab;user-select:none;"
            onclick="if(!this._ldrag)window.open('${l.url.replace(/'/g,"\\'")}','_blank')"
            ondragstart="this._ldrag=false;window._linkDragId='${l.id}';this.style.opacity='.4';"
            ondragend="this._ldrag=true;this.style.opacity='1';setTimeout(()=>{this._ldrag=false},200);"
            ondragover="event.preventDefault();this.style.outline='2px solid var(--primary)';"
            ondragleave="this.style.outline='';"
            ondrop="event.preventDefault();this.style.outline='';dropLinkOn('${l.id}');">
            <div class="link-card-icon">
              <i data-lucide="link" style="width:14px;height:14px;color:var(--primary);stroke-width:1.75;"></i>
            </div>
            <div style="flex:1;min-width:0;">
              <div class="link-card-title" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${l.titulo}</div>
              ${l.categoria ? `<div style="font-size:10px;color:var(--primary);font-weight:600;margin-top:1px;">${l.categoria}</div>` : ''}
              ${l.desc ? `<div class="link-card-desc">${l.desc}</div>` : ''}
              <div style="font-size:10px;color:#94a3b8;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${l.url}</div>
            </div>
            <button class="link-card-edit" onclick="event.stopPropagation();openLinkModal('${l.id}')" title="Editar">
              <i data-lucide="pencil" style="width:13px;height:13px;stroke-width:2;"></i>
            </button>
          </div>
        `).join('')}
        <div class="link-card" onclick="openLinkModal(null)"
          style="cursor:pointer;border-style:dashed;background:transparent;justify-content:center;opacity:.6;gap:6px;">
          <i data-lucide="plus" style="width:14px;height:14px;stroke-width:2;color:var(--text-muted);"></i>
          <span style="font-size:13px;color:var(--text-muted);">Agregar link</span>
        </div>
      </div>
    ` : `
      <div class="empty-state">
        <i data-lucide="link" style="width:40px;height:40px;color:#cbd5e1;stroke-width:1;margin-bottom:12px;"></i>
        <h3>Sin links${filter!=='Todas'?' en esta categoría':' guardados'}</h3>
        <p>Guardá atajos rápidos a tus recursos: Drive, Canva, planillas, reportes...</p>
        <button class="btn btn-primary" style="margin-top:12px;" onclick="openLinkModal(null)">+ Agregar primer link</button>
      </div>
    `}
  `;
  setTimeout(refreshIcons, 30);
}

window.dropLinkOn = async function(targetId) {
  const dragId = window._linkDragId;
  if (!dragId || dragId === targetId) return;
  const links = STATE.links;
  const fromIdx = links.findIndex(l => String(l.id) === String(dragId));
  const toIdx   = links.findIndex(l => String(l.id) === String(targetId));
  if (fromIdx < 0 || toIdx < 0) return;
  const [moved] = links.splice(fromIdx, 1);
  links.splice(toIdx, 0, moved);
  STATE.home.links = links;
  renderSection('links');
  saveHomeData(clientId, STATE.home).catch(() => {});
};

let _editingLink = null;
window.openLinkModal = function(id) {
  _editingLink = id ? STATE.links.find(l => String(l.id) === String(id)) : null;
  const l = _editingLink || {};
  document.getElementById('link-modal-title').textContent = _editingLink ? 'Editar link' : 'Nuevo link';
  document.getElementById('lf-titulo').value = l.titulo || '';
  document.getElementById('lf-url').value = l.url || '';
  document.getElementById('lf-desc').value = l.desc || '';
  document.getElementById('lf-categoria').value = l.categoria || '';
  const cats = [...new Set((STATE.links || []).map(x => x.categoria).filter(Boolean))];
  const dl = document.getElementById('lf-cat-list');
  if (dl) dl.innerHTML = cats.map(c => `<option value="${c}">`).join('');
  document.getElementById('deleteLinkBtn').style.display = _editingLink ? '' : 'none';
  document.getElementById('linkModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('lf-titulo').focus(), 50);
};

// ──────────────────────────────────────────────────────
// ARCHIVOS IMPORTANTES
// ──────────────────────────────────────────────────────
const ARCHIVO_ICONS = {
  Drive: 'folder', Dropbox: 'box', PDF: 'file-text',
  Documento: 'file', Planilla: 'table', Otro: 'link',
};

function tipoDesdeArchivo(filename) {
  const ext = (filename.split('.').pop() || '').toLowerCase();
  if (ext === 'pdf') return 'PDF';
  if (['doc', 'docx', 'txt', 'rtf'].includes(ext)) return 'Documento';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'Planilla';
  return 'Otro';
}

// Carpetas -- un solo nivel (sin subcarpetas anidadas), a propósito: es
// para "mayor organización" de una lista que se hace larga, no un
// explorador de archivos completo. STATE.home.archivoCarpetas guarda los
// NOMBRES (para que una carpeta pueda existir vacía); archivo.carpeta
// guarda a cuál pertenece cada archivo ('' / null = raíz).
let _archivoCarpetaActual = '';
let _archivoBusqueda = '';

function carpetasDisponibles() {
  const set = new Set(STATE.home.archivoCarpetas || []);
  (STATE.home.archivos || []).forEach(a => { if (a.carpeta) set.add(a.carpeta); });
  return [...set].sort((a, b) => a.localeCompare(b));
}

function archivosToolbarHtml() {
  return `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
      <input type="text" value="${_archivoBusqueda}" oninput="buscarArchivos(this.value)" placeholder="🔎 Buscar archivo..." class="form-control" style="flex:1;min-width:120px;font-size:12px;padding:5px 8px;">
      ${!_archivoBusqueda ? `
        <button class="btn btn-secondary btn-sm" onclick="crearCarpetaArchivo()" title="Nueva carpeta">📁+</button>
        <button class="btn btn-secondary btn-sm" onclick="document.getElementById('af-folder-input').click()" title="Subir una carpeta entera de la compu, con todos los archivos que tenga adentro">📁⬆ Subir carpeta</button>
      ` : ''}
    </div>
    ${!_archivoBusqueda && _archivoCarpetaActual ? `<div style="font-size:11px;color:var(--text-muted);margin-bottom:8px;">📁 ${_archivoCarpetaActual}</div>` : ''}
    <div id="af-folder-status" style="font-size:12px;color:var(--primary);margin-bottom:8px;"></div>
  `;
}

// Menú "⋮" tipo Windows -- mismas clases que .client-row-menu (ya usadas
// en el panel admin para el menú de cada cliente), así no hace falta CSS
// nuevo y se ve consistente con el resto del Hub.
function archivoCardHtml(a) {
  const abrir = a.subido ? `abrirArchivoSubido('${a.id}')` : `window.open('${(a.url || '').replace(/'/g, "\\'")}','_blank')`;
  return `
    <div class="link-card" onclick="${abrir}" style="cursor:pointer;">
      <div class="link-card-icon">
        <i data-lucide="${ARCHIVO_ICONS[a.tipo] || 'file'}" style="width:14px;height:14px;color:var(--primary);stroke-width:1.75;"></i>
      </div>
      <div style="flex:1;min-width:0;">
        <div class="link-card-title" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${a.titulo}</div>
        <div style="font-size:10px;color:var(--primary);font-weight:600;margin-top:1px;">${a.tipo || 'Otro'}${a.subido ? ' · Subido' : ''}${_archivoBusqueda && a.carpeta ? ` · 📁 ${a.carpeta}` : ''}</div>
        ${a.desc ? `<div class="link-card-desc">${a.desc}</div>` : ''}
      </div>
      <div class="client-row-menu-wrap" onclick="event.stopPropagation();" style="flex-shrink:0;">
        <button class="client-row-menu-btn" onclick="toggleArchivoMenu('${a.id}', event)" title="Más opciones">⋮</button>
        <div class="client-row-menu hidden" id="armenu-${a.id}">
          <button onclick="toggleArchivoMenu('${a.id}');${abrir}">Abrir</button>
          <button onclick="toggleArchivoMenu('${a.id}');openArchivoModal('${a.id}')">✏️ Editar</button>
          <button onclick="moverArchivoModal('${a.id}')">📁 Mover a carpeta</button>
          <button class="danger" onclick="eliminarArchivoDirecto('${a.id}')">🗑 Eliminar</button>
        </div>
      </div>
    </div>`;
}

function renderArchivos(container) {
  const todos = STATE.home.archivos || [];

  if (_archivoBusqueda) {
    const encontrados = todos.filter(a =>
      (a.titulo || '').toLowerCase().includes(_archivoBusqueda) || (a.desc || '').toLowerCase().includes(_archivoBusqueda));
    container.innerHTML = archivosToolbarHtml() + (encontrados.length
      ? `<div class="links-grid">${encontrados.map(archivoCardHtml).join('')}</div>`
      : `<div class="empty-state"><p>Sin resultados para "${_archivoBusqueda}".</p></div>`);
    setTimeout(refreshIcons, 30);
    return;
  }

  const carpetas = carpetasDisponibles();
  const enCarpetaActual = todos.filter(a => (a.carpeta || '') === _archivoCarpetaActual);
  const enRaiz = !_archivoCarpetaActual;

  if (!todos.length && !carpetas.length) {
    container.innerHTML = archivosToolbarHtml() + `
      <div class="empty-state">
        <i data-lucide="folder-open" style="width:40px;height:40px;color:#cbd5e1;stroke-width:1;margin-bottom:12px;"></i>
        <h3>Sin archivos guardados</h3>
        <p>Subí un archivo directamente o pegá un link (Drive, Dropbox, etc.)</p>
        <button class="btn btn-primary" style="margin-top:12px;" onclick="openArchivoModal(null)">+ Agregar primer archivo</button>
      </div>`;
    setTimeout(refreshIcons, 30);
    return;
  }

  container.innerHTML = archivosToolbarHtml() + `
    <div class="links-grid">
      ${!enRaiz ? `
        <div class="link-card" onclick="entrarCarpetaArchivo('')" style="cursor:pointer;justify-content:center;gap:6px;background:transparent;border-style:dashed;">
          <span style="font-size:13px;color:var(--primary);font-weight:600;">⬅ Volver a la raíz</span>
        </div>
      ` : carpetas.map(c => {
        const n = todos.filter(a => a.carpeta === c).length;
        return `
        <div class="link-card" onclick="entrarCarpetaArchivo('${c.replace(/'/g, "\\'")}')" style="cursor:pointer;">
          <div class="link-card-icon" style="background:#FEF3C7;">
            <i data-lucide="folder" style="width:14px;height:14px;color:#b45309;stroke-width:1.75;"></i>
          </div>
          <div style="flex:1;min-width:0;">
            <div class="link-card-title" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c}</div>
            <div style="font-size:10px;color:var(--text-muted);margin-top:1px;">${n} archivo${n !== 1 ? 's' : ''}</div>
          </div>
          <button onclick="event.stopPropagation();eliminarCarpetaArchivo('${c.replace(/'/g, "\\'")}')" title="Eliminar carpeta (solo si está vacía)" style="background:none;border:none;color:#cbd5e1;cursor:pointer;font-size:16px;flex-shrink:0;padding:0 2px;">×</button>
        </div>`;
      }).join('')}
      ${enCarpetaActual.map(archivoCardHtml).join('')}
      <div class="link-card" onclick="openArchivoModal(null)"
        style="cursor:pointer;border-style:dashed;background:transparent;justify-content:center;opacity:.6;gap:6px;">
        <i data-lucide="plus" style="width:14px;height:14px;stroke-width:2;color:var(--text-muted);"></i>
        <span style="font-size:13px;color:var(--text-muted);">Agregar archivo</span>
      </div>
    </div>
  `;
  setTimeout(refreshIcons, 30);
}

window.buscarArchivos = function(valor) {
  _archivoBusqueda = valor.trim().toLowerCase();
  renderArchivos(document.getElementById('archivos-col-body'));
};

window.entrarCarpetaArchivo = function(nombre) {
  _archivoCarpetaActual = nombre;
  renderArchivos(document.getElementById('archivos-col-body'));
};

window.crearCarpetaArchivo = async function() {
  const nombre = prompt('Nombre de la carpeta nueva:');
  if (!nombre || !nombre.trim()) return;
  const limpio = nombre.trim();
  if (!STATE.home.archivoCarpetas) STATE.home.archivoCarpetas = [];
  if (!STATE.home.archivoCarpetas.includes(limpio)) {
    STATE.home.archivoCarpetas.push(limpio);
    try { await saveHomeData(clientId, STATE.home); } catch (e) { alert('No se pudo crear la carpeta: ' + e.message); return; }
  }
  _archivoCarpetaActual = limpio;
  renderArchivos(document.getElementById('archivos-col-body'));
};

window.eliminarCarpetaArchivo = async function(nombre) {
  const enUso = (STATE.home.archivos || []).some(a => a.carpeta === nombre);
  if (enUso) { alert('Esta carpeta tiene archivos adentro -- movélos o borralos primero.'); return; }
  if (!confirm(`¿Eliminar la carpeta "${nombre}"?`)) return;
  STATE.home.archivoCarpetas = (STATE.home.archivoCarpetas || []).filter(c => c !== nombre);
  try { await saveHomeData(clientId, STATE.home); } catch (e) { alert('No se pudo eliminar: ' + e.message); return; }
  renderArchivos(document.getElementById('archivos-col-body'));
};

window.moverArchivoModal = function(id) {
  toggleArchivoMenu(id);
  const a = (STATE.home.archivos || []).find(x => String(x.id) === String(id));
  if (!a) return;
  const opciones = ['(Raíz)', ...carpetasDisponibles()];
  const eleccion = prompt(`¿A qué carpeta mover "${a.titulo}"?\n\nOpciones existentes: ${opciones.join(', ')}\n\nEscribí el nombre exacto (podés escribir uno nuevo), o "(Raíz)" para sacarlo de cualquier carpeta.`, a.carpeta || '(Raíz)');
  if (eleccion === null) return;
  const destino = eleccion.trim();
  moverArchivoA(id, destino === '(Raíz)' || !destino ? '' : destino);
};

window.moverArchivoA = async function(id, carpeta) {
  const a = (STATE.home.archivos || []).find(x => String(x.id) === String(id));
  if (!a) return;
  a.carpeta = carpeta || null;
  if (carpeta) {
    if (!STATE.home.archivoCarpetas) STATE.home.archivoCarpetas = [];
    if (!STATE.home.archivoCarpetas.includes(carpeta)) STATE.home.archivoCarpetas.push(carpeta);
  }
  try { await saveHomeData(clientId, STATE.home); } catch (e) { alert('No se pudo mover: ' + e.message); return; }
  renderArchivos(document.getElementById('archivos-col-body'));
};

window.eliminarArchivoDirecto = async function(id) {
  const a = (STATE.home.archivos || []).find(x => String(x.id) === String(id));
  if (!a || !confirm(`¿Eliminar "${a.titulo}"?`)) return;
  STATE.home.archivos = (STATE.home.archivos || []).filter(x => String(x.id) !== String(id));
  try { await saveHomeData(clientId, STATE.home); } catch (e) { alert('No se pudo eliminar: ' + e.message); return; }
  renderArchivos(document.getElementById('archivos-col-body'));
};

window.toggleArchivoMenu = function(id, ev) {
  if (ev) ev.stopPropagation();
  document.querySelectorAll('.client-row-menu').forEach(m => { if (m.id !== `armenu-${id}`) m.classList.add('hidden'); });
  const menu = document.getElementById(`armenu-${id}`);
  if (!menu) return;
  const abrir = menu.classList.contains('hidden');
  menu.classList.toggle('hidden');
  if (abrir && ev && ev.currentTarget) {
    const rect = ev.currentTarget.getBoundingClientRect();
    menu.style.top = `${rect.bottom + 4}px`;
    let left = rect.right - menu.offsetWidth;
    if (left < 4) left = 4;
    menu.style.left = `${left}px`;
  }
};
document.addEventListener('click', () => {
  document.querySelectorAll('.client-row-menu').forEach(m => m.classList.add('hidden'));
});

// Subir una carpeta entera de la compu (selector nativo de carpetas vía
// webkitdirectory) -- como acá las carpetas son de un solo nivel, TODO lo
// que traiga la carpeta elegida (subcarpetas incluidas) se aplana adentro
// de una sola carpeta con el nombre de la carpeta raíz elegida.
document.getElementById('af-folder-input')?.addEventListener('change', async (e) => {
  const files = [...e.target.files].filter(f => !f.name.startsWith('.'));
  e.target.value = '';
  if (!files.length) return;
  const folderName = (files[0].webkitRelativePath || files[0].name).split('/')[0] || 'Carpeta subida';
  const statusEl = document.getElementById('af-folder-status');
  if (!STATE.home.archivos) STATE.home.archivos = [];
  if (!STATE.home.archivoCarpetas) STATE.home.archivoCarpetas = [];
  if (!STATE.home.archivoCarpetas.includes(folderName)) STATE.home.archivoCarpetas.push(folderName);

  let ok = 0, saltados = 0;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (statusEl) statusEl.textContent = `Subiendo ${i + 1}/${files.length}: ${file.name}…`;
    if (file.size > 50 * 1024 * 1024) { saltados++; continue; }
    try {
      const subido = await uploadArchivo(clientId, file);
      STATE.home.archivos.push({
        id: Date.now() + i, titulo: file.name, desc: '',
        tipo: tipoDesdeArchivo(subido.filename), subido: true,
        key: subido.key, filename: subido.filename, size: subido.size,
        carpeta: folderName,
      });
      ok++;
    } catch (err) { saltados++; }
  }
  if (statusEl) statusEl.textContent = 'Guardando...';
  try {
    await saveHomeData(clientId, STATE.home);
  } catch (err) {
    alert('Se subieron los archivos pero no se pudo guardar la lista: ' + err.message);
  }
  _archivoCarpetaActual = folderName;
  _archivoBusqueda = '';
  renderArchivos(document.getElementById('archivos-col-body'));
  if (saltados) alert(`Se subieron ${ok} archivo${ok !== 1 ? 's' : ''}. ${saltados} se saltearon (pesan más de 50 MB o falló la subida).`);
});

window.abrirArchivoSubido = async function(id) {
  const a = (STATE.home.archivos || []).find(x => String(x.id) === String(id));
  if (!a) return;
  try {
    await abrirArchivo(clientId, a.key, a.filename);
  } catch (e) {
    alert('No se pudo abrir el archivo: ' + e.message);
  }
};

let _editingArchivo = null;
let _archivoModo = 'link';
let _archivoFilePendiente = null;

function setArchivoModo(modo) {
  _archivoModo = modo;
  document.getElementById('af-url-group').classList.toggle('hidden', modo !== 'link');
  document.getElementById('af-file-group').classList.toggle('hidden', modo !== 'subir');
  document.getElementById('af-modo-link').classList.toggle('btn-primary', modo === 'link');
  document.getElementById('af-modo-link').classList.toggle('btn-secondary', modo !== 'link');
  document.getElementById('af-modo-subir').classList.toggle('btn-primary', modo === 'subir');
  document.getElementById('af-modo-subir').classList.toggle('btn-secondary', modo !== 'subir');
}
document.getElementById('af-modo-link').addEventListener('click', () => setArchivoModo('link'));
document.getElementById('af-modo-subir').addEventListener('click', () => setArchivoModo('subir'));

document.getElementById('af-file-input')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  document.getElementById('af-file-name').textContent = '';
  _archivoFilePendiente = null;
  if (!file) return;
  if (file.size > 50 * 1024 * 1024) {
    alert('El archivo supera los 50 MB. Para archivos más pesados usá "Pegar link" (Drive/Dropbox).');
    e.target.value = '';
    return;
  }
  _archivoFilePendiente = file;
  document.getElementById('af-file-name').textContent = `✓ ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)`;
});

window.openArchivoModal = function(id) {
  _editingArchivo = id ? (STATE.home.archivos||[]).find(a => String(a.id) === String(id)) : null;
  const a = _editingArchivo || {};
  const esNuevo = !_editingArchivo;
  const esSubido = !!a.subido;
  document.getElementById('archivo-modal-title').textContent = _editingArchivo ? 'Editar archivo' : 'Nuevo archivo';
  document.getElementById('af-titulo').value = a.titulo || '';
  document.getElementById('af-url').value = a.url || '';
  document.getElementById('af-tipo').value = a.tipo || 'Drive';
  document.getElementById('af-desc').value = a.desc || '';
  document.getElementById('af-file-input').value = '';
  document.getElementById('af-file-name').textContent = '';
  _archivoFilePendiente = null;
  document.getElementById('af-modo-group').classList.toggle('hidden', !esNuevo);
  setArchivoModo('link');
  if (esSubido) document.getElementById('af-url-group').classList.add('hidden');
  document.getElementById('deleteArchivoBtn').style.display = _editingArchivo ? '' : 'none';
  document.getElementById('archivoModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('af-titulo').focus(), 50);
};

function closeArchivoModal() { document.getElementById('archivoModal').classList.add('hidden'); }
document.getElementById('closeArchivoModal').addEventListener('click', closeArchivoModal);
document.getElementById('closeArchivoModal2').addEventListener('click', closeArchivoModal);
document.getElementById('saveArchivoBtn').addEventListener('click', async () => {
  const titulo = document.getElementById('af-titulo').value.trim();
  if (!titulo) { alert('El título es obligatorio.'); return; }
  if (!STATE.home.archivos) STATE.home.archivos = [];
  const btn = document.getElementById('saveArchivoBtn');
  const esNuevo = !_editingArchivo;
  const modo = esNuevo ? _archivoModo : (_editingArchivo.subido ? 'subido' : 'link');
  let obj;

  if (modo === 'subir') {
    if (!_archivoFilePendiente) { alert('Elegí un archivo para subir.'); return; }
    btn.disabled = true; btn.textContent = 'Subiendo...';
    try {
      const subido = await uploadArchivo(clientId, _archivoFilePendiente);
      obj = {
        id: Date.now(), titulo, desc: document.getElementById('af-desc').value.trim(),
        tipo: tipoDesdeArchivo(subido.filename), subido: true,
        key: subido.key, filename: subido.filename, size: subido.size,
        carpeta: _archivoCarpetaActual || null,
      };
      STATE.home.archivos.push(obj);
    } catch (e) {
      alert('Error al subir el archivo: ' + e.message);
      btn.disabled = false; btn.textContent = 'Guardar';
      return;
    }
  } else if (modo === 'subido') {
    obj = { ..._editingArchivo, titulo, desc: document.getElementById('af-desc').value.trim(), tipo: document.getElementById('af-tipo').value };
    const i = STATE.home.archivos.findIndex(a => a.id === obj.id);
    STATE.home.archivos[i] = obj;
  } else {
    const url = document.getElementById('af-url').value.trim();
    if (!url) { alert('La URL es obligatoria.'); return; }
    obj = {
      ...(_editingArchivo || {}), id: _editingArchivo?.id || Date.now(),
      titulo, url, tipo: document.getElementById('af-tipo').value,
      desc: document.getElementById('af-desc').value.trim(),
      carpeta: _editingArchivo ? (_editingArchivo.carpeta || null) : (_archivoCarpetaActual || null),
    };
    if (_editingArchivo) {
      const i = STATE.home.archivos.findIndex(a => a.id === obj.id);
      STATE.home.archivos[i] = obj;
    } else {
      STATE.home.archivos.push(obj);
    }
  }

  btn.disabled = true; btn.textContent = 'Guardando...';
  try {
    await saveHomeData(clientId, STATE.home);
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar';
  }
  closeArchivoModal();
  renderArchivos(document.getElementById('archivos-col-body'));
  setTimeout(refreshIcons, 50);
});
document.getElementById('deleteArchivoBtn').addEventListener('click', async () => {
  if (!_editingArchivo || !confirm('¿Eliminar este archivo?')) return;
  STATE.home.archivos = (STATE.home.archivos||[]).filter(a => a.id !== _editingArchivo.id);
  await saveHomeData(clientId, STATE.home);
  closeArchivoModal();
  renderArchivos(document.getElementById('archivos-col-body'));
  setTimeout(refreshIcons, 50);
});

// ──────────────────────────────────────────────────────
// SITIO WEB
// ──────────────────────────────────────────────────────
const WEB_CATS = ['Contenido', 'Arreglo / Bug', 'Funcionalidad nueva', 'SEO / Métricas', 'Diseño', 'Otro'];
const WEB_ESTADOS = ['Pendiente', 'En proceso', 'En revisión', 'Listo'];

function renderWeb(container) {
  const tasks = (STATE.home.webTareas || []);
  const byEstado = WEB_ESTADOS.reduce((acc, e) => { acc[e] = tasks.filter(t => t.estado === e); return acc; }, {});
  const colors = { 'Pendiente': '#94a3b8', 'En proceso': '#f59e0b', 'En revisión': '#ec4899', 'Listo': '#22c55e' };

  container.innerHTML = `
    <div style="margin-bottom:16px;display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
      <div style="font-size:13px;color:var(--text-muted);">${tasks.length} tareas · ${byEstado['Listo'].length} completadas</div>
    </div>
    <div class="kanban-board">
      ${WEB_ESTADOS.map(estado => {
        const items = byEstado[estado];
        return `
        <div class="kanban-col" style="flex:1;max-width:none;">
          <div class="kanban-col-header">
            <span class="kanban-col-dot" style="background:${colors[estado]};"></span>
            <span class="col-title">${estado}</span>
            <span class="col-count">${items.length}</span>
          </div>
          <div class="kanban-cards">
            ${items.map(t => `
              <div class="kanban-card" onclick="openWebTaskModal('${t.id}')">
                <div style="display:flex;align-items:flex-start;gap:6px;">
                  <button onclick="event.stopPropagation();toggleWebTareaListo('${t.id}')" title="${t.estado === 'Listo' ? 'Marcar como no hecha' : 'Marcar como hecha'}" style="flex-shrink:0;width:16px;height:16px;border-radius:50%;border:2px solid ${t.estado === 'Listo' ? '#22c55e' : '#cbd5e1'};background:${t.estado === 'Listo' ? '#22c55e' : 'transparent'};color:#fff;font-size:10px;line-height:1;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0;">${t.estado === 'Listo' ? '✓' : ''}</button>
                  <span style="font-size:10px;padding:2px 7px;border-radius:10px;background:#f1f5f9;color:var(--text-muted);font-weight:600;flex-shrink:0;">${t.categoria||'Otro'}</span>
                </div>
                <div class="kanban-card-title" style="margin-top:6px;${t.estado === 'Listo' ? 'text-decoration:line-through;color:var(--text-muted);' : ''}">${t.titulo}</div>
                ${t.notas ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${t.notas}</div>` : ''}
                ${t.url ? `<a href="${t.url}" target="_blank" onclick="event.stopPropagation();" style="font-size:11px;color:var(--accent);display:block;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">↗ ${t.url}</a>` : ''}
                ${t.vencimiento ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">📅 ${fmtDate(t.vencimiento)}</div>` : ''}
              </div>
            `).join('')}
            <button class="kanban-add-btn" onclick="openWebTaskModal(null,'${estado}')">+ Agregar</button>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
}

window.toggleWebTareaListo = async function(id) {
  const t = (STATE.home.webTareas || []).find(x => String(x.id) === String(id));
  if (!t) return;
  t.estado = t.estado === 'Listo' ? 'Pendiente' : 'Listo';
  t.completadoEn = t.estado === 'Listo' ? new Date().toISOString().split('T')[0] : null;
  await saveHomeData(clientId, STATE.home);
  renderWeb(document.getElementById('main-content'));
  if (currentSection === 'home') renderSection('home');
};

let _editingWebTask = null;
window.openWebTaskModal = function(id, defaultEstado) {
  _editingWebTask = id ? (STATE.home.webTareas||[]).find(t => String(t.id) === String(id)) : null;
  const t = _editingWebTask || {};
  document.getElementById('wt-titulo').value = t.titulo || '';
  document.getElementById('wt-categoria').value = t.categoria || 'Contenido';
  document.getElementById('wt-estado').value = t.estado || defaultEstado || 'Pendiente';
  document.getElementById('wt-vencimiento').value = t.vencimiento || '';
  document.getElementById('wt-url').value = t.url || '';
  document.getElementById('wt-notas').value = t.notas || '';
  document.getElementById('deleteWebTaskBtn').style.display = _editingWebTask ? '' : 'none';
  document.getElementById('webTaskModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('wt-titulo').focus(), 50);
};

// ──────────────────────────────────────────────────────
// INSTRUCCIONES
// ──────────────────────────────────────────────────────
function renderInstrucciones(container) {
  container.innerHTML = `
    <div style="max-width:780px;">
      <div class="card" style="margin-bottom:16px;">
        <div class="card-header"><h2 style="font-family:'Playfair Display',serif;">🧭 Bienvenido al Marketing Hub de COSMART</h2></div>
        <div class="card-body" style="line-height:1.8;font-size:14px;color:var(--text-muted);">
          <p>Este es tu panel de control digital. Desde acá podés gestionar todos los aspectos de tu estrategia de marketing en un solo lugar.</p>
        </div>
      </div>

      ${[
        { icon:'bar-chart-2', title:'Dashboard Editorial', color:'#8b5cf6', items:[
          'Mostrá el resumen mensual: frecuencia por semana, formatos, ejes y tipos de contenido.',
          'Navegá entre meses con las flechas. Se actualiza solo con los contenidos cargados.',
          'Usalo para presentar avances a clientes o gerencia.',
        ]},
        { icon:'pen-line', title:'Contenidos', color:'#3b82f6', items:[
          '<strong>Banco de contenidos:</strong> Tabla con todos los posts. Podés editar desde acá.',
          '<strong>Calendario:</strong> Vista mensual. Tocá el "+" de un día para agregar contenido.',
          '<strong>Estados (Kanban):</strong> Arrastrá los contenidos entre Idea → En proceso → Aprobado → Publicado.',
          '<strong>Feed IG / Muro FB / Stories:</strong> Vista previa del perfil con filtros por estado. Tocá ✏️ para editar.',
          '<strong>Banco de ideas:</strong> Guardá ideas y convertílas en contenido con un clic.',
          '<strong>+ Nuevo contenido:</strong> Completá plataformas, formato, dimensión, copy, pieza terminada y material. Podés pegar imágenes con Ctrl+V.',
          '<strong>¿Es contenido para pauta?</strong> Marcá si es dark post u orgánico; si va a pauta te lleva a campañas.',
          '<strong>📥 Importar Excel:</strong> subí un calendario armado con la plantilla base y se cargan todos los contenidos de una — no hace falta tipearlos uno por uno.',
        ]},
        { icon:'list-checks', title:'Tareas', color:'#10b981', items:[
          'Organizadas en tres columnas: <strong>Sin empezar → En progreso → Listo</strong>.',
          'El <strong>To-do del Home</strong> y las Tareas están sincronizados: lo que agregás en uno aparece en el otro.',
          'Cada tarea puede tener <strong>subtareas</strong>, fecha de vencimiento, prioridad y enlace.',
          'Podés agregar <strong>recurrencia</strong>: diaria, semanal, quincenal, mensual o días específicos.',
          'Podés <strong>archivar</strong> tareas completadas para mantener el tablero limpio.',
        ]},
        { icon:'trending-up', title:'Pauta Digital', color:'#f59e0b', items:[
          'Registrá tus campañas de Meta Ads, Google Ads, TikTok Ads o LinkedIn Ads.',
          'El <strong>ROAS</strong> se calcula automáticamente (Ingresos ÷ Gastado).',
          'Definí tu <strong>ROAS de equilibrio</strong> para saber si la campaña es rentable.',
          'La barra de progreso muestra el % del presupuesto ejecutado.',
          '<strong>📥 Importar Excel:</strong> subí varias campañas de una desde una planilla, sin cargarlas a mano.',
        ]},
        { icon:'file-text', title:'Reporte Ejecutivo', color:'#e02020', items:[
          'Generá un reporte mensual para presentar a gerencia: contenidos publicados, métricas, campañas e insights.',
          'Accedé desde el botón "📊 Reporte" en la sección Contenidos.',
          'Podés imprimir o guardar como PDF con Ctrl+P.',
        ]},
        { icon:'folder-open', title:'Archivos importantes', color:'#7c3aed', items:[
          'Guardá los documentos clave del cliente: contratos, briefings, manuales de marca, carpetas de Drive/Dropbox.',
          'Cada archivo es un link con título, tipo (Drive, Dropbox, PDF, Documento, Planilla u Otro) y descripción opcional.',
        ]},
        { icon:'link', title:'Links', color:'#0d9488', items:[
          'Guardá atajos rápidos a tus recursos: Drive, Canva, planillas, reportes, portales.',
          'Tocá "+ Nuevo link" o el botón "+" en la grilla para agregar uno.',
          'Tocá el ✏️ sobre un link para editarlo o eliminarlo.',
        ]},
        { icon:'globe', title:'Sitio Web', color:'#64748b', items:[
          'Gestioná tareas y mejoras del sitio web del cliente.',
          'Podés cargar tareas del tipo: contenidos, arreglos, agregados o análisis.',
          'Las tareas del sitio web están separadas de las tareas de marketing pero usan la misma interfaz.',
        ]},
        { icon:'map-pin', title:'Google Drive', color:'#ec4899', items:[
          'Usamos Google Drive para almacenar las piezas gráficas y videos.',
          '<strong>Pieza terminada:</strong> el archivo listo para publicar (podés agregar múltiples links).',
          '<strong>Material de referencia:</strong> fotos brutas, referencias, brief visual.',
          'Para linkear: abrí el archivo en Drive → botón derecho → "Copiar link" → pegalo en el campo.',
        ]},
      ].map(s => `
        <div class="card" style="margin-bottom:12px;">
          <div class="card-header">
            <i data-lucide="${s.icon}" style="width:16px;height:16px;color:${s.color};stroke-width:1.75;flex-shrink:0;"></i>
            <h2 style="font-family:'Playfair Display',serif;">${s.title}</h2>
          </div>
          <div class="card-body">
            <ul style="list-style:none;padding:0;display:flex;flex-direction:column;gap:8px;">
              ${s.items.map(item=>`<li style="font-size:13px;color:var(--text-muted);padding-left:16px;position:relative;line-height:1.6;"><span style="position:absolute;left:0;color:${s.color};">›</span>${item}</li>`).join('')}
            </ul>
          </div>
        </div>
      `).join('')}

      <div class="card" style="border:1px solid #bfdbfe;background:#eff6ff;">
        <div class="card-body" style="font-size:13px;color:#1d4ed8;line-height:1.7;">
          <strong>¿Tenés dudas?</strong> Contactá a tu equipo COSMART en <a href="mailto:info@cosmart.com.ar" style="color:#1d4ed8;">info@cosmart.com.ar</a>.
        </div>
      </div>
    </div>
  `;
}

// ──────────────────────────────────────────────────────
// REPORTE EJECUTIVO
// ──────────────────────────────────────────────────────
window.openReporteModal = function() {
  const hoy = new Date();
  const mesActual = hoy.toISOString().slice(0, 7);
  const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const mesLabel = `${MESES[hoy.getMonth()]} ${hoy.getFullYear()}`;
  const cliente = STATE.client.nombre || STATE.client.name || clientId;

  const conts = STATE.contenidos.filter(c => c.fechaPub && c.fechaPub.startsWith(mesActual));
  const publicados = conts.filter(c => c.estado === 'Publicado');
  const aprobados = conts.filter(c => c.estado === 'Aprobado');
  const campanas = STATE.campanas || [];
  const activas = campanas.filter(c => c.estado === 'Activa');
  const finalizadas = campanas.filter(c => c.estado === 'Finalizada');

  // Formato breakdown
  const fmtCount = {};
  conts.forEach(c => {
    const fmts = Array.isArray(c.formato) ? c.formato : (c.formato ? [c.formato] : []);
    fmts.forEach(f => { fmtCount[f] = (fmtCount[f]||0)+1; });
  });

  // Eje breakdown
  const ejeCount = {};
  conts.forEach(c => { if(c.eje) ejeCount[c.eje] = (ejeCount[c.eje]||0)+1; });

  // Métricas pauta
  const totalPresup = campanas.reduce((s,c)=>s+(c.presupuesto||0),0);
  const totalGastado = campanas.reduce((s,c)=>s+(c.gastado||0),0);
  const totalIngresos = campanas.reduce((s,c)=>s+(c.ingresos||0),0);
  const roasTotal = totalGastado ? (totalIngresos/totalGastado).toFixed(2) : '—';

  // Tareas del mes
  const tareasReporte = tareasVisibles(STATE.tareas);
  const tareasPend = tareasReporte.filter(t => !t.archivado && t.estado !== 'Listo').length;
  const tareasOk = tareasReporte.filter(t => t.estado === 'Listo').length;

  // Insights automáticos
  const insights = [];
  if (publicados.length < 8) insights.push('📉 Menos de 8 contenidos publicados este mes. Considerá aumentar la frecuencia.');
  if (conts.filter(c=>c.eje==='Comercial').length === 0) insights.push('💡 No hay contenido comercial este mes. Incluir al menos 1-2 posts de conversión.');
  if (conts.filter(c=>(c.plataformas||[]).includes('TikTok')).length === 0) insights.push('📱 Sin contenido para TikTok este mes.');
  if (activas.length && totalGastado && parseFloat(roasTotal) < 2) insights.push(`⚠️ ROAS de ${roasTotal} por debajo del umbral recomendado (2x). Revisar segmentación.`);
  if (tareasPend > 5) insights.push(`📋 Hay ${tareasPend} tareas pendientes. Priorizar para no acumular deuda operativa.`);
  if (!insights.length) insights.push('✅ Todo en orden. Excelente desempeño este mes.');

  const body = document.getElementById('reporte-body');
  body.innerHTML = `
    <div style="font-family:'DM Sans',sans-serif;" id="reporte-print-content">
      <div style="text-align:center;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid var(--primary);">
        <div style="font-size:11px;font-weight:700;letter-spacing:2px;color:var(--accent);text-transform:uppercase;">Reporte Ejecutivo</div>
        <div style="font-family:'Playfair Display',serif;font-size:24px;font-weight:700;color:var(--primary-dark);margin:4px 0;">${cliente}</div>
        <div style="font-size:13px;color:var(--text-muted);">${mesLabel} · Generado el ${hoy.toLocaleDateString('es-AR')}</div>
      </div>

      <!-- Stats resumen -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px;">
        ${[
          {label:'Contenidos del mes', val:conts.length, color:'var(--primary)'},
          {label:'Publicados', val:publicados.length, color:'#22c55e'},
          {label:'Aprobados / listos', val:aprobados.length, color:'#3b82f6'},
          {label:'Campañas activas', val:activas.length, color:'#f59e0b'},
        ].map(s=>`
          <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:26px;font-weight:700;color:${s.color};">${s.val}</div>
            <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${s.label}</div>
          </div>`).join('')}
      </div>

      <!-- Contenidos -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:14px;">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:12px;">Contenidos del mes</div>
        ${conts.length ? `
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="background:#f8fafc;">${['Título','Fecha','Plataformas','Formato','Estado'].map(h=>`<th style="text-align:left;padding:6px 8px;font-weight:600;border-bottom:1px solid var(--border);">${h}</th>`).join('')}</tr></thead>
          <tbody>${conts.map(c=>`
            <tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:6px 8px;font-weight:500;">${c.titulo}</td>
              <td style="padding:6px 8px;color:var(--text-muted);">${fmtDate(c.fechaPub)||'—'}</td>
              <td style="padding:6px 8px;">${(c.plataformas||[]).join(', ')||'—'}</td>
              <td style="padding:6px 8px;">${Array.isArray(c.formato)?c.formato.join(', '):(c.formato||'—')}</td>
              <td style="padding:6px 8px;">${c.estado||'—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>` : '<p style="color:var(--text-muted);font-size:13px;">Sin contenidos este mes.</p>'}
      </div>

      <!-- Distribución -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px;">
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px;">
          <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:10px;">Por Formato</div>
          ${Object.entries(fmtCount).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <div style="flex:1;font-size:12px;">${k}</div>
              <div style="width:80px;background:#f1f5f9;border-radius:20px;height:6px;overflow:hidden;"><div style="width:${Math.round(v/conts.length*100)}%;background:var(--accent);height:6px;border-radius:20px;"></div></div>
              <div style="font-size:12px;font-weight:700;color:var(--primary);min-width:20px;">${v}</div>
            </div>`).join('') || '<p style="font-size:12px;color:var(--text-muted);">Sin datos</p>'}
        </div>
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px;">
          <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:10px;">Por Eje de Comunicación</div>
          ${Object.entries(ejeCount).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <div style="flex:1;font-size:12px;">${k}</div>
              <div style="width:80px;background:#f1f5f9;border-radius:20px;height:6px;overflow:hidden;"><div style="width:${Math.round(v/conts.length*100)}%;background:var(--primary);height:6px;border-radius:20px;"></div></div>
              <div style="font-size:12px;font-weight:700;color:var(--primary);min-width:20px;">${v}</div>
            </div>`).join('') || '<p style="font-size:12px;color:var(--text-muted);">Sin datos</p>'}
        </div>
      </div>

      <!-- Campañas -->
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px;margin-bottom:14px;">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text-muted);margin-bottom:12px;">Campañas de Pauta</div>
        ${campanas.length ? `
        <table style="width:100%;border-collapse:collapse;font-size:12px;">
          <thead><tr style="background:#f8fafc;">${['Campaña','Plataforma','Estado','Presup.','Gastado','ROAS'].map(h=>`<th style="text-align:left;padding:6px 8px;font-weight:600;border-bottom:1px solid var(--border);">${h}</th>`).join('')}</tr></thead>
          <tbody>${campanas.map(c=>{
            const roas = c.gastado ? (c.ingresos/c.gastado).toFixed(2) : '—';
            return `<tr style="border-bottom:1px solid #f1f5f9;">
              <td style="padding:6px 8px;font-weight:500;">${c.nombre}</td>
              <td style="padding:6px 8px;color:var(--text-muted);">${c.plataforma||'—'}</td>
              <td style="padding:6px 8px;"><span style="padding:2px 8px;border-radius:10px;background:${c.estado==='Activa'?'#dcfce7':'#f1f5f9'};color:${c.estado==='Activa'?'#16a34a':'#64748b'};font-size:11px;font-weight:600;">${c.estado||'—'}</span></td>
              <td style="padding:6px 8px;">$${fmtNum(c.presupuesto)}</td>
              <td style="padding:6px 8px;">$${fmtNum(c.gastado)}</td>
              <td style="padding:6px 8px;font-weight:700;color:${parseFloat(roas)>=2?'#16a34a':'#dc2626'}">${roas}x</td>
            </tr>`;}).join('')}
            <tr style="background:#f8fafc;font-weight:700;">
              <td colspan="3" style="padding:6px 8px;">TOTALES</td>
              <td style="padding:6px 8px;">$${fmtNum(totalPresup)}</td>
              <td style="padding:6px 8px;">$${fmtNum(totalGastado)}</td>
              <td style="padding:6px 8px;color:${parseFloat(roasTotal)>=2?'#16a34a':'#dc2626'}">${roasTotal}x</td>
            </tr>
          </tbody>
        </table>` : '<p style="color:var(--text-muted);font-size:13px;">Sin campañas registradas.</p>'}
      </div>

      <!-- Insights -->
      <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px;">
        <div style="font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#b45309;margin-bottom:10px;">💡 Insights y Sugerencias</div>
        <ul style="list-style:none;padding:0;display:flex;flex-direction:column;gap:8px;">
          ${insights.map(i=>`<li style="font-size:13px;color:#78350f;line-height:1.5;">${i}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;

  document.getElementById('reporteModal').classList.remove('hidden');
};

document.getElementById('closeReporteModal').addEventListener('click', () => document.getElementById('reporteModal').classList.add('hidden'));
document.getElementById('closeReporteModal2').addEventListener('click', () => document.getElementById('reporteModal').classList.add('hidden'));

window.openCampanaModal = function(id) {
  editingCampana = id ? STATE.campanas.find(c => c.id === id) : null;
  const c = editingCampana || {};
  document.getElementById('campana-modal-title').textContent = editingCampana ? 'Editar campaña' : 'Nueva campaña';
  document.getElementById('pf-nombre').value = c.nombre||'';
  document.getElementById('pf-plataforma').value = c.plataforma||'Meta Ads';
  document.getElementById('pf-estado').value = c.estado||'Activa';
  const pfAsignado = document.getElementById('pf-asignado');
  if (pfAsignado) pfAsignado.innerHTML = getAsignarOptions(c.asignado?.email || '');
  document.getElementById('pf-presupuesto').value = c.presupuesto||'';
  document.getElementById('pf-gastado').value = c.gastado||'';
  document.getElementById('pf-inicio').value = c.fechaInicio||'';
  document.getElementById('pf-fin').value = c.fechaFin||'';
  document.getElementById('pf-impresiones').value = c.impresiones||'';
  document.getElementById('pf-alcance').value = c.alcance||'';
  document.getElementById('pf-clics').value = c.clics||'';
  document.getElementById('pf-cpm').value = c.cpm||'';
  document.getElementById('pf-cpc').value = c.cpc||'';
  document.getElementById('pf-ctr').value = c.ctr||'';
  document.getElementById('pf-visitas').value = c.visitas||'';
  document.getElementById('pf-conversiones').value = c.conversiones||'';
  document.getElementById('pf-ingresos').value = c.ingresos||'';
  document.getElementById('pf-roas-eq').value = c.roasEq||'';
  const roas = c.gastado ? ((c.ingresos||0) / c.gastado).toFixed(2) : '';
  document.getElementById('pf-roas').value = roas;
  document.getElementById('deleteCampanaBtn').style.display = editingCampana ? '' : 'none';
  document.getElementById('campanaModal').classList.remove('hidden');
};

function closeCampanaModal() { document.getElementById('campanaModal').classList.add('hidden'); }
document.getElementById('closeCampanaModal').addEventListener('click', closeCampanaModal);
document.getElementById('closeCampanaModal2').addEventListener('click', closeCampanaModal);

function recalcRoas() {
  const gastado = +document.getElementById('pf-gastado').value||0;
  const ingresos = +document.getElementById('pf-ingresos').value||0;
  document.getElementById('pf-roas').value = gastado ? (ingresos/gastado).toFixed(2) : '';
}
document.getElementById('pf-gastado').addEventListener('input', recalcRoas);
document.getElementById('pf-ingresos').addEventListener('input', recalcRoas);

document.getElementById('saveCampanaBtn').addEventListener('click', async () => {
  const nombre = document.getElementById('pf-nombre').value.trim();
  if (!nombre) { alert('El nombre es obligatorio.'); return; }
  const gastado = +document.getElementById('pf-gastado').value||0;
  const ingresos = +document.getElementById('pf-ingresos').value||0;
  const pfAsignadoSel = document.getElementById('pf-asignado');
  const pfAsignadoEmail = pfAsignadoSel.value;
  const pfAsignadoNombre = pfAsignadoSel.selectedOptions[0]?.dataset.nombre || '';
  const obj = {
    ...(editingCampana||{}), nombre,
    plataforma: document.getElementById('pf-plataforma').value,
    estado: document.getElementById('pf-estado').value,
    asignado: pfAsignadoEmail ? { email: pfAsignadoEmail, nombre: pfAsignadoNombre } : null,
    presupuesto: +document.getElementById('pf-presupuesto').value||0,
    gastado, fechaInicio: document.getElementById('pf-inicio').value,
    fechaFin: document.getElementById('pf-fin').value,
    impresiones: +document.getElementById('pf-impresiones').value||0,
    alcance: +document.getElementById('pf-alcance').value||0,
    clics: +document.getElementById('pf-clics').value||0,
    cpm: +document.getElementById('pf-cpm').value||0,
    cpc: +document.getElementById('pf-cpc').value||0,
    ctr: +document.getElementById('pf-ctr').value||0,
    visitas: +document.getElementById('pf-visitas').value||0,
    conversiones: +document.getElementById('pf-conversiones').value||0,
    ingresos,
    roas: gastado ? +(ingresos/gastado).toFixed(2) : 0,
    roasEq: +document.getElementById('pf-roas-eq').value||0,
  };
  const saved = await saveCampana(clientId, obj);
  if (editingCampana) { const i = STATE.campanas.findIndex(c => c.id === saved.id); STATE.campanas[i] = saved; }
  else STATE.campanas.push(saved);
  closeCampanaModal();
  renderPauta(document.getElementById('main-content'));
});

document.getElementById('deleteCampanaBtn').addEventListener('click', async () => {
  if (!editingCampana || !confirm('¿Eliminar esta campaña?')) return;
  await deleteCampana(clientId, editingCampana.id);
  STATE.campanas = STATE.campanas.filter(c => c.id !== editingCampana.id);
  closeCampanaModal();
  renderPauta(document.getElementById('main-content'));
});

// ──────────────────────────────────────────────────────
// IMPORTAR CAMPAÑAS DESDE EXCEL
// ──────────────────────────────────────────────────────
const IMPORT_CAMPANA_ESTADOS = ['Activa', 'Pausada', 'Finalizada', 'Borrador'];
const IMPORT_CAMPANA_PLATAFORMAS = ['Meta Ads', 'Google Ads', 'TikTok Ads', 'LinkedIn Ads'];
const IMPORT_CAMPANA_HEADER_MAP = {
  nombre: 'nombre',
  plataforma: 'plataforma',
  estado: 'estado',
  'presupuesto total': 'presupuesto',
  presupuesto: 'presupuesto',
  'gastado hasta hoy': 'gastado',
  gastado: 'gastado',
  'fecha inicio': 'fechaInicio',
  'fecha fin': 'fechaFin',
  impresiones: 'impresiones',
  alcance: 'alcance',
  clics: 'clics',
  cpm: 'cpm',
  cpc: 'cpc',
  ctr: 'ctr',
  'visitas en pagina de destino': 'visitas',
  visitas: 'visitas',
  conversiones: 'conversiones',
  'ingresos generados': 'ingresos',
  ingresos: 'ingresos',
  'roas de equilibrio break-even': 'roasEq',
  'roas de equilibrio': 'roasEq',
  roaseq: 'roasEq',
};

function importCampanaNum(val) {
  if (val === '' || val == null) return 0;
  const n = parseFloat(String(val).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

let _importCampanaRows = [];

function openImportCampanasModal() {
  _importCampanaRows = [];
  document.getElementById('import-campana-file-input').value = '';
  document.getElementById('import-campana-status').textContent = '';
  document.getElementById('import-campana-preview').innerHTML = '';
  document.getElementById('confirmImportCampanaBtn').disabled = true;
  document.getElementById('importCampanaModal').classList.remove('hidden');
  loadXLSXLib();
}
window.openImportCampanasModal = openImportCampanasModal;

function closeImportCampanaModal() {
  document.getElementById('importCampanaModal').classList.add('hidden');
}
document.getElementById('closeImportCampanaModal').addEventListener('click', closeImportCampanaModal);
document.getElementById('closeImportCampanaModal2').addEventListener('click', closeImportCampanaModal);

document.getElementById('import-campana-file-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const statusEl = document.getElementById('import-campana-status');
  const previewEl = document.getElementById('import-campana-preview');
  const confirmBtn = document.getElementById('confirmImportCampanaBtn');
  previewEl.innerHTML = '';
  confirmBtn.disabled = true;
  _importCampanaRows = [];
  if (!file) return;

  statusEl.textContent = 'Leyendo archivo…';
  try {
    await loadXLSXLib();
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array', cellDates: true });
    const sheetName = wb.SheetNames.find(n => normalizeHeader(n) === 'campanas') || wb.SheetNames[0];
    const sheet = wb.Sheets[sheetName];
    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
    if (!raw.length) { statusEl.textContent = 'El archivo no tiene filas.'; return; }

    const headerRow = raw[0].map(normalizeHeader);
    const fieldByCol = headerRow.map(h => IMPORT_CAMPANA_HEADER_MAP[h] || null);

    const valid = [];
    const errores = [];
    for (let r = 1; r < raw.length; r++) {
      const dataRow = raw[r];
      if (!dataRow || dataRow.every(v => v === '' || v == null)) continue;
      const obj = {};
      fieldByCol.forEach((field, ci) => { if (field) obj[field] = dataRow[ci]; });

      const nombre = String(obj.nombre || '').trim();
      if (!nombre) { errores.push(`Fila ${r + 1}: falta el nombre de la campaña.`); continue; }

      const plataformaRaw = String(obj.plataforma || '').trim();
      const plataforma = IMPORT_CAMPANA_PLATAFORMAS.includes(plataformaRaw) ? plataformaRaw : 'Meta Ads';
      const estadoRaw = String(obj.estado || '').trim();
      const estado = IMPORT_CAMPANA_ESTADOS.includes(estadoRaw) ? estadoRaw : 'Activa';
      const gastado = importCampanaNum(obj.gastado);
      const ingresos = importCampanaNum(obj.ingresos);

      valid.push({
        nombre, plataforma, estado,
        presupuesto: importCampanaNum(obj.presupuesto),
        gastado,
        fechaInicio: importParseFecha(obj.fechaInicio),
        fechaFin: importParseFecha(obj.fechaFin),
        impresiones: importCampanaNum(obj.impresiones),
        alcance: importCampanaNum(obj.alcance),
        clics: importCampanaNum(obj.clics),
        cpm: importCampanaNum(obj.cpm),
        cpc: importCampanaNum(obj.cpc),
        ctr: importCampanaNum(obj.ctr),
        visitas: importCampanaNum(obj.visitas),
        conversiones: importCampanaNum(obj.conversiones),
        ingresos,
        roasEq: importCampanaNum(obj.roasEq),
      });
    }

    _importCampanaRows = valid;
    statusEl.textContent = `${valid.length} campaña(s) lista(s) para importar${errores.length ? ` · ${errores.length} fila(s) con error` : ''}.`;

    previewEl.innerHTML = `
      ${valid.length ? `<div class="table-wrapper table-scroll-wrap"><table class="data-table">
        <thead><tr><th>Nombre</th><th>Plataforma</th><th>Estado</th><th>Presup.</th><th>Inicio</th><th>Fin</th></tr></thead>
        <tbody>
          ${valid.map(c => `<tr><td>${c.nombre}</td><td>${c.plataforma}</td><td>${c.estado}</td><td>$${c.presupuesto}</td><td>${c.fechaInicio || '—'}</td><td>${c.fechaFin || '—'}</td></tr>`).join('')}
        </tbody>
      </table></div>` : ''}
      ${errores.length ? `<div style="margin-top:10px;padding:10px 12px;background:#fef2f2;border-radius:6px;font-size:12px;color:#991b1b;">${errores.join('<br>')}</div>` : ''}
    `;
    confirmBtn.disabled = !valid.length;
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'No se pudo leer el archivo. Verificá que sea un .xlsx válido.';
  }
});

document.getElementById('confirmImportCampanaBtn').addEventListener('click', async () => {
  if (!_importCampanaRows.length) return;
  const btn = document.getElementById('confirmImportCampanaBtn');
  btn.disabled = true; btn.textContent = 'Importando…';
  try {
    const saved = await saveCampanasBulk(clientId, _importCampanaRows);
    STATE.campanas.push(...saved);
    closeImportCampanaModal();
    renderPauta(document.getElementById('main-content'));
  } catch (err) {
    console.error(err);
    alert('Hubo un error al importar. Probá de nuevo.');
  } finally {
    btn.disabled = false; btn.textContent = 'Importar';
  }
});

// ──────────────────────────────────────────────────────
// KANBAN DRAG & DROP
// ──────────────────────────────────────────────────────
// Auto-scroll mientras se arrastra una tarjeta cerca del borde -- sin
// esto, para mover una tarjeta a otra columna hacía falta scrollear a
// mano hasta que ambas entraran en pantalla a la vez (pedido de Vaneh,
// 02/09). OJO: el layout de esta app NO scrollea la ventana -- .layout
// tiene overflow:hidden y el que scrollea de verdad es .content (ver
// css/style.css), así que window.scrollBy() no hacía nada (primer
// intento fallido). Hay que mover .content (vertical) y .kanban-board
// (horizontal, cuando hay más columnas de las que entran en pantalla).
// Se registra UNA sola vez acá (no adentro de initKanbanDrag, que se
// llama en cada render) para no acumular listeners.
(function habilitarAutoScrollKanban() {
  const MARGEN = 70, VELOCIDAD = 16;
  document.addEventListener('dragover', (e) => {
    const board = e.target.closest?.('.kanban-board');
    if (!board) return;
    const scroller = board.closest('.content') || document.scrollingElement;
    if (scroller) {
      const r = scroller.getBoundingClientRect();
      if (e.clientY < r.top + MARGEN) scroller.scrollTop -= VELOCIDAD;
      else if (e.clientY > r.bottom - MARGEN) scroller.scrollTop += VELOCIDAD;
    }
    const br = board.getBoundingClientRect();
    if (e.clientX < br.left + MARGEN) board.scrollLeft -= VELOCIDAD;
    else if (e.clientX > br.right - MARGEN) board.scrollLeft += VELOCIDAD;
  });
})();

function initKanbanDrag(boardSelector, items, onDrop) {
  let draggingId = null;
  const board = document.querySelector(boardSelector);
  if (!board) return;

  board.querySelectorAll('.kanban-card[draggable]').forEach(card => {
    card.addEventListener('dragstart', e => { draggingId = card.dataset.id; card.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', card.dataset.id); });
    card.addEventListener('dragend', () => card.classList.remove('dragging'));
  });

  board.querySelectorAll('.kanban-cards').forEach(zone => {
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.parentElement.classList.add('drag-over'); });
    zone.addEventListener('dragleave', () => zone.parentElement.classList.remove('drag-over'));
    zone.addEventListener('drop', async e => {
      e.preventDefault();
      zone.parentElement.classList.remove('drag-over');
      if (draggingId) { await onDrop(draggingId, zone.dataset.col); draggingId = null; }
    });
  });
}

// ──────────────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────────────
// Normalize linkDrive/linkDriveRef — supports old string or new array
function firstLink(val) {
  if (!val) return '';
  return Array.isArray(val) ? (val[0] || '') : val;
}

function fmtDate(d) {
  if (!d) return '';
  try { return new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric' }); } catch { return d; }
}

function fmtNum(n) {
  if (!n && n !== 0) return '—';
  return Number(n).toLocaleString('es-AR');
}

function statusBadge(estado) {
  const map = { 'Idea':'s-idea','En proceso':'s-proceso','En revisión':'s-revision','Aprobado':'s-aprobado','Programado':'s-programado','Publicado':'s-publicado' };
  return `<span class="status-badge ${map[estado]||'s-idea'}">${estado||'—'}</span>`;
}

function statusColor(estado) {
  const map = { 'Idea':'#94a3b8','En proceso':'#f59e0b','En revisión':'#ec4899','Aprobado':'#10b981','Programado':'#3b82f6','Publicado':'#22c55e' };
  return map[estado] || '#94a3b8';
}

function statusDot(estado) {
  return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${statusColor(estado)};border:1.5px solid white;"></span>`;
}

function platBadge(plat) {
  if (!plat) return '';
  const map = { Instagram:'plat-ig', Facebook:'plat-fb', LinkedIn:'plat-li', Twitter:'plat-tw' };
  const abbr = { Instagram:'IG', Facebook:'FB', LinkedIn:'LI', Twitter:'TW' };
  return `<span class="plat-badge ${map[plat]||''}">${abbr[plat]||(plat.slice(0,2).toUpperCase())} · ${plat}</span>`;
}

function platIcon(plat) {
  if (!plat) return '';
  return { Instagram:'IG', Facebook:'FB', LinkedIn:'LI', Twitter:'TW' }[plat] || plat.slice(0,2).toUpperCase();
}

function driveThumb(url) {
  const m = url && url.match(/\/d\/([^/]+)/);
  return m ? `https://drive.google.com/thumbnail?id=${m[1]}&sz=w400` : '';
}

function normUbicacion(u) {
  if (!u) return [];
  return Array.isArray(u) ? u : [u];
}

// ── Recurrencia → show/hide dias-semana ───────────────
document.getElementById('tf-recurrencia').addEventListener('change', function() {
  document.getElementById('dias-semana-group').style.display = this.value === 'dias-semana' ? '' : 'none';
});

// ── Todo modal wiring ──────────────────────────────────
function closeTodoModal() { document.getElementById('todoModal').classList.add('hidden'); }
document.getElementById('closeTodoModal').addEventListener('click', closeTodoModal);
document.getElementById('closeTodoModal2').addEventListener('click', closeTodoModal);
document.getElementById('saveTodoBtn').addEventListener('click', async () => {
  const text = document.getElementById('todo-text').value.trim();
  if (!text) { alert('El título es obligatorio.'); return; }
  const vencimiento = document.getElementById('todo-vencimiento').value || null;
  const prioridad = document.getElementById('todo-prioridad').value;
  // Create as a real tarea so it appears in the Kanban too
  const obj = { titulo: text, estado: 'Sin empezar', prioridad, vencimiento, notas: '', subtareas: [] };
  const saved = await saveTarea(clientId, obj);
  STATE.tareas.push(saved);
  closeTodoModal();
  updateBadges();
  if (currentSection === 'home') renderSection('home');
  else if (currentSection === 'tareas') refreshTareasView();
});

// ── Link modal wiring ──────────────────────────────────
function closeLinkModal() { document.getElementById('linkModal').classList.add('hidden'); }
document.getElementById('closeLinkModal').addEventListener('click', closeLinkModal);
document.getElementById('closeLinkModal2').addEventListener('click', closeLinkModal);
document.getElementById('saveLinkBtn').addEventListener('click', async () => {
  const titulo = document.getElementById('lf-titulo').value.trim();
  const url = document.getElementById('lf-url').value.trim();
  if (!titulo || !url) { alert('Título y URL son obligatorios.'); return; }
  const obj = { ...(_editingLink || {}), id: _editingLink?.id || Date.now(), titulo, url, desc: document.getElementById('lf-desc').value.trim(), categoria: (document.getElementById('lf-categoria')?.value || '').trim() };
  if (_editingLink) {
    const i = STATE.links.findIndex(l => l.id === obj.id);
    STATE.links[i] = obj;
  } else {
    STATE.links.push(obj);
  }
  STATE.home.links = STATE.links;
  await saveHomeData(clientId, STATE.home);
  closeLinkModal();
  renderLinks(document.getElementById('links-col-body'));
  setTimeout(refreshIcons, 50);
});
document.getElementById('deleteLinkBtn').addEventListener('click', async () => {
  if (!_editingLink || !confirm('¿Eliminar este link?')) return;
  STATE.links = STATE.links.filter(l => l.id !== _editingLink.id);
  STATE.home.links = STATE.links;
  await saveHomeData(clientId, STATE.home);
  closeLinkModal();
  renderLinks(document.getElementById('links-col-body'));
  setTimeout(refreshIcons, 50);
});

// ── Idea modal wiring ──────────────────────────────────
function closeIdeaModal() { document.getElementById('ideaModal').classList.add('hidden'); }
document.getElementById('closeIdeaModal').addEventListener('click', closeIdeaModal);
document.getElementById('closeIdeaModal2').addEventListener('click', closeIdeaModal);
document.getElementById('saveIdeaBtn').addEventListener('click', async () => {
  const titulo = document.getElementById('if-titulo').value.trim();
  if (!titulo) { alert('El título es obligatorio.'); return; }
  const plats = Array.from(document.querySelectorAll('.idea-plat-check:checked')).map(cb => cb.value);
  const obj = {
    ...(_editingIdea || {}),
    titulo,
    notas: document.getElementById('if-notas').value,
    formato: document.getElementById('if-formato').value,
    plataformas: plats,
  };
  const saved = await saveIdea(clientId, obj);
  if (_editingIdea) { const i = STATE.ideas.findIndex(x => x.id === saved.id); STATE.ideas[i] = saved; }
  else STATE.ideas.push(saved);
  closeIdeaModal();
  renderContTab('ideas');
});

// ── Sitio Web modal wiring ─────────────────────────────
function closeWebTaskModal() { document.getElementById('webTaskModal').classList.add('hidden'); }
document.getElementById('closeWebTaskModal').addEventListener('click', closeWebTaskModal);
document.getElementById('closeWebTaskModal2').addEventListener('click', closeWebTaskModal);

document.getElementById('saveWebTaskBtn').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  if (btn.disabled) return;
  const titulo = document.getElementById('wt-titulo').value.trim();
  if (!titulo) { alert('La descripción es obligatoria.'); return; }
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    if (!STATE.home.webTareas) STATE.home.webTareas = [];
    const wtEstadoVal = document.getElementById('wt-estado').value;
    const obj = {
      ...(_editingWebTask || {}),
      id: _editingWebTask?.id || Date.now(),
      titulo,
      categoria: document.getElementById('wt-categoria').value,
      estado: wtEstadoVal,
      vencimiento: document.getElementById('wt-vencimiento').value || null,
      url: document.getElementById('wt-url').value.trim() || null,
      notas: document.getElementById('wt-notas').value.trim(),
      completadoEn: wtEstadoVal === 'Listo' ? (_editingWebTask?.estado === 'Listo' ? _editingWebTask.completadoEn : new Date().toISOString().split('T')[0]) : null,
    };
    if (_editingWebTask) {
      const i = STATE.home.webTareas.findIndex(t => t.id === obj.id);
      STATE.home.webTareas[i] = obj;
    } else {
      STATE.home.webTareas.push(obj);
    }
    await saveHomeData(clientId, STATE.home);
    closeWebTaskModal();
    renderSection(currentSection);
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar';
  }
});

document.getElementById('deleteWebTaskBtn').addEventListener('click', async () => {
  if (!_editingWebTask || !confirm('¿Eliminar esta tarea?')) return;
  STATE.home.webTareas = (STATE.home.webTareas||[]).filter(t => t.id !== _editingWebTask.id);
  await saveHomeData(clientId, STATE.home);
  closeWebTaskModal();
  renderSection(currentSection);
});

// ── Aprobación de contenido ────────────────────────────
window.aprobarContenido = async function(id) {
  const c = STATE.contenidos.find(x => x.id === id);
  if (!c) return;
  c.estado = 'Aprobado';
  await saveContenido(clientId, c);
  STATE.contenidos[STATE.contenidos.findIndex(x => x.id === id)] = c;
  renderContTab(activeContTab);
  // Notificar al cliente por email
  if (STATE.client.email) {
    const { WORKER_URL } = await import('./firebase.js');
    const { getSessionToken } = await import('./auth.js');
    fetch(WORKER_URL + '/email/aprobado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getSessionToken()}` },
      body: JSON.stringify({
        toEmail: STATE.client.email,
        toName: STATE.client.nombre || STATE.client.name || '',
        titulo: c.titulo || '',
        tipo: c.tipo || '',
        cuenta: c.cuenta || c.red || '',
        fechaPub: c.fechaPub || '',
        clientId,
      }),
    }).catch(() => {});
  }
};

window.rechazarContenido = async function(id) {
  const c = STATE.contenidos.find(x => x.id === id);
  if (!c) return;
  const motivo = prompt('Motivo del rechazo (opcional):');
  if (motivo === null) return;
  c.estado = 'En proceso';
  if (motivo) c.notas = `[Rechazado: ${motivo}]${c.notas ? ' — ' + c.notas : ''}`;
  await saveContenido(clientId, c);
  STATE.contenidos[STATE.contenidos.findIndex(x => x.id === id)] = c;
  renderContTab(activeContTab);
};

// ── Comentarios ────────────────────────────────────────
function renderComments(ctx, comments) {
  const prefix = ctx === 'cont' ? 'cont' : 'tarea';
  const listEl = document.getElementById(`${prefix}-comments-list`);
  if (!listEl) return;
  if (!comments || !comments.length) {
    listEl.innerHTML = '<p style="font-size:12px;color:var(--text-muted);margin:0;">Sin comentarios aún.</p>';
    return;
  }
  listEl.innerHTML = comments.map((c, idx) => {
    const inicial = (c.autor || '?')[0].toUpperCase();
    const textoHtml = (c.texto || '').replace(/@(\w+)/g, '<strong style="color:var(--accent);">@$1</strong>');
    const vistoPor = c.vistoPor || [];
    const yoLoVi = vistoPor.some(v => v.email === user.email);
    const vistoTitle = vistoPor.length ? `Visto por ${vistoPor.map(v => v.nombre).join(', ')}` : 'Marcar como visto';
    return `
    <div style="display:flex;gap:8px;align-items:flex-start;">
      <div style="width:26px;height:26px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0;">${inicial}</div>
      <div style="flex:1;background:#f8fafc;border:1px solid var(--border-strong);border-radius:8px;padding:7px 10px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:2px;">
          <span style="font-size:11px;font-weight:700;color:var(--text);">${c.autor || 'Anónimo'}</span>
          <span style="font-size:10px;color:var(--text-muted);">${c.fecha || ''}</span>
        </div>
        <p style="font-size:13px;margin:0 0 4px;color:var(--text);">${textoHtml}</p>
        <button onclick="toggleCommentSeen('${ctx}',${idx})" title="${vistoTitle}" style="background:none;border:none;cursor:pointer;padding:0;display:inline-flex;align-items:center;gap:4px;font-size:11px;color:${yoLoVi ? '#10b981' : '#94a3b8'};font-weight:${yoLoVi ? '700' : '400'};">
          ✓ ${vistoPor.length ? vistoTitle : 'Visto'}
        </button>
      </div>
    </div>`;
  }).join('');
  listEl.scrollTop = listEl.scrollHeight;
}

function renderAsignadoVisto(selectId, item) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const existing = document.getElementById(selectId + '-visto');
  if (existing) existing.remove();
  const a = item?.asignado;
  if (!a || !a.email) return;
  const div = document.createElement('div');
  div.id = selectId + '-visto';
  div.style.cssText = 'font-size:11px;margin-top:4px;';
  if (a.visto) {
    div.style.color = '#10b981';
    div.textContent = `👁 Visto por ${a.nombre}${a.vistoFecha ? ' el ' + a.vistoFecha : ''}`;
  } else {
    div.style.color = '#94a3b8';
    div.textContent = `${a.nombre} todavía no vio esta asignación`;
  }
  sel.insertAdjacentElement('afterend', div);
}

async function marcarAsignacionVista(item, saveFn, stateArr) {
  const a = item?.asignado;
  if (!a || a.email !== user.email || a.visto) return;
  a.visto = true;
  a.vistoFecha = new Date().toLocaleDateString('es-AR');
  const saved = await saveFn(clientId, item);
  const i = stateArr.findIndex(x => x.id === item.id);
  if (i >= 0) stateArr[i] = saved;
}

async function notifyAsignacion(tipo, item, prevAsignadoEmail) {
  const asignado = item.asignado;
  if (!asignado || !asignado.email || asignado.email === prevAsignadoEmail || asignado.email === user.email) return;
  try {
    const { WORKER_URL } = await import('./firebase.js');
    const { getSessionToken } = await import('./auth.js');
    fetch(WORKER_URL + '/email/asignacion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getSessionToken()}` },
      body: JSON.stringify({
        toEmail: asignado.email,
        toName: asignado.nombre,
        asignadorNombre: user.name || user.email.split('@')[0],
        titulo: item.titulo || '',
        tipo,
        itemId: item.id,
        clientId,
      }),
    }).catch(() => {});
  } catch (e) { /* no bloquea el guardado si falla la notificación */ }
}

function getAsignarOptions(currentEmail) {
  const options = [];
  if (STATE.client.email) options.push({ nombre: STATE.client.nombre || STATE.client.name || 'Cliente', email: STATE.client.email });
  (STATE.client.usuarios || []).forEach(u => options.push(u));
  const seen = new Set();
  const unique = options.filter(u => {
    if (!u.email || seen.has(u.email.toLowerCase())) return false;
    seen.add(u.email.toLowerCase());
    return true;
  });
  return '<option value="">Sin asignar</option>' + unique.map(u =>
    `<option value="${u.email}" data-nombre="${u.nombre}" ${currentEmail === u.email ? 'selected' : ''}>${u.nombre} — ${u.email}</option>`
  ).join('');
}

// Mismo equipo que getAsignarOptions (cliente + colaboradores agregados
// en "Equipo") pero para el filtro de Tareas -- sin el "Sin asignar" de
// arriba (ese es la opción por defecto al asignar; acá va aparte, al
// final, como filtro explícito).
function opcionesFiltroAsignadoTareas() {
  const options = [];
  if (STATE.client.email) options.push({ nombre: STATE.client.nombre || STATE.client.name || 'Cliente', email: STATE.client.email });
  (STATE.client.usuarios || []).forEach(u => options.push(u));
  const seen = new Set();
  const unique = options.filter(u => {
    if (!u.email || seen.has(u.email.toLowerCase())) return false;
    seen.add(u.email.toLowerCase());
    return true;
  });
  return unique.map(u => `<option value="${u.email}">${u.nombre}</option>`).join('');
}

function getMentionUsers() {
  const usuarios = STATE.client.usuarios || [];
  return [
    { nombre: user.name || user.email.split('@')[0], email: user.email },
    ...usuarios
  ];
}

function setupMentionAutocomplete(inputId, dropdownId) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  if (!input || !dropdown) return;
  input.addEventListener('input', () => {
    const val = input.value;
    const atIdx = val.lastIndexOf('@');
    if (atIdx === -1) { dropdown.classList.add('hidden'); return; }
    const query = val.slice(atIdx + 1).toLowerCase();
    const users = getMentionUsers().filter(u => u.nombre.toLowerCase().includes(query) || u.email.toLowerCase().includes(query));
    if (!users.length) { dropdown.classList.add('hidden'); return; }
    dropdown.innerHTML = users.map(u => `
      <div class="mention-item" data-nombre="${u.nombre}">
        <div class="mention-avatar">${u.nombre[0].toUpperCase()}</div>
        <div><div style="font-weight:600;font-size:12px;">${u.nombre}</div><div style="font-size:11px;color:var(--text-muted);">${u.email}</div></div>
      </div>`).join('');
    dropdown.classList.remove('hidden');
    dropdown.querySelectorAll('.mention-item').forEach(item => {
      item.addEventListener('click', () => {
        const nombre = item.dataset.nombre;
        const atIdx2 = input.value.lastIndexOf('@');
        input.value = input.value.slice(0, atIdx2) + '@' + nombre + ' ';
        dropdown.classList.add('hidden');
        input.focus();
      });
    });
  });
  input.addEventListener('blur', () => setTimeout(() => dropdown.classList.add('hidden'), 150));
}

async function doAddComment(ctx, editingObj, saveFn, stateArr, idField) {
  const prefix = ctx === 'cont' ? 'cont' : 'tarea';
  const input = document.getElementById(`${prefix}-comment-input`);
  if (!input) return;
  const texto = input.value.trim();
  if (!texto) return;
  if (!editingObj) {
    input.placeholder = '⚠ Guardá primero para comentar';
    setTimeout(() => { input.placeholder = '@usuario — escribí un comentario...'; }, 2000);
    return;
  }
  const autorNombre = user.name || user.email.split('@')[0];
  const comment = { autor: autorNombre, email: user.email, fecha: new Date().toLocaleDateString('es-AR'), texto };
  if (!editingObj.comentarios) editingObj.comentarios = [];
  editingObj.comentarios.push(comment);
  await saveFn(clientId, editingObj);
  const i = stateArr.findIndex(x => x.id === editingObj.id);
  if (i >= 0) stateArr[i] = editingObj;
  input.value = '';
  renderComments(ctx, editingObj.comentarios);
  // Notificar por email a los usuarios mencionados con @
  const mencionados = [...texto.matchAll(/@(\w+)/g)].map(m => m[1]);
  const allUsers = getMentionUsers();
  const { WORKER_URL } = await import('./firebase.js');
  const { getSessionToken } = await import('./auth.js');
  mencionados.forEach(nombre => {
    const u = allUsers.find(u => u.nombre.toLowerCase() === nombre.toLowerCase());
    if (u && u.email && u.email !== user.email) {
      fetch(WORKER_URL + '/email/mencion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getSessionToken()}` },
        body: JSON.stringify({
          toEmail: u.email,
          toName: u.nombre,
          mencionador: autorNombre,
          contexto: editingObj.titulo || '',
          tipo: ctx === 'cont' ? 'contenido' : 'tarea',
          itemId: editingObj.id,
          clientId,
        }),
      }).catch(() => {});
    }
  });
}

window.addContenidoComment = () => doAddComment('cont', editingContenido, saveContenido, STATE.contenidos);
window.addTareaComment = () => doAddComment('tarea', editingTarea, saveTarea, STATE.tareas);

window.toggleCommentSeen = async function(ctx, idx) {
  const editingObj = ctx === 'cont' ? editingContenido : editingTarea;
  const saveFn = ctx === 'cont' ? saveContenido : saveTarea;
  const stateArr = ctx === 'cont' ? STATE.contenidos : STATE.tareas;
  if (!editingObj || !editingObj.comentarios || !editingObj.comentarios[idx]) return;
  const comment = editingObj.comentarios[idx];
  if (!comment.vistoPor) comment.vistoPor = [];
  const yaLoVi = comment.vistoPor.findIndex(v => v.email === user.email);
  if (yaLoVi >= 0) comment.vistoPor.splice(yaLoVi, 1);
  else comment.vistoPor.push({ email: user.email, nombre: user.name || user.email.split('@')[0] });
  await saveFn(clientId, editingObj);
  const i = stateArr.findIndex(x => x.id === editingObj.id);
  if (i >= 0) stateArr[i] = editingObj;
  renderComments(ctx, editingObj.comentarios);
};

// Inicializar autocomplete de mentions al cargar
setTimeout(() => {
  setupMentionAutocomplete('cont-comment-input', 'cont-mention-list');
  setupMentionAutocomplete('tarea-comment-input', 'tarea-mention-list');
}, 200);

// ── Gestión de equipo ──────────────────────────────────
window.openEquipoModal = function() {
  renderEquipoList();
  ['eq-nombre','eq-apellido','eq-email','eq-telefono','eq-instagram','eq-linkedin','eq-tiktok','eq-facebook'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('eq-rol').value = 'Responsable COSMART';
  document.getElementById('eq-cargo').value = '';
  document.getElementById('equipoModal').classList.remove('hidden');
};

function renderEquipoList() {
  const usuarios = STATE.client.usuarios || [];
  const list = document.getElementById('equipo-list');
  if (!list) return;
  if (!usuarios.length) {
    list.innerHTML = '<p style="font-size:12px;color:var(--text-muted);">Sin usuarios agregados todavía.</p>';
    return;
  }
  const redes = (u) => [
    u.instagram ? `<a href="https://instagram.com/${u.instagram.replace(/^@/,'')}" target="_blank" style="color:var(--accent);">IG</a>` : '',
    u.linkedin ? `<a href="${u.linkedin.startsWith('http') ? u.linkedin : 'https://' + u.linkedin}" target="_blank" style="color:var(--accent);">in</a>` : '',
    u.tiktok ? `<a href="https://tiktok.com/${u.tiktok.startsWith('@') ? u.tiktok : '@' + u.tiktok}" target="_blank" style="color:var(--accent);">TT</a>` : '',
    u.facebook ? `<a href="${u.facebook.startsWith('http') ? u.facebook : 'https://' + u.facebook}" target="_blank" style="color:var(--accent);">FB</a>` : '',
  ].filter(Boolean).join(' · ');
  list.innerHTML = usuarios.map((u, i) => `
    <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:#f8fafc;border:1px solid var(--border-strong);border-radius:8px;">
      <div style="width:32px;height:32px;border-radius:50%;background:var(--accent);color:#fff;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;flex-shrink:0;">${(u.nombre||'?')[0].toUpperCase()}</div>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;font-size:13px;">${u.nombre}${u.apellido ? ' ' + u.apellido : ''}</div>
        <div style="font-size:11px;color:var(--text-muted);">${u.email}${u.telefono ? ' · ' + u.telefono : ''} · <span style="color:var(--accent);">${u.rol||'Usuario'}</span>${u.cargo ? ' · ' + u.cargo : ''}</div>
        ${redes(u) ? `<div style="font-size:11px;margin-top:2px;">${redes(u)}</div>` : ''}
      </div>
      <button onclick="eliminarUsuarioEquipo(${i})" style="background:none;border:none;cursor:pointer;color:#94a3b8;font-size:18px;padding:2px 6px;" title="Eliminar">×</button>
    </div>
  `).join('');
}

window.agregarUsuarioEquipo = async function() {
  const nombre = document.getElementById('eq-nombre').value.trim();
  const apellido = document.getElementById('eq-apellido').value.trim();
  const email = document.getElementById('eq-email').value.trim();
  const telefono = document.getElementById('eq-telefono').value.trim();
  const rol = document.getElementById('eq-rol').value;
  const cargo = document.getElementById('eq-cargo').value;
  const instagram = document.getElementById('eq-instagram').value.trim();
  const linkedin = document.getElementById('eq-linkedin').value.trim();
  const tiktok = document.getElementById('eq-tiktok').value.trim();
  const facebook = document.getElementById('eq-facebook').value.trim();
  if (!nombre || !email) { alert('Nombre y email son obligatorios.'); return; }
  if (!STATE.client.usuarios) STATE.client.usuarios = [];
  if (STATE.client.usuarios.length >= 5) { alert('Límite alcanzado: podés tener hasta 5 miembros en tu equipo.'); return; }
  if (STATE.client.usuarios.find(u => u.email === email)) { alert('Ya existe un usuario con ese email.'); return; }
  STATE.client.usuarios.push({ nombre, apellido, email, telefono, rol, cargo, instagram, linkedin, tiktok, facebook });
  await saveClientData(clientId, { usuarios: STATE.client.usuarios });
  ['eq-nombre','eq-apellido','eq-email','eq-telefono','eq-instagram','eq-linkedin','eq-tiktok','eq-facebook'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('eq-cargo').value = '';
  renderEquipoList();
};

window.eliminarUsuarioEquipo = async function(idx) {
  if (!confirm('¿Eliminar este usuario del equipo?')) return;
  STATE.client.usuarios.splice(idx, 1);
  await saveClientData(clientId, { usuarios: STATE.client.usuarios });
  renderEquipoList();
};

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  if (overlay.id === 'mustChangePasswordModal') return; // obligatorio, no se cierra clickeando afuera
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.add('hidden'); });
});

// ── Mobile sidebar toggle ──────────────────────────────
const _sidebar = document.querySelector('.sidebar');
const _sidebarOverlay = document.getElementById('sidebar-overlay');
const _sidebarToggle = document.getElementById('sidebar-toggle');

function openMobileSidebar() {
  _sidebar.classList.add('open');
  _sidebarOverlay.classList.add('active');
}
function closeMobileSidebar() {
  _sidebar.classList.remove('open');
  _sidebarOverlay.classList.remove('active');
}

_sidebarToggle?.addEventListener('click', () => {
  _sidebar.classList.contains('open') ? closeMobileSidebar() : openMobileSidebar();
});
_sidebarOverlay?.addEventListener('click', closeMobileSidebar);

// Cerrar al navegar en mobile
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => { if (window.innerWidth <= 768) closeMobileSidebar(); });
});

// ── Bottom nav mobile ──────────────────────────────────
const _bottomNav = document.getElementById('mobile-bottom-nav');

function updateBottomNav(sec) {
  if (!_bottomNav) return;
  _bottomNav.querySelectorAll('.bnav-btn[data-section]').forEach(b => {
    b.classList.toggle('active', b.dataset.section === sec);
  });
}

function updateFab(sec) {
  const fab = document.getElementById('fab-btn');
  if (!fab) return;
  const fabSections = { home: () => openTareaModal(null), contenidos: () => openContenidoModal(null), tareas: () => openTareaModal(null) };
  if (fabSections[sec] && window.innerWidth <= 768) {
    fab.style.display = 'flex';
    fab.onclick = fabSections[sec];
  } else {
    fab.style.display = 'none';
  }
}

// Bottom nav clicks
_bottomNav?.querySelectorAll('.bnav-btn[data-section]').forEach(btn => {
  btn.addEventListener('click', () => renderSection(btn.dataset.section));
});

// Botón "Más" → abre sidebar
document.getElementById('bnav-more')?.addEventListener('click', openMobileSidebar);

// Badge tareas en bottom nav
function updateBnavBadge() {
  const badge = document.getElementById('bnav-badge-tareas');
  if (!badge) return;
  const vencidas = (STATE.tareas || []).filter(t => !t.archivado && t.vencimiento && t.vencimiento < new Date().toISOString().split('T')[0]).length;
  badge.textContent = vencidas || '';
  badge.classList.toggle('visible', vencidas > 0);
}


// ── Collapsible avanzado en modal contenido ────────────
window.toggleContAdvanced = function() {
  const section = document.getElementById('cont-advanced');
  const btn = document.getElementById('cont-advanced-toggle');
  if (!section || !btn) return;
  const isOpen = section.classList.contains('open');
  section.classList.toggle('open', !isOpen);
  btn.classList.toggle('open', !isOpen);
  btn.innerHTML = `<i data-lucide="${isOpen ? 'chevron-down' : 'chevron-up'}" style="width:14px;height:14px;stroke-width:2;"></i> ${isOpen ? 'Ver más opciones' : 'Ocultar opciones avanzadas'}`;
  refreshIcons();
};

// ── Start ──────────────────────────────────────────────
function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function showMustChangePasswordModal() {
  const modal = document.getElementById('mustChangePasswordModal');
  if (!modal) { init(); return; } // por si el HTML no se actualizó todavía, no bloquear el acceso
  modal.classList.remove('hidden');
  const err = document.getElementById('mcp-error');
  const btn = document.getElementById('mcpSaveBtn');
  btn.onclick = async () => {
    err.style.display = 'none';
    const actual = document.getElementById('mcp-actual').value;
    const nueva = document.getElementById('mcp-nueva').value;
    const confirmar = document.getElementById('mcp-confirmar').value;
    if (!actual || !nueva) { err.textContent = 'Completá los dos campos.'; err.style.display = ''; return; }
    if (nueva.length < 6) { err.textContent = 'La contraseña nueva debe tener al menos 6 caracteres.'; err.style.display = ''; return; }
    if (nueva !== confirmar) { err.textContent = 'Las contraseñas nuevas no coinciden.'; err.style.display = ''; return; }
    btn.disabled = true; btn.textContent = 'Guardando…';
    try {
      await changePassword(actual, nueva);
      modal.classList.add('hidden');
      init();
    } catch (e) {
      err.textContent = e.message || 'Error al cambiar la contraseña.';
      err.style.display = '';
    } finally {
      btn.disabled = false; btn.textContent = 'Guardar y entrar';
    }
  };
}

if (user.mustChangePassword) {
  showMustChangePasswordModal();
} else {
  init();
}
