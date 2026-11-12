// Robot 1 « Ajout des articles » : récupère les articles de la marque Kiabi (hors marketplace), FEMME et HOMME,
// à partir des pages thématiques publiques (kiabi.com/v/...), filtres Kiabi + genre, tri Nouveautés.
// Lecture tournante : à chaque passage, il lit les rubriques les moins récemment lues (environ un tiers) ;
// une rubrique sans article Kiabi n'est relue qu'une fois par semaine. Un article reste dans l'app tant qu'il a été vu
// dans les 2 derniers jours. Les redirections de Kiabi (rubrique renommée) sont suivies, filtres remis.
// Garde les tailles déjà vérifiées et note dans scripts/catalog-index.json l'état de chaque rubrique (pour le robot 2).
// Usage : node scripts/update-catalog.mjs   →   écrit data/products.json et scripts/catalog-index.json
//         MAX_PAGES=50 node scripts/update-catalog.mjs   → limite le nombre de rubriques lues (essais)
//         ONLY=h node scripts/update-catalog.mjs         → relit seulement les rubriques homme (ou f : femme)
import { chromium } from 'playwright';
import fs from 'node:fs';
import { PAUSE, pageUrl, keyOf } from './lib/kiabi.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const PAGES = JSON.parse(fs.readFileSync(ROOT + 'scripts/pages.json', 'utf8'));   // { femme: [...], homme: [...] }
const OUT = ROOT + 'data/products.json';
const INDEX = ROOT + 'scripts/catalog-index.json';
const MAX_PAGES = +(process.env.MAX_PAGES || 1000);      // rubriques lues par passage (3 passages par jour : tout le site relu chaque jour)
const GENDERS = { f: 'femme', h: 'homme' };
const DAY = 864e5, now = Date.now(), today = new Date().toISOString().slice(0, 10);

// ---------- quelles rubriques lire ce passage ----------
const state = fs.existsSync(INDEX) ? JSON.parse(fs.readFileSync(INDEX, 'utf8')).pages || {} : {};
const all = [];
// femme et homme en alternance : à égalité (jamais lues), une rubrique de chaque à tour de rôle
const lists = Object.entries(GENDERS).map(([g, name]) => (PAGES[name] || []).map(slug => ({ g, slug, id: g + ':' + slug })));
for (let i = 0; i < Math.max(...lists.map(l => l.length)); i++) lists.forEach(l => l[i] && all.push(l[i]));
// ONLY=h (ou f) : relance à la main sur un seul genre, en relisant ses rubriques même lues récemment
const ONLY = process.env.ONLY || '';
const due = all.filter(p => { if (ONLY && p.g !== ONLY) return false; const s = state[p.id]; if (!s || !s.read) return true;
  if (ONLY) return !(s.empty >= 2);            // sauf rubriques vides deux fois de suite
  return now - Date.parse(s.read) >= (s.empty >= 2 ? 7 * DAY : 12 * 3600e3); });
due.sort((a, b) => (Date.parse(state[a.id]?.read || 0) || 0) - (Date.parse(state[b.id]?.read || 0) || 0));
const todo = due.slice(0, MAX_PAGES);
console.log(`${todo.length} rubriques à lire (${due.length} à jour de lecture, ${all.length} en tout)`);

