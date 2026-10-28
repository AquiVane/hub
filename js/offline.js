// Modo sin conexión (25/10, pedido de Vaneh: "que se pueda seguir trabajando
// sin conexión y que cuando enganche internet se sincronice").
//
// Cómo funciona (todo vive en el dispositivo, en IndexedDB):
//  - Cada GET exitoso a la API se guarda ("cache"): lo último que se vio con
//    internet. Sin conexión se muestra eso, con un aviso.
//  - Cada guardado de /data/:cliente/:tipo sin conexión (o con la conexión
//    caída a mitad de camino) no se manda: se anota como cambio pendiente
//    ("pending"), ítem por ítem (por `id`), con la versión base que había
//    cuando se empezó a editar.
//  - Al volver la conexión se baja la lista fresca del servidor y se le
//    aplican SOLO los cambios propios -- los de los demás no se pisan. Si
//    otra persona tocó el MISMO ítem, se pregunta cuál versión se queda.
//
// Regla de diseño: el servidor sigue guardando listas enteras (POST de la
// lista completa), así que el merge se hace acá, en el cliente.
import { WORKER_URL } from './firebase.js';

const DB_NAME = 'hub-offline';
const RE_DATA = /^\/data\/[^/]+\/[^/]+$/;

let rawFn = null;          // la api() "cruda" de data.js (sin offline)
let flagOffline = false;   // true si el último pedido falló por red
let syncing = false;
let conflictOpen = false;
let lastSynced = null;     // { remoteChanged, at } para el cartel de "Sincronizado"
let syncedTimer = null;

export function configure(raw) { rawFn = raw; }

// ── IndexedDB mínimo (si falla, todo sigue andando sin modo offline) ──
let dbp = null;
function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const r = indexedDB.open(DB_NAME, 1);
      r.onupgradeneeded = () => {
        r.result.createObjectStore('cache');
        r.result.createObjectStore('pending');
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error);
    });
  }
  return dbp;
}
async function idb(store, mode, fn) {
  try {
    const d = await db();
    return await new Promise((resolve, reject) => {
      const t = d.transaction(store, mode);
      let out;
      const rq = fn(t.objectStore(store));
      if (rq) rq.onsuccess = () => { out = rq.result; };
      t.oncomplete = () => resolve(out);
      t.onerror = t.onabort = () => reject(t.error);
    });
  } catch (e) { return undefined; }
}

function userKey() {
  try { return (JSON.parse(localStorage.getItem('mh_user') || '{}').email || '') + '|'; } catch (e) { return '|'; }
}
const kGet = (store, path) => idb(store, 'readonly', s => s.get(userKey() + path));
const kSet = (store, path, v) => idb(store, 'readwrite', s => s.put(v, userKey() + path));
const kDel = (store, path) => idb(store, 'readwrite', s => s.delete(userKey() + path));
async function kPaths(store) {
  const pre = userKey();
  const keys = (await idb(store, 'readonly', s => s.getAllKeys(IDBKeyRange.bound(pre, pre + '￿')))) || [];
  return keys.map(k => k.slice(pre.length));
}

// ── Utilidades ────────────────────────────────────────────────
function stable(v) {
  if (Array.isArray(v)) return '[' + v.map(stable).join(',') + ']';
  if (v && typeof v === 'object') {
    return '{' + Object.keys(v).sort().filter(k => v[k] !== undefined).map(k => JSON.stringify(k) + ':' + stable(v[k])).join(',') + '}';
  }
  return JSON.stringify(v === undefined ? null : v);
}
function me() {
  try { const u = JSON.parse(localStorage.getItem('mh_user') || '{}'); return { por: u.name || u.email || 'alguien', mail: u.email || '', role: u.role || '' }; }
  catch (e) { return { por: 'alguien', mail: '', role: '' }; }
}
const CONFLICTOS = '/data/_cosmart/conflictos';
const clientOf = path => (path.split('/')[2] || '');
const tipoOf = path => (path.split('/')[3] || '');
const fmtFecha = iso => { try { return new Date(iso).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } };
const eq = (a, b) => (a === undefined || b === undefined) ? a === b : stable(a) === stable(b);
const clone = v => (v === undefined ? v : JSON.parse(JSON.stringify(v)));

