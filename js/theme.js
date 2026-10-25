(function () {
  function currentMode() {
    try { return localStorage.getItem('hub_theme') || 'system'; } catch (e) { return 'system'; }
  }

  function applyTheme(mode) {
    if (mode === 'light' || mode === 'dark') document.documentElement.setAttribute('data-theme', mode);
    else document.documentElement.removeAttribute('data-theme');
  }

  var LABELS = {
    system: ['monitor', 'Tema: Sistema'],
    light: ['sun', 'Tema: Claro'],
    dark: ['moon', 'Tema: Oscuro'],
  };

  function updateToggleUI() {
    var mode = currentMode();
    var iconWrap = document.getElementById('themeToggleIconWrap');
    var label = document.getElementById('themeToggleLabel');
    var v = LABELS[mode] || LABELS.system;
    if (label) label.textContent = v[1];
    if (iconWrap) {
      // lucide.createIcons() reemplaza el <i data-lucide> por un <svg> --
      // por eso hay que volver a crear el <i> desde cero en cada cambio,
      // no alcanza con pisarle el atributo a un <svg> ya convertido.
      iconWrap.innerHTML = '<i data-lucide="' + v[0] + '" class="nav-icon"></i>';
      if (window.lucide) window.lucide.createIcons();
    }
  }

  function setMode(mode) {
    try {
      if (mode === 'system') localStorage.removeItem('hub_theme');
      else localStorage.setItem('hub_theme', mode);
    } catch (e) {}
    applyTheme(mode === 'system' ? null : mode);
    updateToggleUI();
  }

  window.cycleTheme = function () {
    var order = ['system', 'light', 'dark'];
    var next = order[(order.indexOf(currentMode()) + 1) % order.length];
    setMode(next);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', updateToggleUI);
  else updateToggleUI();

  // ---- Botón "Descargar app" (instalar la PWA) ----
  var deferredPrompt = null;
  function isStandalone() {
    return (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;
  }
  var UA = navigator.userAgent || '';
  var isIOS = /iPad|iPhone|iPod/.test(UA) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isIOSSafari = isIOS && !/CriOS|FxiOS|EdgiOS|OPiOS|GSA\//.test(UA);

  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferredPrompt = e; });
  window.addEventListener('appinstalled', function () {
    var b = document.getElementById('installAppBtn'); if (b) b.style.display = 'none';
  });

  function step(n, html) {
    return '<div style="display:flex;gap:10px;align-items:flex-start;margin:10px 0;"><span style="flex:0 0 24px;height:24px;border-radius:50%;background:#1A4DAA;color:#fff;font-weight:700;font-size:13px;display:flex;align-items:center;justify-content:center;">' + n + '</span><div style="flex:1;line-height:1.45;">' + html + '</div></div>';
  }

  function closeInstallModal() {
    var m = document.getElementById('installAppModal'); if (m) m.remove();
  }

  function showInstallModal() {
    closeInstallModal();
    var body;
    if (isIOSSafari) {
      body = '<p style="margin:0 0 4px;">Instalá el Hub como app en tu iPhone en 3 pasos:</p>' +
        step(1, 'Tocá el botón <b>Compartir</b> (el cuadradito con la flecha hacia arriba) en la barra de abajo de Safari.') +
        step(2, 'Deslizá hacia abajo y elegí <b>"Agregar a inicio"</b>.') +
        step(3, 'Tocá <b>Agregar</b>. Listo: el ícono del Hub queda en tu pantalla de inicio.');
    } else if (isIOS) {
      body = '<p style="margin:0 0 4px;">En iPhone la app se instala desde <b>Safari</b>. Seguí estos pasos:</p>' +
        step(1, 'Copiá el link con el botón de abajo.') +
        step(2, 'Abrí <b>Safari</b> y pegalo en la barra de direcciones.') +
        step(3, 'Entrá al Hub, tocá <b>Compartir</b> (cuadradito con flecha) → <b>"Agregar a inicio"</b> → <b>Agregar</b>.') +
        '<button id="installCopyBtn" style="width:100%;margin-top:6px;padding:12px;border:0;border-radius:10px;background:#1A4DAA;color:#fff;font-weight:700;font-size:15px;cursor:pointer;">Copiar link para Safari</button>';
    } else {
      body = '<p style="margin:0 0 4px;">Instalalo desde el menú del navegador:</p>' +
        step(1, 'Tocá el menú <b>⋮</b> (arriba a la derecha).') +
        step(2, 'Elegí <b>"Instalar app"</b> o <b>"Agregar a la pantalla principal"</b>.') +
        step(3, 'Confirmá. El ícono del Hub queda en tu pantalla de inicio.');
    }
    var m = document.createElement('div');
    m.id = 'installAppModal';
    m.setAttribute('style', 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.6);display:flex;align-items:flex-end;justify-content:center;padding:0;');
    m.innerHTML = '<div role="dialog" aria-modal="true" style="background:#0B1B3A;color:#fff;width:100%;max-width:440px;border-radius:18px 18px 0 0;padding:20px 18px calc(20px + env(safe-area-inset-bottom));box-sizing:border-box;max-height:90vh;overflow:auto;font-size:15px;">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><b style="font-size:17px;">Descargar la app del Hub</b><button id="installCloseBtn" aria-label="Cerrar" style="background:none;border:0;color:#fff;font-size:26px;line-height:1;cursor:pointer;padding:4px 8px;">×</button></div>' +
      body + '<a href="/instalar.html" style="display:block;text-align:center;margin-top:14px;color:#9CC4F5;font-size:14px;">Ver guía completa (Windows, Mac, Android, iPhone y iPad)</a></div>';
    document.body.appendChild(m);
    m.addEventListener('click', function (e) { if (e.target === m) closeInstallModal(); });
    document.getElementById('installCloseBtn').onclick = closeInstallModal;
    var cp = document.getElementById('installCopyBtn');
    if (cp) cp.onclick = function () {
      var url = location.origin + '/login.html';
      var done = function () { cp.textContent = '¡Link copiado! Pegalo en Safari'; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(done, function () { window.prompt('Copiá este link:', url); });
      else window.prompt('Copiá este link:', url);
    };
  }

  window.installApp = function () {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () { deferredPrompt = null; });
    } else showInstallModal();
  };

  function addInstallButton() {
    if (isStandalone() || document.getElementById('installAppBtn')) return;
    var theme = document.getElementById('themeToggleBtn');
    if (!theme) return;
    var b = document.createElement('button');
    b.id = 'installAppBtn';
    b.className = 'btn-logout';
    b.type = 'button';
    b.setAttribute('style', 'margin-bottom:6px;display:flex;align-items:center;justify-content:center;gap:6px;');
    b.innerHTML = '<i data-lucide="download" class="nav-icon"></i><span>Descargar app</span>';
    b.onclick = window.installApp;
    theme.parentNode.insertBefore(b, theme);
    if (window.lucide) window.lucide.createIcons();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addInstallButton);
  else addInstallButton();
})();
