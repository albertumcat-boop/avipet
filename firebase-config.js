// [firebase-config.js] - CONFIGURACIÓN FINAL AVICOLAPET
// ==========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import {
  getAuth,
  signInAnonymously
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
const firebaseConfig = {
    apiKey: "AIzaSyBd7HDH1wDbkq8T1XTsKUV0gBQ_O_BF7jI",
    authDomain: "avicolapet.firebaseapp.com",
    projectId: "avicolapet",
    storageBucket: "avicolapet.firebasestorage.app",
    messagingSenderId: "909478828234",
    appId: "1:909478828234:web:b04a444b41d239cc4a3c33",
    measurementId: "G-S1SBZT5QHW"
};

// Encendemos el motor
const app = initializeApp(firebaseConfig);

// ── BASE DE DATOS CON SOPORTE OFFLINE ────────────────────
// Usamos initializeFirestore con persistentLocalCache (Firebase 10.x)
// Esto permite trabajar sin internet y sincronizar al volver la conexión
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
  console.log("✅ AVIPET — modo offline activado");
} catch (err) {
  // Fallback: si ya fue inicializado, usar instancia existente
  db = getFirestore(app);
  console.log("✅ AVIPET — Firebase conectado (modo estándar)");
}

// ── AUTH ANÓNIMO ──────────────────────────────────────────
// Requerido para que las reglas de Firestore puedan verificar
// que la solicitud viene de la app AVIPET y no de internet abierto.
const auth = getAuth(app);
signInAnonymously(auth)
  .then(() => console.log("✅ AVIPET — Auth anónimo activo"))
  .catch(e => console.warn("[AVIPET] Auth anónimo falló:", e.message));

export { db, auth };
