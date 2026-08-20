const toneSettings = {
    info: {
        marker: "i",
        status: "[INFO] system.notice",
        title: "Mensagem do sistema"
    },
    success: {
        marker: "✓",
        status: "[OK] operation.completed",
        title: "Operação concluída"
    },
    warning: {
        marker: "!",
        status: "[WARN] action.required",
        title: "Atenção"
    },
    error: {
        marker: "×",
        status: "[ERR] operation.failed",
        title: "Não foi possível concluir"
    },
    danger: {
        marker: "!",
        status: "[WARN] destructive.action",
        title: "Confirmar exclusão"
    }
};

const confirmationQueue = [];
let toastRegion = null;
let activeConfirmation = null;
let toastSequence = 0;

function inferTone(message) {
    const normalized = String(message).toLocaleLowerCase("pt-BR");

    if (/sucesso|criada|salvo|salva|atualizado|atualizada|enviado|enviada|publicada|reenviado|excluído|excluída/.test(normalized)) {
        return "success";
    }

    if (/obrigatóri|incorret|não pode|precisa|confirme|verifique|use apenas|entre novamente|não está ativo/.test(normalized)) {
        return "warning";
    }

    return "info";
}

function getToastRegion() {
    if (toastRegion) return toastRegion;

    toastRegion = document.createElement("div");
    toastRegion.className = "site-toast-region";
    toastRegion.setAttribute("aria-label", "Notificações do site");
    toastRegion.setAttribute("aria-live", "polite");
    document.body.appendChild(toastRegion);
    return toastRegion;
}

function dismissToast(toast, onRemoved) {
    if (!toast?.isConnected || toast.dataset.closing === "true") return;

    toast.dataset.closing = "true";
    toast.classList.remove("is-visible");
    toast.classList.add("is-leaving");

    window.setTimeout(() => {
        toast.remove();
        onRemoved?.();
    }, 180);
}

function createToast(options) {
    const region = getToastRegion();
    const tone = toneSettings[options.tone] ? options.tone : "info";
    const settings = toneSettings[tone];
    const toastId = `site-toast-${++toastSequence}`;
    const toast = document.createElement("article");

    toast.className = "site-toast";
    toast.dataset.tone = tone;
    toast.setAttribute("aria-labelledby", `${toastId}-title`);
    toast.setAttribute("aria-describedby", `${toastId}-message`);
    toast.setAttribute("role", options.kind === "confirm" ? "alertdialog" : (tone === "error" ? "alert" : "status"));

    toast.innerHTML = `
        <div class="site-toast__header">
            <div class="window-controls" aria-hidden="true">
                <span class="control-dot close"></span>
                <span class="control-dot minimize"></span>
                <span class="control-dot maximize"></span>
            </div>
            <span class="site-toast__filename">system_notice.log</span>
            <button type="button" class="site-toast__close" aria-label="Fechar notificação">×</button>
        </div>
        <div class="site-toast__content">
            <div class="site-toast__marker" aria-hidden="true">${settings.marker}</div>
            <div class="site-toast__copy">
                <p class="site-toast__status"></p>
                <h2 id="${toastId}-title"></h2>
                <p id="${toastId}-message" class="site-toast__message"></p>
            </div>
        </div>
        <div class="site-toast__actions" hidden>
            <button type="button" class="btn-secondary site-toast__button site-toast__cancel">Cancelar</button>
            <button type="button" class="btn-primary site-toast__button site-toast__confirm">Confirmar</button>
        </div>
        <div class="site-toast__progress" aria-hidden="true"></div>
    `;

    toast.querySelector(".site-toast__status").textContent = options.status || settings.status;
    toast.querySelector("h2").textContent = options.title || settings.title;
    toast.querySelector(".site-toast__message").textContent = options.message;
    region.prepend(toast);

    requestAnimationFrame(() => toast.classList.add("is-visible"));
    return toast;
}

export function siteAlert(message, options = {}) {
    const duration = Math.max(2500, Number(options.duration) || 4800);
    const toast = createToast({
        kind: "alert",
        message: String(message),
        tone: options.tone || inferTone(message),
        title: options.title,
        status: options.status
    });
    const closeButton = toast.querySelector(".site-toast__close");
    let timeoutId = window.setTimeout(() => dismissToast(toast), duration);

    toast.style.setProperty("--toast-duration", `${duration}ms`);
    closeButton.addEventListener("click", () => {
        window.clearTimeout(timeoutId);
        dismissToast(toast);
    });

    toast.addEventListener("mouseenter", () => window.clearTimeout(timeoutId));
    toast.addEventListener("mouseleave", () => {
        timeoutId = window.setTimeout(() => dismissToast(toast), 1800);
    });

    Array.from(toast.parentElement?.children || [])
        .slice(4)
        .forEach((oldToast) => dismissToast(oldToast));

    return Promise.resolve();
}

function showNextConfirmation() {
    if (activeConfirmation || confirmationQueue.length === 0) return;

    activeConfirmation = confirmationQueue.shift();
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const toast = createToast(activeConfirmation);
    const actions = toast.querySelector(".site-toast__actions");
    const progress = toast.querySelector(".site-toast__progress");
    const closeButton = toast.querySelector(".site-toast__close");
    const cancelButton = toast.querySelector(".site-toast__cancel");
    const confirmButton = toast.querySelector(".site-toast__confirm");

    actions.hidden = false;
    progress.hidden = true;
    cancelButton.textContent = activeConfirmation.cancelText;
    confirmButton.textContent = activeConfirmation.confirmText;
    confirmButton.classList.toggle("site-toast__button--danger", activeConfirmation.tone === "danger");

    const finish = (result) => {
        if (!activeConfirmation) return;
        const current = activeConfirmation;
        activeConfirmation = null;
        dismissToast(toast, () => {
            if (previouslyFocused?.isConnected) previouslyFocused.focus();
            current.resolve(result);
            showNextConfirmation();
        });
    };

    closeButton.addEventListener("click", () => finish(false));
    cancelButton.addEventListener("click", () => finish(false));
    confirmButton.addEventListener("click", () => finish(true));
    toast.addEventListener("keydown", (event) => {
        if (event.key === "Escape") finish(false);
    });

    confirmButton.focus();
}

export function siteConfirm(message, options = {}) {
    return new Promise((resolve) => {
        confirmationQueue.push({
            kind: "confirm",
            message: String(message),
            tone: options.tone || "warning",
            title: options.title,
            status: options.status,
            confirmText: options.confirmText || "Confirmar",
            cancelText: options.cancelText || "Cancelar",
            resolve
        });
        showNextConfirmation();
    });
}
