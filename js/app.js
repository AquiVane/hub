import { requireAuth, logoutUser } from './auth.js';
import {
  getClientData, getContenidos, saveContenido, deleteContenido,
  getTareas, saveTarea, deleteTarea,
  getCampanas, saveCampana, deleteCampana,
  getMetricas, saveMetricasData, getHomeData, saveHomeData,
  getIdeas, saveIdea, deleteIdea
} from './data.js';

// ── Bootstrap ──────────────────────────────────────────
const user = requireAuth();
if (!user) throw new Error('No auth');

const params = new URLSearchParams(window.location.search);
const clientId = params.get('client') || user.clientId;
if (!clientId) { window.location.href = '../admin/index.html'; }

let STATE = { contenidos: [], tareas: [], campanas: [], metricas: {}, ideas: [], client: {}, links: [] };
let currentSection = 'home';
let editingContenido = null;
let editingTarea = null;
let editingCampana = null;

// ── Init ───────────────────────────────────────────────
async function init() {
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
  setupNav();
  renderSection('home');
  setTimeout(() => refreshIcons(), 100);
}

async function loadAllData() {
  const [cont, tareas, campanas, metricas, home, ideas] = await Promise.all([
    getContenidos(clientId), getTareas(clientId), getCampanas(clientId),
    getMetricas(clientId), getHomeData(clientId), getIdeas(clientId)
  ]);
  STATE.contenidos = cont;
  STATE.tareas = tareas;
  STATE.campanas = campanas;
  STATE.metricas = metricas;
  STATE.home = home || { prioridades: [], todos: [], links: [], webTareas: [] };
  STATE.ideas = ideas;
  STATE.links = STATE.home.links || [];
  updateBadges();
}

function applyClientLogo(src) {
  const img = document.getElementById('sb-client-logo');
  const placeholder = document.getElementById('sb-client-logo-placeholder');
  img.src = src;
  img.style.display = 'block';
  if (placeholder) placeholder.style.display = 'none';
}

function updateBadges() {
  const pending = STATE.tareas.filter(t => t.estado !== 'Listo').length;
  document.getElementById('badge-tareas').textContent = pending;
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
  const titles = { home: 'Inicio', dashboard: 'Dashboard Editorial', contenidos: 'Contenidos', tareas: 'Tareas', pauta: 'Pauta Digital', links: 'Links', web: 'Sitio Web', instrucciones: 'Instrucciones' };
  const subs = { home: 'Resumen y prioridades del mes', dashboard: 'Calendario editorial y métricas de contenido', contenidos: 'Gestión de contenidos para redes sociales', tareas: 'Tareas internas del equipo', pauta: 'Campañas y métricas de pauta digital', links: 'Atajos rápidos a tus recursos', web: 'Gestión del sitio web: contenidos, arreglos y métricas', instrucciones: 'Guía de uso del Marketing Hub' };
  document.getElementById('topbar-title').textContent = titles[sec];
  document.getElementById('topbar-sub').textContent = subs[sec];

  const actions = document.getElementById('topbar-actions');
  actions.innerHTML = '';

  const content = document.getElementById('main-content');

  if (sec === 'home') { renderHome(content); setTimeout(refreshIcons, 50); }
  else if (sec === 'dashboard') { renderDashboard(content); setTimeout(refreshIcons, 50); }
  else if (sec === 'contenidos') {
    const rptBtn = document.createElement('button');
    rptBtn.className = 'btn btn-secondary';
    rptBtn.textContent = '📊 Reporte';
    rptBtn.onclick = () => openReporteModal();
    actions.appendChild(rptBtn);
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = '+ Nuevo contenido';
    btn.onclick = () => openContenidoModal(null);
    actions.appendChild(btn);
    renderContenidos(content);
    setTimeout(refreshIcons, 50);
  }
  else if (sec === 'tareas') {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = '+ Nueva tarea';
    btn.onclick = () => openTareaModal(null);
    actions.appendChild(btn);
    renderTareas(content);
    setTimeout(refreshIcons, 50);
  }
  else if (sec === 'pauta') {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = '+ Nueva campaña';
    btn.onclick = () => openCampanaModal(null);
    actions.appendChild(btn);
    renderPauta(content);
    setTimeout(refreshIcons, 50);
  }
  else if (sec === 'links') {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = '+ Nuevo link';
    btn.onclick = () => openLinkModal(null);
    actions.appendChild(btn);
    renderLinks(content);
    setTimeout(refreshIcons, 50);
  }
  else if (sec === 'web') {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = '+ Nueva tarea web';
    btn.onclick = () => openWebTaskModal(null);
    actions.appendChild(btn);
    renderWeb(content);
    setTimeout(refreshIcons, 50);
  }
  else if (sec === 'instrucciones') {
    renderInstrucciones(content);
    setTimeout(refreshIcons, 50);
  }
}

