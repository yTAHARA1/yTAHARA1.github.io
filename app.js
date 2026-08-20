import { auth, db } from "./firebase-config.js?v=6";
import {
    escapeHTML,
    firebaseErrorMessage,
    formatFirestoreDate,
    questionStatusLabel,
    sanitizePublicUrl
} from "./security-utils.js?v=1";
import { siteAlert, siteConfirm } from "./ui-dialog.js?v=2";
import { 
    createUserWithEmailAndPassword, 
    deleteUser,
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    sendEmailVerification,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-auth.js";
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
    onSnapshot,
    serverTimestamp,
    where
} from "https://www.gstatic.com/firebasejs/12.17.1/firebase-firestore.js";

// ====== UTILITÁRIOS GERAIS ======
function showFirebaseError(error, fallback) {
    console.error(error);
    void siteAlert(firebaseErrorMessage(error, fallback), {
        tone: "error",
        title: "Falha na operação"
    });
}

function sanitizeURL(url) {
    if (!url) return '';
    const trimmed = url.trim();
    // Apenas permitir links absolutos http/https ou caminhos relativos/âncoras seguros
    if (/^(https?:\/\/|\/|#)/i.test(trimmed)) {
        return trimmed;
    }
    return '#';
}

// ====== ESTADO GLOBAL ======
let currentUser = null;
let currentRole = "user";
let registrationInProgress = false;
const projectAdminCache = new Map();
const certificateAdminCache = new Map();

// ====== ELEMENTOS DOM ======
const navLogin = document.getElementById("nav-login");
const navLogout = document.getElementById("nav-logout");
const navAdmin = document.getElementById("nav-admin");
const navPerguntas = document.getElementById("nav-perguntas");

const secLogin = document.getElementById("login");
const secAdmin = document.getElementById("admin");
const secPerguntas = document.getElementById("perguntas");
const authVerifyBanner = document.getElementById("auth-verify-banner");

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
function hideRestrictedAreas() {
    navAdmin.style.display = "none";
    navPerguntas.style.display = "none";
    secAdmin.style.display = "none";
    secPerguntas.style.display = "none";
}

async function applyAuthState(user) {
    if (registrationInProgress) return;

    if (!user) {
        currentUser = null;
        currentRole = "user";
        navLogin.style.display = "block";
        navLogout.style.display = "none";
        hideRestrictedAreas();
        return;
    }

    navLogout.style.display = "block";

    if (!user.emailVerified) {
        currentUser = null;
        currentRole = "user";
        navLogin.style.display = "block";
        secLogin.style.display = "block";
        hideRestrictedAreas();
        authVerifyBanner?.classList.add("visible");
        return;
    }

    try {
        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);

        if (!userDoc.exists()) {
            await siteAlert("Seu perfil não está ativo. Entre em contato com o administrador do site.", {
                tone: "warning",
                title: "Perfil indisponível"
            });
            await signOut(auth);
            return;
        }

        currentUser = user;
        currentRole = userDoc.data().role === "admin" ? "admin" : "user";
        navLogin.style.display = "none";
        navLogout.style.display = "block";
        secLogin.style.display = "none";
        navPerguntas.style.display = "block";
        authVerifyBanner?.classList.remove("visible");

        if (userDoc.data().emailVerified !== true) {
            try {
                await updateDoc(userRef, { emailVerified: true });
            } catch (error) {
                console.warn("Não foi possível sincronizar a verificação do e-mail.", error);
            }
        }

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

        carregarMinhasPerguntas();
    } catch (error) {
        currentUser = null;
        currentRole = "user";
        hideRestrictedAreas();
        showFirebaseError(error, "Não foi possível validar seu perfil. Tente entrar novamente.");
    }
}

onAuthStateChanged(auth, applyAuthState);

