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
  event.respondWith(fetch(event.request));
});