function isItemsList(a) {
  if (!Array.isArray(a)) return false;
  const seen = new Set();
  for (const x of a) {
    if (!x || typeof x !== 'object' || Array.isArray(x)) return false;
    if (typeof x.id !== 'string' && typeof x.id !== 'number') return false;
    if (seen.has(x.id)) return false;
    seen.add(x.id);
  }
  return true;
}
const toMap = a => { const m = new Map(); (Array.isArray(a) ? a : []).forEach(x => { if (x && x.id !== undefined) m.set(x.id, x); }); return m; };

function countOps(p) { return !p ? 0 : p.mode === 'items' ? Object.keys(p.ops).length : 1; }
export async function pendingCount() {
  let n = 0;
  for (const path of await kPaths('pending')) n += countOps(await kGet('pending', path));
  return n;
}

// ── Punto de entrada: lo usa api() de data.js ─────────────────
export async function wrap(method, path, body, raw) {
  const isData = RE_DATA.test(path);

  if (method === 'GET') {
    if (isData && navigator.onLine !== false && (await kGet('pending', path))) {
      try { await syncPath(path); } catch (e) { /* queda pendiente */ }
    }
    if (await kGet('pending', path)) {
      const c = await kGet('cache', path);
      if (c) return clone(c.local);
    }
    try {
      const data = await raw();
      markOnline();
      await kSet('cache', path, { server: data, local: data, at: Date.now() });
      return data;
    } catch (e) {
      if (e && e.isNet) {
        const c = await kGet('cache', path);
        if (c) { markOffline(); return clone(c.local); }
        markOffline();
        e.message = 'Sin conexión, y esto todavía no se abrió con internet en este dispositivo.';
      }
      throw e;
    }
  }

  if (method === 'POST' && isData) {
    body = await stampAutor(path, body);
    raw = () => rawFn('POST', path, body); // manda el cuerpo ya sellado con autor
    if (/^\/data\/(?!_personal\/)[^/]+\/contenidos$/.test(path)) {
      // Preserva la base original, combina contra lectura fresca y envía CAS.
      // Si ocurre 409/503 no borra la cola ni vuelve a escribir a ciegas.
      const queued = await enqueue(path, body);
      if(navigator.onLine !== false) {
        try { await syncPath(path); markOnline(); return {ok:true}; }
        catch(e) { if(e?.isNet)markOffline(); throw e; }
      }
      return queued;
    }
    if (navigator.onLine !== false && !(await kGet('pending', path))) {
      try {
        const r = await raw();
        markOnline();
        await kSet('cache', path, { server: body, local: body, at: Date.now() });
        return r;
      } catch (e) {
        if (!e || !e.isNet) throw e;
        markOffline();
      }
    }
    return enqueue(path, body);
  }

  try {
    const r = await raw();
    markOnline();
    return r;
  } catch (e) {
    if (e && e.isNet) {
      markOffline();
      if (navigator.onLine === false) e.message = 'Esto necesita conexión a internet.';
    }
    throw e;
  }
}

// Cada ítem que se guarda lleva `_ed` = quién lo tocó y cuándo (como el
// "última edición de ..." de Google Docs), así un conflicto puede mostrar
// "Ger puso X a las 14:03". Solo se sella lo que cambió respecto a lo último visto.
async function stampAutor(path, body) {
  if (path === CONFLICTOS || !isItemsList(body)) return body;
  const c = await kGet('cache', path);
  if (!c || !isItemsList(c.local)) return body;
  const L = toMap(c.local), who = me(), en = new Date().toISOString();
  return body.map(it => {
    const prev = L.get(it.id);
    if (prev && eq(prev, it)) return it;
    return { ...it, _ed: { por: who.por, mail: who.mail, en } };
  });
}