// ──────────────────────────────────────────────────────
// DASHBOARD EDITORIAL
// ──────────────────────────────────────────────────────
let dashYear = new Date().getFullYear();
let dashMonth = new Date().getMonth(); // 0-based

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
              const tareasPend = STATE.tareas.filter(t => t.estado === 'Sin empezar' && !t.archivado);
              const allItems = [
                ...todos.map(t => ({ type:'todo', ...t })),
                ...tareasPend.map(t => ({ type:'tarea', id: t.id, text: t.titulo, done: false, tarea: t }))
              ];
              if (!allItems.length) return `<p class="text-muted text-sm">Sin tareas pendientes.</p>`;
              return allItems.map(item => {
                if (item.type === 'tarea') return `
                  <div class="todo-item" style="border-left:3px solid #3b82f6;padding-left:8px;">
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
          return `<table class="data-table">
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
          </table>`;
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
        <button class="tab-btn ${activeContTab==='banco'?'active':''}" data-tab="banco">📋 Banco de contenidos</button>
        <button class="tab-btn ${activeContTab==='calendario'?'active':''}" data-tab="calendario">📅 Calendario</button>
        <button class="tab-btn ${activeContTab==='estados'?'active':''}" data-tab="estados">🗂 Estados (Kanban)</button>
        <button class="tab-btn ${activeContTab==='feed-ig'?'active':''}" data-tab="feed-ig">📸 Feed IG</button>
        <button class="tab-btn ${activeContTab==='muro-fb'?'active':''}" data-tab="muro-fb">📘 Muro FB</button>
        <button class="tab-btn ${activeContTab==='stories'?'active':''}" data-tab="stories">▯ Stories IG</button>
        <button class="tab-btn ${activeContTab==='ideas'?'active':''}" data-tab="ideas">💡 Banco de ideas</button>
        <button class="tab-btn ${activeContTab==='proceso'?'active':''}" data-tab="proceso">✏️ En proceso</button>
        <button class="tab-btn ${activeContTab==='metricas'?'active':''}" data-tab="metricas">📈 Métricas</button>
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

// ─ Banco de contenidos (tabla editable) ─
function renderBancoContenidos(container) {
  const all = [...STATE.contenidos].sort((a,b) => (a.fechaPub||'zzz') > (b.fechaPub||'zzz') ? 1 : -1);
  container.innerHTML = `
    <div style="display:flex;justify-content:flex-end;margin-bottom:10px;">
      <button class="btn btn-primary btn-sm" onclick="openContenidoModal(null)">+ Nuevo contenido</button>
    </div>
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Fecha pub.</th><th>Título</th><th>Plataforma</th>
            <th>Estado</th><th>Formato</th><th>Eje</th>
            <th>Drive</th><th>Notas</th>
          </tr>
        </thead>
        <tbody>
          ${all.map(c => `
            <tr data-id="${c.id}" onclick="openContenidoModalById('${c.id}')" style="cursor:pointer;" class="banco-row">
              <td>
                <input type="date" value="${c.fechaPub||''}" class="banco-date-input"
                  onclick="event.stopPropagation()"
                  onchange="bancoUpdateFecha('${c.id}', this.value)"
                  style="border:none;background:transparent;font-size:12px;color:var(--text);cursor:pointer;width:120px;">
              </td>
              <td style="font-weight:500;min-width:160px;">${c.titulo}</td>
              <td>${(c.plataformas||[]).map(p => platBadge(p)).join(' ')}</td>
              <td>${statusBadge(c.estado)}</td>
              <td style="font-size:12px;">${Array.isArray(c.formato)?c.formato.join(', '):(c.formato||'')}</td>
              <td style="font-size:12px;">${c.eje||''}</td>
              <td>${firstLink(c.linkDrive) ? `<a class="drive-link" href="${firstLink(c.linkDrive)}" target="_blank" onclick="event.stopPropagation()" title="${firstLink(c.linkDrive)}">📎</a>` : ''}</td>
              <td class="text-sm text-muted" style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.notas||''}</td>
            </tr>
          `).join('')}
          <tr onclick="openContenidoModal(null)" style="cursor:pointer;opacity:.55;" class="banco-row">
            <td colspan="8" style="text-align:center;padding:10px;font-size:12px;border-style:dashed;">
              ＋ Agregar nuevo contenido
            </td>
          </tr>
        </tbody>
      </table>
    </div>
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
      const dayConts = STATE.contenidos.filter(c => c.fechaPub === dateStr);

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
    const items = STATE.contenidos.filter(c => c.estado === col.key);
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
              ${c.fechaPub ? `<div class="kanban-card-date">📅 ${fmtDate(c.fechaPub)}</div>` : ''}
              <div style="display:flex;gap:4px;margin-top:6px;">
                <button class="btn btn-secondary btn-sm" onclick="openContenidoModalById('${c.id}')">Editar</button>
                <button class="btn btn-secondary btn-sm" onclick="openPreview('${c.id}')">👁</button>
              </div>
            </div>
          `).join('')}
        </div>
        <button class="kanban-add-btn" onclick="openContenidoModal({estado:'${col.key}'})">+ Agregar</button>
      </div>
    `;
  }).join('')}</div>`;

  initKanbanDrag('#kanban-cont', STATE.contenidos, async (id, newCol) => {
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
            <div style="font-weight:600;font-size:13px;margin-bottom:8px;">💡 ${i.titulo}</div>
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
  renderDriveLinks(type);
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
  wrap.innerHTML = _imgList.map((src, i) => `
    <div style="position:relative;">
      <img src="${src}" style="width:72px;height:72px;object-fit:cover;border-radius:6px;border:1px solid var(--border);">
      <button type="button" onclick="removeImg(${i})" style="position:absolute;top:-6px;right:-6px;background:#E02020;color:#fff;border:none;border-radius:50%;width:18px;height:18px;font-size:11px;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center;">×</button>
    </div>
  `).join('');
  const ph = document.querySelector('.img-paste-placeholder');
  if (ph) ph.style.display = _imgList.length ? 'none' : '';
}

window.removeImg = function(i) { _imgList.splice(i, 1); renderImgThumbs(); };

function addImgFromFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = e => { _imgList.push(e.target.result); renderImgThumbs(); };
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

  document.getElementById('deleteContenidoBtn').style.display = editingContenido ? '' : 'none';
  document.getElementById('contenidoModal').classList.remove('hidden');
};

window.openContenidoModalById = function(id) { openContenidoModal({ id }); };

function closeContenidoModal() { document.getElementById('contenidoModal').classList.add('hidden'); }
document.getElementById('closeContenidoModal').addEventListener('click', closeContenidoModal);
document.getElementById('closeContenidoModal2').addEventListener('click', closeContenidoModal);

// Platform checkboxes → update formats
document.getElementById('plat-checks').addEventListener('change', updatePlatFilters);

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
  };

  try {
    const saved = await saveContenido(clientId, obj);
    if (editingContenido) {
      const i = STATE.contenidos.findIndex(c => c.id === saved.id);
      STATE.contenidos[i] = saved;
    } else {
      STATE.contenidos.push(saved);
    }
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

// ──────────────────────────────────────────────────────
// TAREAS
// ──────────────────────────────────────────────────────
function renderTareas(container) {
  const cols = [
    { key: 'Sin empezar', label: 'Sin empezar', color: '#94a3b8' },
    { key: 'En progreso', label: 'En progreso', color: '#3b82f6' },
    { key: 'Listo', label: 'Listo', color: '#10b981' },
  ];
  const archivadas = STATE.tareas.filter(t => t.archivado);

  container.innerHTML = `<div class="kanban-board" id="kanban-tareas">${cols.map(col => {
    const items = STATE.tareas.filter(t => t.estado === col.key && !t.archivado);
    return `
      <div class="kanban-col" data-col="${col.key}" style="flex:1;max-width:none;">
        <div class="kanban-col-header">
          <span class="kanban-col-dot" style="background:${col.color};"></span>
          <span class="col-title">${col.label}</span>
          <span class="col-count">${items.length}</span>
        </div>
        <div class="kanban-cards" data-col="${col.key}">
          ${items.map(t => `
            <div class="kanban-card" draggable="true" data-id="${t.id}">
              <div class="kanban-card-title">${t.titulo}</div>
              ${t.prioridad ? `<div style="margin-top:4px;"><span style="font-size:10px;padding:2px 7px;border-radius:10px;background:${t.prioridad==='Alta'?'#fee2e2':t.prioridad==='Media'?'#fff7ed':'#f1f5f9'};color:${t.prioridad==='Alta'?'#dc2626':t.prioridad==='Media'?'#b45309':'#64748b'};font-weight:700;">${t.prioridad}</span></div>` : ''}
              ${t.vencimiento ? `<div style="font-size:11px;margin-top:4px;color:${new Date(t.vencimiento+'T00:00:00') < new Date() && t.estado !== 'Listo' ? '#dc2626' : 'var(--text-muted)'};">📅 Vence: ${fmtDate(t.vencimiento)}</div>` : ''}
              ${t.notas ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${t.notas}</div>` : ''}
              ${t.recurrencia ? `<div style="font-size:10px;margin-top:4px;"><span style="padding:2px 7px;background:#eff6ff;color:#3b82f6;border-radius:10px;font-weight:600;">↻ ${t.recurrencia}</span></div>` : ''}
              ${t.linkRef ? `<a href="${t.linkRef}" target="_blank" onclick="event.stopPropagation();" style="font-size:10px;color:var(--accent);display:block;margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;">🔗 ${t.linkRef}</a>` : ''}
              ${t.subtareas?.length ? (() => {
                const done = t.subtareas.filter(s=>s.done).length;
                const total = t.subtareas.length;
                const pct = Math.round(done/total*100);
                return `<div style="margin-top:6px;">
                  <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-muted);margin-bottom:3px;"><span>${done}/${total} subtareas</span><span>${pct}%</span></div>
                  <div style="height:3px;background:#e2e8f0;border-radius:2px;"><div style="height:3px;background:#10b981;border-radius:2px;width:${pct}%;"></div></div>
                </div>`;
              })() : ''}
              <div style="display:flex;gap:4px;margin-top:8px;">
                <button class="btn btn-secondary btn-sm" onclick="openTareaModal('${t.id}')">Editar</button>
                <button class="btn btn-danger btn-sm" onclick="eliminarTareaDirecta('${t.id}')" title="Eliminar">×</button>
              </div>
            </div>
          `).join('')}
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
    if (!t) return;
    t.estado = newCol;
    await saveTarea(clientId, t);
    updateBadges();
    renderTareas(document.getElementById('main-content'));
  });
}

