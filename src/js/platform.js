// Comportement « appli » : pas de zoom au pincement ni au double-tap, service worker et mise à jour automatique.
export function setupPlatform() {
  // pas de zoom : pincement et double-tap bloqués (Safari ignore la balise viewport)
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(t => document.addEventListener(t, e => e.preventDefault(), { passive: false }));
  document.addEventListener('touchmove', e => { if (e.touches && e.touches.length > 1) e.preventDefault(); }, { passive: false });
  let lastTouch = 0;
  document.addEventListener('touchend', e => { const now = Date.now(); if (now - lastTouch < 320 && !e.target.closest('input, textarea')) e.preventDefault(); lastTouch = now; }, { passive: false });

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => reg.update()).catch(() => {});
    // quand une nouvelle version prend le relais, on recharge une fois pour l'afficher
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloaded && !sessionStorage.getItem('craquage-sw-reload')) { reloaded = true; sessionStorage.setItem('craquage-sw-reload', 1); location.reload(); } });
  }
}