// ── Cola de cambios ───────────────────────────────────────────
async function enqueue(path, body) {
  const c = await kGet('cache', path);
  if (!c) {
    throw new Error('Sin conexión: esto no se abrió antes con internet en este dispositivo, así que no se puede guardar ahora.');
  }
  let p = (await kGet('pending', path)) || null;
  const canItems = isItemsList(c.server) && isItemsList(body) && (!p || p.mode === 'items');

  if (canItems) {
    p = p || { mode: 'items', ops: {} };
    const L = toMap(c.local), N = toMap(body), S = toMap(c.server);
    const ids = new Set([...L.keys(), ...N.keys()]);
    for (const id of ids) {
      if (eq(L.get(id), N.get(id))) continue;
      const prev = p.ops[id];
      const base = prev ? prev.base : S.get(id);
      const next = N.get(id);
      if (eq(next, base)) delete p.ops[id];
      else p.ops[id] = { base: clone(base), next: clone(next) };
    }
    if (!Object.keys(p.ops).length) p = null;
  } else {
    const base = p && p.mode === 'whole' ? p.base : c.server;
    p = eq(body, base) ? null : { mode: 'whole', base: clone(base), next: clone(body) };
  }

  if (p) await kSet('pending', path, p); else await kDel('pending', path);
  c.local = clone(body);
  await kSet('cache', path, c);
  render();
  return { ok: true, queued: true };
}

// ── Sincronización ────────────────────────────────────────────
async function rawGet(path) { return rawFn('GET', path, null); }

async function syncPath(path) {
  const p = await kGet('pending', path);
  if (!p || !rawFn) return;
  const fresh = await rawGet(path);
  const c = (await kGet('cache', path)) || {};
  let merged, conflicts = [];

  if (p.mode === 'items') {
    merged = clone(Array.isArray(fresh) ? fresh : []);
    const S = toMap(merged);
    const todo = [];
    for (const [id, op] of Object.entries(p.ops)) {
      const key = isNaN(Number(id)) || S.has(id) ? id : Number(id);
      const s = S.has(key) ? S.get(key) : S.get(Number(id));
      if (eq(s, op.next)) continue;
      if (eq(s, op.base)) todo.push({ id: key, op });
      else conflicts.push({ id: key, op, theirs: s });
    }
    const apply = (id, next) => {
      const i = merged.findIndex(x => x && String(x.id) === String(id));
      if (next === undefined) { if (i >= 0) merged.splice(i, 1); }
      else if (i >= 0) merged[i] = clone(next);
      else merged.push(clone(next));
    };
    todo.forEach(t => apply(t.id, t.op.next));
    if (conflicts.length) {
      if (me().role === 'colaborador') {
        // Como en Google Docs: el desempate es de la administración. Mientras tanto
        // queda la versión que ya estaba en el servidor y se guardan las dos.
        await estacionarConflictos(path, conflicts);
        lastSynced = { remoteChanged: true, parked: ((lastSynced && lastSynced.parked) || 0) + conflicts.length };
      } else {
        const choice = await askConflicts(path, conflicts);
        conflicts.forEach((cf, i) => { if (choice[i] === 'mine') apply(cf.id, cf.op.next); });
      }
    }
  } else {
    if (eq(fresh, p.next)) merged = fresh;
    else if (eq(fresh, p.base)) merged = p.next;
    else {
      const cf = [{ id: null, op: { base: p.base, next: p.next }, theirs: fresh }];
      if (me().role === 'colaborador') {
        await estacionarConflictos(path, cf);
        lastSynced = { remoteChanged: true, parked: ((lastSynced && lastSynced.parked) || 0) + 1 };
        merged = fresh;
      } else {
        const choice = await askConflicts(path, cf);
        merged = choice[0] === 'mine' ? p.next : fresh;
      }
    }
  }

  if (!eq(merged, fresh)) await rawFn('POST', path, merged, fresh);
  const remoteChanged = !eq(merged, c.local);
  await kSet('cache', path, { server: merged, local: merged, at: Date.now() });
  await kDel('pending', path);
  lastSynced = { ...(lastSynced || {}), remoteChanged: (lastSynced && lastSynced.remoteChanged) || remoteChanged };
}

