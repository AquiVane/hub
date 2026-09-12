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
})();
