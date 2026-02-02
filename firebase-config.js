import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "TU_API_KEY_REAL", 
  authDomain: "TU_DOMINIO_REAL",
  projectId: "TU_ID_REAL",
  storageBucket: "TU_BUCKET_REAL",
  messagingSenderId: "TU_SENDER_ID_REAL",
  appId: "TU_APP_ID_REAL"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

