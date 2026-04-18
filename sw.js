// =========================================================
// AVIPET — Service Worker v1
// Estrategia: Cache First para estáticos, Network First para Firebase
// =========================================================

const CACHE_V = 'avipet-v1';

const ESTATICOS = [
  '/index.html',
  '/main.js',
  '/historia.js',
  '/peluqueria.js',
  '/finanzas.js',
  '/buscador.js',
  '/inventario.js',
  '/seguridad.js',
  '/vacunas.js',
  '/avipet.png',
  '/logo_darwin.jpg',
  '/logo_joan.png',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.all.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js',
  'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
];

// ── INSTALAR ──────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_V).then(cache =>
      Promise.allSettled(ESTATICOS.map(url =>
        cache.add(url).catch(() => {}) // silencioso si falla alguno
      ))
    ).then(() => self.skipWaiting())
  );
});

// ── ACTIVAR ───────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_V).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// ── FETCH ─────────────────────────────────────────────────
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Firebase y APIs externas → solo red, nunca cache
  if (url.includes('firestore.googleapis.com') ||
      url.includes('firebase') ||
      url.includes('googleapis.com') ||
      url.includes('dolarapi.com') ||
      url.includes('er-api.com')) {
    return; // dejar pasar sin interceptar
  }

  // Archivos estáticos → Cache First (si está en cache lo usa, si no va a la red)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // Guardar en cache si es una respuesta válida
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_V).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => {
        // Sin red y sin cache → página de offline si es navegación
        if (event.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

// ── COLA DE ESCRITURAS OFFLINE ────────────────────────────
// Cuando Firebase falla por falta de internet, guardamos en cola
// y reintentamos cuando vuelve la conexión

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