// Logout
navLogout.addEventListener("click", async (e) => {
    e.preventDefault();
    await signOut(auth);
    await siteAlert("Você saiu da sua conta.", {
        tone: "success",
        title: "Sessão encerrada"
    });
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
const authResendVerify  = document.getElementById("auth-resend-verify");
const captchaQuestion   = document.getElementById("captcha-question");
const captchaAnswer     = document.getElementById("captcha-answer");
const authPassword      = document.getElementById("auth-senha");

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
        authSubmit.innerText = "Criar conta";
        nameGroup.style.display = "block";
        if (authSwitchLabel) authSwitchLabel.innerText = "Já tem conta?";
        toggleAuth.innerText = "Entrar";
        if (authForgotWrap) authForgotWrap.style.display = "none";
        authPassword?.setAttribute("autocomplete", "new-password");
    } else {
        authTitle.innerText = "Acessar conta";
        authSubmit.innerText = "Entrar";
        nameGroup.style.display = "none";
        if (authSwitchLabel) authSwitchLabel.innerText = "Não tem conta?";
        toggleAuth.innerText = "Cadastre-se";
        if (authForgotWrap) authForgotWrap.style.display = "";
        authPassword?.setAttribute("autocomplete", "current-password");
    }
    gerarCaptcha();
});

// ---- Esqueci minha senha ----
if (authForgotLink) {
    authForgotLink.addEventListener("click", async (e) => {
        e.preventDefault();
        const email = document.getElementById("auth-email").value.trim();
        if (!email) {
            await siteAlert("Digite seu e-mail no campo acima primeiro.", { tone: "warning" });
            return;
        }
        try {
            await sendPasswordResetEmail(auth, email);
            await siteAlert(`E-mail de redefinição de senha enviado para ${email}. Verifique sua caixa de entrada.`, {
                tone: "success",
                title: "E-mail enviado"
            });
        } catch (error) {
            showFirebaseError(error, "Não foi possível enviar o e-mail de redefinição. Tente novamente.");
        }
    });
}

// ---- Reenviar verificação de e-mail ----
if (authResendVerify) {
    authResendVerify.addEventListener("click", async (e) => {
        e.preventDefault();
        if (auth.currentUser && !auth.currentUser.emailVerified) {
            try {
                await sendEmailVerification(auth.currentUser);
                await siteAlert("E-mail de verificação reenviado! Verifique sua caixa de entrada.", {
                    tone: "success",
                    title: "Verificação enviada"
                });
            } catch (error) {
                showFirebaseError(error, "Não foi possível reenviar a verificação. Tente novamente.");
            }
        } else {
            await siteAlert("Entre novamente para solicitar outro e-mail de verificação.", { tone: "warning" });
        }
    });
}

