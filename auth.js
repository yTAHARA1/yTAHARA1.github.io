import { auth, db } from './firebase-config.js';
import { 
    signInWithEmailAndPassword, 
    createUserWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    doc, 
    getDoc, 
    setDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Check if user is Admin
async function checkAdmin(user) {
    if (!user) return false;
    try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (!userDoc.exists()) {
            console.warn("Documento de usuário não encontrado no Firestore!");
            return false;
        }
        console.log("Role detectado:", userDoc.data().role);
        return userDoc.data().role === 'admin';
    } catch (e) {
        console.error("Erro ao verificar admin:", e);
        return false;
    }
}

// Redirect based on role
async function handleRedirection(user) {
    if (!user) return;
    
    console.log("Checando permissões para:", user.email);
    const isAdmin = await checkAdmin(user);
    const currentPage = window.location.pathname;
    
    if (isAdmin) {
        console.log("Acesso Admin confirmado!");
        if (!currentPage.includes('admin.html')) {
            window.location.href = 'admin.html';
        }
    } else {
        console.log("Acesso como usuário comum.");
    }
}

// Global Auth State Observer
onAuthStateChanged(auth, (user) => {
    handleRedirection(user);
    const authElements = document.querySelectorAll('.auth-only');
    const guestElements = document.querySelectorAll('.guest-only');
    
    if (user) {
        authElements.forEach(el => el.style.display = 'block');
        guestElements.forEach(el => el.style.display = 'none');
        document.getElementById('userNameDisplay')?.textContent = user.displayName || user.email;
    } else {
        authElements.forEach(el => el.style.display = 'none');
        guestElements.forEach(el => el.style.display = 'block');
    }
});

// LOGIN
export async function login(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        return { success: true, user: userCredential.user };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// REGISTER
export async function register(email, password, name) {
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        // Define role (Hardcoded admin for you)
        const role = (email === 'emilio.tahara01@gmail.com') ? 'admin' : 'user';
        
        // Save user profile to Firestore
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            name: name,
            email: email,
            role: role,
            createdAt: new Date()
        });
        
        return { success: true, user: user };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// LOGOUT
export async function logout() {
    try {
        await signOut(auth);
        window.location.href = 'index.html';
    } catch (error) {
        console.error("Logout error", error);
    }
}
