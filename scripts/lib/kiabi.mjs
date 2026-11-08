// Outils partagés par les deux robots : adresses des rayons Kiabi, tailles, lecture d'un rayon filtré sur une taille.
export const PAUSE = ms => new Promise(r => setTimeout(r, ms));

// Filtres du site « Marques › Kiabi » (pas de marketplace) et « Genre › Femme » (ni homme, ni enfant, ni bébé),
// tri « Nouveautés » : les nouveaux articles de chaque rayon passent en premier.
export const pageUrl = (slug, extra = '') => 'https://www.kiabi.com/v/' + slug + '?itemsperpage=90&display=grid&fieldnametosort=isnew&filter=marques%3Akiabi;genre%3Afemme' + extra;

// Identifiant d'une couleur d'article : « produit:couleur » tiré de l'adresse …_P123C456
export const keyOf = u => (u.match(/_P(\d+)C(\d+)$/) || []).slice(1).join(':');

// Tailles de l'app → valeurs du filtre « Taille » de Kiabi (lettres, chiffres et tailles doubles)
export const CLOTHES = { XS: ['xxs', 'xs', '32', '34', 'xs/s', '32/34', '34/36'], S: ['s', '36', 'xs/s', 's/m', '34/36', '36/38'],
  M: ['m', '38', 's/m', 'm/l', '36/38', '38/40'], L: ['l', '40', 'm/l', 'l/xl', '38/40', '40/42'],
  XL: ['xl', '42', 'l/xl', 'xl/xxl', '40/42', '42/44'], XXL: ['xxl', '44', 'xl/xxl', 'xxl/3xl', '42/44', '44/46'] };
export const SHOES = Object.fromEntries([35, 36, 37, 38, 39, 40, 41, 42].map(n => [String(n), [String(n), n - .5 + '', n + .5 + '', `${n - 1}/${n}`, `${n}/${n + 1}`]]));

// Couleurs présentes dans un rayon filtré sur certaines tailles (null si le filtre n'a pas pu être appliqué)
export async function readSized(browser, slug, values) {
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
