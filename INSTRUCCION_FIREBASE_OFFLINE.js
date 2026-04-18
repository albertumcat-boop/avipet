// =========================================================
// INSTRUCCIÓN PARA ACTIVAR FIREBASE OFFLINE (Opción C)
// =========================================================
//
// En tu archivo firebase-config.js, AGREGA estas líneas
// justo después de donde inicializas Firestore:
//
// ANTES (lo que tienes ahora, algo así):
// ─────────────────────────────────────
//   import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
//   import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
//
//   const app = initializeApp(firebaseConfig);
//   export const db = getFirestore(app);
//
//
// DESPUÉS (agrega las líneas marcadas con ← AGREGAR):
// ─────────────────────────────────────────────────────
//   import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
//   import {
//     getFirestore,
//     enableIndexedDbPersistence          // ← AGREGAR esta línea al import
//   } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
//
//   const app = initializeApp(firebaseConfig);
//   export const db = getFirestore(app);
//
//   // ← AGREGAR este bloque completo:
//   enableIndexedDbPersistence(db).then(() => {
//     console.log("✅ Firebase offline activado");
//   }).catch(err => {
//     if (err.code === 'failed-precondition') {
//       // Más de una pestaña abierta — solo funciona en una a la vez
//       console.warn("Firebase offline: múltiples pestañas abiertas");
//     } else if (err.code === 'unimplemented') {
//       // El navegador no soporta IndexedDB (muy raro)
//       console.warn("Firebase offline: navegador no compatible");
//     }
//   });
//
// =========================================================
// ¿QUÉ HACE ESTO?
// =========================================================
//
// Firebase guarda una copia local de todos los datos en
// IndexedDB (base de datos del navegador).
//
// Sin internet:
//   - Las LECTURAS usan la copia local (historial, inventario, etc.)
//   - Las ESCRITURAS se guardan en cola local
//   - Cuando vuelve el internet, Firebase sincroniza todo solo
//
// El doctor ni se entera de que no hay internet.
// =========================================================
