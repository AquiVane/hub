// Botón ⟳ "Actualizar" (admin y panel de clientes): recarga completa forzada, como Ctrl+Shift+R.
// Borra las copias guardadas por la app, pide de nuevo los archivos a la red y recarga.
(function () {
  const st = document.createElement('style'); st.textContent = '@keyframes hubSpin{to{transform:rotate(360deg)}}'; document.head.appendChild(st);
  window.hubActualizar = async function () {
    const ic = document.getElementById('iconActualizar');
    if (ic) ic.style.animation = 'hubSpin .8s linear infinite';
    try {
      if (window.caches) { const k = await caches.keys(); await Promise.all(k.map(x => caches.delete(x))); }
      if (navigator.serviceWorker) { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r => r.update().catch(() => {}))); }
      const urls = [location.href, ...performance.getEntriesByType('resource').map(e => e.name).filter(u => u.startsWith(location.origin))];
      await Promise.race([Promise.all(urls.map(u => fetch(u, { cache: 'reload' }).catch(() => {}))), new Promise(r => setTimeout(r, 4000))]);
    } catch (e) {}
    location.reload();
  };
})();
