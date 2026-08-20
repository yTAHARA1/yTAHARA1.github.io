import { auth, db } from "./firebase-config.js";
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    sendPasswordResetEmail
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
    orderBy,
    onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ====== UTILITÁRIO GERAL ======
function escapeHTML(str) {
    if (!str) return '';
    return str.toString()
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

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

// ====== MENU BAR (MOBILE) ======
const menuToggle = document.getElementById("menu-toggle");
const navLinksContainer = document.getElementById("nav-links");

if (menuToggle && navLinksContainer) {
    const mobileMenu = window.matchMedia("(max-width: 960px)");

    const setMenuState = (open) => {
        navLinksContainer.classList.toggle("active", open);
        menuToggle.setAttribute("aria-expanded", String(open));
        menuToggle.setAttribute("aria-label", open ? "Fechar menu" : "Abrir menu");
        menuToggle.textContent = open ? "×" : "☰";
        document.body.classList.toggle("nav-open", open && mobileMenu.matches);
    };

    menuToggle.addEventListener("click", () => {
        setMenuState(!navLinksContainer.classList.contains("active"));
    });

    // Fechar menu ao clicar em um link mobile
    navLinksContainer.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => {
            if (mobileMenu.matches) setMenuState(false);
        });
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && navLinksContainer.classList.contains("active")) {
            setMenuState(false);
            menuToggle.focus();
        }
    });

    document.addEventListener("click", (event) => {
        if (mobileMenu.matches && navLinksContainer.classList.contains("active") &&
            !event.target.closest(".nav-content")) {
            setMenuState(false);
        }
    });

    mobileMenu.addEventListener("change", () => setMenuState(false));
}

const siteHeader = document.querySelector(".header");
const updateHeader = () => siteHeader?.classList.toggle("scrolled", window.scrollY > 12);
window.addEventListener("scroll", updateHeader, { passive: true });
updateHeader();

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
                carregarCertificadosAdmin();
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

const toggleAuth        = document.getElementById("toggle-auth");
const authSwitchLabel   = document.getElementById("auth-switch-label");
const nameGroup         = document.getElementById("name-group");
const authTitle         = document.getElementById("auth-title");
const authSubmit        = document.getElementById("auth-submit");
const authForm          = document.getElementById("auth-form");
const authForgotWrap    = document.getElementById("auth-forgot-wrap");
const authForgotLink    = document.getElementById("auth-forgot-link");
const authVerifyBanner  = document.getElementById("auth-verify-banner");
const authResendVerify  = document.getElementById("auth-resend-verify");
const captchaQuestion   = document.getElementById("captcha-question");
const captchaAnswer     = document.getElementById("captcha-answer");

// ---- Captcha matemático ----
let captchaExpected = 0;

function gerarCaptcha() {
    const ops = ['+', '-', '×'];
    const op = ops[Math.floor(Math.random() * ops.length)];
    let a, b, result;
    if (op === '+') {
        a = Math.floor(Math.random() * 10) + 1;
        b = Math.floor(Math.random() * 10) + 1;
        result = a + b;
    } else if (op === '-') {
        a = Math.floor(Math.random() * 10) + 5;
        b = Math.floor(Math.random() * (a - 1)) + 1;
        result = a - b;
    } else {
        a = Math.floor(Math.random() * 5) + 1;
        b = Math.floor(Math.random() * 5) + 1;
        result = a * b;
    }
    captchaExpected = result;
    if (captchaQuestion) captchaQuestion.textContent = `${a} ${op} ${b} = ?`;
    if (captchaAnswer) captchaAnswer.value = "";
}

gerarCaptcha(); // Gera captcha inicial