const verDe = (item, rolFallback) => ({
  por: (item && item._ed && item._ed.por) || rolFallback,
  en: (item && item._ed && item._ed.en) || null,
  borrado: item === undefined || item === null,
  valor: item === undefined ? null : item,
});

async function estacionarConflictos(path, conflicts) {
  const lista = clone(await rawFn('GET', CONFLICTOS)) || [];
  const arr = Array.isArray(lista) ? lista : [];
  const who = me();
  for (const cf of conflicts) {
    const mia = { ...verDe(cf.op.next, who.por), por: who.por, mail: who.mail, en: (cf.op.next && cf.op.next._ed && cf.op.next._ed.en) || new Date().toISOString() };
    const suya = verDe(cf.theirs, 'otra persona');
    const abierto = arr.find(r => r.estado === 'abierto' && r.path === path && String(r.itemId) === String(cf.id));
    if (abierto) { if (!abierto.versiones.some(v => eq(v.valor, mia.valor))) abierto.versiones.push(mia); continue; }
    arr.push({
      id: 'cf' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      estado: 'abierto', path, clientId: clientOf(path), tipo: tipoOf(path), itemId: cf.id,
      etiqueta: itemLabel(cf.op.next || cf.theirs || cf.op.base, path), creado: new Date().toISOString(),
      versiones: [suya, mia],
    });
  }
  await rawFn('POST', CONFLICTOS, arr);
}

// ── Administración: ver y desempatar conflictos ──
let conflictosAbiertos = 0;
export async function refreshConflictos() {
  if (me().role !== 'admin' || !rawFn || navigator.onLine === false) return;
  try {
    const l = await wrap('GET', CONFLICTOS, null, () => rawFn('GET', CONFLICTOS));
    conflictosAbiertos = (Array.isArray(l) ? l : []).filter(r => r.estado === 'abierto').length;
  } catch (e) { /* sin permisos o sin red: no molesta */ }
  render();
}

export async function reviewConflictos() {
  const l = await wrap('GET', CONFLICTOS, null, () => rawFn('GET', CONFLICTOS));
  const abiertos = (Array.isArray(l) ? l : []).filter(r => r.estado === 'abierto');
  if (!abiertos.length) { conflictosAbiertos = 0; render(); return; }
  const eleccion = await askVersiones(abiertos);
  for (let i = 0; i < abiertos.length; i++) {
    const r = abiertos[i], v = r.versiones[eleccion[i]];
    if (!v) continue;
    const lista = await wrap('GET', r.path, null, () => rawFn('GET', r.path));
    let nueva;
    if (r.itemId === null || r.itemId === undefined) nueva = v.valor;
    else {
      nueva = Array.isArray(lista) ? clone(lista) : [];
      const idx = nueva.findIndex(x => x && String(x.id) === String(r.itemId));
      if (v.borrado) { if (idx >= 0) nueva.splice(idx, 1); }
      else if (idx >= 0) nueva[idx] = clone(v.valor); else nueva.push(clone(v.valor));
    }
    await wrap('POST', r.path, nueva, () => rawFn('POST', r.path, nueva));
    r.estado = 'resuelto';
  }
  const resto = l.filter(r => r.estado === 'abierto');
  await wrap('POST', CONFLICTOS, resto, () => rawFn('POST', CONFLICTOS, resto));
  conflictosAbiertos = resto.length;
  window.dispatchEvent(new CustomEvent('hub-synced', { detail: { remoteChanged: true } }));
  lastSynced = { remoteChanged: true };
  render();
}