// ---- Submit do formulário ----
authForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Verificação de Honeypot anti-spam
    const honeypot = document.getElementById("auth-honeypot")?.value;
    if (honeypot) {
        console.warn("Autenticação bloqueada: spam detectado (honeypot preenchido).");
        return;
    }

    const email = document.getElementById("auth-email").value.trim();
    const senha = document.getElementById("auth-senha").value.trim();

    // Validação básica
    if (!email || !senha) {
        await siteAlert("E-mail e senha são obrigatórios!", { tone: "warning" });
        return;
    }
    if (senha.length < 8) {
        await siteAlert("Sua senha precisa ter pelo menos 8 caracteres.", { tone: "warning" });
        return;
    }

    // Validação do captcha
    const respostaCaptcha = parseInt(captchaAnswer ? captchaAnswer.value : "NaN", 10);
    if (isNaN(respostaCaptcha) || respostaCaptcha !== captchaExpected) {
        await siteAlert("Resposta do captcha incorreta. Tente novamente.", {
            tone: "warning",
            title: "Verificação incorreta"
        });
        gerarCaptcha();
        return;
    }

    try {
        if (isRegistering) {
            const nome = document.getElementById("auth-nome").value.trim();
            if (!nome) {
                await siteAlert("O nome é obrigatório para cadastro.", { tone: "warning" });
                return;
            }

            registrationInProgress = true;
            let userCred;
            let verificationEmailError = null;
            try {
                userCred = await createUserWithEmailAndPassword(auth, email, senha);

                try {
                    await setDoc(doc(db, "users", userCred.user.uid), {
                        uid: userCred.user.uid,
                        nome,
                        email: userCred.user.email,
                        role: "user",
                        emailVerified: false,
                        dataCadastro: serverTimestamp()
                    });
                } catch (profileError) {
                    try {
                        await deleteUser(userCred.user);
                    } catch (cleanupError) {
                        console.error("Não foi possível desfazer o cadastro incompleto.", cleanupError);
                    }
                    throw profileError;
                }

                try {
                    await sendEmailVerification(userCred.user);
                } catch (emailError) {
                    verificationEmailError = emailError;
                }
            } finally {
                registrationInProgress = false;
            }

            await applyAuthState(userCred.user);

            // Mostrar banner de verificação
            if (authVerifyBanner) authVerifyBanner.classList.add("visible");
            authTitle.innerText = "Acessar conta";
            authSubmit.innerText = "Entrar";
            nameGroup.style.display = "none";
            isRegistering = false;
            if (authSwitchLabel) authSwitchLabel.innerText = "Não tem conta?";
            toggleAuth.innerText = "Cadastre-se";
            if (authForgotWrap) authForgotWrap.style.display = "";
            authPassword?.setAttribute("autocomplete", "current-password");
            if (verificationEmailError) {
                showFirebaseError(verificationEmailError, "A conta foi criada, mas o e-mail de confirmação não foi enviado. Use o link para reenviar.");
            } else {
                await siteAlert("Conta criada! Enviamos um e-mail de confirmação em português.", {
                    tone: "success",
                    title: "Conta criada"
                });
            }

        } else {
            const userCred = await signInWithEmailAndPassword(auth, email, senha);

            // Verificar se e-mail foi confirmado
            if (!userCred.user.emailVerified) {
                if (authVerifyBanner) authVerifyBanner.classList.add("visible");
                await siteAlert("Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.", {
                    tone: "warning",
                    title: "Confirmação necessária"
                });
                gerarCaptcha();
                return;
            }

            showSection("perguntas");
        }

        authForm.reset();
        gerarCaptcha();

    } catch (error) {
        registrationInProgress = false;
        showFirebaseError(error, "Não foi possível autenticar sua conta. Tente novamente.");
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
            const imageUrl = sanitizePublicUrl(p.imagemURL);
            const projectUrl = sanitizePublicUrl(p.link);
            html += `
                <div class="window-pane reveal active" tabindex="0">
                    <div class="window-header">
                        <div class="window-controls">
                            <span class="control-dot close" role="button" tabindex="0" aria-label="Fechar janela"></span>
                            <span class="control-dot minimize" role="button" tabindex="0" aria-label="Minimizar janela"></span>
                            <span class="control-dot maximize" role="button" tabindex="0" aria-label="Maximizar janela"></span>
                        </div>
                        <span class="window-title">case_study_${escapeHTML(id.substring(0, 6))}.json</span>
                    </div>
                    <div class="window-body">
<<<<<<< HEAD
                        ${p.imagemURL ? `<img src="${escapeHTML(sanitizeURL(p.imagemURL))}" alt="${escapeHTML(p.titulo)}" style="width:100%; border-radius: 8px; margin-bottom:1rem; aspect-ratio: 16/9; object-fit: cover;">` : ''}
=======
                        ${imageUrl ? `<img src="${escapeHTML(imageUrl)}" alt="${escapeHTML(p.titulo)}" style="width:100%; border-radius: 8px; margin-bottom:1rem; aspect-ratio: 16/9; object-fit: cover;">` : ''}
>>>>>>> 9e4d092188f673492f3710a7859ed9ceaa11e8dd
                        <div class="tech-stack" style="margin-bottom:1rem;">
                            ${p.tags ? escapeHTML(p.tags).split(',').map(t => `<span class="badge">${t.trim()}</span>`).join('') : ''}
                        </div>
                        <h3>${escapeHTML(p.titulo)}</h3>
                        <p style="margin-bottom:1rem;">${escapeHTML(p.descricao)}</p>
<<<<<<< HEAD
                        ${p.link ? `<a href="${escapeHTML(sanitizeURL(p.link))}" target="_blank" class="btn-outline" style="display:inline-block">Ver Projeto</a>` : ''}
=======
                        ${projectUrl ? `<a href="${escapeHTML(projectUrl)}" target="_blank" rel="noopener noreferrer" class="btn-outline" style="display:inline-block">Ver Projeto</a>` : ''}
>>>>>>> 9e4d092188f673492f3710a7859ed9ceaa11e8dd
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

    const q = query(collection(db, "perguntas"), where("status", "==", "respondida"));
    onSnapshot(q, (snapshot) => {
        let html = "";
        let count = 0;
        snapshot.forEach((doc) => {
            const p = doc.data();
            count++;
            html += `
                    <div class="window-pane reveal active" style="border-left: 3px solid var(--accent-green); display: flex; flex-direction: column; justify-content: space-between;" tabindex="0">
                        <div class="window-header">
                            <div class="window-controls">
                                <span class="control-dot close" role="button" tabindex="0" aria-label="Fechar janela"></span>
                                <span class="control-dot minimize" role="button" tabindex="0" aria-label="Minimizar janela"></span>
                                <span class="control-dot maximize" role="button" tabindex="0" aria-label="Maximizar janela"></span>
                            </div>
                            <span class="window-title">qna_public_${escapeHTML(doc.id.substring(0, 6))}.log</span>
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
            const imageUrl = sanitizePublicUrl(c.imagemURL);
            const certificateUrl = sanitizePublicUrl(c.link);
            html += `
                <div class="window-pane reveal active" tabindex="0">
                    <div class="window-header">
                        <div class="window-controls">
                            <span class="control-dot close" role="button" tabindex="0" aria-label="Fechar janela"></span>
                            <span class="control-dot minimize" role="button" tabindex="0" aria-label="Minimizar janela"></span>
                            <span class="control-dot maximize" role="button" tabindex="0" aria-label="Maximizar janela"></span>
                        </div>
                        <span class="window-title">certificate_${escapeHTML(doc.id.substring(0, 6))}.crt</span>
                    </div>
                    <div class="window-body">
<<<<<<< HEAD
                        ${c.imagemURL ? `<img src="${escapeHTML(sanitizeURL(c.imagemURL))}" alt="${escapeHTML(c.titulo)}" style="width:100%; border-radius: 8px; margin-bottom:1rem; aspect-ratio: 16/9; object-fit: cover;">` : ''}
=======
                        ${imageUrl ? `<img src="${escapeHTML(imageUrl)}" alt="${escapeHTML(c.titulo)}" style="width:100%; border-radius: 8px; margin-bottom:1rem; aspect-ratio: 16/9; object-fit: cover;">` : ''}
>>>>>>> 9e4d092188f673492f3710a7859ed9ceaa11e8dd
                        <div class="tech-stack" style="margin-bottom:1rem;">
                            <span class="badge" style="background: rgba(255,255,255,0.05); color: var(--text-primary)">${escapeHTML(c.emissor)}</span>
                        </div>
                        <h3 style="margin-bottom: 1rem;">${escapeHTML(c.titulo)}</h3>
<<<<<<< HEAD
                        ${c.link ? `<a href="${escapeHTML(sanitizeURL(c.link))}" target="_blank" class="btn-outline" style="display:inline-block">Verificar Autenticidade</a>` : ''}
=======
                        ${certificateUrl ? `<a href="${escapeHTML(certificateUrl)}" target="_blank" rel="noopener noreferrer" class="btn-outline" style="display:inline-block">Verificar Autenticidade</a>` : ''}
>>>>>>> 9e4d092188f673492f3710a7859ed9ceaa11e8dd
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

    // Verificação de Honeypot anti-spam
    const honeypot = document.getElementById("pergunta-honeypot")?.value;
    if (honeypot) {
        console.warn("Envio bloqueado: spam detectado (honeypot preenchido).");
        return;
    }

    // Rate Limiting no cliente (30 segundos entre envios)
    const LAST_SUBMISSION_KEY = `last_q_submit_${currentUser.uid}`;
    const lastSubmitTime = localStorage.getItem(LAST_SUBMISSION_KEY);
    const now = Date.now();
    if (lastSubmitTime && (now - parseInt(lastSubmitTime)) < 30000) {
        const secondsLeft = Math.ceil((30000 - (now - parseInt(lastSubmitTime))) / 1000);
        alert(`Aguarde ${secondsLeft} segundos antes de enviar outra pergunta para evitar spam.`);
        return;
    }

    const texto = document.getElementById("pergunta-texto").value.trim();
    if (!texto || texto.length > 1000) {
        await siteAlert("Sua pergunta não pode estar vazia e o limite é de 1000 caracteres.", {
            tone: "warning",
            title: "Revise sua pergunta"
        });
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
            dataHora: serverTimestamp(),
            status: "pendente"
        });
<<<<<<< HEAD
        await siteAlert("Pergunta enviada com sucesso!", {
            tone: "success",
            title: "Pergunta recebida"
        });
=======
        // Atualiza o timestamp do último envio com sucesso
        localStorage.setItem(LAST_SUBMISSION_KEY, Date.now().toString());
        alert("Pergunta enviada com sucesso!");
>>>>>>> 8e8b823fd7db465c1ae98b798370c229ff5e3597
        formPergunta.reset();
        carregarMinhasPerguntas();
    } catch (error) {
        showFirebaseError(error, "Não foi possível enviar sua pergunta. Tente novamente.");
    }
});

async function carregarMinhasPerguntas() {
    if (!currentUser) return;
    const div = document.getElementById("lista-minhas-perguntas");
    try {
        const q = query(collection(db, "perguntas"), where("uid", "==", currentUser.uid));
        const snapshot = await getDocs(q);
        let html = "<h4>Seus últimos envios:</h4>";
        snapshot.forEach(doc => {
            const data = doc.data();
            html += `
                    <div style="border-left: 2px solid var(--accent); padding-left: 15px; margin-bottom: 15px; background: rgba(0,255,136,0.05); padding: 10px; border-radius: 4px;">
                        <p style="margin-bottom:5px;">${escapeHTML(data.texto)}</p>
                        <small style="color: var(--text-muted)">Status: <strong style="color: var(--text-bright)">${escapeHTML(questionStatusLabel(data.status))}</strong> - Enviado em: ${escapeHTML(formatFirestoreDate(data.dataHora))}</small>
                    </div>
            `;
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
    const titulo = document.getElementById("proj-titulo").value.trim();
    const tags = document.getElementById("proj-tags").value.trim();
<<<<<<< HEAD
    const link = sanitizeURL(document.getElementById("proj-link").value.trim());
    const descricao = document.getElementById("proj-descricao").value.trim();
    const imagemURL = sanitizeURL(document.getElementById("proj-imagem").value.trim());
=======
    const linkInput = document.getElementById("proj-link").value.trim();
    const descricao = document.getElementById("proj-descricao").value.trim();
    const imageInput = document.getElementById("proj-imagem").value.trim();
    const link = sanitizePublicUrl(linkInput);
    const imagemURL = sanitizePublicUrl(imageInput);

    if ((linkInput && !link) || (imageInput && !imagemURL)) {
        await siteAlert("Use apenas endereços seguros que comecem com https://.", {
            tone: "warning",
            title: "Endereço não permitido"
        });
        return;
    }
>>>>>>> 9e4d092188f673492f3710a7859ed9ceaa11e8dd

    try {
        btnSubmitProj.innerText = "Salvando...";

        if (id) {
            // Editando
            await updateDoc(doc(db, "projetos", id), {
                titulo, tags, link, descricao, imagemURL,
                dataAtualizacao: serverTimestamp()
            });
            await siteAlert("Projeto atualizado com sucesso!", { tone: "success" });
        } else {
            // Criando novo
            await addDoc(collection(db, "projetos"), {
                titulo, tags, link, descricao, imagemURL,
                dataCriacao: serverTimestamp()
            });
            await siteAlert("Projeto salvo com sucesso!", { tone: "success" });
        }

        cancelarEdicao(); // limpa o form
        carregarProjetosPublicos();
        carregarProjetosAdmin();
    } catch (e) {
        showFirebaseError(e, "Não foi possível salvar o projeto.");
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
            const isCurrentUser = id === currentUser?.uid;
            html += `
                <tr>
                    <td>${escapeHTML(u.nome || '-')}</td>
                    <td>${escapeHTML(u.email)}</td>
                    <td>
                        <select data-action="change-role" data-uid="${escapeHTML(id)}" ${isCurrentUser ? 'disabled title="Você não pode alterar o próprio perfil"' : ''} style="background: var(--bg-dark); color: white; padding: 4px; border: 1px solid var(--border-color)">
                            <option value="user" ${u.role === 'user' ? 'selected':''}>Usuário</option>
                            <option value="admin" ${u.role === 'admin' ? 'selected':''}>Administrador</option>
                        </select>
                    </td>
                    <td>
                        <button class="action-btn" data-action="reset-password" data-email="${escapeHTML(u.email)}" style="color:var(--text-bright); border:1px solid var(--border-color); padding:4px 8px; border-radius:4px;">Redefinir senha</button>
                        <button class="action-btn delete" data-action="delete-user" data-uid="${escapeHTML(id)}" ${isCurrentUser ? 'disabled title="Você não pode remover o próprio perfil"' : ''}>Remover perfil</button>
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
                            <textarea id="resp-${escapeHTML(id)}" rows="3" style="width:100%; padding: 10px; background: var(--bg-dark); color: var(--text-bright); border: 1px solid var(--border-color); border-radius:6px; font-family: inherit;" placeholder="Escreva a solução/resposta aqui..."></textarea>
                            <button class="btn-primary" data-action="answer-question" data-id="${escapeHTML(id)}" style="padding: 8px 16px; font-size: 0.9rem; max-width: 250px;">Salvar resposta e publicar</button>
                        ` : ''}
                        
                        <div style="display: flex; gap: 10px; align-items: center; margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-color);">
                            <span style="font-size: 0.85rem">Status atual:</span>
                            <select data-action="change-question-status" data-id="${escapeHTML(id)}" style="background: var(--bg-dark); color: white; padding: 4px; border: 1px solid var(--border-color)">
                                <option value="pendente" ${p.status === 'pendente'?'selected':''}>Pendente</option>
                                <option value="respondida" ${p.status === 'respondida'?'selected':''}>Respondida</option>
                                <option value="arquivada" ${p.status === 'arquivada'?'selected':''}>Arquivada</option>
                            </select>
                            <button class="action-btn delete" data-action="delete-question" data-id="${escapeHTML(id)}">Apagar</button>
                        </div>
                    </div>
                </div>
            `;
        });
        div.innerHTML = html || "<p>Nenhuma pergunta no sistema.</p>";
    } catch(e) { console.error(e); }
}

