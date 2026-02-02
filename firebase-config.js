import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBd7HDH1wDbkq8T1XTsKUV0gBQ_O_BF7jI",
  authDomain: "avicolapet.firebaseapp.com",
  projectId: "avicolapet",
  storageBucket: "avicolapet.firebasestorage.app",
  messagingSenderId: "909478828234",
  appId: "1:909478828234:web:b04a444b41d239cc4a3c33",
  measurementId: "G-S1SBZT5QHW"
};

// Inicializamos Firebase y la Base de Datos (Firestore)
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
