// =========================================================
// AVIPET — Service Worker v8
// Elimina TODO el cache anterior sin excepción
// NUNCA cachea JS ni HTML — siempre frescos de Vercel
// =========================================================

const CACHE_V = 'avipet-v8';

self.addEventListener('install', event => {
  console.log('[SW v8] Instalando...');
  // No cachear nada en la instalación — todo viene de la red
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  console.log('[SW v8] Activando — eliminando TODOS los caches...');
  event.waitUntil(
    caches.keys().then(keys => {
      console.log('[SW v8] Caches encontrados:', keys);
      return Promise.all(keys.map(k => {
        console.log('[SW v8] Eliminando:', k);
        return caches.delete(k);
      }));
    }).then(() => {
      console.log('[SW v8] Todos los caches eliminados');
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Firebase, APIs externas, CDNs → dejar pasar sin interceptar
  if (url.includes('firestore.googleapis.com') ||
      url.includes('firebase') ||
      url.includes('googleapis.com') ||
      url.includes('dolarapi.com') ||
      url.includes('er-api.com') ||
      url.includes('cdn.') ||
      url.includes('jsdelivr') ||
      url.includes('cdnjs') ||
      url.includes('tailwind') ||
      url.includes('gstatic')) {
    return; // no interceptar
  }

  // JS, HTML y cualquier archivo del sitio → SIEMPRE de la red
  // NUNCA del cache — así los cambios se reflejan inmediatamente
  event.respondWith(
    fetch(event.request).catch(() => {
      // Sin red → intentar cache solo como último recurso
      return caches.match(event.request);
    })
  );
});
