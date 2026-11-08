// Animation d'ouverture : les lettres de « Craquage » montent, le cœur craque, « by K » apparaît.
import { $, reduced } from './utils.js';

export function playSplash() {
  const sp = $('splash'), word = $('word'), by = sp.querySelector('.by');
  let done = false;
  const finish = () => { if (done) return; done = true;
    sp.animate([{ opacity: 1, transform: 'scale(1)' }, { opacity: 0, transform: 'scale(1.06)' }], { duration: 420, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' }).onfinish = () => sp.remove(); };
  sp.addEventListener('click', finish);
  // lettres dans une fente invisible + cœur en deux moitiés (fissure en zigzag)
  const letters = [...'Craquage'].map(ch => { const m = document.createElement('span'); m.className = 'm'; const l = document.createElement('span'); l.className = 'l'; l.textContent = ch; m.appendChild(l); word.appendChild(m); return l; });
  const H = 'M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.1 0 3.6 1.2 5.3 3 1.7-1.8 3.2-3 5.3-3 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21z';
  word.insertAdjacentHTML('beforeend', `<svg class="heart" viewBox="0 0 24 24" aria-hidden="true"><defs>
    <clipPath id="hl"><path d="M0 0H12.6L11 9l2.4 4-2.2 4L12 24H0Z"/></clipPath><clipPath id="hr"><path d="M12.6 0H24V24H12L11.2 17l2.2-4L11 9Z"/></clipPath></defs>
    <g class="hl"><path clip-path="url(#hl)" d="${H}"/></g><g class="hr"><path clip-path="url(#hr)" d="${H}"/></g></svg>`);
  const heart = word.querySelector('.heart'), hl = heart.querySelector('.hl'), hr = heart.querySelector('.hr');
  if (reduced || !sp.animate) { letters.forEach(l => l.style.transform = 'none'); heart.style.transform = 'none'; by.style.opacity = 1; return setTimeout(finish, 1100); }
  const ease = 'cubic-bezier(.2,.8,.2,1)';
  letters.forEach((l, i) => l.animate([{ transform: 'translateY(110%) rotate(8deg)', filter: 'blur(6px)' }, { transform: 'translateY(0) rotate(0)', filter: 'blur(0)' }],
    { duration: 620, delay: 150 + i * 55, easing: ease, fill: 'both' }));
  const tHeart = 150 + 7 * 55 + 380;
  heart.animate([{ transform: 'scale(0) rotate(-20deg)' }, { transform: 'scale(1.25) rotate(6deg)', offset: .6 }, { transform: 'scale(1) rotate(0)' }],
    { duration: 480, delay: tHeart, easing: 'cubic-bezier(.3,1.4,.5,1)', fill: 'both' });
  // le cœur craque : deux moitiés qui s'écartent à peine, petite secousse du mot
  const tCrack = tHeart + 560;
  [hl, hr].forEach((g, i) => { g.style.transformBox = 'fill-box'; g.style.transformOrigin = i ? '0% 100%' : '100% 100%';
    g.animate([{ transform: 'translate(0,0) rotate(0)' }, { transform: `translate(${i ? 2.2 : -2.2}px, 1px) rotate(${i ? 14 : -14}deg)`, offset: .45 }, { transform: `translate(${i ? 1.2 : -1.2}px, .6px) rotate(${i ? 8 : -8}deg)` }],
      { duration: 520, delay: tCrack, easing: ease, fill: 'forwards' }); });
  word.animate([{ transform: 'translateX(0)' }, { transform: 'translateX(-3px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(-1px)' }, { transform: 'translateX(0)' }], { duration: 280, delay: tCrack });
  by.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 520, delay: tCrack + 220, easing: ease, fill: 'both' });
  setTimeout(finish, tCrack + 220 + 520 + 650);
}
