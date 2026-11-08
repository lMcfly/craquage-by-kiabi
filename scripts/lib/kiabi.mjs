// Outils partagés par les deux robots : adresses des rayons Kiabi, tailles, lecture d'un rayon filtré sur une taille.
export const PAUSE = ms => new Promise(r => setTimeout(r, ms));

// Filtres du site « Marques › Kiabi » (pas de marketplace) et « Genre › Femme » ou « Homme » (jamais enfant ni bébé),
// tri « Nouveautés » : les nouveaux articles de chaque rayon passent en premier.
export const pageUrl = (slug, extra = '', genre = 'femme') => 'https://www.kiabi.com/v/' + slug + '?itemsperpage=90&display=grid&fieldnametosort=isnew&filter=marques%3Akiabi;genre%3A' + genre + extra;

// Identifiant d'une couleur d'article : « produit:couleur » tiré de l'adresse …_P123C456
export const keyOf = u => (u.match(/_P(\d+)C(\d+)$/) || []).slice(1).join(':');

// Tailles de l'app → valeurs du filtre « Taille » de Kiabi (lettres, chiffres et tailles doubles)
export const CLOTHES = { XS: ['xxs', 'xs', '32', '34', 'xs/s', '32/34', '34/36'], S: ['s', '36', 'xs/s', 's/m', '34/36', '36/38'],
  M: ['m', '38', 's/m', 'm/l', '36/38', '38/40'], L: ['l', '40', 'm/l', 'l/xl', '38/40', '40/42'],
  XL: ['xl', '42', 'l/xl', 'xl/xxl', '40/42', '42/44'], XXL: ['xxl', '44', 'xl/xxl', 'xxl/3xl', '42/44', '44/46'] };
const shoes = list => Object.fromEntries(list.map(n => [String(n), [String(n), n - .5 + '', n + .5 + '', `${n - 1}/${n}`, `${n}/${n + 1}`]]));
export const SHOES = shoes([35, 36, 37, 38, 39, 40, 41, 42]);
// Homme : hauts S à 3XL, pantalons 38 à 48 (38 = S … 48 = 3XL), pointures 39 à 46
export const CLOTHES_H = { S: ['s', 'xs/s', 's/m', '36', '38', '36/38'], M: ['m', 's/m', 'm/l', '40', '38/40'], L: ['l', 'm/l', 'l/xl', '42', '40/42'],
  XL: ['xl', 'l/xl', 'xl/xxl', '44', '42/44'], XXL: ['xxl', '2xl', 'xl/xxl', '46', '44/46'], '3XL': ['3xl', 'xxxl', 'xxl/3xl', '48', '46/48'] };
export const SHOES_H = shoes([39, 40, 41, 42, 43, 44, 45, 46]);
export const GENRE = { f: 'femme', h: 'homme' };

// Couleurs présentes dans un rayon filtré sur certaines tailles (null si le filtre n'a pas pu être appliqué)
export async function readSized(browser, slug, values, g = 'f') {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  try {
    await page.goto(pageUrl(slug, ';taille%3A' + values.map(encodeURIComponent).join(','), GENRE[g]), { waitUntil: 'domcontentloaded', timeout: 60000 });
    await PAUSE(2500);
    const r = await page.evaluate(genre => {
      const on = f => !!document.querySelector(`[data-filter="${f}"] input`)?.checked;
      const sized = [...document.querySelectorAll('[data-filter] input:checked')].some(i => /^taille/.test(i.name));
      return { ok: on('kiabi') && on(genre) && sized,
               keys: [...document.querySelectorAll('.products-item-wrapper a[href*="_P"]')].map(a => (a.href.split('?')[0].match(/_P(\d+)C(\d+)$/) || []).slice(1).join(':')) };
    }, GENRE[g]);
    return r.ok ? r.keys : null;
  } catch (e) { return null; } finally { await page.close(); }
}
