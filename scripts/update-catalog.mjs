// Récupère le catalogue femme Kiabi à partir des pages thématiques publiques (kiabi.com/v/...).
// Pour chaque page : ouverture dans un navigateur, appui sur « Voir plus d'articles » jusqu'au bout,
// lecture des cartes produit, puis regroupement des couleurs et rangement par catégorie.
// Usage : node scripts/update-catalog.mjs   →   écrit data/products.json
import { chromium } from 'playwright';
import fs from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
const { pages } = JSON.parse(fs.readFileSync(ROOT + 'scripts/pages.json', 'utf8'));
const OUT = ROOT + 'data/products.json';
const PAUSE = ms => new Promise(r => setTimeout(r, ms));

async function readPage(browser, slug) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.goto('https://www.kiabi.com/v/' + slug, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await PAUSE(3000);
    if (await page.evaluate(() => /captcha|access denied/i.test(document.title + document.body.innerText.slice(0, 400)))) {
      console.log(`  ${slug}: bloqué par une vérification anti-robots, page ignorée`); return [];
    }
    const count = () => page.evaluate(() => document.querySelectorAll('.products-item-wrapper').length);
    let last = await count();
    for (let i = 0; i < 15; i++) {                       // « Voir plus d'articles »
      const clicked = await page.evaluate(() => { const b = document.querySelector('.load-more-products button'); if (!b) return false; b.click(); return true; });
      if (!clicked) break;
      await PAUSE(4000);
      const n = await count(); if (n === last) break; last = n;
    }
    const items = await page.evaluate(() => [...document.querySelectorAll('.products-item-wrapper')].map(w => {
      const a = w.querySelector('a[href*="_P"]'); if (!a) return null;
      const href = a.href.split('?')[0];
      const m = href.match(/\/([^/]+)_P(\d+)C(\d+)$/); if (!m) return null;
      const prices = [...(w.querySelector('.products-item-info__price')?.innerText || '').matchAll(/(\d+),(\d{2})\s*€/g)].map(x => +(x[1] + '.' + x[2]));
      const imgs = [...w.querySelectorAll('img')].map(i => i.getAttribute('src') || '').filter(s => s.includes('static.kiabi.com/images/'));
      const rating = (w.querySelector('.stars')?.getAttribute('style') || '').match(/--rating:\s*([\d,.]+)/);
      return { url: href, slug: m[1], pid: m[2], cid: m[3], name: (w.querySelector('.products-item-info__title')?.innerText || '').trim(),
               prices, imgs, rating: rating ? +rating[1].replace(',', '.') : null };
    }).filter(Boolean));
    console.log(`  ${slug}: ${items.length} couleurs`);
    return items.map(x => ({ ...x, src: slug }));
  } catch (e) {
    console.log(`  ${slug}: erreur (${e.message.split('\n')[0]}), page ignorée`); return [];
  } finally { await page.close(); }
}

// ---------- rangement ----------
const norm = s => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
const KIDS = /\b(enfant|fille|garcon|bebe|junior|ado|homme|naissance|grossesse)\b/;
// La catégorie vient d'abord du premier mot du nom (Kiabi nomme ses articles par leur type), puis du rayon.
const BY_NAME = [
  ['chaussures', /^(bottine|botte|basket|escarpin|mocassin|ballerine|sandale|chaussure|derby|sabot|mule|boots|santiag|chausson|pantoufle)/],
  ['accessoire', /^(sac|pochette|cabas|bonnet|echarpe|foulard|gant|mitaine|ceinture|chapeau|casquette|bijou|collier|chaussette|collant|snood|beret|bandeau|lot de)/],
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
await browser.close();
const products = build(all);
const previous = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')).products.length : 0;
if (products.length < Math.max(50, previous * 0.5)) {   // garde-fou : si Kiabi a bloqué, on ne casse pas le catalogue
  console.log(`Seulement ${products.length} articles récupérés (avant : ${previous}). Catalogue conservé tel quel.`);
  process.exit(0);
}
fs.writeFileSync(OUT, JSON.stringify({ updated: new Date().toISOString(), count: products.length, products }));
console.log(`${products.length} articles écrits dans data/products.json`);
