import { auth, db } from './firebase-config.js';
import { login, register, logout } from './auth.js';
import { 
    collection, 
    addDoc, 
    getDocs, 
    query, 
    orderBy, 
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// --- UI Elements ---
const authBtn = document.getElementById('authBtn');
const authModal = document.getElementById('authModal');
const closeModals = document.querySelectorAll('.closeModal');
const tabBtns = document.querySelectorAll('.tab-btn');
const authForms = document.querySelectorAll('.auth-form');

// --- Auth Modal Logic ---
authBtn?.addEventListener('click', () => authModal.classList.add('active'));
document.querySelector('.openAuthModal')?.addEventListener('click', (e) => {
    e.preventDefault();
    authModal.classList.add('active');
});

closeModals.forEach(btn => btn.onclick = () => authModal.classList.remove('active'));

tabBtns.forEach(btn => {
    btn.onclick = () => {
        tabBtns.forEach(b => b.classList.remove('active'));
        authForms.forEach(f => f.classList.remove('active'));
        btn.classList.add('active');
        document.getElementById(btn.dataset.tab + 'Form').classList.add('active');
    };
});

// --- Login / Register Handlers ---
document.getElementById('loginForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await login(document.getElementById('loginEmail').value, document.getElementById('loginPassword').value);
    if (res.success) authModal.classList.remove('active');
    else alert(res.error);
});

document.getElementById('registerForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const res = await register(
        document.getElementById('regEmail').value, 
        document.getElementById('regPassword').value,
        document.getElementById('regName').value
    );
    if (res.success) authModal.classList.remove('active');
    else alert(res.error);
});

document.getElementById('logoutNavBtn')?.addEventListener('click', logout);

// --- Load Content from Firebase ---
function loadDynamicContent() {
    // Load Projects
    const projectsContainer = document.getElementById('projectsContainer');
    onSnapshot(query(collection(db, "projects"), orderBy("createdAt", "desc")), (snapshot) => {
        if (snapshot.empty) {
            projectsContainer.innerHTML = '<p class="text-center">Mais cases em breve...</p>';
            return;
        }
        projectsContainer.innerHTML = '';
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const projectEl = document.createElement('div');
            projectEl.className = 'projeto-content border-glow reveal';
            projectEl.innerHTML = `
                <div class="projeto-text">
                    <div class="tech-stack">
                        ${data.tags.map(t => `<span class="badge">${t}</span>`).join('')}
                    </div>
                    <h3>${data.title}</h3>
                    <div class="process-step"><h4><span class="accent">></span> O Contexto</h4><p>${data.context}</p></div>
                    <div class="process-step"><h4><span class="accent">></span> A Solução</h4><p>${data.solution}</p></div>
                    <div class="process-step"><h4><span class="accent">></span> Impacto</h4><p>${data.impact}</p></div>
                </div>
            `;
            projectsContainer.appendChild(projectEl);
        });
        reveal(); // Re-trigger animation check
    });

    // Load Blog
    const blogContainer = document.getElementById('blogContainer');
    onSnapshot(query(collection(db, "blog"), orderBy("createdAt", "desc")), (snapshot) => {
        if (snapshot.empty) {
            blogContainer.innerHTML = '<p>Novos insights sendo preparados...</p>';
            return;
        }
        blogContainer.innerHTML = '';
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const postEl = document.createElement('div');
            postEl.className = 'blog-card reveal';
            postEl.innerHTML = `
                <h3>${data.title}</h3>
                <p>${data.content.substring(0, 150)}...</p>
                <a href="#" class="accent">Ler mais ></a>
            `;
            blogContainer.appendChild(postEl);
        });
        reveal();
    });
}

// --- Q&A Logic ---
document.getElementById('qaForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;

    await addDoc(collection(db, "questions"), {
        userId: user.uid,
        userName: user.displayName || user.email,
        text: document.getElementById('questionText').value,
        status: 'pending',
        createdAt: new Date()
    });
    
    alert('Pergunta enviada com sucesso! O Emilio responderá em breve.');
    e.target.reset();
});

// --- Scroll Reveal Animation ---
function reveal() {
    const reveals = document.querySelectorAll(".reveal");
    reveals.forEach(el => {
        const windowHeight = window.innerHeight;
        const elementTop = el.getBoundingClientRect().top;
        const elementVisible = 150;
        if (elementTop < windowHeight - elementVisible) {
            el.classList.add("active");
        }
    });
}

window.addEventListener("scroll", reveal);
document.addEventListener('DOMContentLoaded', () => {
    reveal();
    loadDynamicContent();
});
