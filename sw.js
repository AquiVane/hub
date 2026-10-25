// Service worker del Hub. Dos trabajos: (1) cumplir el criterio de
// instalabilidad de PWA y (2) desde el 25/10, dejar abrir el Hub SIN conexión
// (pedido de Vaneh: seguir trabajando sin internet y sincronizar después).
//
// Estrategia a propósito "red primero": con internet SIEMPRE sirve lo más
// nuevo de la red (el Hub ya tuvo problemas serios de contenido viejo por
// caché, ver _headers) y guarda una copia; la copia solo se usa si la red
// falla o tarda más de 6 s. No toca la API del Hub (otro dominio) ni nada
// que no sea GET -- los datos offline los maneja js/offline.js.
const CACHE = 'hub-shell-v1';
const CDN_OK = ['unpkg.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  const network = fetch(request).then(async (res) => {
    if (res && (res.ok || res.type === 'opaque')) {
      const copy = res.clone();
      cache.put(request, copy).then(async () => {
        // Tope de tamaño: si se acumulan copias de versiones viejas (?v=), borra las más antiguas.
        const keys = await cache.keys();
        if (keys.length > 200) for (const k of keys.slice(0, 60)) cache.delete(k);
      }).catch(() => {});
    }
    return res;
  });
  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), 6000));
  try {
    const first = await Promise.race([network, timeout]);
    if (first) return first;
    const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
    return cached || network;
  } catch (e) {
    const cached = await cache.match(request, { ignoreSearch: request.mode === 'navigate' });
    if (cached) return cached;
    throw e;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (!sameOrigin && !CDN_OK.includes(url.hostname)) return;
  if (sameOrigin && (url.pathname === '/sw.js' || url.pathname.startsWith('/.well-known/'))) return;
  event.respondWith(networkFirst(req));
});

// Notificaciones push (29/09, pedido de Vaneh: "que notifique ventas,
// leads, tareas" -- mismo mecanismo ya probado en la PWA de Ventas de
// Training, Push API estándar del browser, sin SDK de terceros) -- cada
// notificación que ya se crea en la campanita (asignación, mención,
// cambio de estado, comentario, lead nuevo, venta) llega acá también
// como push real al dispositivo.
self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch (e) {}
  const title = data.title || 'Marketing Hub';
  const options = {
    body: data.body || '',
    icon: data.icon || '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: data.data || {},
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/admin/index.html';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
