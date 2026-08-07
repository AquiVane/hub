import { WORKER_URL, DEMO_MODE } from './firebase.js';

// ── Demo users (modo sin worker configurado) ──────────────────
const DEMO_USERS = {
  'admin@demo.com': { password: 'admin123', role: 'admin',  clientId: null,    name: 'Admin' },
  'slots@demo.com': { password: 'slots123', role: 'client', clientId: 'slots', name: 'Slots!' },
  'domo@demo.com':  { password: 'domo123',  role: 'client', clientId: 'domo',  name: 'DOMO' },
};

// ── Helpers de sesión local ───────────────────────────────────
function saveSession(token, userData) {
  localStorage.setItem('mh_session_token', token);
  localStorage.setItem('mh_user', JSON.stringify(userData));
}

function clearSession() {
  localStorage.removeItem('mh_session_token');
  localStorage.removeItem('mh_user');
}

export function getSessionToken() {
  return localStorage.getItem('mh_session_token') || '';
}

// ── API pública ───────────────────────────────────────────────

export async function loginUser(email, password) {
  if (DEMO_MODE) {
    const user = DEMO_USERS[email.toLowerCase()];
    if (!user || user.password !== password) throw new Error('Email o contraseña incorrectos.');
    const userData = { email, role: user.role, clientId: user.clientId, name: user.name };
    saveSession('demo-token', userData);
    return userData;
  }

  const res = await fetch(WORKER_URL + '/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Error al iniciar sesión.');

  const userData = { email: data.email, role: data.role, clientId: data.clientId, name: data.name };
  saveSession(data.token, userData);
  return data;
}

export async function logoutUser() {
  if (!DEMO_MODE) {
    const token = getSessionToken();
    if (token && token !== 'demo-token') {
      fetch(WORKER_URL + '/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      }).catch(() => {});
    }
  }
  clearSession();
  window.location.href = '/index.html';
}

export function getCurrentUser() {
  const raw = localStorage.getItem('mh_user');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function requireAuth(requiredRole) {
  const user = getCurrentUser();
  if (!user) {
    if (window.location.pathname !== '/index.html' && window.location.pathname !== '/') {
      window.location.href = '/index.html';
    }
    return null;
  }
  if (requiredRole && user.role !== requiredRole) {
    window.location.href = '/index.html';
    return null;
  }
  return user;
}
