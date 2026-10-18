/* Verano en Juego — configuración pública y helpers compartidos (solo valores públicos por diseño) */
window.VEJ = (function () {
  var CFG = {
    API: 'https://verano-en-juego.conglomeradocosmart.workers.dev',          // Worker de licencias, activación y métricas
    MP_WORKER: 'https://mp-productos-ganadores.conglomeradocosmart.workers.dev', // Worker de cobros ya existente (/preference, /pay)
    MP_PUBLIC_KEY: 'APP_USR-057d290b-5af9-4b00-8a08-6753dc47aec4',
    PAYPAL_CLIENT_ID: 'AYuQX3JJShvSkgNn0C195h3GEHGiKNtx44X3wd_5PEoBI1iinpysmDzNRqdZ7blNuZvFWIwcwhc9qiOP',
    PRODUCTO: 'verano-en-juego',
    PRECIO_ARS: 3500, PRECIO_USD: 2.28,   // solo para mostrar: el monto real lo fija el servidor
    BASE: '/juegos/verano-en-juego/', JUGAR: '/juegos/jugar/'
  };
  function ars(n) { return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
  function emailOk(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s) && s.length <= 120; }
  function cookie(n) { var m = document.cookie.match(new RegExp('(?:^|; )' + n + '=([^;]*)')); return m ? decodeURIComponent(m[1]) : ''; }
  function api(path, body, opts) {
    opts = opts || {};
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var t = ctrl ? setTimeout(function () { ctrl.abort(); }, opts.timeout || 12000) : null;
    return fetch(CFG.API + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}),
      signal: ctrl ? ctrl.signal : undefined, keepalive: !!opts.keepalive
    }).then(function (r) { if (t) clearTimeout(t); return r.json().catch(function () { return {}; }).then(function (j) { j._status = r.status; return j; }); })
      .catch(function (e) { if (t) clearTimeout(t); return { ok: false, _status: 0, error: 'Sin conexión. Revisá tu internet e intentá de nuevo.' }; });
  }
  // ID anónimo del navegador (sin datos personales) para métricas
  function anon() {
    try { var v = localStorage.getItem('vej-anon'); if (!v) { v = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()).replace(/-/g, '').slice(0, 24); localStorage.setItem('vej-anon', v); } return v; }
    catch (e) { return 'sin-storage'; }
  }
  function evento(tipo, juego) {
    var b = { evento: tipo, anon: anon() }; if (juego) b.juego = juego;
    return api('/api/eventos', b, { keepalive: true, timeout: 5000 });
  }
  return { cfg: CFG, ars: ars, emailOk: emailOk, cookie: cookie, api: api, anon: anon, evento: evento };
})();
