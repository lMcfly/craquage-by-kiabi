// Le catalogue : catégories, pastilles de couleur, photos Kiabi et calcul des promos.
import { t } from './i18n.js';

export const IMG = 'https://static.kiabi.com/images/';
export const SW = { 'écru': '#efe8d8', 'blanc': '#f7f7f4', 'noir': '#1b1b1b', 'marine': '#1f2a4a', 'bleu clair': '#b9cbe8', 'denim': '#3d5a8a', 'bleu': '#4f74b3', 'gris': '#8a8d92',
  'beige': '#d8c3a5', 'camel': '#b48a5f', 'marron': '#5a3a2a', 'taupe': '#9b8b7a', 'kaki': '#7a7a32', 'vert': '#5f7a4f', 'bordeaux': '#6e1f2b', 'rouge': '#c0392b',
  'rose': '#e7a3b5', 'jaune': '#ecd36a', 'orange': '#e07b39', 'violet': '#8a6bb0',
  'léopard': 'linear-gradient(135deg,#c9a777 30%,#3b2a1c 30% 40%,#c9a777 40% 70%,#3b2a1c 70% 80%,#c9a777 80%)', 'multicolore': 'conic-gradient(#ed2237,#ecd36a,#5f7a4f,#4f74b3,#ed2237)' };
export const CATS = ['all', 'deal', 'robe', 'pull', 'haut', 'pantalon', 'jupe', 'veste', 'chaussures', 'accessoire'].map(k => [k]);
export const catLabel = k => t('cat_' + k);
export const LOOK = { haut: 'haut', pull: 'haut', robe: 'robe', pantalon: 'bas', jupe: 'bas', veste: 'veste', chaussures: 'extra', accessoire: 'extra' };
export const photo = (c, size, k = 0) => IMG + c.i + '_' + size + (c.x[k] || c.x[0] || 1) + '.jpg';
export const discount = c => { const now = Math.min(...c.p), was = Math.max(...c.p); return was > now ? Math.round((1 - now / was) * 100) : 0; };