async function mudarRole(uid, novoRole) {
    if (!['user', 'admin'].includes(novoRole) || uid === currentUser?.uid) return;
    try {
        await updateDoc(doc(db, "users", uid), { role: novoRole });
        await siteAlert("Perfil de acesso atualizado!", { tone: "success" });
    } catch(e) {
        showFirebaseError(e, "Não foi possível atualizar o perfil de acesso.");
        carregarUsuarios();
    }
}

async function enviarRedefinicaoSenha(emailUsuario) {
    try {
        await sendPasswordResetEmail(auth, emailUsuario);
        await siteAlert("O Firebase enviou um e-mail de redefinição de senha em português.", {
            tone: "success",
            title: "E-mail enviado"
        });
    } catch(e) {
        showFirebaseError(e, "Não foi possível enviar o e-mail de redefinição.");
    }
}

async function deletarUsuario(uid) {
    if (uid === currentUser?.uid) return;
    if (await siteConfirm("Remover o perfil deste usuário? Ele perderá o acesso ao site, mas a conta de autenticação deverá ser excluída separadamente no Firebase Console.", {
        tone: "danger",
        title: "Remover perfil",
        confirmText: "Remover"
    })) {
        try {
            await deleteDoc(doc(db, "users", uid));
            carregarUsuarios();
            await siteAlert("Perfil removido. Se desejar, exclua também a conta na área Authentication do Firebase Console.", {
                tone: "success",
                title: "Perfil removido"
            });
        } catch(e) {
            showFirebaseError(e, "Não foi possível remover o perfil.");
        }
    }
}

