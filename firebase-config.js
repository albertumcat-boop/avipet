// [firebase-config.js] - CONFIGURACIÓN FINAL AVICOLAPET
// ==========================================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  enableIndexedDbPersistence
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

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

// Exportamos las herramientas para el sistema
export const db      = getFirestore(app);
export const storage = getStorage(app);

// ── MODO OFFLINE ──────────────────────────────────────────
// Firebase guarda una copia local de los datos en el navegador.
// Sin internet: lee del cache, las escrituras se guardan en cola.
// Cuando vuelve el internet: sincroniza todo automáticamente.
enableIndexedDbPersistence(db).then(() => {
  console.log("✅ AVIPET modo offline activado");
}).catch(err => {
  if (err.code === 'failed-precondition') {
    console.warn("⚠️ Offline: cierra otras pestañas de AVIPET");
  } else if (err.code === 'unimplemented') {
    console.warn("⚠️ Offline: este navegador no lo soporta");
  }
});
