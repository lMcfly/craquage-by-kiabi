// Mes infos : taille(s) de vêtements et pointure(s), enregistrées uniquement sur l'appareil.
// Sert à ne montrer que les articles disponibles dans la taille de l'utilisatrice.
// Les tailles disponibles de chaque couleur viennent du robot : c.s = ['S', 'M'] ou ['37', '38'] (absent = inconnues).
import { store } from './utils.js';

export const CLOTHES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
export const SHOES = ['35', '36', '37', '38', '39', '40', '41', '42'];
export const PROFILE_KEY = 'craquage-profile-v1';

export const profile = Object.assign({ sizes: [], shoes: [], onlyMine: true, asked: false }, store.get(PROFILE_KEY) || {});
export const saveProfile = () => store.set(PROFILE_KEY, profile);
export const hasSizes = () => profile.sizes.length > 0 || profile.shoes.length > 0;

// Cette couleur existe-t-elle dans la taille choisie ? (accessoires et tailles inconnues : toujours oui)
export function fits(p, c, evenIfOff = false) {
  if ((!profile.onlyMine && !evenIfOff) || p.k === 'accessoire' || !Array.isArray(c.s)) return true;
  const mine = p.k === 'chaussures' ? profile.shoes : profile.sizes;
  return !mine.length || c.s.some(x => mine.includes(x));
}

// « S – XL » quand les tailles se suivent, sinon « S · L · XXL »
export function sizeText(p, c) {
  if (!Array.isArray(c.s) || !c.s.length || p.k === 'accessoire') return '';
  const scale = p.k === 'chaussures' ? SHOES : CLOTHES, idx = c.s.map(x => scale.indexOf(x)).filter(i => i >= 0).sort((a, b) => a - b);
  if (!idx.length) return '';
  const run = idx.every((v, i) => !i || v === idx[i - 1] + 1);
  return run && idx.length > 2 ? `${scale[idx[0]]} – ${scale[idx[idx.length - 1]]}` : idx.map(i => scale[i]).join(' · ');
}

// Rangée de pastilles à choix multiple (XS, S, M… ou 36, 37…)
export function sizePicker(box, list, key, onChange) {
  box.innerHTML = '';
  list.forEach(v => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.textContent = v;
    b.setAttribute('aria-pressed', String(profile[key].includes(v)));
    b.onclick = () => {
      const on = profile[key].includes(v);
      profile[key] = on ? profile[key].filter(x => x !== v) : list.filter(x => x === v || profile[key].includes(x));
      b.setAttribute('aria-pressed', String(!on)); saveProfile(); onChange && onChange();
    };
    box.appendChild(b);
  });
}
