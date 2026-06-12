import { requireAuth, logoutUser } from './auth.js';
import {
  getClientData, getContenidos, saveContenido, deleteContenido,
  getTareas, saveTarea, deleteTarea,
  getCampanas, saveCampana,
  getMetricas, getHomeData, saveHomeData,
  getIdeas, saveIdea
} from './data.js';

// ── Bootstrap ──────────────────────────────────────────
const user = requireAuth();
if (!user) throw new Error('No auth');

const params = new URLSearchParams(window.location.search);
const clientId = params.get('client') || user.clientId;
if (!clientId) { window.location.href = '../admin/index.html'; }

let STATE = { contenidos: [], tareas: [], campanas: [], metricas: {}, ideas: [], client: {} };
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

  await loadAllData();
  setupNav();
  renderSection('home');
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
  STATE.home = home;
  STATE.ideas = ideas;
  updateBadges();
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
  const titles = { home: 'Home', contenidos: 'Contenidos', tareas: 'Tareas', pauta: 'Pauta Digital' };
  const subs = { home: 'Resumen y prioridades del mes', contenidos: 'Gestión de contenidos para redes sociales', tareas: 'Tareas internas del equipo', pauta: 'Campañas y métricas de pauta digital' };
  document.getElementById('topbar-title').textContent = titles[sec];
  document.getElementById('topbar-sub').textContent = subs[sec];

  const actions = document.getElementById('topbar-actions');
  actions.innerHTML = '';

  const content = document.getElementById('main-content');

  if (sec === 'home') { renderHome(content); }
  else if (sec === 'contenidos') {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = '+ Nuevo contenido';
    btn.onclick = () => openContenidoModal(null);
    actions.appendChild(btn);
    renderContenidos(content);
  }
  else if (sec === 'tareas') {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = '+ Nueva tarea';
    btn.onclick = () => openTareaModal(null);
    actions.appendChild(btn);
    renderTareas(content);
  }
  else if (sec === 'pauta') {
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = '+ Nueva campaña';
    btn.onclick = () => openCampanaModal(null);
    actions.appendChild(btn);
    renderPauta(content);
  }
}

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
        { label: 'Contenidos este mes', val: pubMes, icon: '📅' },
        { label: 'En proceso', val: enProceso, icon: '✏️' },
        { label: 'Aprobados', val: aprobados, icon: '✅' },
        { label: 'Publicados', val: publicados, icon: '🚀' },
      ].map(m => `
        <div class="card" style="padding:16px;">
          <div style="font-size:22px;margin-bottom:6px;">${m.icon}</div>
          <div style="font-size:24px;font-weight:800;">${m.val}</div>
          <div style="font-size:12px;color:var(--text-muted);">${m.label}</div>
        </div>
      `).join('')}
    </div>

    <div class="home-grid">
      <!-- Prioridades del mes -->
      <div class="card">
        <div class="card-header">
          <h2>⭐ Prioridades de ${mesStr}</h2>
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
          <h2>📋 To-do — ${diaStr}</h2>
          <button class="btn btn-secondary btn-sm" onclick="addTodoItem()" style="margin-left:auto;">+ Agregar</button>
        </div>
        <div class="card-body">
          <div id="todo-list">
            ${todos.length ? todos.map(t => `
              <div class="todo-item ${t.done ? 'done' : ''}" data-id="${t.id}">
                <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleTodo(${t.id})">
                <label onclick="toggleTodo(${t.id})">${t.text}</label>
                <button onclick="removeTodo(${t.id})" style="background:none;border:none;color:#cbd5e1;cursor:pointer;font-size:16px;padding:0 4px;" title="Eliminar">×</button>
              </div>
            `).join('') : `<p class="text-muted text-sm">Sin tareas para hoy.</p>`}
          </div>
        </div>
      </div>
    </div>

    <!-- Contenidos próximos -->
    <div class="card">
      <div class="card-header"><h2>📅 Próximas publicaciones</h2></div>
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
  `;
}

window.editPrioridades = function() {
  const { prioridades = [] } = STATE.home || {};
  const val = prompt('Ingresá las prioridades separadas por Enter (una por línea):', prioridades.join('\n'));
  if (val === null) return;
  STATE.home.prioridades = val.split('\n').map(s => s.trim()).filter(Boolean);
  saveHomeData(clientId, STATE.home);
  renderSection('home');
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

window.addTodoItem = async function() {
  const text = prompt('Nueva tarea para hoy:');
  if (!text || !text.trim()) return;
  STATE.home.todos = STATE.home.todos || [];
  STATE.home.todos.push({ id: Date.now(), text: text.trim(), done: false });
  await saveHomeData(clientId, STATE.home);
  renderSection('home');
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
  const all = [...STATE.contenidos].sort((a,b) => (a.fechaPub||'') > (b.fechaPub||'') ? 1 : -1);
  container.innerHTML = `
    <div class="table-wrapper">
      <table class="data-table">
        <thead>
          <tr>
            <th>Fecha pub.</th><th>Título</th><th>Plataforma</th>
            <th>Ubicación</th><th>Eje</th><th>Tipo</th>
            <th>Estado</th><th>Cuenta</th><th>Formato</th>
            <th>Objetivo</th><th>Drive</th><th>Notas</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${all.map(c => `
            <tr data-id="${c.id}">
              <td>${fmtDate(c.fechaPub)}</td>
              <td style="font-weight:500;min-width:160px;">${c.titulo}</td>
              <td>${(c.plataformas||[]).map(p => platBadge(p)).join(' ')}</td>
              <td>${c.ubicacion||''}</td>
              <td>${c.eje||''}</td>
              <td>${c.tipo||''}</td>
              <td>${statusBadge(c.estado)}</td>
              <td class="text-sm text-muted">${c.cuenta||''}</td>
              <td>${c.formato||''}</td>
              <td>${c.objetivo||''}</td>
              <td>${c.linkDrive ? `<a class="drive-link" href="${c.linkDrive}" target="_blank" title="${c.linkDrive}">📎 Drive</a>` : ''}</td>
              <td class="text-sm text-muted" style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${c.notas||''}</td>
              <td>
                <div style="display:flex;gap:4px;">
                  <button class="btn btn-secondary btn-sm" onclick="openContenidoModalById('${c.id}')">✏️</button>
                  <button class="btn btn-secondary btn-sm" onclick="openPreview('${c.id}')">👁</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

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
        <div class="cal-day-num">${cellDate.getDate()}</div>
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
    { key: 'Idea', label: '💡 Idea', cls: 's-idea' },
    { key: 'En proceso', label: '✏️ En proceso', cls: 's-proceso' },
    { key: 'En revisión', label: '👁 En revisión', cls: 's-revision' },
    { key: 'Aprobado', label: '✅ Aprobado', cls: 's-aprobado' },
    { key: 'Programado', label: '📅 Programado', cls: 's-programado' },
    { key: 'Publicado', label: '🚀 Publicado', cls: 's-publicado' },
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
function renderFeedIG(container) {
  const feedItems = STATE.contenidos
    .filter(c => (c.plataformas||[]).includes('Instagram') && c.ubicacion !== 'Story')
    .sort((a,b) => (b.fechaPub||'') > (a.fechaPub||'') ? 1 : -1)
    .slice(0, 9);

  const client = STATE.client;
  container.innerHTML = `
    <div style="display:flex;gap:24px;flex-wrap:wrap;align-items:flex-start;">
      <div class="phone-device" style="width:300px;">
        <div class="phone-screen">
          <!-- Header de perfil -->
          <div style="padding:10px 12px;border-bottom:1px solid #f1f5f9;display:flex;align-items:center;gap:10px;">
            <div class="ig-avatar"></div>
            <div>
              <div style="font-weight:700;font-size:13px;">${client.instagram||'@cuenta'}</div>
              <div style="font-size:10px;color:#666;">${feedItems.length} publicaciones</div>
            </div>
          </div>
          <!-- Grid feed -->
          <div class="feed-grid">
            ${feedItems.map(c => `
              <div class="feed-cell" onclick="openPreview('${c.id}')">
                ${c.linkDrive
                  ? `<img src="${driveThumb(c.linkDrive)}" onerror="this.parentElement.querySelector('.feed-cell-empty').style.display='flex';this.style.display='none';">`
                  : ''
                }
                <div class="feed-cell-empty" style="${c.linkDrive ? 'display:none' : ''}">${platIcon('Instagram')}</div>
                <div class="feed-cell-overlay">
                  <div style="font-size:10px;font-weight:600;">${c.titulo}</div>
                  <div style="margin-top:4px;">${statusBadge(c.estado)}</div>
                </div>
                <div class="feed-cell-status">${statusDot(c.estado)}</div>
              </div>
            `).join('')}
            ${Array(Math.max(0, 9 - feedItems.length)).fill(0).map(() =>
              `<div class="feed-cell"><div class="feed-cell-empty" style="color:#e2e8f0;">+</div></div>`
            ).join('')}
          </div>
        </div>
        <div class="phone-label">Feed Instagram</div>
      </div>

      <!-- Lista lateral -->
      <div style="flex:1;min-width:280px;">
        <h3 style="font-size:14px;font-weight:600;margin-bottom:12px;">Posts de Instagram (Feed)</h3>
        ${feedItems.length ? feedItems.map(c => `
          <div class="card" style="padding:12px 16px;margin-bottom:8px;display:flex;align-items:center;gap:10px;">
            <div style="flex:1;">
              <div style="font-weight:600;font-size:13px;">${c.titulo}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${fmtDate(c.fechaPub)} · ${c.formato||''}</div>
            </div>
            ${statusBadge(c.estado)}
            <button class="btn btn-secondary btn-sm" onclick="openPreview('${c.id}')">👁 Preview</button>
          </div>
        `).join('') : `<div class="empty-state"><p>No hay posts de Instagram Feed.</p></div>`}
      </div>
    </div>
  `;
}

// ─ Muro FB ─
function renderMuroFB(container) {
  const fbItems = STATE.contenidos
    .filter(c => (c.plataformas||[]).includes('Facebook') && c.ubicacion !== 'Story')
    .sort((a,b) => (b.fechaPub||'') > (a.fechaPub||'') ? 1 : -1);

  container.innerHTML = `
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
              <div class="fb-image">${c.linkDrive?`<img src="${driveThumb(c.linkDrive)}" onerror="this.style.display='none'" style="width:100%;height:100%;object-fit:cover;">`:'📘'}</div>
            </div>
          `).join('')}
        </div>
        <div class="phone-label">Muro Facebook</div>
      </div>

      <div style="flex:1;min-width:280px;">
        <h3 style="font-size:14px;font-weight:600;margin-bottom:12px;">Posts de Facebook</h3>
        ${fbItems.length ? fbItems.map(c => `
          <div class="card" style="padding:12px 16px;margin-bottom:8px;display:flex;align-items:center;gap:10px;">
            <div style="flex:1;">
              <div style="font-weight:600;font-size:13px;">${c.titulo}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px;">${fmtDate(c.fechaPub)} · ${c.formato||''}</div>
            </div>
            ${statusBadge(c.estado)}
            <button class="btn btn-secondary btn-sm" onclick="openPreview('${c.id}')">👁 Preview</button>
          </div>
        `).join('') : `<div class="empty-state"><p>No hay posts de Facebook.</p></div>`}
      </div>
    </div>
  `;
}

// ─ Stories ─
function renderStories(container) {
  const stories = STATE.contenidos.filter(c =>
    (c.plataformas||[]).includes('Instagram') && c.ubicacion === 'Story'
  );

  container.innerHTML = `
    <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start;">
      ${stories.length ? stories.slice(0,4).map(c => `
        <div>
          <div class="phone-device" style="width:180px;">
            <div class="phone-screen">
              <div class="story-preview">
                ${c.linkDrive
                  ? `<img src="${driveThumb(c.linkDrive)}" onerror="this.style.display='none'">`
                  : '<div class="story-preview-empty">▯</div>'
                }
                <div class="story-bar">
                  <div class="story-bar-seg active"></div>
                  <div class="story-bar-seg"></div>
                  <div class="story-bar-seg"></div>
                </div>
                <div class="story-user">
                  <div class="story-avatar"></div>
                  <span class="story-uname">${STATE.client.instagram||'@cuenta'}</span>
                </div>
                <div class="story-caption">${(c.copy||c.titulo||'').slice(0,60)}</div>
              </div>
            </div>
          </div>
          <div class="phone-label" style="margin-top:6px;">${c.titulo.slice(0,20)}</div>
          <div style="text-align:center;margin-top:4px;">${statusBadge(c.estado)}</div>
          <div style="text-align:center;margin-top:6px;">
            <button class="btn btn-secondary btn-sm" onclick="openContenidoModalById('${c.id}')">Editar</button>
          </div>
        </div>
      `).join('')
      : `<div class="empty-state w-full"><div class="empty-state-icon">▯</div><h3>Sin stories</h3><p>Agregá contenidos con ubicación "Story" e Instagram como plataforma.</p></div>`}
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
            </div>
          </div>
        `).join('')}
      </div>
    ` : `<div class="empty-state"><div class="empty-state-icon">💡</div><h3>Sin ideas</h3><p>Guardá ideas de contenido para trabajarlas después.</p></div>`}
  `;
}