export async function syncAll() {
  if (syncing || conflictOpen) return;
  if (navigator.onLine === false) { render(); return; }
  const run = async () => {
    syncing = true; render();
    let failed = false;
    try {
      for (const path of await kPaths('pending')) {
        try { await syncPath(path); }
        catch (e) { failed = true; if (e && e.isNet) { markOffline(); break; } console.warn('[offline] no se pudo sincronizar', path, e); }
      }
    } finally { syncing = false; }
    if (!failed && !(await pendingCount())) {
      if (lastSynced) {
        window.dispatchEvent(new CustomEvent('hub-synced', { detail: lastSynced }));
        clearTimeout(syncedTimer);
        syncedTimer = setTimeout(() => { lastSynced = null; render(); }, lastSynced.remoteChanged ? 20000 : 4000);
      }
    }
    render();
  };
  if (navigator.locks && navigator.locks.request) await navigator.locks.request('hub-sync', { ifAvailable: true }, l => (l ? run() : undefined));
  else await run();
}

function markOffline() { if (!flagOffline) { flagOffline = true; render(); } }
function markOnline() {
  if (flagOffline) { flagOffline = false; render(); }
  pendingCount().then(n => { if (n && !syncing) syncAll(); });
}

// ── Salir de la sesión sin perder cambios ─────────────────────
export async function beforeLogout() {
  let n = await pendingCount();
  if (n && navigator.onLine !== false) {
    await Promise.race([syncAll(), new Promise(r => setTimeout(r, 10000))]);
    n = await pendingCount();
  }
  if (n && !window.confirm(`Tenés ${n} cambio${n === 1 ? '' : 's'} sin sincronizar. Si cerrás sesión ahora se pierden. ¿Cerrar igual?`)) return false;
  const pre = userKey();
  for (const store of ['cache', 'pending']) {
    const keys = (await idb(store, 'readonly', s => s.getAllKeys(IDBKeyRange.bound(pre, pre + '￿')))) || [];
    for (const k of keys) await idb(store, 'readwrite', s => s.delete(k));
  }
  return true;
}

// ── Interfaz: cartel de estado y modal de conflictos ──────────
let bar = null;
function ensureBar() {
  if (bar) return bar;
  const st = document.createElement('style');
  st.textContent = `
  #hubOfflineBar{position:fixed;left:50%;transform:translateX(-50%);top:calc(8px + env(safe-area-inset-top,0px));z-index:99990;max-width:calc(100vw - 24px);display:none;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;font:600 13px/1.3 'DM Sans',system-ui,sans-serif;color:#fff;box-shadow:0 4px 16px rgba(0,0,0,.3)}
  #hubOfflineBar button{background:rgba(255,255,255,.22);border:0;color:#fff;font:inherit;border-radius:999px;padding:4px 10px;cursor:pointer}
  #hubOfflineBar.off{background:#8A5A00}#hubOfflineBar.sync{background:#1A4DAA}#hubOfflineBar.err{background:#9B1C1C}#hubOfflineBar.ok{background:#12683B}
  #hubConflictModal{position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;padding:16px;font-family:'DM Sans',system-ui,sans-serif}
  #hubConflictModal .box{background:#0B1B3A;color:#fff;border-radius:16px;width:100%;max-width:560px;max-height:88vh;overflow:auto;padding:18px}
  #hubConflictModal h3{font-size:18px;margin:0 0 6px;color:#fff}#hubConflictModal p{margin:0 0 12px;font-size:14px;color:#fff;opacity:.9}
  #hubConflictModal .cf{border:1px solid rgba(255,255,255,.25);border-radius:12px;padding:12px;margin-bottom:12px}
  #hubConflictModal .cf b{display:block;margin-bottom:6px;color:#fff}
  #hubConflictModal .diff{font-size:13px;color:#fff;opacity:.9;margin:2px 0;word-break:break-word}
  #hubConflictModal .opts{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
  #hubConflictModal .opt{flex:1 1 140px;min-height:44px;border-radius:10px;border:2px solid rgba(255,255,255,.35);background:transparent;color:#fff;font:600 14px 'DM Sans',system-ui,sans-serif;cursor:pointer;padding:8px}
  #hubConflictModal .opt.sel{background:#1A4DAA;border-color:#6BB0E8}
  #hubConflictModal .go{width:100%;min-height:48px;border:0;border-radius:12px;background:#3A8FC7;color:#fff;font:700 16px 'DM Sans',system-ui,sans-serif;cursor:pointer}
  #hubConflictModal .go[disabled]{opacity:.45;cursor:not-allowed}
  #hubConflictModal .bulk{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
  #hubConflictModal .bulk button{flex:1 1 150px;background:transparent;border:1px dashed rgba(255,255,255,.4);color:#fff;border-radius:10px;padding:8px;cursor:pointer;font:600 13px 'DM Sans',system-ui,sans-serif}`;
  document.head.appendChild(st);
  bar = document.createElement('div');
  bar.id = 'hubOfflineBar';
  bar.setAttribute('role', 'status');
  bar.setAttribute('aria-live', 'polite');
  document.body.appendChild(bar);
  return bar;
}