// ── Rich Text Editor helpers ──
let _tareaImgList = [];

window.rteCmd = function(cmd) {
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
  const reader = new FileReader();
  reader.onload = e => { _tareaImgList.push(e.target.result); renderTareaImgThumbs(); };
  reader.readAsDataURL(file);
}

window.openTareaModal = function(id, defaultEstado) {
  editingTarea = id ? STATE.tareas.find(t => t.id === id) : null;
  const t = editingTarea || {};
  document.getElementById('tarea-modal-title').textContent = editingTarea ? 'Editar tarea' : 'Nueva tarea';
  document.getElementById('tf-titulo').value = t.titulo || '';
  document.getElementById('tf-estado').value = t.estado || defaultEstado || 'Sin empezar';
  document.getElementById('tf-prioridad').value = t.prioridad || 'Media';
  document.getElementById('tf-vencimiento').value = t.vencimiento || '';
  document.getElementById('tf-notas').innerHTML = t.notas || '';
  document.getElementById('tf-recurrencia').value = t.recurrencia || '';
  document.getElementById('tf-link').value = t.linkRef || '';
  // Imágenes
  _tareaImgList = t.imagenes ? [...t.imagenes] : [];
  renderTareaImgThumbs();
  document.getElementById('deleteTareaBtn').style.display = editingTarea ? '' : 'none';
  document.getElementById('archiveTareaBtn').style.display = editingTarea ? '' : 'none';

  // dias-semana
  const diasGroup = document.getElementById('dias-semana-group');
  diasGroup.style.display = (t.recurrencia === 'dias-semana') ? '' : 'none';
  document.querySelectorAll('.dia-check').forEach(cb => {
    cb.checked = (t.diasSemana || []).includes(cb.value);
  });

  // Subtareas — solo visible al editar
  const stSection = document.getElementById('subtareas-section');
  stSection.style.display = editingTarea ? '' : 'none';
  if (editingTarea) renderSubtareas(t.subtareas || []);

  document.getElementById('tareaModal').classList.remove('hidden');
};

