// Mapa de productos COSMART (uso interno). El HTML vive en el worker
// marketing-hub (GET /admin/mapa, solo admin de COSMART con sesión
// válida) -- nunca en este repo, que es público.
import { WORKER_URL } from './firebase.js';
import { getSessionToken } from './auth.js';

const auth = () => ({ 'Authorization': `Bearer ${getSessionToken()}` });

export async function traerMapa(doc) {
  const res = await fetch(WORKER_URL + '/admin/mapa' + (doc ? '?doc=' + encodeURIComponent(doc) : ''), { headers: auth() });
  if (res.status === 403 || res.status === 401) throw new Error('Esta sección es solo para el admin de COSMART con la sesión iniciada.');
  if (!res.ok) throw new Error('No pude cargar el mapa. Probá de nuevo.');
  const d = await res.json();
  if (!d.html) throw new Error('Todavía no fue publicado. Pedile a Claude que lo publique.');
  return d.html;
}

export async function subirMapa(html) {
  const res = await fetch(WORKER_URL + '/admin/mapa', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...auth() },
    body: JSON.stringify({ html }),
  });
  if (!res.ok) throw new Error('No se pudo subir el mapa.');
}

export async function mostrarMapa(iframe, estado, doc) {
  estado.textContent = 'Cargando…';
  try {
    iframe.srcdoc = await traerMapa(doc);
    estado.textContent = '';
  } catch (e) {
    iframe.srcdoc = '';
    estado.textContent = e.message;
  }
}
