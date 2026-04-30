import { auth, db } from './firebase-config.js';
import { 
    collection, 
    getDocs, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    doc, 
    query, 
    orderBy, 
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { logout } from './auth.js';

// --- Navigation ---
const navItems = document.querySelectorAll('.nav-item');
const sections = document.querySelectorAll('.admin-section');

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        const target = item.getAttribute('data-section');
        
        navItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        
        sections.forEach(s => {
            s.classList.remove('active');
            if (s.id === target + 'Section') s.classList.add('active');
        });
    });
});

// --- Logout ---
document.getElementById('logoutBtn').addEventListener('click', logout);

// --- Real-time Stats ---
function updateStats() {
    onSnapshot(collection(db, "users"), (snapshot) => {
        document.getElementById('statUsers').textContent = snapshot.size;
    });
    onSnapshot(collection(db, "projects"), (snapshot) => {
        document.getElementById('statProjects').textContent = snapshot.size;
    });
    onSnapshot(collection(db, "questions"), (snapshot) => {
        const pending = snapshot.docs.filter(d => d.data().status === 'pending').length;
        document.getElementById('statQuestions').textContent = pending;
    });
}

// --- Project Management ---
const projectModal = document.getElementById('projectModal');
const projectForm = document.getElementById('projectForm');

document.getElementById('openAddProjectModal').addEventListener('click', () => {
    projectForm.reset();
    document.getElementById('projectId').value = '';
    document.getElementById('projectModalTitle').textContent = 'Novo Projeto';
    projectModal.classList.add('active');
});

document.querySelectorAll('.closeModal').forEach(btn => {
    btn.addEventListener('click', () => projectModal.classList.remove('active'));
});

// Load Projects
onSnapshot(query(collection(db, "projects"), orderBy("createdAt", "desc")), (snapshot) => {
    const tbody = document.getElementById('projectsListBody');
    tbody.innerHTML = '';
    
    snapshot.forEach((docSnap) => {
        const project = docSnap.data();
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${project.title}</td>
            <td>${project.createdAt?.toDate().toLocaleDateString() || 'N/A'}</td>
            <td>
                <button class="btn-edit" data-id="${docSnap.id}">Editar</button>
                <button class="btn-delete" data-id="${docSnap.id}">Excluir</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    
    // Add event listeners for Edit/Delete
    attachProjectActions();
});

function attachProjectActions() {
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.getAttribute('data-id');
            // Logic to fetch one and open modal
        };
    });
    
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.onclick = async () => {
            const id = btn.getAttribute('data-id');
            if(confirm('Tem certeza?')) await deleteDoc(doc(db, "projects", id));
        };
    });
}

// Save Project
projectForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('projectId').value;
    const projectData = {
        title: document.getElementById('projectTitle').value,
        tags: document.getElementById('projectTags').value.split(',').map(t => t.trim()),
        context: document.getElementById('projectContext').value,
        solution: document.getElementById('projectSolution').value,
        impact: document.getElementById('projectImpact').value,
        updatedAt: new Date()
    };

    if (id) {
        await updateDoc(doc(db, "projects", id), projectData);
    } else {
        projectData.createdAt = new Date();
        await addDoc(collection(db, "projects"), projectData);
    }
    
    projectModal.classList.remove('active');
});

// --- Initialize ---
updateStats();
// TODO: Implement Users, Blog and Questions logic similarly