async function render() {
  if (!document.body || !localStorage.getItem('mh_session_token')) return;
  const n = await pendingCount();
  const off = navigator.onLine === false || flagOffline;
  const b = ensureBar();
  const plural = n === 1 ? '' : 's';
  let cls = '', html = '';
  if (off) { cls = 'off'; html = n ? `Sin conexión · ${n} cambio${plural} pendiente${plural}` : 'Sin conexión · mostrando lo último guardado'; }
  else if (syncing) { cls = 'sync'; html = 'Sincronizando…'; }
  else if (n) { cls = 'err'; html = `${n} cambio${plural} sin sincronizar`; }
  else if (lastSynced && lastSynced.parked) { cls = 'off'; html = 'Algunos cambios tuyos chocaron con los de otra persona. La administración va a elegir la versión.'; }
  else if (lastSynced) { cls = 'ok'; html = lastSynced.remoteChanged ? '✓ Sincronizado · hay novedades del equipo' : '✓ Todo sincronizado'; }
  else if (conflictosAbiertos) { cls = 'off'; html = `${conflictosAbiertos} conflicto${conflictosAbiertos === 1 ? '' : 's'} por resolver`; }
  if (!cls) { b.style.display = 'none'; return; }
  b.className = cls;
  b.textContent = html;
  if (!off && !syncing && n) { const r = document.createElement('button'); r.textContent = 'Reintentar'; r.onclick = () => syncAll(); b.appendChild(r); }
  if (cls === 'off' && !lastSynced && conflictosAbiertos) { const r = document.createElement('button'); r.textContent = 'Resolver'; r.onclick = () => reviewConflictos(); b.appendChild(r); }
  if (cls === 'ok' && lastSynced.remoteChanged) { const r = document.createElement('button'); r.textContent = 'Actualizar'; r.onclick = () => location.reload(); b.appendChild(r); }
  b.style.display = 'flex';
}

const TIPOS = { tareas: 'Tarea', contenidos: 'Contenido', ideas: 'Idea', campanas: 'Campaña', guiones: 'Guion', procesos: 'Procesos', recursos: 'Recursos', home: 'Inicio', plan: 'Plan', metricas: 'Métricas' };
function itemLabel(it, path) {
  const tipo = TIPOS[path.split('/').pop()] || 'Dato';
  if (!it) return tipo;
  const name = it.titulo || it.title || it.nombre || it.name || it.texto || it.idea || '';
  return name ? `${tipo}: ${String(name).slice(0, 80)}` : tipo;
}
function diffLines(a, b) {
  const out = [];
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return out;
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const k of keys) {
    if (k.startsWith('_') || eq(a[k], b[k])) continue;
    const f = v => v === undefined ? '(vacío)' : (typeof v === 'string' ? v : JSON.stringify(v)).slice(0, 70);
    out.push({ k, mine: f(a[k]), theirs: f(b[k]) });
    if (out.length >= 5) break;
  }
  return out;
}

