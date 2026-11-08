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

// ---------- Occasions ----------
// Une occasion = des styles détectés (p.t) + des mots du nom de l'article ; « not » écarte ce qui ne colle pas.
const norm = s => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
const UNDIES = /tanga|culotte|string|soutien|brassiere|shorty|slip|boxer|pyjama|nuisette|de nuit|maillot de bain/;
const MAIN = ['robe', 'haut', 'pull', 'pantalon', 'jupe'];
// tags : styles détectés, pris en compte seulement pour les catégories de tagKinds ; rx : mots du nom ; not : exclusions
export const OCCASIONS = {
  soiree: { tags: ['glam'], tagKinds: ['robe', 'haut', 'jupe'],
            rx: /sequin|paillet|satin|lurex|strass|metallis|ceremonie|soiree|bustier|escarpin|robe.*(dentelle|velours)|jupe.*(dentelle|velours|plisse)|top.*dentelle|body.*(dentelle|sequin|bijou)|bijou|pochette(?!.*telephone)/,
            not: /mocassin|denim|jean|cotele|telephone|macrame|\blin\b|echarpe|foulard|maternite|sport|jogging|sweat|chausson|polaire|plage|legging|chaussette|bonnet|banane|gant|doudoune|parka|tee-shirt|t-shirt/ },
  bureau: { tags: [], tagKinds: [],
            rx: /blazer|tailleur|chemise|chemisier|blouse|lavalliere|cigarette|pantalon (droit|fluide|a pinces|en toile)|pinces|viscose|trench|caban|manteau|mocassin|escarpin|fine jauge|col roule|sous-pull|gilet (en maille|long|boutonne|col rond|court)|pull col|robe (chemise|droite|pull|blazer|portefeuille)|jupe (midi|crayon|plissee)/,
            not: /pantalon.*maille|elastique|soft touch|grosse jauge|denim|jean|maternite|paillet|sequin|satin|dentelle|strass|fourrure|astrakan|astracan|moutonne|ceremonie|velours|leopard|multicolore|tee-shirt|t-shirt|doudou|crochet|plage|bain|short|bardot|dos nu|bustier|bretelle|fluo|noel|oversize|nouee|caftan|plumetis|basket|chausson|jogging|sweat|carreaux|rayure|raye|pois/ },
  weekend: { tags: ['casual', 'sport', 'retro'], tagKinds: [...MAIN, 'chaussures'],
             rx: /jean|denim|sweat|t-shirt|tee-shirt|basket|jogging|salopette|cargo|bob|casquette|banane|mariniere|short|parka|doudoune/,
             not: /sequin|paillet|satin|escarpin|ceremonie|tailleur|blazer|chausson|maternite/ },
  cocooning: { tags: ['cosy'], tagKinds: [...MAIN, 'veste', 'chaussures', 'accessoire'],
               rx: /maille|pull|gilet|polaire|sherpa|moumoute|teddy|chausson|legging|jogging|doudou|chaussette|bonnet|echarpe|plaid|molleton|sweat|fourre/,
               not: /sequin|paillet|dentelle|dos nu|plage|crochet|sandale|mule|escarpin|bustier|\blin\b|bain|satin|blazer|tailleur/ }
};
export const occLabel = k => t('occ_' + k);
export function occFits(p, k) {
  const o = OCCASIONS[k]; if (!o) return true;
  const n = norm(p.n); if (UNDIES.test(n) || o.not.test(n)) return false;
  return o.rx.test(n) || (o.tagKinds.includes(p.k) && p.t.some(x => o.tags.includes(x)));
}
