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
    const userDoc = await getDoc(doc(db, "users", user.uid));
    return userDoc.exists() && userDoc.data().role === 'admin';
}

// Redirect based on role
async function handleRedirection(user) {
    if (!user) return;
    
    const isAdmin = await checkAdmin(user);
    const currentPage = window.location.pathname;
    
    if (isAdmin && !currentPage.includes('admin.html')) {
        window.location.href = 'admin.html';
    } else if (!isAdmin && currentPage.includes('admin.html')) {
        window.location.href = 'index.html';
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