function askConflicts(path, conflicts) {
  conflictOpen = true;
  return new Promise(resolve => {
    const choice = new Array(conflicts.length).fill(null);
    const m = document.createElement('div');
    m.id = 'hubConflictModal';
    const box = document.createElement('div');
    box.className = 'box';
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    const h = document.createElement('h3');
    h.textContent = conflicts.length === 1 ? 'Alguien más cambió lo mismo' : `Alguien más cambió ${conflicts.length} cosas que vos también tocaste`;
    const intro = document.createElement('p');
    intro.textContent = 'Mientras no tenías conexión, otra persona editó lo mismo que vos. Elegí qué versión se queda en cada caso.';
    box.append(h, intro);

    const go = document.createElement('button');
    go.className = 'go'; go.textContent = 'Confirmar y sincronizar'; go.disabled = true;
    const refresh = () => { go.disabled = choice.some(c => !c); };

    if (conflicts.length > 1) {
      const bulk = document.createElement('div'); bulk.className = 'bulk';
      [['mine', 'Quedarme con todas las mías'], ['theirs', 'Quedarme con todas las del equipo']].forEach(([v, t]) => {
        const bt = document.createElement('button'); bt.textContent = t;
        bt.onclick = () => { conflicts.forEach((_, i) => { choice[i] = v; }); box.querySelectorAll('.cf').forEach(cf => cf.querySelectorAll('.opt').forEach(o => o.classList.toggle('sel', o.dataset.v === v))); refresh(); };
        bulk.appendChild(bt);
      });
      box.appendChild(bulk);
    }

    conflicts.forEach((cf, i) => {
      const card = document.createElement('div'); card.className = 'cf';
      const t = document.createElement('b');
      const mineGone = cf.op.next === undefined, theirsGone = cf.theirs === undefined;
      t.textContent = itemLabel(cf.op.next || cf.theirs || cf.op.base, path);
      card.appendChild(t);
      if (mineGone || theirsGone) {
        const d = document.createElement('div'); d.className = 'diff';
        d.textContent = mineGone ? 'Vos la borraste, pero el equipo la modificó.' : 'El equipo la borró, pero vos la modificaste.';
        card.appendChild(d);
      } else {
        const quien = (it, def) => `${(it && it._ed && it._ed.por) || def}${it && it._ed && it._ed.en ? ' (' + fmtFecha(it._ed.en) + ')' : ''}`;
        const who = document.createElement('div'); who.className = 'diff';
        who.textContent = `Tuya: ${quien(cf.op.next, 'vos')} · Del equipo: ${quien(cf.theirs, 'otra persona')}`;
        card.appendChild(who);
        diffLines(cf.op.next, cf.theirs).forEach(l => {
          const d = document.createElement('div'); d.className = 'diff';
          d.textContent = `${l.k}: tuya "${l.mine}" · del equipo "${l.theirs}"`;
          card.appendChild(d);
        });
      }
      const opts = document.createElement('div'); opts.className = 'opts';
      [['mine', mineGone ? 'Borrarla igual' : 'Quedarme con la mía'], ['theirs', theirsGone ? 'Dejarla borrada' : 'Quedarme con la del equipo']].forEach(([v, label]) => {
        const o = document.createElement('button'); o.className = 'opt'; o.dataset.v = v; o.textContent = label;
        o.onclick = () => { choice[i] = v; opts.querySelectorAll('.opt').forEach(x => x.classList.toggle('sel', x === o)); refresh(); };
        opts.appendChild(o);
      });
      card.appendChild(opts);
      box.appendChild(card);
    });

    go.onclick = () => { m.remove(); conflictOpen = false; resolve(choice); };
    box.appendChild(go);
    m.appendChild(box);
    document.body.appendChild(m);
  });
}