// ---- Alternar Login / Cadastro ----
toggleAuth.addEventListener("click", (e) => {
    e.preventDefault();
    isRegistering = !isRegistering;
    if (authVerifyBanner) authVerifyBanner.classList.remove("visible");
    if (isRegistering) {
        authTitle.innerText = "Cadastre-se";
        authSubmit.innerText = "Criar Conta";
        nameGroup.style.display = "block";
        if (authSwitchLabel) authSwitchLabel.innerText = "Já tem conta?";
        toggleAuth.innerText = "Faça o login";
        if (authForgotWrap) authForgotWrap.style.display = "none";
    } else {
        authTitle.innerText = "Login";
        authSubmit.innerText = "Entrar";
        nameGroup.style.display = "none";
        if (authSwitchLabel) authSwitchLabel.innerText = "Não tem conta?";
        toggleAuth.innerText = "Cadastre-se";
        if (authForgotWrap) authForgotWrap.style.display = "";
    }
    gerarCaptcha();
});

// ---- Esqueci minha senha ----
if (authForgotLink) {
    authForgotLink.addEventListener("click", async (e) => {
        e.preventDefault();
        const email = document.getElementById("auth-email").value.trim();
        if (!email) {
            alert("Digite seu e-mail no campo acima primeiro.");
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            alert(`E-mail de redefinição de senha enviado para ${email}. Verifique sua caixa de entrada.`);
        } catch (error) {
            console.error(error);
            alert("Erro ao enviar e-mail de redefinição: " + error.message);
        }
    });
}

// ---- Reenviar verificação de e-mail ----
if (authResendVerify) {
    authResendVerify.addEventListener("click", async (e) => {
        e.preventDefault();
        if (auth.currentUser && !auth.currentUser.emailVerified) {
            try {
                await auth.currentUser.sendEmailVerification();
                alert("E-mail de verificação reenviado! Verifique sua caixa de entrada.");
            } catch (error) {
                alert("Erro ao reenviar: " + error.message);
            }
        }
    });
}

