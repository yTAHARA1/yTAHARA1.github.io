import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, beforeEach, test } from "node:test";

import {
    assertFails,
    assertSucceeds,
    initializeTestEnvironment
} from "@firebase/rules-unit-testing";
import {
    Timestamp,
    collection,
    deleteDoc,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    setDoc,
    updateDoc,
    where
} from "firebase/firestore";

const projectId = "portfolio-emilio-security-tests";
const rules = readFileSync(new URL("../firestore.rules", import.meta.url), "utf8");
let testEnv;

function authenticatedDb(uid, email, verified = true) {
    return testEnv.authenticatedContext(uid, {
        email,
        email_verified: verified
    }).firestore();
}

async function seedDocuments(documents) {
    await testEnv.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await Promise.all(documents.map(([path, data]) => setDoc(doc(db, path), data)));
    });
}

const userProfile = (uid, email, role = "user", nome = "Usuário Teste") => ({
    uid,
    nome,
    email,
    role,
    emailVerified: true,
    dataCadastro: Timestamp.fromDate(new Date("2026-08-20T12:00:00.000Z"))
});

const question = (uid, status = "pendente", resposta) => ({
    uid,
    nome: "Usuário Teste",
    texto: "Como manter a infraestrutura segura?",
    dataHora: Timestamp.fromDate(new Date("2026-08-20T12:00:00.000Z")),
    status,
    ...(resposta ? { resposta } : {})
});

before(async () => {
    testEnv = await initializeTestEnvironment({
        projectId,
        firestore: {
            rules,
            host: "127.0.0.1",
            port: 8080
        }
    });
});

beforeEach(async () => {
    await testEnv.clearFirestore();
});

after(async () => {
    await testEnv.cleanup();
});

test("cadastro cria somente o próprio perfil com papel de usuário", async () => {
    const db = authenticatedDb("user-1", "user@example.com", false);

    await assertSucceeds(setDoc(doc(db, "users/user-1"), {
        uid: "user-1",
        nome: "Pessoa Segura",
        email: "user@example.com",
        role: "user",
        emailVerified: false,
        dataCadastro: serverTimestamp()
    }));

    const attackerDb = authenticatedDb("attacker", "attacker@example.com", false);
    await assertFails(setDoc(doc(attackerDb, "users/attacker"), {
        uid: "attacker",
        nome: "Atacante",
        email: "attacker@example.com",
        role: "admin",
        emailVerified: false,
        dataCadastro: serverTimestamp()
    }));

    await assertFails(setDoc(doc(attackerDb, "users/another-user"), {
        uid: "another-user",
        nome: "Outro",
        email: "attacker@example.com",
        role: "user",
        emailVerified: false,
        dataCadastro: serverTimestamp()
    }));
});

test("somente conta verificada e ativa envia pergunta vinculada ao próprio perfil", async () => {
    await seedDocuments([
        ["users/user-1", userProfile("user-1", "user@example.com")],
        ["users/user-2", userProfile("user-2", "unverified@example.com")]
    ]);

    const verifiedDb = authenticatedDb("user-1", "user@example.com", true);
    await assertSucceeds(setDoc(doc(verifiedDb, "perguntas/question-ok"), {
        uid: "user-1",
        nome: "Usuário Teste",
        texto: "Minha pergunta segura",
        dataHora: serverTimestamp(),
        status: "pendente"
    }));

    const unverifiedDb = authenticatedDb("user-2", "unverified@example.com", false);
    await assertFails(setDoc(doc(unverifiedDb, "perguntas/question-unverified"), {
        uid: "user-2",
        nome: "Usuário Teste",
        texto: "Pergunta sem verificação",
        dataHora: serverTimestamp(),
        status: "pendente"
    }));

    await assertFails(setDoc(doc(verifiedDb, "perguntas/question-forged"), {
        uid: "another-user",
        nome: "Usuário Teste",
        texto: "Pergunta forjada",
        dataHora: serverTimestamp(),
        status: "pendente",
        role: "admin"
    }));
});

test("visitante vê apenas perguntas respondidas quando usa a consulta segura", async () => {
    await seedDocuments([
        ["perguntas/public", question("user-1", "respondida", "Use atualizações e menor privilégio.")],
        ["perguntas/private", question("user-1", "pendente")]
    ]);

    const db = testEnv.unauthenticatedContext().firestore();
    const publicQuery = query(collection(db, "perguntas"), where("status", "==", "respondida"));
    const snapshot = await assertSucceeds(getDocs(publicQuery));

    assert.equal(snapshot.size, 1);
    await assertSucceeds(getDoc(doc(db, "perguntas/public")));
    await assertFails(getDoc(doc(db, "perguntas/private")));
    await assertFails(getDocs(collection(db, "perguntas")));
});

