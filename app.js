import { auth, db } from "./firebase-config.js";
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    getDocs, 
    addDoc, 
    deleteDoc, 
    updateDoc, 
    query, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ====== ESTADO GLOBAL ======
let currentUser = null;
let currentRole = "user";

// ====== ELEMENTOS DOM ======
const navLogin = document.getElementById("nav-login");
const navLogout = document.getElementById("nav-logout");
const navAdmin = document.getElementById("nav-admin");
const navPerguntas = document.getElementById("nav-perguntas");

const secLogin = document.getElementById("login");
const secAdmin = document.getElementById("admin");
const secPerguntas = document.getElementById("perguntas");

// ====== FUNÇÕES DA SPA ======
function showSection(id) {
    if (id === 'login') secLogin.style.display = 'block';
    if (id === 'admin') secAdmin.style.display = 'block';
    if (id === 'perguntas') secPerguntas.style.display = 'block';
    
    // Rola para a seção após 100ms para dar tempo do display block renderizar
    setTimeout(() => {
        document.getElementById(id).scrollIntoView({ behavior: 'smooth' });
    }, 100);
}

// Navegação customizada para os itens dinâmicos
navLogin.addEventListener("click", (e) => { e.preventDefault(); showSection('login'); });
navAdmin.addEventListener("click", (e) => { e.preventDefault(); showSection('admin'); });
navPerguntas.addEventListener("click", (e) => { e.preventDefault(); showSection('perguntas'); });

// ====== OBSERVAR STATUS DE AUTENTICAÇÃO ======
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Logado
        currentUser = user;
        navLogin.style.display = "none";
        navLogout.style.display = "block";
        secLogin.style.display = "none";
        navPerguntas.style.display = "block"; // Libera o link e a seção

        // Buscar role no Firestore
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            currentRole = userDoc.data().role;
            if (currentRole === "admin") {
                navAdmin.style.display = "block";
                carregarProjetosAdmin();
                carregarUsuarios();
                carregarTodasPerguntas();
            } else {
                navAdmin.style.display = "none";
                secAdmin.style.display = "none";
            }
        }
        carregarMinhasPerguntas();
    } else {
        // Deslogado
        currentUser = null;
        currentRole = "user";
        navLogin.style.display = "block";
        navLogout.style.display = "none";
        navAdmin.style.display = "none";
        navPerguntas.style.display = "none";
        secAdmin.style.display = "none";
        secPerguntas.style.display = "none";
    }
});

// Logout
navLogout.addEventListener("click", async (e) => {
    e.preventDefault();
    await signOut(auth);
    alert("Você saiu da sua conta.");
    window.location.href = "#home";
});

// ====== LÓGICA DE LOGIN/REGISTRO ======
let isRegistering = false;
const toggleAuth = document.getElementById("toggle-auth");
const nameGroup = document.getElementById("name-group");
const authTitle = document.getElementById("auth-title");
const authSubmit = document.getElementById("auth-submit");
const authForm = document.getElementById("auth-form");

toggleAuth.addEventListener("click", (e) => {
    e.preventDefault();
    isRegistering = !isRegistering;
    if (isRegistering) {
        authTitle.innerText = "Cadastre-se";
        authSubmit.innerText = "Criar Conta";
        nameGroup.style.display = "block";
        toggleAuth.innerHTML = "Já tem conta? <span style='color: var(--accent)'>Faça o login</span>";
    } else {
        authTitle.innerText = "Login";
        authSubmit.innerText = "Entrar";
        nameGroup.style.display = "none";
        toggleAuth.innerHTML = "Não tem conta? <span style='color: var(--accent)'>Cadastre-se</span>";
    }
});

authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("auth-email").value;
    const senha = document.getElementById("auth-senha").value;
    
    try {
        if (isRegistering) {
            const nome = document.getElementById("auth-nome").value;
            const userCred = await createUserWithEmailAndPassword(auth, email, senha);
            // Salvar no Firestore
            await setDoc(doc(db, "users", userCred.user.uid), {
                uid: userCred.user.uid,
                nome: nome,
                email: email,
                role: "user",
                dataCadastro: new Date().toISOString()
            });
            alert("Conta criada com sucesso!");
        } else {
            await signInWithEmailAndPassword(auth, email, senha);
            alert("Login realizado com sucesso!");
        }
        showSection("perguntas"); // Redireciona visualmente
        authForm.reset();
    } catch (error) {
        console.error(error);
        alert("Erro na autenticação: " + error.message);
    }
});