window.openIdeaModal = function(id) {
  const idea = id ? STATE.ideas.find(i => i.id === id) : null;
  const titulo = prompt('Título de la idea:', idea?.titulo || '');
  if (!titulo) return;
  const notas = prompt('Notas (opcional):', idea?.notas || '');
  const obj = idea ? { ...idea, titulo, notas: notas||'' } : { titulo, notas: notas||'', plataformas: ['Instagram','Facebook'], formato: 'Imagen' };
  saveIdea(clientId, obj).then(saved => {
    if (!idea) STATE.ideas.push(saved);
    else { const i = STATE.ideas.findIndex(x => x.id === saved.id); STATE.ideas[i] = saved; }
    renderContTab('ideas');
  });
};

window.promoverIdea = async function(id) {
  const idea = STATE.ideas.find(i => i.id === id);
  if (!idea) return;
  const nuevo = { titulo: idea.titulo, plataformas: idea.plataformas||[], formato: idea.formato||'', estado: 'En proceso', notas: idea.notas||'', eje:'', tipo:'', objetivo:'', fechaPub:'', ubicacion:'Feed', cuenta: STATE.client.instagram||'' };
  const saved = await saveContenido(clientId, nuevo);
  STATE.contenidos.push(saved);
  STATE.ideas = STATE.ideas.filter(i => i.id !== id);
  await (async() => { const { deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js"); })().catch(()=>{});
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
function renderMetricasContenidos(container) {
  const m = STATE.metricas || {};
  container.innerHTML = `
    <div class="metrics-grid">
      ${[
        { label: 'Seguidores IG', val: fmtNum(m.seguidores_ig), delta: m.crecimiento_ig, icon:'📸' },
        { label: 'Seguidores FB', val: fmtNum(m.seguidores_fb), delta: m.crecimiento_fb, icon:'📘' },
        { label: 'Alcance mensual', val: fmtNum(m.alcance_mensual), delta: '', icon:'📡' },
        { label: 'Engagement', val: m.tasa_engagement||'—', delta: '', icon:'❤️' },
        { label: 'Publicaciones', val: m.publicaciones||'—', delta: '', icon:'📋' },
        { label: 'Impresiones', val: fmtNum(m.impresiones), delta: '', icon:'👁' },
      ].map(x => `
        <div class="metric-card">
          <div style="font-size:20px;margin-bottom:4px;">${x.icon}</div>
          <div class="metric-label">${x.label}</div>
          <div class="metric-value">${x.val||'—'}</div>
          ${x.delta ? `<div class="metric-delta up">${x.delta}</div>` : ''}
        </div>
      `).join('')}
    </div>
    <div class="card">
      <div class="card-header"><h2>Editar métricas del mes</h2></div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
          ${Object.entries(m).map(([k,v]) => `
            <div class="form-group">
              <label>${k.replace(/_/g,' ')}</label>
              <input type="text" class="form-control form-control-sm" value="${v||''}" data-key="${k}" onchange="updateMetrica('${k}',this.value)">
            </div>
          `).join('')}
          <div class="form-group" style="align-self:end;">
            <button class="btn btn-primary btn-sm" onclick="saveMetricas()">Guardar métricas</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

window.updateMetrica = function(key, val) { STATE.metricas[key] = val; };
window.saveMetricas = async function() {
  const { setDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  const { db, DEMO_MODE } = await import('./firebase.js');
  if (!DEMO_MODE) await setDoc(doc(db, 'clients', clientId, 'metricas', 'resumen'), STATE.metricas);
  else {
    const data = JSON.parse(localStorage.getItem(`mh_data_${clientId}`)||'{}');
    data.metricas = STATE.metricas;
    localStorage.setItem(`mh_data_${clientId}`, JSON.stringify(data));
  }
  alert('Métricas guardadas.');
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
  const imgHtml = c.linkDrive
    ? `<img src="${driveThumb(c.linkDrive)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'">`
    : '';
  const copy = c.copy || c.titulo || '';
  const plats = c.plataformas || [];

  document.getElementById('preview-modal-title').textContent = `Vista previa — ${c.titulo}`;

  const previews = [];

  if (plats.includes('Instagram') && c.ubicacion !== 'Story') previews.push(`
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

  if (plats.includes('Instagram') && c.ubicacion === 'Story') previews.push(`
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
window.openContenidoModal = function(defaults = {}) {
  editingContenido = defaults?.id ? STATE.contenidos.find(c => c.id === defaults.id) : null;
  const c = editingContenido || {};
  document.getElementById('modal-cont-title').textContent = editingContenido ? 'Editar contenido' : 'Nuevo contenido';
  document.getElementById('cf-titulo').value = c.titulo || '';
  document.getElementById('cf-fecha').value = c.fechaPub || defaults.fechaPub || '';
  document.getElementById('cf-estado').value = c.estado || defaults.estado || 'Idea';
  document.getElementById('cf-cuenta').value = c.cuenta || STATE.client.instagram || '';
  document.getElementById('cf-ubicacion').value = c.ubicacion || 'Feed';
  document.getElementById('cf-eje').value = c.eje || 'Institucional';
  document.getElementById('cf-tipo').value = c.tipo || 'Informativo';
  document.getElementById('cf-formato').value = c.formato || 'Imagen';
  document.getElementById('cf-objetivo').value = c.objetivo || 'Notoriedad';
  document.getElementById('cf-copy').value = c.copy || '';
  document.getElementById('cf-drive').value = c.linkDrive || '';
  document.getElementById('cf-notas').value = c.notas || '';
  document.querySelectorAll('.plat-check').forEach(cb => {
    cb.checked = (c.plataformas || defaults.plataformas || []).includes(cb.value);
  });
  document.getElementById('deleteContenidoBtn').style.display = editingContenido ? '' : 'none';
  document.getElementById('contenidoModal').classList.remove('hidden');
};

window.openContenidoModalById = function(id) {
  openContenidoModal({ id });
};

function closeContenidoModal() { document.getElementById('contenidoModal').classList.add('hidden'); }
document.getElementById('closeContenidoModal').addEventListener('click', closeContenidoModal);
document.getElementById('closeContenidoModal2').addEventListener('click', closeContenidoModal);

document.getElementById('saveContenidoBtn').addEventListener('click', async () => {
  const titulo = document.getElementById('cf-titulo').value.trim();
  if (!titulo) { alert('El título es obligatorio.'); return; }
  const plats = Array.from(document.querySelectorAll('.plat-check:checked')).map(cb => cb.value);
  const obj = {
    ...(editingContenido || {}),
    titulo,
    fechaPub: document.getElementById('cf-fecha').value,
    estado: document.getElementById('cf-estado').value,
    cuenta: document.getElementById('cf-cuenta').value,
    plataformas: plats,
    ubicacion: document.getElementById('cf-ubicacion').value,
    eje: document.getElementById('cf-eje').value,
    tipo: document.getElementById('cf-tipo').value,
    formato: document.getElementById('cf-formato').value,
    objetivo: document.getElementById('cf-objetivo').value,
    copy: document.getElementById('cf-copy').value,
    linkDrive: document.getElementById('cf-drive').value,
    notas: document.getElementById('cf-notas').value,
  };
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
    { key: 'Sin empezar', label: '⬜ Sin empezar', color: '#94a3b8' },
    { key: 'En progreso', label: '🔵 En progreso', color: '#3b82f6' },
    { key: 'Listo', label: '✅ Listo', color: '#10b981' },
  ];

  container.innerHTML = `<div class="kanban-board" id="kanban-tareas">${cols.map(col => {
    const items = STATE.tareas.filter(t => t.estado === col.key);
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
              ${t.notas ? `<div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${t.notas}</div>` : ''}
              <button class="btn btn-secondary btn-sm" onclick="openTareaModal('${t.id}')" style="margin-top:8px;">Editar</button>
            </div>
          `).join('')}
        </div>
        <button class="kanban-add-btn" onclick="openTareaModal(null,'${col.key}')">+ Agregar</button>
      </div>
    `;
  }).join('')}</div>`;

  initKanbanDrag('#kanban-tareas', STATE.tareas, async (id, newCol) => {
    const t = STATE.tareas.find(x => x.id === id);
    if (!t) return;
    t.estado = newCol;
    await saveTarea(clientId, t);
    updateBadges();
    renderTareas(document.getElementById('main-content'));
  });
}

window.openTareaModal = function(id, defaultEstado) {
  editingTarea = id ? STATE.tareas.find(t => t.id === id) : null;
  const t = editingTarea || {};
  document.getElementById('tarea-modal-title').textContent = editingTarea ? 'Editar tarea' : 'Nueva tarea';
  document.getElementById('tf-titulo').value = t.titulo || '';
  document.getElementById('tf-estado').value = t.estado || defaultEstado || 'Sin empezar';
  document.getElementById('tf-prioridad').value = t.prioridad || 'Media';
  document.getElementById('tf-notas').value = t.notas || '';
  document.getElementById('deleteTareaBtn').style.display = editingTarea ? '' : 'none';
  document.getElementById('tareaModal').classList.remove('hidden');
};

function closeTareaModal() { document.getElementById('tareaModal').classList.add('hidden'); }
document.getElementById('closeTareaModal').addEventListener('click', closeTareaModal);
document.getElementById('closeTareaModal2').addEventListener('click', closeTareaModal);

document.getElementById('saveTareaBtn').addEventListener('click', async () => {
  const titulo = document.getElementById('tf-titulo').value.trim();
  if (!titulo) { alert('El título es obligatorio.'); return; }
  const obj = { ...(editingTarea||{}), titulo, estado: document.getElementById('tf-estado').value, prioridad: document.getElementById('tf-prioridad').value, notas: document.getElementById('tf-notas').value };
  const saved = await saveTarea(clientId, obj);
  if (editingTarea) { const i = STATE.tareas.findIndex(t => t.id === saved.id); STATE.tareas[i] = saved; }
  else STATE.tareas.push(saved);
  closeTareaModal();
  updateBadges();
  renderTareas(document.getElementById('main-content'));
});

document.getElementById('deleteTareaBtn').addEventListener('click', async () => {
  if (!editingTarea || !confirm('¿Eliminar esta tarea?')) return;
  await deleteTarea(clientId, editingTarea.id);
  STATE.tareas = STATE.tareas.filter(t => t.id !== editingTarea.id);
  closeTareaModal();
  updateBadges();
  renderTareas(document.getElementById('main-content'));
});

// ──────────────────────────────────────────────────────
// PAUTA
// ──────────────────────────────────────────────────────
function renderPauta(container) {
  const total = STATE.campanas.reduce((s,c) => s + (c.presupuesto||0), 0);
  const gastado = STATE.campanas.reduce((s,c) => s + (c.gastado||0), 0);
  const activas = STATE.campanas.filter(c => c.estado === 'Activa').length;

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px;">
      ${[
        { label: 'Campañas activas', val: activas, icon: '🟢' },
        { label: 'Presupuesto total', val: '$'+fmtNum(total), icon: '💰' },
        { label: 'Gastado', val: '$'+fmtNum(gastado), icon: '💸' },
        { label: '% ejecutado', val: total ? Math.round(gastado/total*100)+'%' : '—', icon: '📊' },
      ].map(m => `<div class="card" style="padding:16px;"><div style="font-size:22px;margin-bottom:6px;">${m.icon}</div><div style="font-size:22px;font-weight:800;">${m.val}</div><div style="font-size:12px;color:var(--text-muted);">${m.label}</div></div>`).join('')}
    </div>

    <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
      <h3 style="font-size:15px;font-weight:600;">Campañas</h3>
    </div>

    ${STATE.campanas.length ? STATE.campanas.map(c => {
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
              { label:'Impresiones', val: fmtNum(c.impresiones) },
              { label:'Alcance', val: fmtNum(c.alcance) },
              { label:'Clics', val: fmtNum(c.clics) },
              { label:'CPM', val: c.cpm ? '$'+c.cpm : '—' },
              { label:'CTR', val: c.ctr ? c.ctr+'%' : '—' },
              { label:'Período', val: `${fmtDate(c.fechaInicio)}→${fmtDate(c.fechaFin)}` },
            ].map(s => `<div><div class="campaign-stat-label">${s.label}</div><div class="campaign-stat-val">${s.val||'—'}</div></div>`).join('')}
          </div>
          <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(pct,100)}%;"></div></div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px;">${pct}% del presupuesto ejecutado</div>
        </div>
      `;
    }).join('')
    : `<div class="empty-state"><div class="empty-state-icon">📊</div><h3>Sin campañas</h3><p>Agregá tu primera campaña de pauta digital.</p></div>`}

    <div class="card" style="margin-top:16px;padding:16px;">
      <div style="font-size:13px;color:var(--text-muted);">
        💡 <strong>Conectar Meta Ads:</strong> Para importar resultados automáticamente desde Meta Ads Manager,
        necesitás configurar el token de acceso de la API de Marketing de Meta.
        Seguí las instrucciones en <code>SETUP.md</code>.
      </div>
    </div>
  `;
}

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
  document.getElementById('deleteCampanaBtn').style.display = editingCampana ? '' : 'none';
  document.getElementById('campanaModal').classList.remove('hidden');
};

function closeCampanaModal() { document.getElementById('campanaModal').classList.add('hidden'); }
document.getElementById('closeCampanaModal').addEventListener('click', closeCampanaModal);
document.getElementById('closeCampanaModal2').addEventListener('click', closeCampanaModal);

document.getElementById('saveCampanaBtn').addEventListener('click', async () => {
  const nombre = document.getElementById('pf-nombre').value.trim();
  if (!nombre) { alert('El nombre es obligatorio.'); return; }
  const obj = { ...(editingCampana||{}), nombre, plataforma: document.getElementById('pf-plataforma').value, estado: document.getElementById('pf-estado').value, presupuesto: +document.getElementById('pf-presupuesto').value||0, gastado: +document.getElementById('pf-gastado').value||0, fechaInicio: document.getElementById('pf-inicio').value, fechaFin: document.getElementById('pf-fin').value, impresiones: +document.getElementById('pf-impresiones').value||0, alcance: +document.getElementById('pf-alcance').value||0, clics: +document.getElementById('pf-clics').value||0, cpm: +document.getElementById('pf-cpm').value||0 };
  const saved = await saveCampana(clientId, obj);
  if (editingCampana) { const i = STATE.campanas.findIndex(c => c.id === saved.id); STATE.campanas[i] = saved; }
  else STATE.campanas.push(saved);
  closeCampanaModal();
  renderPauta(document.getElementById('main-content'));
});

document.getElementById('deleteCampanaBtn').addEventListener('click', async () => {
  if (!editingCampana || !confirm('¿Eliminar esta campaña?')) return;
  const { deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js");
  const { db, DEMO_MODE } = await import('./firebase.js');
  if (!DEMO_MODE) await deleteDoc(doc(db, 'clients', clientId, 'campanas', editingCampana.id));
  else {
    const data = JSON.parse(localStorage.getItem(`mh_data_${clientId}`)||'{}');
    data.campanas = (data.campanas||[]).filter(c => c.id !== editingCampana.id);
    localStorage.setItem(`mh_data_${clientId}`, JSON.stringify(data));
  }
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

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.classList.add('hidden'); });
});

// ── Start ──────────────────────────────────────────────
init();