test("usuário acessa as próprias perguntas, mas não lista perguntas privadas de terceiros", async () => {
    await seedDocuments([
        ["users/user-1", userProfile("user-1", "user@example.com")],
        ["perguntas/own", question("user-1", "pendente")],
        ["perguntas/other", question("user-2", "arquivada")]
    ]);

    const db = authenticatedDb("user-1", "user@example.com", true);
    const ownQuery = query(collection(db, "perguntas"), where("uid", "==", "user-1"));
    const snapshot = await assertSucceeds(getDocs(ownQuery));

    assert.equal(snapshot.size, 1);
    await assertFails(getDoc(doc(db, "perguntas/other")));
});

test("administrador gerencia conteúdo sem poder rebaixar ou excluir a si mesmo", async () => {
    await seedDocuments([
        ["users/admin-1", userProfile("admin-1", "admin@example.com", "admin", "Administrador")],
        ["users/user-1", userProfile("user-1", "user@example.com")],
        ["perguntas/pending", {
            ...question("user-1", "pendente"),
            dataHora: "2026-08-20T12:00:00.000Z"
        }]
    ]);

    const adminDb = authenticatedDb("admin-1", "admin@example.com", true);
    await assertSucceeds(updateDoc(doc(adminDb, "users/user-1"), { role: "admin" }));
    await assertFails(updateDoc(doc(adminDb, "users/admin-1"), { role: "user" }));
    await assertFails(deleteDoc(doc(adminDb, "users/admin-1")));

    await assertSucceeds(setDoc(doc(adminDb, "projetos/secure-project"), {
        titulo: "Projeto seguro",
        tags: "segurança, firebase",
        link: "https://example.com/projeto",
        descricao: "Descrição segura",
        imagemURL: "https://example.com/imagem.png",
        dataCriacao: serverTimestamp()
    }));

    await assertSucceeds(updateDoc(doc(adminDb, "projetos/secure-project"), {
        descricao: "Descrição segura e atualizada",
        dataAtualizacao: serverTimestamp()
    }));

    await assertFails(updateDoc(doc(adminDb, "projetos/secure-project"), {
        dataCriacao: serverTimestamp(),
        dataAtualizacao: serverTimestamp()
    }));

    await assertSucceeds(setDoc(doc(adminDb, "certificados/secure-certificate"), {
        titulo: "Certificado seguro",
        emissor: "Instituição Teste",
        link: "https://example.com/certificado",
        imagemURL: "https://example.com/certificado.png",
        dataCriacao: serverTimestamp()
    }));

    await assertFails(updateDoc(doc(adminDb, "certificados/secure-certificate"), {
        dataCriacao: serverTimestamp(),
        dataAtualizacao: serverTimestamp()
    }));

    await assertFails(setDoc(doc(adminDb, "projetos/insecure-project"), {
        titulo: "Projeto inseguro",
        tags: "teste",
        link: "javascript:alert(1)",
        descricao: "Não deve ser salvo",
        imagemURL: "https://example.com/imagem.png",
        dataCriacao: serverTimestamp()
    }));

    await assertSucceeds(updateDoc(doc(adminDb, "perguntas/pending"), {
        status: "respondida",
        resposta: "Resposta revisada e segura."
    }));
});

test("usuário comum não altera conteúdo administrativo", async () => {
    await seedDocuments([
        ["users/user-1", userProfile("user-1", "user@example.com")],
        ["projetos/project-1", {
            titulo: "Projeto",
            tags: "firebase",
            link: "https://example.com",
            descricao: "Descrição",
            imagemURL: "",
            dataCriacao: Timestamp.now()
        }]
    ]);

    const db = authenticatedDb("user-1", "user@example.com", true);
    await assertFails(updateDoc(doc(db, "projetos/project-1"), {
        titulo: "Projeto adulterado",
        dataAtualizacao: serverTimestamp()
    }));
});

test("administrador precisa manter o e-mail verificado", async () => {
    await seedDocuments([
        ["users/admin-1", userProfile("admin-1", "admin@example.com", "admin", "Administrador")]
    ]);

    const unverifiedAdminDb = authenticatedDb("admin-1", "admin@example.com", false);
    await assertFails(setDoc(doc(unverifiedAdminDb, "projetos/blocked-project"), {
        titulo: "Projeto bloqueado",
        tags: "segurança",
        link: "https://example.com/projeto",
        descricao: "Não deve ser criado por uma sessão não verificada.",
        imagemURL: "",
        dataCriacao: serverTimestamp()
    }));
});

test("coleções não declaradas permanecem bloqueadas", async () => {
    await seedDocuments([
        ["users/admin-1", userProfile("admin-1", "admin@example.com", "admin", "Administrador")]
    ]);

    const adminDb = authenticatedDb("admin-1", "admin@example.com", true);
    await assertFails(setDoc(doc(adminDb, "configuracoes/private"), {
        segredo: "não deve ser gravado"
    }));
});
