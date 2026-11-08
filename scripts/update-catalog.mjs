// Récupère le catalogue FEMME de la marque Kiabi (hors marketplace) à partir des pages thématiques publiques (kiabi.com/v/...).
// Pour chaque page : ouverture dans un navigateur avec le filtre « Marques › Kiabi », lecture des cartes produit,
// lecture des cartes produit, puis regroupement des couleurs et rangement par catégorie.
// Usage : node scripts/update-catalog.mjs   →   écrit data/products.json
import { chromium } from 'playwright';
import fs from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const { pages } = JSON.parse(fs.readFileSync(ROOT + 'scripts/pages.json', 'utf8'));
const OUT = ROOT + 'data/products.json';
const PAUSE = ms => new Promise(r => setTimeout(r, ms));

// filtres du site « Marques › Kiabi » (pas de marketplace) et « Genre › Femme » (ni homme, ni enfant, ni bébé),
// tri « Nouveautés » : les nouveaux articles de chaque rayon passent en premier
const pageUrl = (slug, extra = '') => 'https://www.kiabi.com/v/' + slug + '?itemsperpage=90&display=grid&fieldnametosort=isnew&filter=marques%3Akiabi;genre%3Afemme' + extra;
const pageSizes = new Map();   // rayon → valeurs du filtre « Taille » proposées par Kiabi (xs, m, 38, s/m, 37…)

async function readPage(browser, slug) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.goto(pageUrl(slug), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await PAUSE(3000);
    if (await page.evaluate(() => /captcha|access denied/i.test(document.title + document.body.innerText.slice(0, 400)))) {
      console.log(`  ${slug}: bloqué par une vérification anti-robots, page ignorée`); return [];
    }
    // Le filtre n'est appliqué que si la marque Kiabi existe dans ce rayon ; sinon le site renvoie toutes les marques.
    const on = await page.evaluate(() => ['kiabi', 'femme'].map(f => { const i = document.querySelector(`[data-filter="${f}"] input`); return !!(i && i.checked); }));
    if (!on[0]) { console.log(`  ${slug}: aucun article de marque Kiabi, page ignorée`); return []; }
    if (!on[1]) { console.log(`  ${slug}: filtre Femme absent, page ignorée`); return []; }
    // Pas de « Voir plus » : ce bouton charge la suite sans le filtre de marque (articles de la marketplace).
    // La page filtrée contient jusqu'à 90 articles Kiabi par rayon ; on élargit en ajoutant des rayons.
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
    pageSizes.set(slug, await page.evaluate(() => [...document.querySelectorAll('[data-filter]')]
      .filter(e => /^taille/.test(e.querySelector('input')?.name || '')).map(e => e.dataset.filter)));
    console.log(`  ${slug}: ${items.length} couleurs`);
    return items.map(x => ({ ...x, src: slug }));
  } catch (e) {
    console.log(`  ${slug}: erreur (${e.message.split('\n')[0]}), page ignorée`); return [];
  } finally { await page.close(); }
}

