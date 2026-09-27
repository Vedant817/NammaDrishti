// public/sw.js
/**
 * NammaDrishti Monsoon Offline Service Worker
 * Ensures the civic intelligence platform remains operational during severe weather,
 * power blackouts, and cellular network degradation in Bengaluru.
 */

const CACHE_NAME = 'nammadrishti-offline-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
];

// External real-time dynamic hosts that must NEVER be served from stale static cache
const REALTIME_DYNAMIC_HOSTS = [
  'api.open-meteo.com',
  'api.rainviewer.com',
  'tilecache.rainviewer.com',
  'router.project-osrm.org',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return null;
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }

  // 1. External real-time telemetry (Weather, Doppler Radar, OSRM routing) -> Network-first / live fetch
  if (REALTIME_DYNAMIC_HOSTS.some((host) => url.hostname.includes(host))) {
    event.respondWith(
      fetch(request).catch(() => {
        // Fallback to cache only if network completely unavailable
        return caches.match(request);
      })
    );
    return;
  }

  // 2. Internal /api/ routes -> Network-first with cached fallback for offline resilience
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
    return;
  }

  // 3. Navigation requests (HTML documents) -> Network-first, fall back to /index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, clone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match('/index.html') || caches.match('/');
        })
    );
    return;
  }

  // 4. Static assets (JS bundles, CSS, fonts, icons) -> Cache-first with network background fetch
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
          });
        }
        return response;
      });
    })
  );
});
