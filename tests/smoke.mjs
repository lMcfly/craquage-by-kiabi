// Test rapide de l'app dans un iPhone simulé : ouverture, swipe, réglages (langue, thème), onglets.
// Usage : npm test   (lance un petit serveur local, aucune donnée envoyée ailleurs que kiabi.com pour les photos)
import { chromium, devices } from 'playwright';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const p = path.join(ROOT, decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '/index.html'));
  if (!p.startsWith(ROOT) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(p)] || 'application/octet-stream' }); fs.createReadStream(p).pipe(res);
}).listen(0);
const url = `http://localhost:${server.address().port}/`;

const fails = [];
const check = (ok, label) => { console.log((ok ? '✓ ' : '✗ ') + label); if (!ok) fails.push(label); };
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ ...devices['iPhone 13'], locale: 'fr-FR', serviceWorkers: 'block' });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
  await page.goto(url); await page.waitForTimeout(600); await page.mouse.click(150, 300);   // passe l'animation
  await page.waitForSelector('.card.top', { state: 'attached', timeout: 15000 });
  check(await page.textContent('#catlabel') === 'Tout', 'textes en français');
  const first = await page.textContent('.card.top .name');
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(500);
  check(await page.textContent('#coll-count') === '1' && await page.textContent('.card.top .name') !== first, 'swipe Go : carte suivante + 1 envie');
  await page.click('#gear'); await page.click('#set-lang [data-v="en"]'); await page.click('#set-theme [data-v="dark"]');
  check(await page.textContent('#set-title') === 'Settings', 'langue anglaise');
  check(await page.evaluate(() => document.documentElement.dataset.theme) === 'dark', 'mode nuit');
  await page.keyboard.press('Escape');
  await page.click('#nav-items'); check(await page.isVisible('#pane-items'), 'onglet Envies');
  await page.click('#nav-styles'); check(await page.isVisible('#pane-styles'), 'onglet Style');
  check(errors.length === 0, 'aucune erreur JavaScript' + (errors.length ? ' : ' + errors.join(' | ') : ''));
} finally { await browser.close(); server.close(); }
if (fails.length) { console.log(`\n${fails.length} test(s) en échec`); process.exit(1); }
console.log('\nTout est bon.');
