// Values are replaced for each production build by prepare-service-worker.js.
const CACHE_NAME = 'nammadrishti-build-__BUILD_VERSION__';
const STATIC_ASSETS = /* BUILD_ASSETS */ ['/index.html', '/manifest.json', '/favicon.ico'];
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(STATIC_ASSETS);
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if ((key.startsWith('nammadrishti-') || key.startsWith('nammapulse-')) && key !== CACHE_NAME) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket.io/')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    if (request.mode === 'navigate') {
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put('/index.html', response.clone());
        return response;
      } catch { return (await cache.match('/index.html')) || Response.error(); }
    }
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok && /\.(js|css|png|ico|svg|woff2?)$/.test(url.pathname)) await cache.put(request, response.clone());
    return response;
  })());
});
