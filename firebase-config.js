import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app.js";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-app-check.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

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

// Em desenvolvimento local, o Firebase exibe no console um token de depuração.
// Cadastre esse token no App Check; nunca coloque o token de depuração neste arquivo.
if (["localhost", "127.0.0.1"].includes(window.location.hostname)) {
    self.FIREBASE_APPCHECK_DEBUG_TOKEN = true;
}

const appCheck = initializeAppCheck(app, {
    provider: new ReCaptchaEnterpriseProvider("6LcJO5AtAAAAAM7LvFQWjlcSrB7giDa7OHq98GOI"),
    isTokenAutoRefreshEnabled: true
});

const auth = getAuth(app);
auth.languageCode = "pt-BR";
const db = getFirestore(app);

// Carrega o Analytics somente quando o navegador estiver ocioso, sem disputar
// recursos com o conteúdo principal durante a abertura da página.
let analytics = null;
async function initializeAnalyticsWhenIdle() {
    try {
        const { getAnalytics, isSupported } = await import(
            "https://www.gstatic.com/firebasejs/12.17.1/firebase-analytics.js"
        );
        if (await isSupported()) analytics = getAnalytics(app);
    } catch (error) {
        console.warn("Firebase Analytics bloqueado pelas configurações de privacidade.", error);
    }
}

if ("requestIdleCallback" in window) {
    window.requestIdleCallback(() => void initializeAnalyticsWhenIdle(), { timeout: 3000 });
} else {
    window.setTimeout(() => void initializeAnalyticsWhenIdle(), 1200);
}

// Exportamos tudo para uso no app.js principal
export { app, appCheck, auth, db, analytics };