async function mudarStatusPergunta(pid, novoStatus) {
    if (!['pendente', 'respondida', 'arquivada'].includes(novoStatus)) return;
    try {
        await updateDoc(doc(db, "perguntas", pid), { status: novoStatus });
    } catch(e) {
        showFirebaseError(e, novoStatus === "respondida"
            ? "Escreva e publique uma resposta antes de marcar a pergunta como respondida."
            : "Não foi possível atualizar o status da pergunta.");
        carregarTodasPerguntas();
    }
}

async function responderPergunta(pid) {
    const textarea = document.getElementById("resp-" + pid);
    if (!textarea || !textarea.value.trim()) {
        await siteAlert("Você precisa digitar uma resposta antes de publicar.", { tone: "warning" });
        return;
    }
    
    try {
        await updateDoc(doc(db, "perguntas", pid), { 
            status: "respondida",
            resposta: textarea.value.trim()
        });
        carregarTodasPerguntas(); // Atualiza tab admin
        await siteAlert("Resposta publicada com sucesso!", { tone: "success" });
    } catch(e) {
        showFirebaseError(e, "Não foi possível publicar a resposta.");
    }
}

async function deletarPergunta(pid) {
    if (await siteConfirm("Tem certeza de que deseja excluir esta pergunta?", {
        tone: "danger",
        title: "Excluir pergunta",
        confirmText: "Excluir"
    })) {
        try {
            await deleteDoc(doc(db, "perguntas", pid));
            carregarTodasPerguntas();
        } catch(e) {
            showFirebaseError(e, "Não foi possível excluir a pergunta.");
        }
    }
}

