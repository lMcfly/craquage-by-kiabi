// Langue et thème : réglages enregistrés sur l'appareil, traduction des textes, prix et couleurs.
import { store } from './utils.js';
import { I18N, STYLES_I18N, COLOURS_I18N } from './translations.js';

export const SETTINGS_KEY = 'craquage-settings-v1';
export const settings = Object.assign({ theme: 'auto', lang: (navigator.language || 'fr').slice(0, 2) }, store.get(SETTINGS_KEY) || {});
if (!I18N[settings.lang]) settings.lang = 'fr';
export const eur = n => new Intl.NumberFormat(settings.lang === 'en' ? 'en-IE' : settings.lang, { style: 'currency', currency: 'EUR' }).format(n);
export const t = (k, v = {}) => String((I18N[settings.lang] || I18N.fr)[k] ?? I18N.fr[k] ?? k).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? '');
export const tl = k => (I18N[settings.lang] || I18N.fr)[k] || I18N.fr[k];
export const arts = n => t(n > 1 ? 'artN' : 'art1', { n: n.toLocaleString(settings.lang) });
export const colourName = c => settings.lang === 'fr' ? c.c : ((COLOURS_I18N[settings.lang] || {})[c.f] || c.c);
export const STYLE = new Proxy({}, { get: (_, k) => (STYLES_I18N[settings.lang] || STYLES_I18N.fr)[k] });
export function applyStatic() {
  document.documentElement.lang = settings.lang;
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); el.title = t(el.dataset.i18nAria); });
}
export function applyTheme() {
  const r = document.documentElement;
  if (settings.theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', settings.theme);
  const dark = settings.theme === 'dark' || (settings.theme === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#0a0920' : '#f3f3f8');
}
