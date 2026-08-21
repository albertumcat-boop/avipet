// =========================================================
// AVIPET — Service Worker v10
// Estrategia: cache-first para archivos propios, network-only para CDN/Firebase
// Garantiza que la app cargue offline y que el respaldo localStorage sea leíble
// =========================================================

const CACHE_V = 'avipet-v11';

const APP_SHELL = [
  '/',
  '/index.html',
  '/main.js',
  '/historia.js',
  '/peluqueria.js',
  '/buscador.js',
  '/vacunas.js',
  '/inventario.js',
  '/almuerzo.js',
  '/firebase-config.js',
  '/finanzas.js',
  '/permisos.js',
  '/seguridad.js',
  '/manifest.json',
  '/avipet.png',
  '/logo_darwin.jpg',
  '/cola_offline.js',
  '/facturacion.html',
  '/facturacion.js',
];

// CDN y servicios externos — NUNCA cachear, siempre red
const ES_EXTERNO = url =>
  url.includes('firestore.googleapis.com') ||
  url.includes('firebase') ||
  url.includes('googleapis.com') ||
  url.includes('dolarapi.com') ||
  url.includes('er-api.com') ||
  url.includes('gstatic.com') ||
  url.includes('cdn.') ||
  url.includes('jsdelivr') ||
  url.includes('cdnjs') ||
  url.includes('tailwind') ||
  url.includes('sweetalert') ||
  url.includes('wa.me') ||
  url.includes('calendar.google') ||
  url.includes('vercel.app');

self.addEventListener('install', event => {
  console.log('[SW v9] Instalando y pre-cacheando app shell...');
  event.waitUntil(
    caches.open(CACHE_V).then(cache =>
      // addAll falla si algún archivo no existe — usamos add individual con soft-fail
      Promise.allSettled(APP_SHELL.map(url => cache.add(url)))
        .then(results => {
          const ok  = results.filter(r => r.status === 'fulfilled').length;
          const err = results.filter(r => r.status === 'rejected').length;
          console.log(`[SW v9] Cache: ${ok} archivos OK, ${err} fallidos`);
        })
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  console.log('[SW v9] Activando — limpiando caches anteriores...');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_V).map(k => {
        console.log('[SW v9] Eliminando cache viejo:', k);
        return caches.delete(k);
      }))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Externos: dejar pasar sin tocar
  if (ES_EXTERNO(url)) return;

  // Archivos propios: cache-first con actualización en background (stale-while-revalidate)
  event.respondWith(
    caches.open(CACHE_V).then(async cache => {
      const cached = await cache.match(event.request);

      // Intentar actualizar desde la red en background
      const networkFetch = fetch(event.request).then(response => {
        if (response && response.ok && event.request.method === 'GET') {
          cache.put(event.request, response.clone());
        }
        return response;
      }).catch(() => null);

      // Si hay cache: devolver inmediatamente (app carga offline)
      // Si no hay cache: esperar la red
      return cached || networkFetch;
    })
  );
});
