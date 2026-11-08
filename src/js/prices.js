// Prix au moment du coup de cœur, enregistré sur l'appareil : sert à repérer les baisses de prix dans Envies.
// Le robot met les prix à jour chaque nuit ; si le meilleur prix d'une envie baisse, on l'affiche et on prévient une fois.
import { store } from './utils.js';

const KEY = 'craquage-wishprice-v1';
const data = Object.assign({ at: {}, told: {} }, store.get(KEY) || {});
const save = () => store.set(KEY, data);
const bestPrice = p => Math.min(...p.c.flatMap(c => c.p));

export function rememberPrice(p) { if (p && data.at[p.id] == null) { data.at[p.id] = bestPrice(p); save(); } }
export function forgetPrice(id) { delete data.at[id]; delete data.told[id]; save(); }

// Baisse en euros depuis le coup de cœur (0 si aucune)
export function priceDrop(p) {
  const was = data.at[p.id], now = bestPrice(p);
  return was != null && now < was - .009 ? Math.round((was - now) * 100) / 100 : 0;
}

// Nombre de baisses pas encore signalées (et on les note comme signalées)
export function takeNewDrops(products) {
  const fresh = products.filter(p => priceDrop(p) && data.told[p.id] !== bestPrice(p));
  fresh.forEach(p => { data.told[p.id] = bestPrice(p); });
  if (fresh.length) save();
  return fresh.length;
}
