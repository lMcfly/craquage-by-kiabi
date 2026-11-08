// Ouverture hors ligne, sans jamais bloquer les mises à jour :
// la page et le catalogue viennent d'abord du réseau (copie gardée en secours) ;
// seuls les fichiers fixes (icônes, logo) sont servis depuis la copie.
const CACHE = 'craquage-v6';
const STATIC = ['assets/kiabi-k.svg', 'assets/kiabi-k-white.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'icons/icon-maskable-512.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC))); self.skipWaiting(); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;     // photos Kiabi : cache normal du navigateur
  const isStatic = STATIC.some(f => url.pathname.endsWith('/' + f));
  if (isStatic) { e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request))); return; }
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(r => { if (r.ok) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); } return r; })
      .catch(() => caches.match(e.request).then(hit => hit || caches.match('./')))
  );
});
