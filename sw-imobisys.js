/* ImobiSys — Service Worker v2 (cache-first) */
const CACHE = 'imobisys-v2';
const INICIO = './imobisys.html';

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.add(INICIO))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match(INICIO).then(cached => {
        const atualizar = fetch(INICIO).then(resp => {
          if (resp.ok) caches.open(CACHE).then(c => c.put(INICIO, resp.clone()));
          return resp;
        }).catch(() => null);
        return cached || atualizar;
      })
    );
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
