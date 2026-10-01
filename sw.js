// Service worker mínimo: solo existe para que el sitio cumpla el criterio
// de instalabilidad de PWA/TWA (Chrome exige un service worker con manejador
// de "fetch" para considerar el sitio instalable). A propósito NO cachea
// nada -- el Hub ya tuvo problemas serios de contenido viejo servido por
// caché (ver _headers), así que todo pasa directo a la red.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  // A propósito no se llama a event.respondWith(): con eso alcanza para
  // que Chrome considere el sitio instalable, sin meter al service worker
  // en el medio de cada pedido (todos los pedidos a la API del Hub pasan
  // por acá también, no solo los del sitio) -- interceptarlos de más
  // agregaba una demora real y se sospecha que colgaba alguno.
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
