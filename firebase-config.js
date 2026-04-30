// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Seu Firebase Project Configuration
const firebaseConfig = {
  apiKey: "AIzaSyAKeW-9XrrzxnCWZpTRuu3Ng34auZmA1pI",
  authDomain: "portifolioemiliotahara.firebaseapp.com",
  projectId: "portifolioemiliotahara",
  storageBucket: "portifolioemiliotahara.firebasestorage.app",
  messagingSenderId: "1053679157139",
  appId: "1:1053679157139:web:190fc0e7dec7ebd9d43266",
  measurementId: "G-PHSLWMQBR3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