// ---- Submit do formulário ----
authForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = document.getElementById("auth-email").value.trim();
    const senha = document.getElementById("auth-senha").value.trim();

    // Validação básica
    if (!email || !senha) {
        alert("E-mail e senha são obrigatórios!");
        return;
    }
    if (senha.length < 8) {
        alert("Sua senha precisa ter pelo menos 8 caracteres.");
        return;
    }

    // Validação do captcha
    const respostaCaptcha = parseInt(captchaAnswer ? captchaAnswer.value : "NaN", 10);
    if (isNaN(respostaCaptcha) || respostaCaptcha !== captchaExpected) {
        alert("Resposta do captcha incorreta. Tente novamente.");
        gerarCaptcha();
        return;
    }

    try {
        if (isRegistering) {
            const nome = document.getElementById("auth-nome").value.trim();
            if (!nome) { alert("O nome é obrigatório para cadastro."); return; }

            const userCred = await createUserWithEmailAndPassword(auth, email, senha);

            // Enviar e-mail de verificação
            await userCred.user.sendEmailVerification();

            // Salvar no Firestore
            await setDoc(doc(db, "users", userCred.user.uid), {
                uid: userCred.user.uid,
                nome: nome,
                email: email,
                role: "user",
                emailVerified: false,
                dataCadastro: new Date().toISOString()
            });

            // Mostrar banner de verificação
            if (authVerifyBanner) authVerifyBanner.classList.add("visible");
            authTitle.innerText = "Login";
            authSubmit.innerText = "Entrar";
            nameGroup.style.display = "none";
            isRegistering = false;
            if (authSwitchLabel) authSwitchLabel.innerText = "Não tem conta?";
            toggleAuth.innerText = "Cadastre-se";
            if (authForgotWrap) authForgotWrap.style.display = "";

        } else {
            const userCred = await signInWithEmailAndPassword(auth, email, senha);

            // Verificar se e-mail foi confirmado
            if (!userCred.user.emailVerified) {
                if (authVerifyBanner) authVerifyBanner.classList.add("visible");
                await signOut(auth);
                alert("Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.");
                gerarCaptcha();
                return;
            }

            showSection("perguntas");
        }

        authForm.reset();
        gerarCaptcha();

    } catch (error) {
        console.error(error);
        let msg = "Erro na autenticação.";
        if (error.code === "auth/user-not-found" || error.code === "auth/wrong-password" || error.code === "auth/invalid-credential") {
            msg = "E-mail ou senha incorretos.";
        } else if (error.code === "auth/email-already-in-use") {
            msg = "Este e-mail já está cadastrado. Faça o login.";
        } else if (error.code === "auth/invalid-email") {
            msg = "E-mail inválido.";
        } else if (error.code === "auth/too-many-requests") {
            msg = "Muitas tentativas. Tente novamente em alguns minutos.";
        } else {
            msg = error.message;
        }
        alert(msg);
        gerarCaptcha();
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
                <div class="window-pane reveal active" tabindex="0">
                    <div class="window-header">
                        <div class="window-controls">
                            <span class="control-dot close"></span>
                            <span class="control-dot minimize"></span>
                            <span class="control-dot maximize"></span>
                        </div>
                        <span class="window-title">case_study_${id.substring(0, 6)}.json</span>
                    </div>
                    <div class="window-body">
                        ${p.imagemURL ? `<img src="${escapeHTML(p.imagemURL)}" alt="${escapeHTML(p.titulo)}" style="width:100%; border-radius: 8px; margin-bottom:1rem; aspect-ratio: 16/9; object-fit: cover;">` : ''}
                        <div class="tech-stack" style="margin-bottom:1rem;">
                            ${p.tags ? escapeHTML(p.tags).split(',').map(t => `<span class="badge">${t.trim()}</span>`).join('') : ''}
                        </div>
                        <h3>${escapeHTML(p.titulo)}</h3>
                        <p style="margin-bottom:1rem;">${escapeHTML(p.descricao)}</p>
                        ${p.link ? `<a href="${escapeHTML(p.link)}" target="_blank" rel="noopener noreferrer" class="btn-outline" style="display:inline-block">Ver Projeto</a>` : ''}
                    </div>
                </div>
            `;
        });
        lista.innerHTML = html;
    } catch (e) {
        console.error("Erro ao carregar projetos públicos", e);
    }
}

// ====== RENDERIZAR Q&A PÚBLICO ======
function carregarQnAPublico() {
    const lista = document.getElementById("qna-public-lista");
    const heading = document.getElementById("qna-public-heading");
    if(!lista) return;

    const q = query(collection(db, "perguntas"));
    onSnapshot(q, (snapshot) => {
        let html = "";
        let count = 0;
        snapshot.forEach((doc) => {
            const p = doc.data();
            if (p.status === "respondida") {
                count++;
                html += `
                    <div class="window-pane reveal active" style="border-left: 3px solid var(--accent-green); display: flex; flex-direction: column; justify-content: space-between;" tabindex="0">
                        <div class="window-header">
                            <div class="window-controls">
                                <span class="control-dot close"></span>
                                <span class="control-dot minimize"></span>
                                <span class="control-dot maximize"></span>
                            </div>
                            <span class="window-title">qna_public_${doc.id.substring(0, 6)}.log</span>
                        </div>
                        <div class="window-body" style="display: flex; flex-direction: column; justify-content: space-between; height: 100%;">
                            <div>
                                <div style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 10px; text-transform: uppercase;">A Comunidade Perguntou</div>
                                <h3 style="font-size: 1.25rem; margin-bottom: 1.5rem; line-height: 1.4;">"${escapeHTML(p.texto)}"</h3>
                            </div>
                            <p style="color: var(--text-primary); background: rgba(0, 255, 127, 0.03); padding: 15px; border-radius: 6px; border: 1px solid rgba(0, 255, 127, 0.1); margin-top: auto;"><strong>Emilio Tahara responde:</strong><br><br>${escapeHTML(p.resposta || '')}</p>
                        </div>
                    </div>
                `;
            }
        });
        if (count > 0) {
            lista.innerHTML = html;
            lista.style.display = "grid";
            if (heading) heading.style.display = "block";
        } else {
            lista.style.display = "none";
            if (heading) heading.style.display = "none";
        }
    }, (error) => {
        console.error("Erro ao carregar QnA em Tempo Real", error);
    });
}
window.carregarQnAPublico = carregarQnAPublico;
carregarQnAPublico();

// Chamar ao carregar a página
carregarProjetosPublicos();

async function carregarCertificadosPublicos() {
    const lista = document.getElementById("certificados-lista");
    if(!lista) return;

    try {
        const q = query(collection(db, "certificados"));
        const snapshot = await getDocs(q);
        
        if (snapshot.empty) {
            lista.innerHTML = "<p>Nenhum certificado cadastrado no momento.</p>";
            return;
        }

        let html = "";
        snapshot.forEach((doc) => {
            const c = doc.data();
            html += `
                <div class="window-pane reveal active" tabindex="0">
                    <div class="window-header">
                        <div class="window-controls">
                            <span class="control-dot close"></span>
                            <span class="control-dot minimize"></span>
                            <span class="control-dot maximize"></span>
                        </div>
                        <span class="window-title">certificate_${doc.id.substring(0, 6)}.crt</span>
                    </div>
                    <div class="window-body">
                        ${c.imagemURL ? `<img src="${escapeHTML(c.imagemURL)}" alt="${escapeHTML(c.titulo)}" style="width:100%; border-radius: 8px; margin-bottom:1rem; aspect-ratio: 16/9; object-fit: cover;">` : ''}
                        <div class="tech-stack" style="margin-bottom:1rem;">
                            <span class="badge" style="background: rgba(255,255,255,0.05); color: var(--text-primary)">${escapeHTML(c.emissor)}</span>
                        </div>
                        <h3 style="margin-bottom: 1rem;">${escapeHTML(c.titulo)}</h3>
                        ${c.link ? `<a href="${escapeHTML(c.link)}" target="_blank" rel="noopener noreferrer" class="btn-outline" style="display:inline-block">Verificar Autenticidade</a>` : ''}
                    </div>
                </div>
            `;
        });
        lista.innerHTML = html;
    } catch (e) {
        console.error("Erro ao carregar certificados públicos", e);
    }
}
carregarCertificadosPublicos();

// ====== LÓGICA DE PERGUNTAS (USUÁRIO) ======
const formPergunta = document.getElementById("pergunta-form");
formPergunta.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser) return;

    const texto = document.getElementById("pergunta-texto").value.trim();
    if (!texto || texto.length > 1000) {
        alert("Sua pergunta não pode estar vazia e o limite é de 1000 caracteres.");
        return;
    }
    
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
                        <p style="margin-bottom:5px;">${escapeHTML(data.texto)}</p>
                        <small style="color: var(--text-muted)">Status: <strong style="color: var(--text-bright)">${escapeHTML(data.status)}</strong> - Enviado em: ${new Date(data.dataHora).toLocaleString()}</small>
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

// Admin: Criar/Editar Projeto
const formProjeto = document.getElementById("form-novo-projeto");
const btnSubmitProj = document.getElementById("proj-btn-submit");

formProjeto.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (currentRole !== "admin") return;

    const id = document.getElementById("proj-id").value;
    const titulo = document.getElementById("proj-titulo").value;
    const tags = document.getElementById("proj-tags").value;
    const link = document.getElementById("proj-link").value;
    const descricao = document.getElementById("proj-descricao").value;
    const imagemURL = document.getElementById("proj-imagem").value;

    try {
        btnSubmitProj.innerText = "Salvando...";

        if (id) {
            // Editando
            await updateDoc(doc(db, "projetos", id), {
                titulo, tags, link, descricao, imagemURL,
                dataAtualizacao: new Date().toISOString()
            });
            alert("Projeto atualizado com sucesso!");
        } else {
            // Criando novo
            await addDoc(collection(db, "projetos"), {
                titulo, tags, link, descricao, imagemURL,
                dataCriacao: new Date().toISOString()
            });
            alert("Projeto salvo com sucesso!");
        }

        window.cancelarEdicao(); // limpa o form
        carregarProjetosPublicos();
        carregarProjetosAdmin();
    } catch (e) {
        console.error(e);
        alert("Erro ao salvar projeto: " + e.message);
    } finally {
        btnSubmitProj.innerText = id ? "Atualizar Projeto" : "Salvar Projeto";
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
                    <td>${escapeHTML(u.nome || '-')}</td>
                    <td>${escapeHTML(u.email)}</td>
                    <td>
                        <select onchange="window.mudarRole('${id}', this.value)" style="background: var(--bg-dark); color: white; padding: 4px; border: 1px solid var(--border-color)">
                            <option value="user" ${u.role === 'user' ? 'selected':''}>User</option>
                            <option value="admin" ${u.role === 'admin' ? 'selected':''}>Admin</option>
                        </select>
                    </td>
                    <td>
                        <button class="action-btn" style="color:var(--text-bright); border:1px solid var(--border-color); padding:4px 8px; border-radius:4px;" onclick="window.enviarRedefinicaoSenha('${u.email}')">Reset Senha</button>
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
                    <p><strong>De:</strong> ${escapeHTML(p.nome)}</p>
                    <p><strong>Pergunta:</strong> ${escapeHTML(p.texto)}</p>
                    ${p.status === 'respondida' ? `<div style="margin-top: 10px; padding: 10px; background: var(--bg-dark); border-left: 2px solid var(--accent);"><small style="color:var(--text-muted)">Sua Resposta Publicada:</small><br> ${escapeHTML(p.resposta)}</div>` : ''}
                    
                    <div style="margin-top: 15px; display: flex; flex-direction: column; gap: 10px;">
                        ${p.status !== 'respondida' ? `
                            <textarea id="resp-${id}" rows="3" style="width:100%; padding: 10px; background: var(--bg-dark); color: var(--text-bright); border: 1px solid var(--border-color); border-radius:6px; font-family: inherit;" placeholder="Escreva a solução/resposta aqui..."></textarea>
                            <button class="btn-primary" style="padding: 8px 16px; font-size: 0.9rem; max-width: 250px;" onclick="window.responderPergunta('${id}')">Salvar Resposta e Publicar</button>
                        ` : ''}
                        
                        <div style="display: flex; gap: 10px; align-items: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-color);">
                            <span style="font-size: 0.85rem">Status atual:</span>
                            <select onchange="window.mudarStatusPergunta('${id}', this.value)" style="background: var(--bg-dark); color: white; padding: 4px; border: 1px solid var(--border-color)">
                                <option value="pendente" ${p.status === 'pendente'?'selected':''}>Pendente</option>
                                <option value="respondida" ${p.status === 'respondida'?'selected':''}>Respondida</option>
                                <option value="arquivada" ${p.status === 'arquivada'?'selected':''}>Arquivada</option>
                            </select>
                            <button class="action-btn delete" onclick="window.deletarPergunta('${id}')">Apagar</button>
                        </div>
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

window.enviarRedefinicaoSenha = async (emailUsuario) => {
    if(confirm(`Enviar um link oficial do Google para ${emailUsuario} redefinir sua senha?`)) {
        try {
            await sendPasswordResetEmail(auth, emailUsuario);
            alert("Sucesso! O Firebase enviou um e-mail de redefinição de senha para esse usuário.");
        } catch(e) { alert("Erro ao enviar: " + e.code); }
    }
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

window.responderPergunta = async (pid) => {
    const textarea = document.getElementById("resp-" + pid);
    if (!textarea || !textarea.value.trim()) {
        alert("Você precisa digitar uma resposta antes de publicar.");
        return;
    }
    
    try {
        await updateDoc(doc(db, "perguntas", pid), { 
            status: "respondida",
            resposta: textarea.value.trim()
        });
        carregarTodasPerguntas(); // Atualiza tab admin
        alert("Resposta publicada com sucesso!");
    } catch(e) { alert("Erro ao salvar: " + e.message); }
}

window.deletarPergunta = async (pid) => {
    if(confirm("Certeza que deseja deletar?")) {
        try {
            await deleteDoc(doc(db, "perguntas", pid));
            carregarTodasPerguntas();
        } catch(e) { alert("Erro: " + e.message); }
    }
}

// Admin: Tabela de Projetos
async function carregarProjetosAdmin() {
    if (currentRole !== "admin") return;
    const div = document.getElementById("tabela-projetos-admin");
    try {
        const snapshot = await getDocs(collection(db, "projetos"));
        let html = "";
        
        let projetosArray = [];
        snapshot.forEach(docSnap => projetosArray.push({ id: docSnap.id, ...docSnap.data() }));

        projetosArray.forEach(p => {
            // Escapar aspas duplas caso existam no título para não quebrar a chamada JSON
            const safeObj = encodeURIComponent(JSON.stringify(p));
            html += `
                <div style="border: 1px solid var(--border-color); padding: 15px; margin-bottom: 10px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${escapeHTML(p.titulo)}</strong>
                        <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">Tags: ${escapeHTML(p.tags || '-')}</div>
                    </div>
                    <div>
                        <button class="action-btn" onclick="window.prepararEdicao('${safeObj}')">Editar</button>
                        <button class="action-btn delete" onclick="window.deletarProjeto('${p.id}')">Excluir</button>
                    </div>
                </div>
            `;
        });
        div.innerHTML = html || "<p>Nenhum projeto postado.</p>";
    } catch(e) { console.error(e); }
}

window.prepararEdicao = (encodedObj) => {
    const p = JSON.parse(decodeURIComponent(encodedObj));
    
    document.getElementById("form-proj-title").innerText = "Atualizar Case Study";
    document.getElementById("proj-id").value = p.id;
    document.getElementById("proj-titulo").value = p.titulo || "";
    document.getElementById("proj-tags").value = p.tags || "";
    document.getElementById("proj-link").value = p.link || "";
    document.getElementById("proj-imagem").value = p.imagemURL || "";
    document.getElementById("proj-descricao").value = p.descricao || "";
    
    document.getElementById("proj-btn-submit").innerText = "Atualizar Projeto";
    document.getElementById("proj-btn-cancelar").style.display = "inline-block";
    
    // Rolar para cima (onde o form está)
    document.getElementById("form-proj-title").scrollIntoView({ behavior: 'smooth' });
}

window.cancelarEdicao = () => {
    document.getElementById("form-novo-projeto").reset();
    document.getElementById("proj-id").value = "";
    document.getElementById("form-proj-title").innerText = "Adicionar Novo Case Study";
    document.getElementById("proj-btn-submit").innerText = "Salvar Projeto";
    document.getElementById("proj-btn-cancelar").style.display = "none";
}

window.deletarProjeto = async (pid) => {
    if(confirm("Tem absoluta certeza de que deseja EXCLUIR este Case Study do site?")) {
        try {
            await deleteDoc(doc(db, "projetos", pid));
            alert("Projeto excluído.");
            carregarProjetosPublicos();
            carregarProjetosAdmin();
            window.cancelarEdicao(); // limpa edições se estiver editando este
        } catch(e) { alert("Erro: " + e.message); }
    }
}

// Admin: Criar/Editar Certificado
const formCertificado = document.getElementById("form-novo-certificado");
const btnSubmitCert = document.getElementById("cert-btn-submit");

if(formCertificado) {
    formCertificado.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (currentRole !== "admin") return;

        const id = document.getElementById("cert-id").value;
        const titulo = document.getElementById("cert-titulo").value;
        const emissor = document.getElementById("cert-emissor").value;
        const link = document.getElementById("cert-link").value;
        const imagemURL = document.getElementById("cert-imagem").value;

        try {
            btnSubmitCert.innerText = "Salvando...";

            if (id) {
                await updateDoc(doc(db, "certificados", id), {
                    titulo, emissor, link, imagemURL,
                    dataAtualizacao: new Date().toISOString()
                });
                alert("Certificado atualizado com sucesso!");
            } else {
                await addDoc(collection(db, "certificados"), {
                    titulo, emissor, link, imagemURL,
                    dataCriacao: new Date().toISOString()
                });
                alert("Certificado salvo com sucesso!");
            }

            window.cancelarEdicaoCertificado();
            carregarCertificadosPublicos();
            carregarCertificadosAdmin();
        } catch (e) {
            alert("Erro ao salvar certificado: " + e.message);
        } finally {
            btnSubmitCert.innerText = id ? "Atualizar Certificado" : "Salvar Certificado";
        }
    });
}

// Admin: Tabela de Certificados
async function carregarCertificadosAdmin() {
    if (currentRole !== "admin") return;
    const div = document.getElementById("tabela-certificados-admin");
    if(!div) return;
    try {
        const snapshot = await getDocs(collection(db, "certificados"));
        let html = "";
        
        let arr = [];
        snapshot.forEach(docSnap => arr.push({ id: docSnap.id, ...docSnap.data() }));

        arr.forEach(c => {
            const safeObj = encodeURIComponent(JSON.stringify(c));
            html += `
                <div style="border: 1px solid var(--border-color); padding: 15px; margin-bottom: 10px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${escapeHTML(c.titulo)}</strong>
                        <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">Emissor: ${escapeHTML(c.emissor)}</div>
                    </div>
                    <div>
                        <button class="action-btn" onclick="window.prepararEdicaoCertificado('${safeObj}')">Editar</button>
                        <button class="action-btn delete" onclick="window.deletarCertificado('${c.id}')">Excluir</button>
                    </div>
                </div>
            `;
        });
        div.innerHTML = html || "<p>Nenhum certificado postado.</p>";
    } catch(e) { console.error(e); }
}

window.prepararEdicaoCertificado = (encodedObj) => {
    const c = JSON.parse(decodeURIComponent(encodedObj));
    document.getElementById("form-cert-title").innerText = "Atualizar Certificado";
    document.getElementById("cert-id").value = c.id;
    document.getElementById("cert-titulo").value = c.titulo || "";
    document.getElementById("cert-emissor").value = c.emissor || "";
    document.getElementById("cert-link").value = c.link || "";
    document.getElementById("cert-imagem").value = c.imagemURL || "";
    
    document.getElementById("cert-btn-submit").innerText = "Atualizar Certificado";
    document.getElementById("cert-btn-cancelar").style.display = "inline-block";
    document.getElementById("form-cert-title").scrollIntoView({ behavior: 'smooth' });
}

window.cancelarEdicaoCertificado = () => {
    document.getElementById("form-novo-certificado").reset();
    document.getElementById("cert-id").value = "";
    document.getElementById("form-cert-title").innerText = "Adicionar Novo Certificado";
    document.getElementById("cert-btn-submit").innerText = "Salvar Certificado";
    document.getElementById("cert-btn-cancelar").style.display = "none";
}

window.deletarCertificado = async (id) => {
    if(confirm("Tem absoluta certeza de que deseja EXCLUIR este Certificado do site?")) {
        try {
            await deleteDoc(doc(db, "certificados", id));
            alert("Certificado excluído.");
            carregarCertificadosPublicos();
            carregarCertificadosAdmin();
            window.cancelarEdicaoCertificado();
        } catch(e) { alert("Erro: " + e.message); }
    }
}