// ====== RENDERIZAR CASE STUDIES PÚBLICOS ======
async function carregarProjetosPublicos() {
    const lista = document.getElementById("projetos-lista");
    if(!lista) return;

    try {
        const q = query(collection(db, "projetos"));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            lista.innerHTML = "<p>Nenhum projeto disponível no momento.</p>";
            return;
        }

        let html = "";
        snapshot.forEach((doc) => {
            const p = doc.data();
            const id = doc.id;
            html += `
                <div class="card reveal active">
                    ${p.imagemURL ? `<img src="${p.imagemURL}" alt="${p.titulo}" style="width:100%; border-radius: 8px; margin-bottom:1rem; aspect-ratio: 16/9; object-fit: cover;">` : ''}
                    <div class="tech-stack" style="margin-bottom:1rem;">
                        ${p.tags ? p.tags.split(',').map(t => `<span class="badge">${t.trim()}</span>`).join('') : ''}
                    </div>
                    <h3>${p.titulo}</h3>
                    <p style="margin-bottom:1rem;">${p.descricao}</p>
                    ${p.link ? `<a href="${p.link}" target="_blank" class="btn-outline" style="display:inline-block">Ver Projeto</a>` : ''}
                </div>
            `;
        });
        lista.innerHTML = html;
    } catch (e) {
        console.error("Erro ao carregar projetos públicos", e);
    }
}
// Chamar ao carregar a página
carregarProjetosPublicos();

// ====== LÓGICA DE PERGUNTAS (USUÁRIO) ======
const formPergunta = document.getElementById("pergunta-form");
formPergunta.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const texto = document.getElementById("pergunta-texto").value;
    
    // Obter o nome do usuário
    let nomeAutor = currentUser.email;
    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
    if(userDoc.exists()) nomeAutor = userDoc.data().nome || nomeAutor;

    try {
        await addDoc(collection(db, "perguntas"), {
            uid: currentUser.uid,
            nome: nomeAutor,
            texto: texto,
            dataHora: new Date().toISOString(),
            status: "pendente"
        });
        alert("Pergunta enviada com sucesso!");
        formPergunta.reset();
        carregarMinhasPerguntas();
    } catch (error) {
        alert("Erro ao enviar: " + error.message);
    }
});

async function carregarMinhasPerguntas() {
    if (!currentUser) return;
    const div = document.getElementById("lista-minhas-perguntas");
    try {
        const q = query(collection(db, "perguntas"));
        const snapshot = await getDocs(q);
        let html = "<h4>Seus últimos envios:</h4>";
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.uid === currentUser.uid) {
                html += `
                    <div style="border-left: 2px solid var(--accent); padding-left: 15px; margin-bottom: 15px; background: rgba(0,255,136,0.05); padding: 10px; border-radius: 4px;">
                        <p style="margin-bottom:5px;">${data.texto}</p>
                        <small style="color: var(--text-muted)">Status: <strong style="color: var(--text-bright)">${data.status}</strong> - Enviado em: ${new Date(data.dataHora).toLocaleString()}</small>
                    </div>
                `;
            }
        });
        div.innerHTML = html === "<h4>Seus últimos envios:</h4>" ? "<p>Você ainda não fez nenhuma pergunta.</p>" : html;
    } catch(e) { console.error(e); }
}

// ====== DASHBOARD ADMIN ======
// Mudar Tabs
document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        document.querySelectorAll(".tab-content").forEach(c => c.style.display = "none");
        
        btn.classList.add("active");
        document.getElementById(btn.dataset.tab).style.display = "block";
    });
});

