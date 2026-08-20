import assert from "node:assert/strict";
import test from "node:test";

import {
    escapeHTML,
    firebaseErrorMessage,
    formatFirestoreDate,
    questionStatusLabel,
    sanitizePublicUrl
} from "../security-utils.js";

test("escapeHTML neutraliza conteúdo executável", () => {
    const malicious = `<img src=x onerror="alert('xss')">`;
    const escaped = escapeHTML(malicious);

    assert.equal(escaped, "&lt;img src=x onerror=&quot;alert(&#039;xss&#039;)&quot;&gt;");
    assert.equal(escaped.includes("<img"), false);
});

test("sanitizePublicUrl aceita HTTPS e recusa protocolos perigosos", () => {
    assert.equal(sanitizePublicUrl("https://example.com/projeto"), "https://example.com/projeto");
    assert.equal(sanitizePublicUrl("javascript:alert(1)"), "");
    assert.equal(sanitizePublicUrl("data:text/html,<script>alert(1)</script>"), "");
    assert.equal(sanitizePublicUrl("http://example.com"), "");
    assert.equal(sanitizePublicUrl("não é uma url"), "");
});

test("erros do Firebase não expõem mensagens internas em inglês", () => {
    assert.equal(firebaseErrorMessage({ code: "auth/invalid-credential" }), "E-mail ou senha incorretos.");
    assert.equal(
        firebaseErrorMessage({ code: "auth/erro-desconhecido", message: "Internal implementation detail" }, "Falha segura."),
        "Falha segura."
    );
});

test("datas e status são apresentados em português", () => {
    assert.match(formatFirestoreDate("2026-08-20T12:30:00.000Z"), /20\/08\/2026/);
    assert.equal(questionStatusLabel("respondida"), "Respondida");
    assert.equal(questionStatusLabel("valor-inválido"), "Desconhecido");
});