document.getElementById("tabela-usuarios")?.addEventListener("change", (event) => {
    const select = event.target.closest('[data-action="change-role"]');
    if (select) mudarRole(select.dataset.uid, select.value);
});

document.getElementById("tabela-usuarios")?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "reset-password") enviarRedefinicaoSenha(button.dataset.email);
    if (button.dataset.action === "delete-user") deletarUsuario(button.dataset.uid);
});

document.getElementById("lista-todas-perguntas")?.addEventListener("change", (event) => {
    const select = event.target.closest('[data-action="change-question-status"]');
    if (select) mudarStatusPergunta(select.dataset.id, select.value);
});

document.getElementById("lista-todas-perguntas")?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "answer-question") responderPergunta(button.dataset.id);
    if (button.dataset.action === "delete-question") deletarPergunta(button.dataset.id);
});

// Admin: Tabela de Projetos
async function carregarProjetosAdmin() {
    if (currentRole !== "admin") return;
    const div = document.getElementById("tabela-projetos-admin");
    try {
        const snapshot = await getDocs(collection(db, "projetos"));
        let html = "";
        
        let projetosArray = [];
        snapshot.forEach(docSnap => projetosArray.push({ id: docSnap.id, ...docSnap.data() }));
        projectAdminCache.clear();

        projetosArray.forEach(p => {
            projectAdminCache.set(p.id, p);
            html += `
                <div style="border: 1px solid var(--border-color); padding: 15px; margin-bottom: 10px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${escapeHTML(p.titulo)}</strong>
                        <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">Tags: ${escapeHTML(p.tags || '-')}</div>
                    </div>
                    <div>
                        <button class="action-btn" data-action="edit-project" data-id="${escapeHTML(p.id)}">Editar</button>
                        <button class="action-btn delete" data-action="delete-project" data-id="${escapeHTML(p.id)}">Excluir</button>
                    </div>
                </div>
            `;
        });
        div.innerHTML = html || "<p>Nenhum projeto postado.</p>";
    } catch(e) { console.error(e); }
}

