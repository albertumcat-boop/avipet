// =========================================================
// AVIPET — cola_offline.js
// Detecta red offline/online, muestra badge de estado,
// y espera a que Firebase sincronice los writes pendientes
// =========================================================
import { db } from './firebase-config.js';
import { waitForPendingWrites } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

const BADGE_ID = 'avipetOfflineBadge';

function _badge(msg, color) {
  let b = document.getElementById(BADGE_ID);
  if (!b) {
    b = document.createElement('div');
    b.id = BADGE_ID;
    b.style.cssText =
      'position:fixed;bottom:14px;left:14px;z-index:99999;padding:5px 14px;' +
      'border-radius:999px;font-size:10px;font-weight:900;letter-spacing:.5px;' +
      'text-transform:uppercase;box-shadow:0 2px 10px rgba(0,0,0,.25);' +
      'transition:opacity .3s;pointer-events:none;display:none;color:#fff;';
    document.body.appendChild(b);
  }
  if (!msg) { b.style.display = 'none'; return; }
  b.style.display = 'block';
  b.style.background = color;
  b.textContent = msg;
}

// Helper global: ¿es este error un error de red?
window._esErrorRed = (e) =>
  !navigator.onLine ||
  ['unavailable', 'client is offline', 'failed to fetch', 'network request failed', 'connection']
    .some(k => String(e?.message || e?.code || e || '').toLowerCase().includes(k));

// Sin internet → badge naranja
window.addEventListener('offline', () => {
  _badge('📶 Sin internet — guardando localmente', '#f59e0b');
});

// Internet vuelve → sincronizar y confirmar
window.addEventListener('online', async () => {
  _badge('🔄 Sincronizando con la nube...', '#6366f1');
  try {
    await waitForPendingWrites(db);
    _badge('✅ Todo sincronizado', '#16a34a');
    // Notificar con Swal si está disponible
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'success',
        title: '☁️ Sincronización completa',
        text: 'Todos los registros guardados sin internet ya están en la nube.',
        timer: 3500,
        showConfirmButton: false
      });
    }
    setTimeout(() => _badge(null), 4000);
  } catch(e) {
    console.warn('[AVIPET] waitForPendingWrites error:', e);
    _badge(null);
  }
});

// Al cargar: si ya está offline, mostrar badge de inmediato
document.addEventListener('DOMContentLoaded', () => {
  if (!navigator.onLine) {
    _badge('📶 Sin internet — guardando localmente', '#f59e0b');
  }
});

console.log('✅ cola_offline.js — detector de red activo');
