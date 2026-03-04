// [firebase-config.js] - VERSIÓN BLINDADA PARA USO OFFLINE
// ==========================================================================

// 1. Cambiamos las rutas externas por las locales que descargaste
import { initializeApp } from "./firebase-app.js";
import { getFirestore } from "./firebase-firestore.js";
import { getStorage }   from "./firebase-storage.js";   // <-- AÑADIR ESTA LÍNEA

const firebaseConfig = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_DOMINIO",
  projectId: "TU_PROYECTO_ID",
  storageBucket: "TU_BUCKET",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

// 2. Encendemos el motor de Firebase
const app = initializeApp(firebaseConfig);

// 3. Exportamos la base de datos para que el resto del sistema la use
export const db = getFirestore(app);
export const storage = getStorage(app);   // <-- AÑADIR ESTA LÍNEA

