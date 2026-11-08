// Mes infos : taille(s) de vêtements et pointure(s), enregistrées uniquement sur l'appareil.
// Sert à ne montrer que les articles disponibles dans la taille de l'utilisatrice.
// Les tailles disponibles de chaque couleur viennent du robot : c.s = ['S', 'M'] ou ['37', '38'] (absent = inconnues).
import { store } from './utils.js';
import { t } from './i18n.js';

export const CLOTHES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
export const SHOES = ['35', '36', '37', '38', '39', '40', '41', '42'];
// Pantalons et jupes : tailles en chiffres à l'écran, mêmes repères que les lettres dans le catalogue (38 = M)
export const BOTTOMS = ['34', '36', '38', '40', '42', '44'];
const BOTTOM_TO_LETTER = Object.fromEntries(BOTTOMS.map((n, i) => [n, CLOTHES[i]]));
const LETTER_TO_BOTTOM = Object.fromEntries(BOTTOMS.map((n, i) => [CLOTHES[i], n]));
// Trois profils de taille : hauts (pulls, robes, vestes), bas (pantalons, jupes), chaussures
const kindOf = p => p.k === 'chaussures' ? 'shoes' : (p.k === 'pantalon' || p.k === 'jupe') ? 'bottoms' : 'sizes';
export const PROFILE_KEY = 'craquage-profile-v1';

export const profile = Object.assign({ sizes: [], bottoms: [], shoes: [], onlyMine: true, asked: false }, store.get(PROFILE_KEY) || {});
export const saveProfile = () => store.set(PROFILE_KEY, profile);
export const hasSizes = () => profile.sizes.length > 0 || profile.bottoms.length > 0 || profile.shoes.length > 0;

// Le catalogue contient-il les tailles ? (sinon, impossible de trier : on montre tout)
let sizeData = false;
export const setSizeData = v => { sizeData = v; };

// Cette couleur existe-t-elle dans la taille choisie ? Strict : taille inconnue = pas proposée.
// Seuls les accessoires (taille unique) passent toujours.
export function fits(p, c, evenIfOff = false) {
  if ((!profile.onlyMine && !evenIfOff) || p.k === 'accessoire') return true;
  const kind = kindOf(p);
  // bas : taille de pantalon si elle est donnée, sinon la taille des hauts
  const mine = kind === 'shoes' ? profile.shoes : kind === 'bottoms' ? (profile.bottoms.length ? profile.bottoms.map(n => BOTTOM_TO_LETTER[n]) : profile.sizes) : profile.sizes;
  if (!mine.length) return true;                       // pas de taille choisie pour ce type d'article
  if (!Array.isArray(c.s)) return !sizeData;           // tailles inconnues pour cet article
  return c.s.some(x => mine.includes(x));
}

// « S – XL » quand les tailles se suivent, sinon « S · L · XXL »
export function sizeText(p, c) {
  if (!Array.isArray(c.s) || !c.s.length || p.k === 'accessoire') return '';
  const kind = kindOf(p), scale = kind === 'shoes' ? SHOES : CLOTHES, idx = c.s.map(x => scale.indexOf(x)).filter(i => i >= 0).sort((a, b) => a - b);
  if (!idx.length) return '';
  const label = i => kind === 'bottoms' ? LETTER_TO_BOTTOM[scale[i]] : scale[i];   // pantalons et jupes affichés en 34, 36, 38…
  const run = idx.every((v, i) => !i || v === idx[i - 1] + 1);
  return run && idx.length > 2 ? `${label(idx[0])} – ${label(idx[idx.length - 1])}` : idx.map(label).join(' · ');
}

// Rangée de pastilles : on choisit une fourchette de tailles qui se suivent (ex. XS puis M = XS, S, M).
// Toucher une taille hors de la fourchette l'agrandit jusqu'à elle ; toucher un bout la réduit ;
// toucher une taille au milieu repart de cette seule taille.
export function sizePicker(box, list, key, onChange) {
  box.innerHTML = '';
  const paint = () => box.querySelectorAll('.chip').forEach(b => b.setAttribute('aria-pressed', String(profile[key].includes(b.textContent))));
  list.forEach(v => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = v;
    b.onclick = () => {
      const sel = profile[key].map(x => list.indexOf(x)).filter(i => i >= 0).sort((a, b) => a - b), i = list.indexOf(v);
      let lo = sel[0], hi = sel[sel.length - 1];
      if (!sel.length) lo = hi = i;
      else if (i < lo) lo = i; else if (i > hi) hi = i;
      else if (i === lo && i === hi) { lo = hi = null; }
      else if (i === lo) lo++; else if (i === hi) hi--;
      else lo = hi = i;
      profile[key] = lo == null ? [] : list.slice(lo, hi + 1);
      paint(); saveProfile(); onChange && onChange();
    };
    box.appendChild(b);
  });
  paint();
}

// ---------- Présentation « Mes infos » ----------
// Une carte par type d'article : icône, nom, fourchette choisie, puis les tailles à toucher.
const ICONS = {
  sizes: '<path d="M8.5 3.5L4 6l1.8 4L8 9v11.5h8V9l2.2 1L20 6l-4.5-2.5a3.5 3.5 0 01-7 0z"/>',
  bottoms: '<path d="M6.5 3.5h11l1 17h-4.5L12 10l-2 10.5H5.5z"/><path d="M6.5 7h11"/>',
  shoes: '<path d="M3 17.5V11l4-1.5 2.5 3 5 1.5 5.5 1.5a2 2 0 011.5 2v1H3z"/><path d="M3 20.5h18"/>'
};
const ROWS = [['sizes', CLOTHES, 'size_tops'], ['bottoms', BOTTOMS, 'size_bottoms'], ['shoes', SHOES, 'size_shoes']];
export function sizeRows(box, onChange) {
  box.innerHTML = '';
  ROWS.forEach(([key, list, label]) => {
    const row = document.createElement('div'); row.className = 'size-row';
    row.innerHTML = `<div class="size-head"><span class="size-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">${ICONS[key]}</svg></span>
      <span class="size-name"><b>${t(label)}</b><small>${t(label + '_sub')}</small></span><span class="size-sum" aria-live="polite"></span></div>
      <div class="chips${key === 'shoes' ? ' shoes' : ''}" role="group" aria-label="${t(label)}"></div>`;
    const sum = row.querySelector('.size-sum');
    const update = () => { const v = profile[key]; sum.textContent = !v.length ? t('size_any') : v.length === 1 ? v[0] : `${v[0]} – ${v[v.length - 1]}`; sum.classList.toggle('empty', !v.length); };
    sizePicker(row.querySelector('.chips'), list, key, () => { update(); onChange && onChange(); });
    update(); box.appendChild(row);
  });
}
