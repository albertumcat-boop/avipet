// =========================================================
// AVIPET — Service Worker v6
// IMPORTANTE: No cachea archivos JS para siempre tener la versión más reciente
// =========================================================

const CACHE_V = 'avipet-v6';

// Solo cachear assets estáticos que NO cambian frecuentemente
const ESTATICOS = [
  '/avipet.png',
  '/logo_darwin.jpg',
  '/logo_joan.png',
  '/manifest.json',
];

// ── INSTALAR ──────────────────────────────────────────────
self.addEventListener('install', event => {
  console.log('[SW v6] Instalando...');
  event.waitUntil(
    caches.open(CACHE_V).then(cache =>
      Promise.allSettled(ESTATICOS.map(url =>
        cache.add(url).catch(() => {})
      ))
    ).then(() => self.skipWaiting())
  );
});

// ── ACTIVAR: limpiar TODOS los caches anteriores ─────────
self.addEventListener('activate', event => {
  console.log('[SW v6] Activando — limpiando caches viejos...');
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => {
        console.log('[SW v6] Eliminando cache:', k);
        return caches.delete(k);
      })))
      .then(() => self.clients.claim())
  );
});

// ── FETCH: Network First para JS/HTML, Cache para imágenes ──
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Firebase, APIs externas → dejar pasar sin interceptar
  if (url.includes('firestore.googleapis.com') ||
      url.includes('firebase') ||
      url.includes('googleapis.com') ||
      url.includes('dolarapi.com') ||
      url.includes('er-api.com') ||
      url.includes('cdn.') ||
      url.includes('jsdelivr') ||
      url.includes('cdnjs') ||
      url.includes('tailwind')) {
    return;
  }

  // Archivos JS y HTML → SIEMPRE de la red (nunca del cache)
  if (url.endsWith('.js') || url.endsWith('.html') || url.includes('.js?') || url === self.registration.scope) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Imágenes y otros assets → Cache first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_V).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