// Admin: Criar Projeto
const formProjeto = document.getElementById("form-novo-projeto");
formProjeto.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (currentRole !== "admin") return;

    const titulo = document.getElementById("proj-titulo").value;
    const tags = document.getElementById("proj-tags").value;
    const link = document.getElementById("proj-link").value;
    const descricao = document.getElementById("proj-descricao").value;
    const imagemURL = document.getElementById("proj-imagem").value;

    try {
        authSubmit.innerText = "Salvando...";

        await addDoc(collection(db, "projetos"), {
            titulo, tags, link, descricao, imagemURL,
            dataCriacao: new Date().toISOString()
        });

        alert("Projeto salvo com sucesso!");
        formProjeto.reset();
        carregarProjetosPublicos(); // Atualiza a public
        carregarProjetosAdmin(); // Atualiza a lista no admin (se implementasse lista lá, mas atualizar public ja vale)
    } catch (e) {
        console.error(e);
        alert("Erro ao salvar projeto: " + e.message);
    }
});

// Admin: Gerenciar Usuarios
async function carregarUsuarios() {
    if (currentRole !== "admin") return;
    const tbody = document.getElementById("tabela-usuarios");
    try {
        const snapshot = await getDocs(collection(db, "users"));
        let html = "";
        snapshot.forEach(docSnap => {
            const u = docSnap.data();
            const id = docSnap.id;
            html += `
                <tr>
                    <td>${u.nome || '-'}</td>
                    <td>${u.email}</td>
                    <td>
                        <select onchange="window.mudarRole('${id}', this.value)" style="background: var(--bg-dark); color: white; padding: 4px; border: 1px solid var(--border-color)">
                            <option value="user" ${u.role === 'user' ? 'selected':''}>User</option>
                            <option value="admin" ${u.role === 'admin' ? 'selected':''}>Admin</option>
                        </select>
                    </td>
                    <td>
                        <button class="action-btn delete" onclick="window.deletarUsuario('${id}')">Deletar</button>
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    } catch(e) { console.error(e); }
}

// Admin: Gerenciar Perguntas
async function carregarTodasPerguntas() {
    if (currentRole !== "admin") return;
    const div = document.getElementById("lista-todas-perguntas");
    try {
        const snapshot = await getDocs(collection(db, "perguntas"));
        let html = "";
        snapshot.forEach(docSnap => {
            const p = docSnap.data();
            const id = docSnap.id;
            html += `
                <div style="border: 1px solid var(--border-color); padding: 15px; margin-bottom: 10px; border-radius: 8px;">
                    <p><strong>De:</strong> ${p.nome}</p>
                    <p><strong>Pergunta:</strong> ${p.texto}</p>
                    <div style="margin-top: 10px; display: flex; gap: 10px; align-items: center;">
                        <span style="font-size: 0.85rem">Status atual:</span>
                        <select onchange="window.mudarStatusPergunta('${id}', this.value)" style="background: var(--bg-dark); color: white; padding: 4px;">
                            <option value="pendente" ${p.status === 'pendente'?'selected':''}>Pendente</option>
                            <option value="respondida" ${p.status === 'respondida'?'selected':''}>Respondida</option>
                            <option value="arquivada" ${p.status === 'arquivada'?'selected':''}>Arquivada</option>
                        </select>
                        <button class="action-btn delete" onclick="window.deletarPergunta('${id}')">Apagar</button>
                    </div>
                </div>
            `;
        });
        div.innerHTML = html || "<p>Nenhuma pergunta no sistema.</p>";
    } catch(e) { console.error(e); }
}

// Funções globais para botoes da tabela admin
window.mudarRole = async (uid, novoRole) => {
    try {
        await updateDoc(doc(db, "users", uid), { role: novoRole });
        alert("Role atualizada!");
    } catch(e) { alert("Erro: " + e.message); }
}

window.deletarUsuario = async (uid) => {
    if(confirm("Excluir os dados deste usuário? (Ele perderá acesso às áreas restritas)")) {
        try {
            await deleteDoc(doc(db, "users", uid));
            carregarUsuarios();
        } catch(e) { alert("Erro: " + e.message); }
    }
}

window.mudarStatusPergunta = async (pid, novoStatus) => {
    try {
        await updateDoc(doc(db, "perguntas", pid), { status: novoStatus });
    } catch(e) { alert("Erro: " + e.message); }
}

window.deletarPergunta = async (pid) => {
    if(confirm("Certeza que deseja deletar?")) {
        try {
            await deleteDoc(doc(db, "perguntas", pid));
            carregarTodasPerguntas();
        } catch(e) { alert("Erro: " + e.message); }
    }
}

// Apenas um stub para evitar erro
function carregarProjetosAdmin() {} 
