// [firebase-config.js] - VERSIÓN ESTABLE VÍA CDN (SOLUCIONA EL ERROR 404)
// ==========================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage }   from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

// RECUERDA: Pon aquí tus claves reales que ya tenías funcionando
const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_DOMINIO",
  projectId: "TU_PROYECTO_ID",
  storageBucket: "TU_BUCKET",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

// Encendemos el motor
const app = initializeApp(firebaseConfig);

// Exportamos con los nombres exactos que espera tu script principal
export const db = getFirestore(app);
export const storage = getStorage(app);


