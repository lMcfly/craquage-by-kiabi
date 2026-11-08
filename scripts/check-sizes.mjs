// Robot 2 « Vérification des tailles » : pour chaque couleur d'article du catalogue, note les tailles disponibles
// (XS à XXL, pointures 35 à 42) grâce au filtre « Taille » des rayons Kiabi.
// Les pages produit ne sont pas lisibles par un robot ; on rouvre donc un minimum de rayons, une fois par taille,
// et on note les couleurs qui y apparaissent. Strict : une couleur absente du filtre n'est pas dans cette taille.
// Résultat dans chaque couleur : c.s = ['S', 'M'] (vêtements) ou ['37', '38'] (chaussures) ; femme et homme.
// Si un rayon ne peut pas être lu, les tailles déjà connues de ses couleurs sont gardées.
// Usage : node scripts/check-sizes.mjs          → revérifie toutes les couleurs (une fois par jour)
//         node scripts/check-sizes.mjs --new    → seulement les couleurs sans tailles (après chaque ajout du robot 1)
import { chromium } from 'playwright';
import fs from 'node:fs';
import { PAUSE, keyOf, CLOTHES, SHOES, CLOTHES_H, SHOES_H, readSized } from './lib/kiabi.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = ROOT + 'data/products.json', INDEX = ROOT + 'scripts/catalog-index.json';
if (!fs.existsSync(INDEX)) { console.log('Pas d\'index des rayons : lancer d\'abord le robot 1.'); process.exit(0); }
const data = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const { pages } = JSON.parse(fs.readFileSync(INDEX, 'utf8'));

const onlyNew = process.argv.includes('--new');
const colour = new Map();   // couleur → { c, shoe }
data.products.forEach(p => { if (p.k !== 'accessoire') p.c.forEach(c => { if (!onlyNew || !Array.isArray(c.s)) colour.set(keyOf(c.u), { c, shoe: p.k === 'chaussures' }); }); });
if (!colour.size) { console.log('Toutes les couleurs ont déjà leurs tailles.'); process.exit(0); }

// le moins de rayons possible pour couvrir toutes les couleurs (rayons qui proposent un filtre Taille)
const todo = new Set(colour.keys()), chosen = [];
while (todo.size) {
  let best = null, gain = 0;
  for (const [slug, v] of Object.entries(pages)) { if (!(v.sizes || []).length || !(v.keys || []).length) continue; let g = 0; for (const k of v.keys) if (todo.has(k)) g++; if (g > gain) { gain = g; best = slug; } }
  if (!best) break;
  chosen.push(best); pages[best].keys.forEach(k => todo.delete(k));
}
console.log(`${chosen.length} rayons à relire pour ${colour.size} couleurs (${todo.size} sans rayon avec filtre Taille)`);

const fresh = new Map();   // couleur → tailles trouvées pendant ce passage
const browser = await chromium.launch();
let read = 0;
for (const id of chosen) {
  const page = pages[id], g = page.g || 'f', slug = page.slug || id;   // id = « f:robe-maille-femme » ; slug = adresse à jour
  const ks = page.keys.filter(k => colour.has(k));
  const shoe = ks.filter(k => colour.get(k).shoe).length > ks.length / 2;
  const groups = g === 'h' ? (shoe ? SHOES_H : CLOTHES_H) : (shoe ? SHOES : CLOTHES), offered = new Set(page.sizes), found = {};
  let ok = true;
  for (const [label, vals] of Object.entries(groups)) {
    const v = vals.filter(x => offered.has(x));
    if (!v.length) { found[label] = new Set(); continue; }          // aucune pièce du rayon dans cette taille
    const keys = await readSized(browser, slug, v, g); await PAUSE(2000);
    if (!keys) { ok = false; break; }
    found[label] = new Set(keys);
  }
  if (!ok) { console.log(`  ${id}: tailles non lues (tailles connues gardées)`); continue; }
  read++;
  const order = Object.keys(groups);
  for (const k of ks) {
    const s = fresh.get(k) || new Set();
    for (const [label, set] of Object.entries(found)) if (set.has(k)) s.add(label);
    fresh.set(k, s);
    colour.get(k).order = order;
  }
  console.log(`  ${id}: tailles lues (${shoe ? 'pointures' : 'vêtements'})`);
}
await browser.close();

if (!read) { console.log('Aucun rayon lu (blocage ?) : catalogue inchangé.'); process.exit(0); }
let changed = 0;
for (const [k, s] of fresh) {
  const { c, order } = colour.get(k), next = [...s].sort((a, b) => order.indexOf(a) - order.indexOf(b));
  if (JSON.stringify(c.s) !== JSON.stringify(next)) { c.s = next; changed++; }
}
const withSizes = [...colour.values()].filter(x => Array.isArray(x.c.s)).length;
console.log(`${read}/${chosen.length} rayons lus · ${changed} couleurs mises à jour · ${withSizes}/${colour.size} couleurs avec tailles`);
fs.writeFileSync(OUT, JSON.stringify({ ...data, sizes: new Date().toISOString() }));
