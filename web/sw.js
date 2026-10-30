/**
 * Service worker: makes the game work offline after the first visit.
 *
 * Game files: fetched fresh whenever the network answers, so a player never
 * runs an old version after an update. The cached copy is only for when the
 * network fails or is slower than NETWORK_PATIENCE_MS.
 * API calls (/api/…): always go to the network; never cached.
 */
const CACHE = 'heroic-encounters-v2';
const NETWORK_PATIENCE_MS = 3000;
const SHELL = [
  './',
  './index.html',
  './css/base.css',
  './css/cards.css',
  './css/combat.css',
  './css/screens.css',
  './css/workshop.css',
  './js/main.js',
  './manifest.webmanifest',
  './assets/icons/icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;

  event.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(event.request, { ignoreSearch: true });
    const network = fetch(event.request)
      .then((response) => {
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      })
      .catch(() => null);

    if (cached) {
      event.waitUntil(network); // finishes in the background if the cache answers first
      const patience = new Promise((resolve) => { setTimeout(() => resolve(null), NETWORK_PATIENCE_MS); });
      const fresh = await Promise.race([network, patience]);
      return fresh?.ok ? fresh : cached;
    }
    const response = await network;
    if (response) return response;
    // Offline and not cached: fall back to the app shell for page navigations.
    return (event.request.mode === 'navigate' && await cache.match('./index.html')) || new Response('Offline', { status: 503 });
  }));
});
