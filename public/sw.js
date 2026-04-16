const CACHE_NAME = 'stx-runtime-v1';

self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api')) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
        }
        return response;
      })
      .catch(() =>
        caches.match(request).then(cached => {
          if (cached) return cached;
          return new Response(
            '<html><body style="font-family:sans-serif;text-align:center;padding:40px"><h2>Tidak ada koneksi internet</h2><p>Periksa koneksi Anda lalu muat ulang halaman.</p><button onclick="location.reload()">Muat Ulang</button></body></html>',
            { status: 503, headers: { 'Content-Type': 'text/html' } }
          );
        })
      )
  );
});
