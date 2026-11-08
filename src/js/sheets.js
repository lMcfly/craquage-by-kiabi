// Panneaux du bas (réglages, « Je veux voir… », bienvenue) : on les ferme en les faisant glisser vers le bas,
// en touchant le fond sombre, ou avec Échap. Le glissement ne démarre que si le panneau est déjà en haut de son contenu,
// pour ne pas gêner le défilement.
export function swipeToClose(sheet, close) {
  const panel = sheet.querySelector('.catpanel');
  let y0 = null, dy = 0, t0 = 0, dragging = false;

  const move = d => {
    dy = Math.max(0, d);
    panel.style.transform = `translateY(${dy}px)`;
    sheet.style.backgroundColor = `rgba(4, 0, 55, ${.35 * Math.max(0, 1 - dy / panel.offsetHeight)})`;
  };
  const reset = () => { panel.style.transform = ''; sheet.style.backgroundColor = ''; setTimeout(() => { panel.style.transition = ''; }, 230); };
  const finish = () => {
    if (!dragging) { y0 = null; return; }
    dragging = false; y0 = null;
    const fast = dy / Math.max(1, Date.now() - t0) > .5;
    panel.style.transition = 'transform .22s ease';
    if (dy > Math.min(120, panel.offsetHeight * .25) || (fast && dy > 40)) {
      panel.style.transform = `translateY(${panel.offsetHeight}px)`;
      setTimeout(() => { close(); panel.style.transform = ''; panel.style.transition = ''; sheet.style.backgroundColor = ''; }, 200);
    } else reset();
  };
  const begin = y => { y0 = y; dy = 0; t0 = Date.now(); dragging = false; };
  const drag = (y, e) => {
    if (y0 == null) return;
    const d = y - y0;
    if (!dragging) {
      if (d > 6 && panel.scrollTop <= 0) { dragging = true; panel.style.transition = 'none'; }
      else if (d < -6 || panel.scrollTop > 0) { y0 = null; return; }
      else return;
    }
    if (e.cancelable) e.preventDefault();
    move(d);
  };

  // doigt : n'importe où sur le panneau
  panel.addEventListener('touchstart', e => { if (e.touches.length === 1) begin(e.touches[0].clientY); }, { passive: true });
  panel.addEventListener('touchmove', e => drag(e.touches[0].clientY, e), { passive: false });
  panel.addEventListener('touchend', finish);
  panel.addEventListener('touchcancel', finish);
  // souris : en tirant la poignée
  const grab = panel.querySelector('.grab');
  grab.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; begin(e.clientY); grab.setPointerCapture(e.pointerId); });
  grab.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') drag(e.clientY, e); });
  grab.addEventListener('pointerup', e => { if (e.pointerType === 'mouse') finish(); });
  // toucher le fond sombre
  sheet.addEventListener('click', e => { if (e.target === sheet) close(); });
}