function prepararEdicao(id) {
    const p = projectAdminCache.get(id);
    if (!p) return;
    
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

function cancelarEdicao() {
    document.getElementById("form-novo-projeto").reset();
    document.getElementById("proj-id").value = "";
    document.getElementById("form-proj-title").innerText = "Adicionar Novo Case Study";
    document.getElementById("proj-btn-submit").innerText = "Salvar Projeto";
    document.getElementById("proj-btn-cancelar").style.display = "none";
}

async function deletarProjeto(pid) {
    if (await siteConfirm("Tem absoluta certeza de que deseja excluir este Case Study do site?", {
        tone: "danger",
        title: "Excluir Case Study",
        confirmText: "Excluir"
    })) {
        try {
            await deleteDoc(doc(db, "projetos", pid));
            await siteAlert("Projeto excluído.", { tone: "success" });
            carregarProjetosPublicos();
            carregarProjetosAdmin();
            cancelarEdicao(); // limpa edições se estiver editando este
        } catch(e) {
            showFirebaseError(e, "Não foi possível excluir o projeto.");
        }
    }
}

document.getElementById("tabela-projetos-admin")?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "edit-project") prepararEdicao(button.dataset.id);
    if (button.dataset.action === "delete-project") deletarProjeto(button.dataset.id);
});

document.getElementById("proj-btn-cancelar")?.addEventListener("click", cancelarEdicao);

