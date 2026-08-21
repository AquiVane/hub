import { WORKER_URL, DEMO_MODE } from './firebase.js';
import { getSessionToken } from './auth.js';

// ── Worker API helper ─────────────────────────────────────────
async function api(method, path, body = null) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getSessionToken()}`,
    },
  };
  if (body !== null) opts.body = JSON.stringify(body);
  const res = await fetch(WORKER_URL + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Error del servidor');
  return data;
}

// ── Demo data ─────────────────────────────────────────────────
function getDemoData(clientId) {
  const key = `mh_data_${clientId}`;
  const stored = localStorage.getItem(key);
  if (stored) try { return JSON.parse(stored); } catch {}

  const hoy = new Date();
  const f = (d) => new Date(hoy.getFullYear(), hoy.getMonth(), d).toISOString().split('T')[0];

  const defaultData = {
    client: { id: clientId, name: clientId === 'slots' ? 'Slots!' : 'DOMO', instagram: `@${clientId}`, facebook: clientId },
    prioridades: [
      'Reporte trimestral RRSS',
      'Activación de tracking',
      'Pauta Publicitaria nuevas campañas',
      'Sitio web – configuraciones',
    ],
    todos: [
      { id: 1, text: 'Reunión individual Gerente-MKT', done: false },
      { id: 2, text: 'Revisar encuesta mensual', done: true },
      { id: 3, text: 'Automatizaciones pendientes', done: false },
    ],
    contenidos: [
      { id: 'c1', titulo: 'Story 1: La Rosalía', plataformas: ['Instagram','Facebook'], ubicacion: 'Story', eje: 'Institucional', tipo: 'Informativo', estado: 'Publicado', cuenta: `@${clientId}`, formato: 'Story', objetivo: 'Notoriedad', linkDrive: '', notas: 'Subir en hora pico', fechaPub: f(1), copy: '' },
      { id: 'c2', titulo: 'Story 2: La Rosalía', plataformas: ['Instagram','Facebook'], ubicacion: 'Story', eje: 'Institucional', tipo: 'Informativo', estado: 'Publicado', cuenta: `@${clientId}`, formato: 'Story', objetivo: 'Notoriedad', linkDrive: '', notas: '', fechaPub: f(3), copy: '' },
      { id: 'c3', titulo: 'Reel Mensual Total de pagos', plataformas: ['Instagram','Facebook'], ubicacion: 'Feed', eje: 'Institucional', tipo: 'Informativo', estado: 'Aprobado', cuenta: `@${clientId}`, formato: 'Carrusel', objetivo: 'Engagement', linkDrive: '', notas: '', fechaPub: f(10), copy: 'Este mes cerramos con números increíbles 📊' },
      { id: 'c4', titulo: 'Shows Musicales', plataformas: ['Instagram','Facebook'], ubicacion: 'Feed', eje: 'Entretenimiento', tipo: 'Promocional', estado: 'Idea', cuenta: `@${clientId}`, formato: 'Imagen', objetivo: 'Notoriedad', linkDrive: '', notas: '', fechaPub: f(15), copy: '' },
      { id: 'c5', titulo: 'Sorteo especial', plataformas: ['Facebook'], ubicacion: 'Feed', eje: 'Interacción', tipo: 'Sorteo', estado: 'Idea', cuenta: `@${clientId}`, formato: 'Imagen', objetivo: 'Alcance', linkDrive: '', notas: '', fechaPub: f(18), copy: '¡Participá y ganá!' },
      { id: 'c6', titulo: 'Post aniversario', plataformas: ['Instagram','Facebook'], ubicacion: 'Feed', eje: 'Institucional', tipo: 'Celebración', estado: 'En proceso', cuenta: `@${clientId}`, formato: 'Video', objetivo: 'Notoriedad', linkDrive: '', notas: 'Pedir diseño', fechaPub: f(20), copy: '' },
      { id: 'c7', titulo: 'Promo gastronómica', plataformas: ['Instagram'], ubicacion: 'Story', eje: 'Comercial', tipo: 'Oferta', estado: 'En revisión', cuenta: `@${clientId}`, formato: 'Story', objetivo: 'Conversión', linkDrive: '', notas: '', fechaPub: f(22), copy: 'Menú especial solo por este mes 🍽️' },
      { id: 'c8', titulo: 'CAC Challenge/trend', plataformas: ['Instagram'], ubicacion: 'Feed', eje: 'Entretenimiento', tipo: 'Viral', estado: 'Aprobado', cuenta: `@${clientId}`, formato: 'Reel', objetivo: 'Alcance', linkDrive: '', notas: '', fechaPub: f(25), copy: '' },
      { id: 'c9', titulo: 'Evento VIP', plataformas: ['Instagram','Facebook'], ubicacion: 'Feed', eje: 'Institucional', tipo: 'Evento', estado: 'Programado', cuenta: `@${clientId}`, formato: 'Imagen', objetivo: 'Notoriedad', linkDrive: '', notas: '', fechaPub: f(28), copy: 'Te esperamos en una noche única ✨' },
    ],
    tareas: [
      { id: 't1', titulo: 'Socio estratégico OTHON', estado: 'En progreso', notas: '', prioridad: 'Alta' },
      { id: 't2', titulo: 'Optimización canales digitales', estado: 'Sin empezar', notas: '9 subtareas', prioridad: 'Media' },
      { id: 't3', titulo: 'Email marketing', estado: 'Sin empezar', notas: '', prioridad: 'Media' },
      { id: 't4', titulo: 'Verificación cuentas IG', estado: 'Sin empezar', notas: '3 pendientes', prioridad: 'Alta' },
      { id: 't5', titulo: 'Deadlines planner outlook', estado: 'En progreso', notas: '', prioridad: 'Baja' },
      { id: 't6', titulo: 'Activación digital conversiones: tracking', estado: 'En progreso', notas: '', prioridad: 'Alta' },
      { id: 't7', titulo: 'Linkedin - Marca empleadora', estado: 'En progreso', notas: '', prioridad: 'Media' },
      { id: 't8', titulo: 'Evento VIP Día del Amigo', estado: 'Listo', notas: '', prioridad: 'Alta' },
      { id: 't9', titulo: 'Template PREMIOS', estado: 'Listo', notas: '', prioridad: 'Media' },
      { id: 't10', titulo: 'Sitio web configuraciones', estado: 'Listo', notas: '', prioridad: 'Alta' },
    ],
    campanas: [
      { id: 'p1', nombre: 'Campaña Awareness Q2', plataforma: 'Meta Ads', estado: 'Activa', presupuesto: 50000, gastado: 32400, impresiones: 125000, alcance: 89000, clics: 3200, cpm: 25.9, ctr: 2.56, fechaInicio: f(1), fechaFin: f(30) },
      { id: 'p2', nombre: 'Retargeting Eventos', plataforma: 'Meta Ads', estado: 'Activa', presupuesto: 20000, gastado: 14800, impresiones: 45000, alcance: 22000, clics: 1800, cpm: 32.9, ctr: 4.0, fechaInicio: f(5), fechaFin: f(25) },
      { id: 'p3', nombre: 'Tráfico Sitio Web', plataforma: 'Google Ads', estado: 'Pausada', presupuesto: 15000, gastado: 15000, impresiones: 67000, alcance: 67000, clics: 2100, cpm: 22.4, ctr: 3.13, fechaInicio: f(1), fechaFin: f(15) },
    ],
    metricas: {
      seguidores_ig: 4820, crecimiento_ig: '+3.2%',
      seguidores_fb: 12400, crecimiento_fb: '+1.1%',
      alcance_mensual: 89000, tasa_engagement: '4.8%',
      publicaciones: 22, impresiones: 210000,
    },
    ideas: [
      { id: 'i1', titulo: 'Video invitación Show Oct', plataformas: ['Instagram','Facebook'], formato: 'Video', notas: 'Confirmar fecha', fechaCreacion: f(2) },
      { id: 'i2', titulo: 'Cumpleaños cliente del mes', plataformas: ['Instagram'], formato: 'Story', notas: '', fechaCreacion: f(5) },
      { id: 'i3', titulo: 'Pozos Millonarios – interacción', plataformas: ['Instagram'], formato: 'Imagen', notas: '', fechaCreacion: f(8) },
    ],
  };

  localStorage.setItem(key, JSON.stringify(defaultData));
  return defaultData;
}

function saveDemoData(clientId, data) {
  localStorage.setItem(`mh_data_${clientId}`, JSON.stringify(data));
}

// ══════════════════════════════════════════════════════════════
//  API pública — todas las funciones verifican DEMO_MODE
// ══════════════════════════════════════════════════════════════

export async function getClientData(clientId) {
  if (DEMO_MODE) return getDemoData(clientId);
  // Admins usan /admin/clients (lista completa); clientes usan su propio endpoint
  const user = JSON.parse(localStorage.getItem('mh_user') || '{}');
  if (user.role === 'admin') {
    const clients = await api('GET', '/admin/clients');
    return clients.find(c => c.id === clientId) || { id: clientId };
  }
  return api('GET', `/data/${clientId}/clientinfo`);
}

// ── Contenidos ────────────────────────────────────────────────

export async function getContenidos(clientId) {
  if (DEMO_MODE) return getDemoData(clientId).contenidos;
  return api('GET', `/data/${clientId}/contenidos`);
}

export async function saveContenido(clientId, contenido) {
  if (DEMO_MODE) {
    const data = getDemoData(clientId);
    const idx = data.contenidos.findIndex(c => c.id === contenido.id);
    if (idx >= 0) data.contenidos[idx] = contenido;
    else { contenido.id = 'c' + Date.now(); data.contenidos.push(contenido); }
    saveDemoData(clientId, data);
    return contenido;
  }
  const list = await api('GET', `/data/${clientId}/contenidos`);
  const idx = list.findIndex(c => c.id === contenido.id);
  if (idx >= 0) list[idx] = contenido;
  else { contenido.id = 'c' + Date.now(); list.push(contenido); }
  await api('POST', `/data/${clientId}/contenidos`, list);
  return contenido;
}

export async function saveContenidosBulk(clientId, contenidos) {
  const withIds = contenidos.map((c, i) => ({ ...c, id: 'c' + Date.now() + '_' + i }));
  if (DEMO_MODE) {
    const data = getDemoData(clientId);
    data.contenidos.push(...withIds);
    saveDemoData(clientId, data);
    return withIds;
  }
  const list = await api('GET', `/data/${clientId}/contenidos`);
  list.push(...withIds);
  await api('POST', `/data/${clientId}/contenidos`, list);
  return withIds;
}

export async function deleteContenido(clientId, id) {
  if (DEMO_MODE) {
    const data = getDemoData(clientId);
    data.contenidos = data.contenidos.filter(c => c.id !== id);
    saveDemoData(clientId, data);
    return;
  }
  const list = await api('GET', `/data/${clientId}/contenidos`);
  await api('POST', `/data/${clientId}/contenidos`, list.filter(c => c.id !== id));
}

// ── Tareas ────────────────────────────────────────────────────

export async function getTareas(clientId) {
  if (DEMO_MODE) return getDemoData(clientId).tareas;
  return api('GET', `/data/${clientId}/tareas`);
}

export async function saveTarea(clientId, tarea) {
  if (DEMO_MODE) {
    const data = getDemoData(clientId);
    const idx = data.tareas.findIndex(t => t.id === tarea.id);
    if (idx >= 0) data.tareas[idx] = tarea;
    else { tarea.id = 't' + Date.now(); data.tareas.push(tarea); }
    saveDemoData(clientId, data);
    return tarea;
  }
  const list = await api('GET', `/data/${clientId}/tareas`);
  const idx = list.findIndex(t => t.id === tarea.id);
  if (idx >= 0) list[idx] = tarea;
  else { tarea.id = 't' + Date.now(); list.push(tarea); }
  await api('POST', `/data/${clientId}/tareas`, list);
  return tarea;
}

export async function deleteTarea(clientId, id) {
  if (DEMO_MODE) {
    const data = getDemoData(clientId);
    data.tareas = data.tareas.filter(t => t.id !== id);
    saveDemoData(clientId, data);
    return;
  }
  const list = await api('GET', `/data/${clientId}/tareas`);
  await api('POST', `/data/${clientId}/tareas`, list.filter(t => t.id !== id));
}

// ── Campañas ──────────────────────────────────────────────────

export async function getCampanas(clientId) {
  if (DEMO_MODE) return getDemoData(clientId).campanas;
  return api('GET', `/data/${clientId}/campanas`);
}

export async function saveCampana(clientId, campana) {
  if (DEMO_MODE) {
    const data = getDemoData(clientId);
    const idx = data.campanas.findIndex(c => c.id === campana.id);
    if (idx >= 0) data.campanas[idx] = campana;
    else { campana.id = 'p' + Date.now(); data.campanas.push(campana); }
    saveDemoData(clientId, data);
    return campana;
  }
  const list = await api('GET', `/data/${clientId}/campanas`);
  const idx = list.findIndex(c => c.id === campana.id);
  if (idx >= 0) list[idx] = campana;
  else { campana.id = 'p' + Date.now(); list.push(campana); }
  await api('POST', `/data/${clientId}/campanas`, list);
  return campana;
}

export async function saveCampanasBulk(clientId, campanas) {
  const withIds = campanas.map((c, i) => ({ ...c, id: 'p' + Date.now() + '_' + i }));
  if (DEMO_MODE) {
    const data = getDemoData(clientId);
    data.campanas.push(...withIds);
    saveDemoData(clientId, data);
    return withIds;
  }
  const list = await api('GET', `/data/${clientId}/campanas`);
  list.push(...withIds);
  await api('POST', `/data/${clientId}/campanas`, list);
  return withIds;
}

// ── Métricas ──────────────────────────────────────────────────

export async function getMetricas(clientId) {
  if (DEMO_MODE) return getDemoData(clientId).metricas;
  return api('GET', `/data/${clientId}/metricas`);
}

// ── Home (prioridades + to-do) ────────────────────────────────

export async function getHomeData(clientId) {
  if (DEMO_MODE) {
    const d = getDemoData(clientId);
    return { prioridades: d.prioridades||[], todos: d.todos||[], links: d.links||[], webTareas: d.webTareas||[], logoEmpresa: d.logoEmpresa||'' };
  }
  const home = (await api('GET', `/data/${clientId}/home`)) || {};
  return {
    prioridades: home.prioridades || [],
    todos: home.todos || [],
    links: home.links || [],
    webTareas: home.webTareas || [],
    archivos: home.archivos || [],
    logoEmpresa: home.logoEmpresa || ''
  };
}

export async function saveHomeData(clientId, homeObj) {
  const { prioridades=[], todos=[], links=[], webTareas=[], archivos=[], logoEmpresa='' } = homeObj || {};
  if (DEMO_MODE) {
    const data = getDemoData(clientId);
    data.prioridades = prioridades;
    data.todos = todos;
    data.links = links;
    data.webTareas = webTareas;
    data.archivos = archivos;
    data.logoEmpresa = logoEmpresa;
    saveDemoData(clientId, data);
    return;
  }
  await api('POST', `/data/${clientId}/home`, { prioridades, todos, links, webTareas, archivos, logoEmpresa });
}

// ── Plan de ejecución (página privada por cliente) ─────────────

export async function getPlan(clientId) {
  if (DEMO_MODE) return { html: '' };
  const plan = await api('GET', `/data/${clientId}/plan`);
  return (plan && plan.html) ? plan : { html: '' };
}

// ── Ideas ─────────────────────────────────────────────────────

export async function getIdeas(clientId) {
  if (DEMO_MODE) return getDemoData(clientId).ideas;
  return api('GET', `/data/${clientId}/ideas`);
}

export async function saveIdea(clientId, idea) {
  if (DEMO_MODE) {
    const data = getDemoData(clientId);
    const idx = data.ideas.findIndex(i => i.id === idea.id);
    if (idx >= 0) data.ideas[idx] = idea;
    else { idea.id = 'i' + Date.now(); data.ideas.push(idea); }
    saveDemoData(clientId, data);
    return idea;
  }
  const list = await api('GET', `/data/${clientId}/ideas`);
  const idx = list.findIndex(i => i.id === idea.id);
  if (idx >= 0) list[idx] = idea;
  else { idea.id = 'i' + Date.now(); list.push(idea); }
  await api('POST', `/data/${clientId}/ideas`, list);
  return idea;
}

export async function deleteIdea(clientId, id) {
  if (DEMO_MODE) {
    const data = getDemoData(clientId);
    data.ideas = data.ideas.filter(i => i.id !== id);
    saveDemoData(clientId, data);
    return;
  }
  const list = await api('GET', `/data/${clientId}/ideas`);
  await api('POST', `/data/${clientId}/ideas`, list.filter(i => i.id !== id));
}

export async function deleteCampana(clientId, id) {
  if (DEMO_MODE) {
    const data = getDemoData(clientId);
    data.campanas = data.campanas.filter(c => c.id !== id);
    saveDemoData(clientId, data);
    return;
  }
  const list = await api('GET', `/data/${clientId}/campanas`);
  await api('POST', `/data/${clientId}/campanas`, list.filter(c => c.id !== id));
}

export async function saveMetricasData(clientId, metricas) {
  if (DEMO_MODE) {
    const data = getDemoData(clientId);
    data.metricas = metricas;
    saveDemoData(clientId, data);
    return;
  }
  await api('POST', `/data/${clientId}/metricas`, metricas);
}

// ── Admin ─────────────────────────────────────────────────────

export async function getAllClients() {
  if (DEMO_MODE) {
    return [
      { id: 'slots', nombre: 'Slots!', email: 'slots@demo.com', instagram: '@wildeslots', activo: true },
      { id: 'domo',  nombre: 'DOMO',   email: 'domo@demo.com',  instagram: '@domobsa',    activo: true },
    ];
  }
  return api('GET', '/admin/clients');
}

export async function createClient(clientData) {
  if (DEMO_MODE) {
    alert('Para crear clientes reales configurá el worker primero (editá js/firebase.js con la URL).');
    return;
  }
  return api('POST', '/admin/clients', clientData);
}

export async function createColaborador(data) {
  if (DEMO_MODE) {
    alert('Para crear colaboradores reales configurá el worker primero (editá js/firebase.js con la URL).');
    return;
  }
  return api('POST', '/admin/colaboradores', data);
}

export async function getColaboradores() {
  if (DEMO_MODE) return [];
  return api('GET', '/admin/colaboradores');
}

export async function updateColaborador(email, updates) {
  if (DEMO_MODE) { alert('En modo demo no se pueden editar colaboradores reales.'); return; }
  return api('PATCH', `/admin/colaboradores/${encodeURIComponent(email)}`, updates);
}

export async function getInformes() {
  if (DEMO_MODE) return [];
  return api('GET', '/admin/informes');
}

export async function aprobarInforme(id) {
  if (DEMO_MODE) { alert('En modo demo no se pueden aprobar informes reales.'); return; }
  return api('POST', `/admin/informes/${encodeURIComponent(id)}/aprobar`);
}

export async function generarInformesManual(mes, anio) {
  if (DEMO_MODE) { alert('En modo demo no se pueden generar informes reales.'); return { generados: 0 }; }
  return api('POST', '/admin/informes/generar', { mes, anio });
}

export async function saveClientData(clientId, data) {
  if (DEMO_MODE) {
    const demo = getDemoData(clientId);
    demo.client = { ...demo.client, ...data };
    saveDemoData(clientId, demo);
    return demo.client;
  }
  return api('POST', `/admin/clients/${clientId}`, data);
}