async function readPage(browser, g, slug) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.goto(pageUrl(slug, '', GENDERS[g]), { waitUntil: 'domcontentloaded', timeout: 60000 });
    let canonical = slug;
    // rubrique renommée : Kiabi redirige sans les filtres → on rouvre la nouvelle adresse avec les filtres
    const landed = (page.url().match(/\/v\/([^?#]+)/) || [])[1];
    if (landed && landed !== slug) { canonical = landed; await page.goto(pageUrl(landed, '', GENDERS[g]), { waitUntil: 'domcontentloaded', timeout: 60000 }); }
    await PAUSE(3000);
    if (await page.evaluate(() => /captcha|access denied/i.test(document.title + document.body.innerText.slice(0, 400)))) {
      console.log(`  ${slug}: bloqué par une vérification anti-robots`); return { ok: false };
    }
    // Les filtres ne sont appliqués que si la marque Kiabi et le genre existent dans ce rayon.
    const on = await page.evaluate(f => ['kiabi', f].map(x => { const i = document.querySelector(`[data-filter="${x}"] input`); return !!(i && i.checked); }), GENDERS[g]);
    if (!on[0] || !on[1]) { console.log(`  ${g}:${slug}: rien en marque Kiabi ${GENDERS[g]}`); return { ok: true, canonical, items: [], sizes: [] }; }
    // Pas de « Voir plus » : ce bouton charge la suite sans le filtre de marque (articles de la marketplace).
    const items = await page.evaluate(() => [...document.querySelectorAll('.products-item-wrapper')].map(w => {
      const a = w.querySelector('a[href*="_P"]'); if (!a) return null;
      const href = a.href.split('?')[0];
      const m = href.match(/\/([^/]+)_P(\d+)C(\d+)$/); if (!m) return null;
      const prices = [...(w.querySelector('.products-item-info__price')?.innerText || '').matchAll(/(\d+),(\d{2})\s*€/g)].map(x => +(x[1] + '.' + x[2]));
      const imgs = [...w.querySelectorAll('img')].map(i => i.getAttribute('src') || '').filter(s => s.includes('static.kiabi.com/images/'));
      const rating = (w.querySelector('.stars')?.getAttribute('style') || '').match(/--rating:\s*([\d,.]+)/);
      return { url: href, slug: m[1], pid: m[2], cid: m[3], size: a.dataset.id || '', name: (w.querySelector('.products-item-info__title')?.innerText || '').trim(),
               prices, imgs, rating: rating ? +rating[1].replace(',', '.') : null };
    }).filter(Boolean));
    const sizes = await page.evaluate(() => [...document.querySelectorAll('[data-filter]')]
      .filter(e => /^taille/.test(e.querySelector('input')?.name || '')).map(e => e.dataset.filter));
    console.log(`  ${g}:${canonical}: ${items.length} couleurs`);
    return { ok: true, canonical, sizes, items: items.map(x => ({ ...x, src: g + ':' + slug, g })) };
  } catch (e) {
    console.log(`  ${g}:${slug}: erreur (${e.message.split('\n')[0]})`); return { ok: false };
  } finally { await page.close(); }
}

// ---------- rangement ----------
const norm = s => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
// Hors sujet pour craquer : enfant, autre genre, nuit, bain, chaussettes, maternité ; sous-vêtements homme (n'importe où dans le nom)
const OFF = /\b(pyjamas?|nuisette|peignoir|robe de chambre|de nuit|homewear|de bain|maillot|bikini|(?<!effet )(mi-)?chaussettes?|thermiques?|grossesse|allaitement)\b/;
const EXCLUDE = {
  f: /\b(enfant|fille|garcon|bebe|junior|ado|homme|naissance)\b/,
  h: /\b(enfant|fille|garcon|bebe|junior|ado|femme|naissance|calecons?|boxers?|slips?)\b/
};
const excluded = (g, name) => OFF.test(norm(name)) || EXCLUDE[g].test(norm(name));
// La catégorie vient d'abord du premier mot du nom (Kiabi nomme ses articles par leur type), puis du rayon.
const BY_NAME = [
  ['chaussures', /^(bottine|botte|basket|escarpin|mocassin|ballerine|sandale|chaussure|derby|sabot|mule|boots|santiag|chausson|pantoufle|tennis|sneaker|claquette|tong|richelieu|espadrille)/],
  ['pull', /^lot de \d+ (sous-pull|pull|gilet)/],
  ['accessoire', /^(sac|sacoche|pochette|cabas|bonnet|echarpe|foulard|gant|mitaine|ceinture|chapeau|casquette|bob|bijou|collier|chaussette|collant|snood|beret|bandeau|cravate|noeud|bretelles|portefeuille|lot de \d+ paires)/],
  ['robe', /^(robe|combinaison|salopette|combishort)/],
  ['jupe', /^(jupe)/],
  ['pantalon', /^(pantalon|jean|legging|jogging|short|bermuda|jegging|cargo|chino)/],
  ['veste', /^(manteau|doudoune|veste|blouson|trench|parka|caban|blazer|perfecto|cape|poncho|bomber|gilet sans manches|imper|costume|surchemise|coupe-vent)/],
  ['pull', /^(pull|gilet|cardigan|sous-pull|poncho maille)/],
  ['haut', /^(chemise|chemisier|blouse|top|t-shirt|tee-shirt|tshirt|debardeur|body|sweat|tunique|crop|polo|marinière|mariniere|haut|bustier|caraco)/]
];
const BY_PAGE = [['chaussures', /botte|bottine|basket|chaussure/], ['accessoire', /bonnet|sac|echarpe|ceinture/], ['robe', /^robe/], ['jupe', /^jupe/],
  ['pantalon', /pantalon|jean|legging/], ['veste', /manteau|veste|doudoune|trench|parka|blazer/], ['pull', /pull|gilet|cardigan/], ['haut', /./]];
const TAGS = { cosy: /maille|pull|gilet|doux|douce|moumoute|sherpa|polaire|torsad|teddy|chaud|tricot|laine/, chic: /blazer|tailleur|fluide|satin|chemis|blouse|elegan|pliss|drape|long|ceintur/,
  casual: /jean|denim|t-shirt|sweat|basique|coton|large|oversize|basket/, retro: /velours|cotele|volant|fleur|vintage|flare|carreau|imprime|broderie|cowboy|santiag/,
  preppy: /raye|rayure|polo|mariniere|carreau|caban|claudine|vichy|mocassin/, minimal: /\buni\b|basique|droit|essentiel/, rock: /simili|cuir|vinyle|leopard|perfecto|clou|biker|boots/,
  glam: /sequin|paillette|dore|lurex|brillant|fourrure|metallis|satin/, sport: /sweat|jogging|doudoune|molleton|capuche|sport|zip/ };
const FAM = [['écru', /ecru|creme|ivoire|blanc casse/], ['blanc', /blanc/], ['noir', /noir/], ['marine', /marine/], ['bleu clair', /bleu (ciel|clair|pastel)|ciel/],
  ['denim', /denim|stone|brut|jean/], ['bleu', /bleu/], ['gris', /gris|anthracite/], ['beige', /beige|sable|lin\b/], ['camel', /camel|cognac|caramel/],
  ['marron', /marron|chocolat|brun|moka/], ['taupe', /taupe/], ['kaki', /kaki/], ['vert', /vert|emeraude|sauge/], ['bordeaux', /bordeaux|prune|lie/],
  ['rouge', /rouge/], ['rose', /rose|fuchsia/], ['jaune', /jaune|moutarde/], ['orange', /orange|corail|rouille|terracotta/], ['violet', /violet|lilas|mauve|parme/],
  ['léopard', /leopard/], ['multicolore', /./]];
const slugify = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function build(items) {
  const byPid = new Map();
  for (const it of items) {
    if (!it.name || !it.imgs.length || excluded(it.g, it.name)) continue;
    if (/-\d+[AM]$/.test(it.size)) continue;                 // taille enfant ou bébé (3A, 12A, 6M…) : sécurité en plus du filtre genre
    if (!byPid.has(it.pid)) byPid.set(it.pid, new Map());
    const cols = byPid.get(it.pid); if (!cols.has(it.cid)) cols.set(it.cid, it);
  }
  const products = [];
  for (const [pid, cols] of byPid) {
    const list = [...cols.values()].slice(0, 6), first = list[0], n = norm(first.name);
    const kind = (BY_NAME.find(([, rx]) => rx.test(n)) || BY_PAGE.find(([, rx]) => rx.test(first.src.slice(2))))[0];
    if (first.g === 'h' && (kind === 'robe' || kind === 'jupe')) continue;
    const s = slugify(first.name);
    products.push({
      id: 'k' + pid, g: first.g, n: first.name, r: first.rating, k: kind,
      t: (Object.entries(TAGS).filter(([, rx]) => rx.test(n)).map(([t]) => t).slice(0, 3)),
      c: list.map(it => {
        const colour = (it.slug.startsWith(s + '-') ? it.slug.slice(s.length + 1) : it.slug.split('-').pop()).replace(/-/g, ' ') || 'unique';
        // https://static.kiabi.com/images/<base>_fr<n>.jpg  →  on garde <base> et les numéros de photo disponibles
        const photos = it.imgs.map(u => u.match(/images\/(.+)_fr(\d+)\.jpg/)).filter(Boolean);
        return { c: colour, f: FAM.find(([, rx]) => rx.test(norm(colour)))[0], p: [...new Set(it.prices)].sort((a, b) => a - b),
                 u: it.url, i: photos[0][1], x: photos.map(m => +m[2]) };
      })
    });
  }
  return products;
}

// ---------- lecture ----------
const browser = await chromium.launch();
const items = []; let readOk = 0, withItems = 0, blocked = 0;
for (const p of todo) {
  const r = await readPage(browser, p.g, p.slug); await PAUSE(3000);
  if (!r.ok) { blocked++; if (blocked >= 25 && !readOk) { console.log('Trop de blocages : arrêt.'); break; } continue; }
  readOk++; if (r.items.length) withItems++;
  items.push(...r.items);
  const s = state[p.id] || {};
  state[p.id] = { g: p.g, slug: r.canonical, sizes: r.sizes, keys: [...new Set(r.items.map(it => it.pid + ':' + it.cid))],
                  read: new Date().toISOString(), empty: r.items.length ? 0 : (s.empty || 0) + 1 };
}
await browser.close();
console.log(`${readOk} rubriques lues (${withItems} avec des articles Kiabi), ${blocked} non lues`);
if (!withItems) { console.log('Aucun article lu : catalogue conservé tel quel.'); process.exit(0); }

// ---------- fusion avec le catalogue existant ----------
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')).products : [];
const prevById = new Map(prev.map(p => [p.id, p]));
const knownSizes = new Map(prev.flatMap(p => p.c.filter(c => Array.isArray(c.s)).map(c => [keyOf(c.u), c.s])));
const fresh = build(items);
fresh.forEach(p => {
  const old = prevById.get(p.id);
  p.a = old ? (old.a || '2026-01-01') : today;            // date d'arrivée dans Craquage (badge « Nouveau »)
  p.v = today;                                             // dernière fois vu sur kiabi.com
  p.c.forEach(c => { const s = knownSizes.get(keyOf(c.u)); if (s) c.s = s; });   // tailles déjà vérifiées par le robot 2
});
const freshIds = new Set(fresh.map(p => p.id));
// les articles des rubriques pas relues ce passage restent, s'ils ont été vus dans les 5 derniers jours
const kept = prev.filter(p => !freshIds.has(p.id)).map(p => ({ g: 'f', v: today, ...p }))
  .filter(p => now - Date.parse(p.v) <= 5 * DAY && !excluded(p.g, p.n));
const merged = [...fresh, ...kept];

// Un peu de tout : par genre, aucune catégorie ne dépasse 40 % (l'app alterne ensuite les catégories à l'affichage) ; dans chaque catégorie, les nouveautés d'abord.
const MAX_SHARE = .40, products = [], summary = {};
for (const g of Object.keys(GENDERS)) {
  const mine = merged.filter(p => p.g === g); if (!mine.length) continue;
  const groups = {}; mine.forEach(p => (groups[p.k] = groups[p.k] || []).push(p));
  const cap = Math.max(60, Math.round(mine.length * MAX_SHARE));
  for (const [k, l] of Object.entries(groups)) {
    const keep = l.sort((x, y) => y.a.localeCompare(x.a) || (y.r || 0) - (x.r || 0)).slice(0, cap);
    products.push(...keep); summary[g + ':' + k] = keep.length;
  }
}
const added = products.filter(p => !prevById.has(p.id)).length;
console.log('Par genre et catégorie :', summary, `· ${added} nouveaux · ${products.length} articles`);
if (products.length < 50 || products.length < prev.length * .5) {   // garde-fou
  console.log(`Seulement ${products.length} articles (avant : ${prev.length}). Catalogue conservé tel quel.`);
  process.exit(0);
}
fs.writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString(), count: products.length, products }));
console.log(`${products.length} articles écrits dans data/products.json`);
// état des rubriques pour la lecture tournante et le robot 2 (couleurs limitées à celles du catalogue)
const inCatalog = new Set(products.flatMap(p => p.c.map(c => keyOf(c.u))));
Object.values(state).forEach(v => { v.keys = (v.keys || []).filter(k => inCatalog.has(k)); });
fs.writeFileSync(INDEX, JSON.stringify({ updated: new Date().toISOString(), pages: state }));