// Admin: Criar/Editar Certificado
const formCertificado = document.getElementById("form-novo-certificado");
const btnSubmitCert = document.getElementById("cert-btn-submit");

if(formCertificado) {
    formCertificado.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (currentRole !== "admin") return;

        const id = document.getElementById("cert-id").value;
        const titulo = document.getElementById("cert-titulo").value.trim();
        const emissor = document.getElementById("cert-emissor").value.trim();
<<<<<<< HEAD
        const link = sanitizeURL(document.getElementById("cert-link").value.trim());
        const imagemURL = sanitizeURL(document.getElementById("cert-imagem").value.trim());
=======
        const linkInput = document.getElementById("cert-link").value.trim();
        const imageInput = document.getElementById("cert-imagem").value.trim();
        const link = sanitizePublicUrl(linkInput);
        const imagemURL = sanitizePublicUrl(imageInput);

        if ((linkInput && !link) || !imagemURL) {
            await siteAlert("Use apenas endereços seguros que comecem com https://.", {
                tone: "warning",
                title: "Endereço não permitido"
            });
            return;
        }
>>>>>>> 9e4d092188f673492f3710a7859ed9ceaa11e8dd

        try {
            btnSubmitCert.innerText = "Salvando...";

            if (id) {
                await updateDoc(doc(db, "certificados", id), {
                    titulo, emissor, link, imagemURL,
                    dataAtualizacao: serverTimestamp()
                });
                await siteAlert("Certificado atualizado com sucesso!", { tone: "success" });
            } else {
                await addDoc(collection(db, "certificados"), {
                    titulo, emissor, link, imagemURL,
                    dataCriacao: serverTimestamp()
                });
                await siteAlert("Certificado salvo com sucesso!", { tone: "success" });
            }

            cancelarEdicaoCertificado();
            carregarCertificadosPublicos();
            carregarCertificadosAdmin();
        } catch (e) {
            showFirebaseError(e, "Não foi possível salvar o certificado.");
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
        certificateAdminCache.clear();

        arr.forEach(c => {
            certificateAdminCache.set(c.id, c);
            html += `
                <div style="border: 1px solid var(--border-color); padding: 15px; margin-bottom: 10px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>${escapeHTML(c.titulo)}</strong>
                        <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">Emissor: ${escapeHTML(c.emissor)}</div>
                    </div>
                    <div>
                        <button class="action-btn" data-action="edit-certificate" data-id="${escapeHTML(c.id)}">Editar</button>
                        <button class="action-btn delete" data-action="delete-certificate" data-id="${escapeHTML(c.id)}">Excluir</button>
                    </div>
                </div>
            `;
        });
        div.innerHTML = html || "<p>Nenhum certificado postado.</p>";
    } catch(e) { console.error(e); }
}

function prepararEdicaoCertificado(id) {
    const c = certificateAdminCache.get(id);
    if (!c) return;
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

function cancelarEdicaoCertificado() {
    document.getElementById("form-novo-certificado").reset();
    document.getElementById("cert-id").value = "";
    document.getElementById("form-cert-title").innerText = "Adicionar Novo Certificado";
    document.getElementById("cert-btn-submit").innerText = "Salvar Certificado";
    document.getElementById("cert-btn-cancelar").style.display = "none";
}

async function deletarCertificado(id) {
    if (await siteConfirm("Tem absoluta certeza de que deseja excluir este Certificado do site?", {
        tone: "danger",
        title: "Excluir certificado",
        confirmText: "Excluir"
    })) {
        try {
            await deleteDoc(doc(db, "certificados", id));
            await siteAlert("Certificado excluído.", { tone: "success" });
            carregarCertificadosPublicos();
            carregarCertificadosAdmin();
            cancelarEdicaoCertificado();
        } catch(e) {
            showFirebaseError(e, "Não foi possível excluir o certificado.");
        }
    }
}

document.getElementById("tabela-certificados-admin")?.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    if (button.dataset.action === "edit-certificate") prepararEdicaoCertificado(button.dataset.id);
    if (button.dataset.action === "delete-certificate") deletarCertificado(button.dataset.id);
});

document.getElementById("cert-btn-cancelar")?.addEventListener("click", cancelarEdicaoCertificado);
