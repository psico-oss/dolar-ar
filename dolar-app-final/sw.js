const CACHE_NAME = 'dolar-ar-v3';
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Ignorar todo lo que no sea http/https
  if (!event.request.url.startsWith('http')) return;

  const url = new URL(event.request.url);

  // Siempre ir a la red para APIs y funciones
  const skipCache =
    url.hostname === 'dolarapi.com' ||
    url.hostname === 'api.argentinadatos.com' ||
    url.hostname.includes('steampowered.com') ||
    url.hostname === 'steamspy.com' ||
    url.hostname.includes('steamstatic.com') ||
    url.pathname.startsWith('/.netlify/functions/');

  if (skipCache) {
    event.respondWith(fetch(event.request).catch(() =>
      new Response('{}', { headers: { 'Content-Type': 'application/json' } })
    ));
    return;
  }

  // Cache-first para assets estáticos
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || !response.ok) return response;
        const toCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, toCache));
        return response;
      });
    }).catch(() => caches.match('/index.html'))
  );
});
