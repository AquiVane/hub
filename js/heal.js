// Auto-reparación del arranque (24/11, Vaneh: "cuando actualizás la app a mis clientes les queda en blanco y la única opción
// es cerrar sesión y volver a entrar; no puede pasar"). Se carga ANTES que app.js, como script común (no módulo), así
// funciona aunque el módulo falle. Si pasan 30 s y la app no avisó que arrancó (window.__hubListo), o un script de la
// app no se pudo cargar/ejecutar, borra las copias guardadas (caché del service worker), desregistra el service worker y
// recarga una sola vez por minuto (máx. 2 veces por pestaña). NO toca los cambios sin sincronizar (viven en IndexedDB).
(function () {
  var K = 'hub_heal_log';
  function hist() { try { return JSON.parse(sessionStorage.getItem(K) || '[]'); } catch (e) { return []; } }
  window.__hubListo = false;
  window.__hubReparar = function (motivo) {
    var h = hist(), ahora = Date.now();
    if (h.length >= 2 || (h.length && ahora - h[h.length - 1] < 60000)) return false;
    try { h.push(ahora); sessionStorage.setItem(K, JSON.stringify(h)); sessionStorage.setItem('hub_heal_motivo', String(motivo || '')); } catch (e) {}
    (async function () {
      try {
        if (window.caches) { var k = await caches.keys(); await Promise.all(k.map(function (x) { return caches.delete(x); })); }
        if (navigator.serviceWorker) { var r = await navigator.serviceWorker.getRegistrations(); await Promise.all(r.map(function (x) { return x.unregister().catch(function () {}); })); }
      } catch (e) {}
      location.reload();
    })();
    return true;
  };
  setTimeout(function () { if (!window.__hubListo) window.__hubReparar('arranque lento o fallido'); }, 30000);
  window.addEventListener('error', function (e) {
    var t = e && e.target;
    if (t && t.tagName === 'SCRIPT' && /\/js\//.test(t.src || '')) window.__hubReparar('no se pudo cargar ' + t.src);
  }, true);
})();
