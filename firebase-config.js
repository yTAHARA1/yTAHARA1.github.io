import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-analytics.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Configurações e chaves do seu projeto Firebase geradas pelo Console
const firebaseConfig = {
  apiKey: "AIzaSyAKeW-9XrrzxnCWZpTRuu3Ng34auZmA1pI",
  authDomain: "portifolioemiliotahara.firebaseapp.com",
  projectId: "portifolioemiliotahara",
  storageBucket: "portifolioemiliotahara.firebasestorage.app",
  messagingSenderId: "1053679157139",
  appId: "1:1053679157139:web:190fc0e7dec7ebd9d43266",
  measurementId: "G-PHSLWMQBR3"
};

// Inicializar os serviços do Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Só inicializa o Analytics se estiver num ambiente seguro onde a janela não bloqueia cookies agressivamente
let analytics = null;
try {
    analytics = getAnalytics(app);
} catch (e) {
    console.warn("Firebase Analytics bloqueado (ex: extensões de privacidade).", e);
}

// Exportamos tudo para uso no app.js principal
export { app, auth, db, analytics };
