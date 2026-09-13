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
