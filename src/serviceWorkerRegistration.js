// src/serviceWorkerRegistration.js
/**
 * Registers NammaDrishti service worker for offline resilience and PWA support.
 */

export function register() {
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    window.addEventListener('load', () => {
      const swUrl = `${process.env.PUBLIC_URL}/sw.js`;
      navigator.serviceWorker
        .register(swUrl)
        .then((registration) => {
          console.log('[NammaDrishti PWA] ServiceWorker registered:', registration.scope);
        })
        .catch((error) => {
          console.warn('[NammaDrishti PWA] ServiceWorker registration failed:', error);
        });
    });
  }
}

export function unregister() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.unregister();
      })
      .catch((error) => {
        console.error(error.message);
      });
  }
}