// ---------- rangement ----------
const norm = s => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
const KIDS = /\b(enfant|fille|garcon|bebe|junior|ado|homme|naissance|grossesse)\b|^(peignoir|robe de chambre|pyjama|chemise de nuit|nuisette)/;
// La catégorie vient d'abord du premier mot du nom (Kiabi nomme ses articles par leur type), puis du rayon.
const BY_NAME = [
  ['chaussures', /^(bottine|botte|basket|escarpin|mocassin|ballerine|sandale|chaussure|derby|sabot|mule|boots|santiag|chausson|pantoufle)/],
  ['pull', /^lot de \d+ (sous-pull|pull|gilet)/],
  ['accessoire', /^(sac|pochette|cabas|bonnet|echarpe|foulard|gant|mitaine|ceinture|chapeau|casquette|bijou|collier|chaussette|collant|snood|beret|bandeau)/],
  ['robe', /^(robe|combinaison|salopette|combishort)/],
  ['jupe', /^(jupe)/],
  ['pantalon', /^(pantalon|jean|legging|jogging|short|bermuda|jegging|cargo)/],
  ['veste', /^(manteau|doudoune|veste|blouson|trench|parka|caban|blazer|perfecto|cape|poncho|bomber|gilet sans manches|imper)/],
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

function build(all) {
  const byPid = new Map();
  for (const it of all) {
    if (!it.name || !it.imgs.length || KIDS.test(norm(it.name))) continue;
    if (/-\d+[AM]$/.test(it.size)) continue;                 // taille enfant ou bébé (3A, 12A, 6M…) : sécurité en plus du filtre Femme
    if (!byPid.has(it.pid)) byPid.set(it.pid, new Map());
    const cols = byPid.get(it.pid); if (!cols.has(it.cid)) cols.set(it.cid, it);
  }
  const products = [];
  for (const [pid, cols] of byPid) {
    const list = [...cols.values()].slice(0, 6), first = list[0], n = norm(first.name);
    const kind = (BY_NAME.find(([, rx]) => rx.test(n)) || BY_PAGE.find(([, rx]) => rx.test(first.src)))[0];
    const s = slugify(first.name);
    products.push({
      id: 'k' + pid, n: first.name, r: first.rating, k: kind,
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

const browser = await chromium.launch();
const all = [];
for (const slug of pages) { all.push(...await readPage(browser, slug)); await PAUSE(3000); }
// ---------- nouveautés et équilibre ----------
const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')).products : [];
const firstSeen = new Map(prev.map(p => [p.id, p.a || '2026-01-01']));   // articles d'avant le suivi des dates : « anciens »
const today = new Date().toISOString().slice(0, 10);
const built = build(all);
built.forEach(p => { p.a = firstSeen.get(p.id) || today; });   // date d'arrivée dans Craquage (pour le badge « Nouveau »)
// Un peu de tout : aucune catégorie ne dépasse 22 % du catalogue ; dans chaque catégorie on garde d'abord les nouveautés.
const MAX_SHARE = .22;
const groups = {}; built.forEach(p => (groups[p.k] = groups[p.k] || []).push(p));
const cap = Math.max(60, Math.round(built.length * MAX_SHARE));
const products = Object.values(groups).flatMap(l => l.sort((x, y) => y.a.localeCompare(x.a) || (y.r || 0) - (x.r || 0)).slice(0, cap));
// ---------- tailles disponibles ----------
// Les pages produit ne sont pas lisibles par un robot ; on utilise donc le filtre « Taille » des rayons :
// pour chaque taille, on rouvre un minimum de rayons filtrés sur cette taille et on note les couleurs qui y apparaissent.
// Résultat dans chaque couleur : c.s = ['S', 'M'] (vêtements) ou ['37', '38'] (chaussures) ; c.s absent = tailles inconnues.
const CLOTHES = { XS: ['xxs', 'xs', '32', '34', 'xs/s', '32/34', '34/36'], S: ['s', '36', 'xs/s', 's/m', '34/36', '36/38'],
  M: ['m', '38', 's/m', 'm/l', '36/38', '38/40'], L: ['l', '40', 'm/l', 'l/xl', '38/40', '40/42'],
  XL: ['xl', '42', 'l/xl', 'xl/xxl', '40/42', '42/44'], XXL: ['xxl', '44', 'xl/xxl', 'xxl/3xl', '42/44', '44/46'] };
const SHOES = Object.fromEntries([35, 36, 37, 38, 39, 40, 41, 42].map(n => [String(n), [String(n), n - .5 + '', n + .5 + '', `${n - 1}/${n}`, `${n}/${n + 1}`]]));
const keyOf = u => (u.match(/_P(\d+)C(\d+)$/) || []).slice(1).join(':');

async function readSized(browser, slug, values) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.goto(pageUrl(slug, ';taille%3A' + values.map(encodeURIComponent).join(',')), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await PAUSE(2500);
    const r = await page.evaluate(() => {
      const on = f => !!document.querySelector(`[data-filter="${f}"] input`)?.checked;
      const sized = [...document.querySelectorAll('[data-filter] input:checked')].some(i => /^taille/.test(i.name));
      return { ok: on('kiabi') && on('femme') && sized,
               keys: [...document.querySelectorAll('.products-item-wrapper a[href*="_P"]')].map(a => (a.href.split('?')[0].match(/_P(\d+)C(\d+)$/) || []).slice(1).join(':')) };
    });
    return r.ok ? r.keys : null;
  } catch (e) { return null; } finally { await page.close(); }
}

async function sizePass(browser) {
  const colour = new Map(); products.forEach(p => { if (p.k !== 'accessoire') p.c.forEach(c => colour.set(keyOf(c.u), { c, shoe: p.k === 'chaussures' })); });
  const onPage = new Map(); all.forEach(it => { const k = it.pid + ':' + it.cid; if (colour.has(k)) { if (!onPage.has(it.src)) onPage.set(it.src, new Set()); onPage.get(it.src).add(k); } });
  // le moins de rayons possible pour couvrir toutes les couleurs (rayons qui proposent un filtre Taille)
  const todo = new Set(colour.keys()), chosen = [];
  while (todo.size) {
    let best = null, gain = 0;
    for (const [slug, ks] of onPage) { if (!(pageSizes.get(slug) || []).length) continue; let g = 0; for (const k of ks) if (todo.has(k)) g++; if (g > gain) { gain = g; best = slug; } }
    if (!best) break;
    chosen.push(best); for (const k of onPage.get(best)) todo.delete(k);
  }
  console.log(`Tailles : ${chosen.length} rayons à relire pour ${colour.size} couleurs`);
  for (const slug of chosen) {
    const ks = [...onPage.get(slug)], shoe = ks.filter(k => colour.get(k).shoe).length > ks.length / 2;
    const groups = shoe ? SHOES : CLOTHES, offered = new Set(pageSizes.get(slug)), found = {};
    let ok = true;
    for (const [label, vals] of Object.entries(groups)) {
      const v = vals.filter(x => offered.has(x));
      if (!v.length) { found[label] = new Set(); continue; }          // aucune pièce du rayon dans cette taille
      const keys = await readSized(browser, slug, v); await PAUSE(2000);
      if (!keys) { ok = false; break; }
      found[label] = new Set(keys); if (keys.length >= 90) found[label].full = true;   // liste tronquée : on ne conclut pas « indisponible »
    }
    if (!ok) { console.log(`  ${slug}: tailles non lues`); continue; }
    for (const k of ks) {
      const { c } = colour.get(k); const s = new Set(c.s || []);
      for (const [label, set] of Object.entries(found)) if (set.has(k) || set.full) s.add(label);
      const order = Object.keys(groups); c.s = [...s].sort((a, b) => order.indexOf(a) - order.indexOf(b));
    }
    console.log(`  ${slug}: tailles lues (${shoe ? 'pointures' : 'vêtements'})`);
  }
}
await sizePass(browser);
await browser.close();

const previous = prev.length;
const fresh = products.filter(p => !firstSeen.has(p.id)).length;
console.log('Par catégorie :', Object.fromEntries(Object.entries(groups).map(([k, l]) => [k, Math.min(l.length, cap)])), `· ${fresh} nouveaux`);
if (products.length < 50 || products.length < previous * .5) {   // garde-fou : si Kiabi a bloqué une partie des pages, on ne casse pas le catalogue
  console.log(`Seulement ${products.length} articles récupérés (avant : ${previous}). Catalogue conservé tel quel.`);
  process.exit(0);
}
fs.writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString(), count: products.length, products }));
console.log(`${products.length} articles écrits dans data/products.json`);
