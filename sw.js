// Fonctionnement hors ligne : l'app s'ouvre même sans réseau ; le catalogue est rafraîchi dès que possible.
const SHELL = 'craquage-shell-v1';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'assets/kiabi-logo.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(SHELL).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== 'craquage-data').map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;                       // photos Kiabi : cache normal du navigateur
  if (url.pathname.endsWith('/data/products.json')) {                // catalogue : réseau d'abord, copie en secours
    e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open('craquage-data').then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request)));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
