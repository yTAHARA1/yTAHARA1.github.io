const FIREBASE_ERROR_MESSAGES = Object.freeze({
    "auth/email-already-in-use": "Este e-mail já está cadastrado. Entre com sua conta.",
    "auth/invalid-credential": "E-mail ou senha incorretos.",
    "auth/invalid-email": "Digite um endereço de e-mail válido.",
    "auth/invalid-login-credentials": "E-mail ou senha incorretos.",
    "auth/missing-password": "Digite sua senha.",
    "auth/network-request-failed": "Não foi possível conectar. Verifique sua internet e tente novamente.",
    "auth/operation-not-allowed": "Este tipo de acesso não está habilitado.",
    "auth/requires-recent-login": "Por segurança, saia e entre novamente antes de continuar.",
    "auth/too-many-requests": "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
    "auth/user-disabled": "Esta conta foi desativada.",
    "auth/user-not-found": "E-mail ou senha incorretos.",
    "auth/weak-password": "Use uma senha mais forte, com pelo menos 8 caracteres.",
    "auth/wrong-password": "E-mail ou senha incorretos.",
    "permission-denied": "Você não tem permissão para realizar esta ação.",
    "unavailable": "O serviço está temporariamente indisponível. Tente novamente em instantes."
});

export function escapeHTML(value) {
    if (value === null || value === undefined) return "";

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

export function sanitizePublicUrl(value) {
    if (!value) return "";

    try {
        const url = new URL(String(value));
        return url.protocol === "https:" ? url.href : "";
    } catch {
        return "";
    }
}

export function firebaseErrorMessage(error, fallback = "Não foi possível concluir a ação. Tente novamente.") {
    const code = String(error?.code || "").replace(/^firestore\//, "");
    return FIREBASE_ERROR_MESSAGES[code] || fallback;
}

export function formatFirestoreDate(value) {
    if (!value) return "data indisponível";

    const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return "data indisponível";
    return date.toLocaleString("pt-BR");
}

export function questionStatusLabel(status) {
    return ({
        pendente: "Pendente",
        respondida: "Respondida",
        arquivada: "Arquivada"
    })[status] || "Desconhecido";
}