function askVersiones(registros) {
  conflictOpen = true;
  return new Promise(resolve => {
    const choice = new Array(registros.length).fill(null);
    const m = document.createElement('div'); m.id = 'hubConflictModal';
    const box = document.createElement('div'); box.className = 'box';
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    const h = document.createElement('h3'); h.textContent = registros.length === 1 ? 'Hay dos versiones: elegí cuál se queda' : `${registros.length} conflictos: elegí qué versión se queda`;
    const intro = document.createElement('p'); intro.textContent = 'Dos personas cambiaron lo mismo. Ves quién puso qué y cuándo. La que elijas queda para todo el equipo.';
    box.append(h, intro);
    const go = document.createElement('button'); go.className = 'go'; go.textContent = 'Confirmar'; go.disabled = true;
    const refresh = () => { go.disabled = choice.some(c => c === null); };
    const masReciente = r => r.versiones.reduce((best, v, i) => (!best || (v.en || '') > (r.versiones[best.i].en || '') ? { i } : best), null).i;
    const marcar = (card, i) => card.querySelectorAll('.opt').forEach((o, k) => o.classList.toggle('sel', k === i));
    const cards = [];
    if (registros.length > 1) {
      const bulk = document.createElement('div'); bulk.className = 'bulk';
      const bt = document.createElement('button'); bt.textContent = 'Dejar la más reciente en todos';
      bt.onclick = () => { registros.forEach((r, i) => { choice[i] = masReciente(r); marcar(cards[i], choice[i]); }); refresh(); };
      bulk.appendChild(bt); box.appendChild(bulk);
    }
    registros.forEach((r, i) => {
      const card = document.createElement('div'); card.className = 'cf'; cards.push(card);
      const t = document.createElement('b'); t.textContent = `${r.etiqueta}${r.clientId && r.clientId !== '_cosmart' ? ' · ' + r.clientId : ''}`; card.appendChild(t);
      const opts = document.createElement('div'); opts.className = 'opts';
      r.versiones.forEach((v, k) => {
        const d = document.createElement('div'); d.className = 'diff';
        const otras = r.versiones.filter((_, j) => j !== k);
        const lineas = v.borrado ? ['la borró'] : diffLines(v.valor, (otras[0] && otras[0].valor) || {}).map(l => `${l.k}: "${l.mine}"`);
        d.textContent = `${v.por}${v.en ? ' (' + fmtFecha(v.en) + ')' : ''}: ${lineas.join(' · ') || 'sin cambios visibles'}`;
        card.appendChild(d);
        const o = document.createElement('button'); o.className = 'opt';
        o.textContent = `Dejar la de ${v.por}${k === masReciente(r) ? ' (más reciente)' : ''}`;
        o.onclick = () => { choice[i] = k; marcar(card, k); refresh(); };
        opts.appendChild(o);
      });
      card.appendChild(opts); box.appendChild(card);
    });
    go.onclick = () => { m.remove(); conflictOpen = false; resolve(choice); };
    box.appendChild(go); m.appendChild(box); document.body.appendChild(m);
  });
}

// ── Arranque ──────────────────────────────────────────────────
function boot() {
  window.addEventListener('online', () => { flagOffline = false; render(); syncAll().then(refreshConflictos); });
  window.addEventListener('offline', () => render());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { render(); syncAll(); } });
  setInterval(() => { pendingCount().then(n => { if (n && !syncing && !conflictOpen) syncAll(); }); }, 20000);
  render();
  syncAll();
  setTimeout(refreshConflictos, 2500);
  setInterval(refreshConflictos, 60000);
}
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  window.hubOffline = { syncAll, pendingCount, refreshConflictos, reviewConflictos };
}