function renderSubtareas(subtareas) {
  const list = document.getElementById('subtareas-list');
  list.innerHTML = subtareas.map((s, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:${s.done?'#f0fdf4':'#f8fafc'};border-radius:6px;border:1px solid ${s.done?'#bbf7d0':'var(--border)'};">
      <input type="checkbox" ${s.done?'checked':''} onchange="toggleSubtarea(${i})" style="flex-shrink:0;">
      <span style="flex:1;font-size:13px;${s.done?'text-decoration:line-through;color:var(--text-muted);':''}">${s.titulo}</span>
      ${s.vencimiento ? `<span style="font-size:10px;color:${new Date(s.vencimiento+'T00:00:00')<new Date()&&!s.done?'#dc2626':'var(--text-muted)'};">📅 ${s.vencimiento}</span>` : ''}
      <button onclick="deleteSubtarea(${i})" style="background:none;border:none;color:#cbd5e1;cursor:pointer;font-size:16px;padding:0 2px;" title="Eliminar">×</button>
    </div>
  `).join('') || '<p style="font-size:12px;color:var(--text-muted);">Sin subtareas. Agregá una.</p>';
}

window.toggleSubtarea = function(idx) {
  if (!editingTarea) return;
  editingTarea.subtareas = editingTarea.subtareas || [];
  editingTarea.subtareas[idx].done = !editingTarea.subtareas[idx].done;
  renderSubtareas(editingTarea.subtareas);
};

window.deleteSubtarea = function(idx) {
  if (!editingTarea) return;
  editingTarea.subtareas.splice(idx, 1);
  renderSubtareas(editingTarea.subtareas);
};

document.getElementById('addSubtareaBtn').addEventListener('click', () => {
  document.getElementById('st-titulo').value = '';
  document.getElementById('st-vencimiento').value = '';
  document.getElementById('subtareaModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('st-titulo').focus(), 50);
});

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
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    const recurrencia = document.getElementById('tf-recurrencia').value;
    const diasSemana = recurrencia === 'dias-semana'
      ? Array.from(document.querySelectorAll('.dia-check:checked')).map(cb => cb.value)
      : [];
    const obj = { ...(editingTarea||{}), titulo, estado: document.getElementById('tf-estado').value, prioridad: document.getElementById('tf-prioridad').value, vencimiento: document.getElementById('tf-vencimiento').value || null, notas: document.getElementById('tf-notas').innerHTML, recurrencia: recurrencia || null, diasSemana, linkRef: document.getElementById('tf-link').value || null, subtareas: editingTarea?.subtareas || [], imagenes: [..._tareaImgList] };
    const saved = await saveTarea(clientId, obj);
    if (editingTarea) { const i = STATE.tareas.findIndex(t => t.id === saved.id); STATE.tareas[i] = saved; }
    else STATE.tareas.push(saved);
    closeTareaModal();
    updateBadges();
    if (currentSection === 'tareas') renderTareas(document.getElementById('main-content'));
    else if (currentSection === 'home') renderSection('home');
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar';
  }
});

document.getElementById('deleteTareaBtn').addEventListener('click', async () => {
  if (!editingTarea || !confirm('¿Eliminar esta tarea?')) return;
  await deleteTarea(clientId, editingTarea.id);
  STATE.tareas = STATE.tareas.filter(t => t.id !== editingTarea.id);
  closeTareaModal();
  updateBadges();
  renderTareas(document.getElementById('main-content'));
});

document.getElementById('archiveTareaBtn').addEventListener('click', async () => {
  if (!editingTarea) return;
  editingTarea.archivado = true;
  await saveTarea(clientId, editingTarea);
  const i = STATE.tareas.findIndex(t => t.id === editingTarea.id);
  STATE.tareas[i] = editingTarea;
  closeTareaModal();
  updateBadges();
  renderTareas(document.getElementById('main-content'));
});

window.eliminarTareaDirecta = async function(id) {
  if (!confirm('¿Eliminar esta tarea?')) return;
  await deleteTarea(clientId, id);
  STATE.tareas = STATE.tareas.filter(t => t.id !== id);
  updateBadges();
  renderTareas(document.getElementById('main-content'));
};

window.desarchivarTarea = async function(id) {
  const t = STATE.tareas.find(x => x.id === id);
  if (!t) return;
  t.archivado = false;
  await saveTarea(clientId, t);
  updateBadges();
  renderTareas(document.getElementById('main-content'));
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

  container.innerHTML = `
    <div class="tabs" id="pauta-tabs" style="margin-bottom:16px;">
      ${plats.map(p => `<button class="tab-btn ${activePautaTab===(p==='Todas'?'todas':p)?'active':''}" data-tab="${p==='Todas'?'todas':p}">${p}</button>`).join('')}
    </div>

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
function renderLinks(container) {
  const links = STATE.links || [];
  container.innerHTML = `
    ${links.length ? `
      <div class="links-grid">
        ${links.map(l => `
          <div class="link-card" onclick="window.open('${l.url}','_blank')" style="cursor:pointer;">
            <div class="link-card-icon">
              <i data-lucide="link" style="width:14px;height:14px;color:var(--primary);stroke-width:1.75;"></i>
            </div>
            <div style="flex:1;min-width:0;">
              <div class="link-card-title" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${l.titulo}</div>
              ${l.desc ? `<div class="link-card-desc">${l.desc}</div>` : ''}
              <div style="font-size:10px;color:#94a3b8;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${l.url}</div>
            </div>
            <button class="link-card-edit" onclick="event.stopPropagation();openLinkModal('${l.id}')" title="Editar">✏️</button>
          </div>
        `).join('')}
        <div class="link-card" onclick="openLinkModal(null)" style="cursor:pointer;border-style:dashed;background:transparent;justify-content:center;opacity:.6;gap:6px;">
          <i data-lucide="plus" style="width:14px;height:14px;stroke-width:2;color:var(--text-muted);"></i>
          <span style="font-size:13px;color:var(--text-muted);">Agregar link</span>
        </div>
      </div>
    ` : `
      <div class="empty-state">
        <i data-lucide="link" style="width:40px;height:40px;color:#cbd5e1;stroke-width:1;margin-bottom:12px;"></i>
        <h3>Sin links guardados</h3>
        <p>Guardá atajos rápidos a tus recursos: Drive, Canva, planillas, reportes...</p>
        <button class="btn btn-primary" style="margin-top:12px;" onclick="openLinkModal(null)">+ Agregar primer link</button>
      </div>
    `}
  `;
}

let _editingLink = null;
window.openLinkModal = function(id) {
  _editingLink = id ? STATE.links.find(l => l.id === id) : null;
  const l = _editingLink || {};
  document.getElementById('link-modal-title').textContent = _editingLink ? 'Editar link' : 'Nuevo link';
  document.getElementById('lf-titulo').value = l.titulo || '';
  document.getElementById('lf-url').value = l.url || '';
  document.getElementById('lf-desc').value = l.desc || '';
  document.getElementById('deleteLinkBtn').style.display = _editingLink ? '' : 'none';
  document.getElementById('linkModal').classList.remove('hidden');
  setTimeout(() => document.getElementById('lf-titulo').focus(), 50);
};

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
                  <span style="font-size:10px;padding:2px 7px;border-radius:10px;background:#f1f5f9;color:var(--text-muted);font-weight:600;flex-shrink:0;">${t.categoria||'Otro'}</span>
                </div>
                <div class="kanban-card-title" style="margin-top:6px;">${t.titulo}</div>
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

let _editingWebTask = null;
window.openWebTaskModal = function(id, defaultEstado) {
  _editingWebTask = id ? (STATE.home.webTareas||[]).find(t => t.id === id) : null;
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
        ]},
        { icon:'file-text', title:'Reporte Ejecutivo', color:'#e02020', items:[
          'Generá un reporte mensual para presentar a gerencia: contenidos publicados, métricas, campañas e insights.',
          'Accedé desde el botón "📊 Reporte" en la sección Contenidos.',
          'Podés imprimir o guardar como PDF con Ctrl+P.',
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
  const tareasPend = STATE.tareas.filter(t => !t.archivado && t.estado !== 'Listo').length;
  const tareasOk = STATE.tareas.filter(t => t.estado === 'Listo').length;

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
  const obj = {
    ...(editingCampana||{}), nombre,
    plataforma: document.getElementById('pf-plataforma').value,
    estado: document.getElementById('pf-estado').value,
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
// KANBAN DRAG & DROP
// ──────────────────────────────────────────────────────
function initKanbanDrag(boardSelector, items, onDrop) {
  let draggingId = null;
  const board = document.querySelector(boardSelector);
  if (!board) return;

  board.querySelectorAll('.kanban-card[draggable]').forEach(card => {
    card.addEventListener('dragstart', e => { draggingId = card.dataset.id; card.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
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
  const map = { Instagram:'plat-ig', Facebook:'plat-fb', LinkedIn:'plat-li', Twitter:'plat-tw' };
  const icons = { Instagram:'📸', Facebook:'📘', LinkedIn:'💼', Twitter:'🐦' };
  return `<span class="plat-badge ${map[plat]||''}">${icons[plat]||''} ${plat}</span>`;
}

function platIcon(plat) {
  return { Instagram:'📸', Facebook:'📘', LinkedIn:'💼', Twitter:'🐦' }[plat] || '';
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
  else if (currentSection === 'tareas') renderTareas(document.getElementById('main-content'));
});

// ── Subtarea modal wiring ──────────────────────────────
function closeSubtareaModal() { document.getElementById('subtareaModal').classList.add('hidden'); }
document.getElementById('closeSubtareaModal').addEventListener('click', closeSubtareaModal);
document.getElementById('closeSubtareaModal2').addEventListener('click', closeSubtareaModal);
document.getElementById('saveSubtareaBtn').addEventListener('click', () => {
  const titulo = document.getElementById('st-titulo').value.trim();
  if (!titulo) { alert('El título es obligatorio.'); return; }
  const vencimiento = document.getElementById('st-vencimiento').value || null;
  editingTarea.subtareas = editingTarea.subtareas || [];
  editingTarea.subtareas.push({ titulo, done: false, vencimiento });
  renderSubtareas(editingTarea.subtareas);
  closeSubtareaModal();
});

// ── Link modal wiring ──────────────────────────────────
function closeLinkModal() { document.getElementById('linkModal').classList.add('hidden'); }
document.getElementById('closeLinkModal').addEventListener('click', closeLinkModal);
document.getElementById('closeLinkModal2').addEventListener('click', closeLinkModal);
document.getElementById('saveLinkBtn').addEventListener('click', async () => {
  const titulo = document.getElementById('lf-titulo').value.trim();
  const url = document.getElementById('lf-url').value.trim();
  if (!titulo || !url) { alert('Título y URL son obligatorios.'); return; }
  const obj = { ...(_editingLink || {}), id: _editingLink?.id || Date.now(), titulo, url, desc: document.getElementById('lf-desc').value.trim() };
  if (_editingLink) {
    const i = STATE.links.findIndex(l => l.id === obj.id);
    STATE.links[i] = obj;
  } else {
    STATE.links.push(obj);
  }
  STATE.home.links = STATE.links;
  await saveHomeData(clientId, STATE.home);
  closeLinkModal();
  renderLinks(document.getElementById('main-content'));
  setTimeout(refreshIcons, 50);
});
document.getElementById('deleteLinkBtn').addEventListener('click', async () => {
  if (!_editingLink || !confirm('¿Eliminar este link?')) return;
  STATE.links = STATE.links.filter(l => l.id !== _editingLink.id);
  STATE.home.links = STATE.links;
  await saveHomeData(clientId, STATE.home);
  closeLinkModal();
  renderLinks(document.getElementById('main-content'));
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
    const obj = {
      ...(_editingWebTask || {}),
      id: _editingWebTask?.id || Date.now(),
      titulo,
      categoria: document.getElementById('wt-categoria').value,
      estado: document.getElementById('wt-estado').value,
      vencimiento: document.getElementById('wt-vencimiento').value || null,
      url: document.getElementById('wt-url').value.trim() || null,
      notas: document.getElementById('wt-notas').value.trim(),
    };
    if (_editingWebTask) {
      const i = STATE.home.webTareas.findIndex(t => t.id === obj.id);
      STATE.home.webTareas[i] = obj;
    } else {
      STATE.home.webTareas.push(obj);
    }
    await saveHomeData(clientId, STATE.home);
    closeWebTaskModal();
    if (currentSection === 'web') renderWeb(document.getElementById('main-content'));
    else if (currentSection === 'home') renderSection('home');
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar';
  }
});

document.getElementById('deleteWebTaskBtn').addEventListener('click', async () => {
  if (!_editingWebTask || !confirm('¿Eliminar esta tarea?')) return;
  STATE.home.webTareas = (STATE.home.webTareas||[]).filter(t => t.id !== _editingWebTask.id);
  await saveHomeData(clientId, STATE.home);
  closeWebTaskModal();
  renderWeb(document.getElementById('main-content'));
});

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.add('hidden'); });
});

// ── Start ──────────────────────────────────────────────
function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

init();
