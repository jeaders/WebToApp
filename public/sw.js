/* WebToApp service worker
 * Obiettivo: rendere la dashboard installabile come PWA e aprire l'ultima
 * versione anche offline. Le pagine usano "network first" così un nuovo deploy
 * viene sempre mostrato subito; in cache finiscono solo asset statici.
 */
const VERSION = 'wta-v1';
const STATIC_CACHE = `${VERSION}-static`;
const PAGES_CACHE = `${VERSION}-pages`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      cache.addAll([
        '/manifest.json',
        '/icons/icon-192.png',
        '/icons/icon-512.png',
      ]).catch(() => undefined)
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  // Le API non vanno mai in cache.
  if (url.pathname.startsWith('/api/')) return;

  // Navigazioni: rete prima, cache solo se offline.
  if (req.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(PAGES_CACHE);
          cache.put('/', fresh.clone());
          return fresh;
        } catch {
          const cached = await caches.match('/');
          return (
            cached ||
            new Response('Offline', { status: 503, headers: { 'Content-Type': 'text/plain' } })
          );
        }
      })()
    );
    return;
  }

  // Asset statici: cache prima, aggiornamento in background.
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json' ||
    url.pathname === '/favicon.ico'
  ) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE);
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      })()
    );
  }
});
