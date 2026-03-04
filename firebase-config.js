// [firebase-config.js] - CONFIGURACIÓN REAL AVICOLAPET
// ==========================================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage }   from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
  // Busca el apiKey en tu panel de Firebase (es la clave larga que empieza por AIza)
  apiKey: "TU_API_KEY_AQUÍ", 
  authDomain: "avicolapet.firebaseapp.com",
  projectId: "avicolapet",
  storageBucket: "avicolapet.appspot.com",
  messagingSenderId: "909478828234",
  appId: "TU_APP_ID_AQUÍ" // Empieza por 1:909478828234...
};

// Encendemos el motor
const app = initializeApp(firebaseConfig);

// Exportamos las herramientas para "soldar" datos
export const db = getFirestore(app);
export const storage = getStorage(app);
