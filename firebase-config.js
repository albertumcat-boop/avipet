<script type="module">
  // Import the functions you need from the SDKs you need
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.8.0/firebase-analytics.js";
  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyBd7HDH1wDbkq8T1XTsKUV0gBQ_O_BF7jI",
    authDomain: "avicolapet.firebaseapp.com",
    projectId: "avicolapet",
    storageBucket: "avicolapet.firebasestorage.app",
    messagingSenderId: "909478828234",
    appId: "1:909478828234:web:b04a444b41d239cc4a3c33",
    measurementId: "G-S1SBZT5QHW"
  };

  // Initialize Firebase
  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
</script>
