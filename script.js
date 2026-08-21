

document.addEventListener("DOMContentLoaded", () => {


    const observerOptions = {
        root: null,
        rootMargin: "0px",
        threshold: 0.1
    };

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add("active");

                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const revealElements = document.querySelectorAll(".reveal");
    revealElements.forEach(el => {
        revealObserver.observe(el);
    });


    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const target = this.getAttribute('href');
            if (!target || target === '#') return;

            const targetElement = document.querySelector(target);

            if (targetElement) {
                e.preventDefault();
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });


    // ====== TERMINAL TYPING EFFECT ======
    const titleEl = document.getElementById("hero-title");
    const subtitleEl = document.getElementById("hero-subtitle");
    const skipBtn = document.getElementById("btn-skip-typing");

    // Configurações do efeito de digitação (facilmente customizáveis)
    const TYPING_CONFIG = {
        titleSpeed: 20,     // Velocidade do título (ms por caractere)
        subtitleSpeed: 10,  // Velocidade do subtítulo (ms por caractere)
        enabled: true       // Define se a animação está ligada
    };

    if (titleEl && subtitleEl) {
        const titleHtml = titleEl.innerHTML;
        const subtitleHtml = subtitleEl.innerHTML;
        
        // Verifica preferência do sistema por movimento reduzido (acessibilidade)
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        if (prefersReducedMotion || !TYPING_CONFIG.enabled) {
            // Mostra o texto imediatamente
            titleEl.innerHTML = titleHtml;
            subtitleEl.innerHTML = subtitleHtml;
            if (skipBtn) skipBtn.style.display = "none";
        } else {
            // Medir alturas para evitar CLS (Cumulative Layout Shift)
            const titleHeight = titleEl.getBoundingClientRect().height;
            const subtitleHeight = subtitleEl.getBoundingClientRect().height;
            titleEl.style.minHeight = `${titleHeight}px`;
            subtitleEl.style.minHeight = `${subtitleHeight}px`;

            // Limpa os contêineres e exibe o botão de pular
            titleEl.innerHTML = "";
            subtitleEl.innerHTML = "";
            if (skipBtn) skipBtn.style.display = "inline-block";

            let titleIndex = 0;
            let subtitleIndex = 0;
            let titleTimer = null;
            let subtitleTimer = null;
            
            // Adiciona o cursor piscante
            const cursor = document.createElement("span");
            cursor.className = "terminal-cursor";
            titleEl.appendChild(cursor);

            function typeTitle() {
                if (titleIndex < titleHtml.length) {
                    cursor.remove();
                    if (titleHtml[titleIndex] === '<') {
                        const endTag = titleHtml.indexOf('>', titleIndex);
                        if (endTag !== -1) {
                            titleEl.innerHTML += titleHtml.substring(titleIndex, endTag + 1);
                            titleIndex = endTag + 1;
                        } else {
                            titleEl.innerHTML += titleHtml[titleIndex];
                            titleIndex++;
                        }
                    } else {
                        titleEl.innerHTML += titleHtml[titleIndex];
                        titleIndex++;
                    }
                    titleEl.appendChild(cursor);
                    titleTimer = setTimeout(typeTitle, TYPING_CONFIG.titleSpeed);
                } else {
                    // Título concluído, move o cursor para o subtítulo
                    cursor.remove();
                    subtitleEl.appendChild(cursor);
                    typeSubtitle();
                }
            }

            function typeSubtitle() {
                if (subtitleIndex < subtitleHtml.length) {
                    cursor.remove();
                    if (subtitleHtml[subtitleIndex] === '<') {
                        const endTag = subtitleHtml.indexOf('>', subtitleIndex);
                        if (endTag !== -1) {
                            subtitleEl.innerHTML += subtitleHtml.substring(subtitleIndex, endTag + 1);
                            subtitleIndex = endTag + 1;
                        } else {
                            subtitleEl.innerHTML += subtitleHtml[subtitleIndex];
                            subtitleIndex++;
                        }
                    } else {
                        subtitleEl.innerHTML += subtitleHtml[subtitleIndex];
                        subtitleIndex++;
                    }
                    subtitleEl.appendChild(cursor);
                    subtitleTimer = setTimeout(typeSubtitle, TYPING_CONFIG.subtitleSpeed);
                } else {
                    finishTyping();
                }
            }

            function finishTyping() {
                clearTimeout(titleTimer);
                clearTimeout(subtitleTimer);
                cursor.remove();
                titleEl.innerHTML = titleHtml;
                subtitleEl.innerHTML = subtitleHtml;
                
                // Limpa min-height para manter o layout flexível e responsivo pós-renderização
                titleEl.style.minHeight = "";
                subtitleEl.style.minHeight = "";
                
                if (skipBtn) skipBtn.style.display = "none";
                document.removeEventListener("keydown", handleEscKey);
            }

            function handleEscKey(e) {
                if (e.key === "Escape") {
                    finishTyping();
                }
            }

            if (skipBtn) {
                skipBtn.addEventListener("click", finishTyping);
            }
            document.addEventListener("keydown", handleEscKey);

            // Inicia o processo de digitação
            typeTitle();
        }
    }


<<<<<<< HEAD
    // ====== WINDOW CONTROL ACTIONS ======
    const handleWindowControl = (action, pane) => {
        if (!pane) return;
        if (action === "close") {
=======
    // ====== WINDOW CONTROL ACTIONS (CLOSE DOT & ESCAPE) ======
    document.querySelectorAll(".control-dot").forEach((dot) => {
        const isCloseAction = dot.classList.contains("close") && dot.closest(".spa-section");
        if (isCloseAction) {
            dot.setAttribute("role", "button");
            dot.setAttribute("tabindex", "0");
            dot.setAttribute("aria-label", "Fechar painel");
            dot.addEventListener("keydown", (event) => {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    dot.click();
                }
            });
        } else {
            dot.setAttribute("aria-hidden", "true");
        }
    });

    document.addEventListener("click", (e) => {
        if (e.target.classList.contains("close") && e.target.closest(".window-pane")) {
            const pane = e.target.closest(".window-pane");
>>>>>>> 9e4d092188f673492f3710a7859ed9ceaa11e8dd
            const parentSection = pane.closest(".spa-section");
            if (parentSection && ["login", "admin", "perguntas"].includes(parentSection.id)) {
                parentSection.style.display = "none";
                window.location.hash = "home";
                const homeSec = document.getElementById("home");
                if (homeSec) homeSec.scrollIntoView({ behavior: 'smooth' });
            }
        } else if (action === "minimize") {
            pane.classList.toggle("minimized");
            pane.classList.remove("maximized");
        } else if (action === "maximize") {
            pane.classList.toggle("maximized");
            pane.classList.remove("minimized");
        }
    };

    document.addEventListener("click", (e) => {
        const dot = e.target.closest(".control-dot");
        if (dot) {
            const pane = dot.closest(".window-pane");
            if (pane) {
                if (dot.classList.contains("close")) handleWindowControl("close", pane);
                if (dot.classList.contains("minimize")) handleWindowControl("minimize", pane);
                if (dot.classList.contains("maximize")) handleWindowControl("maximize", pane);
            }
        }
    });

    document.addEventListener("keydown", (e) => {
        // Suporte para teclado nos botões de controle focados (Enter ou Espaço)
        const dot = e.target.closest(".control-dot");
        if (dot && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            const pane = dot.closest(".window-pane");
            if (pane) {
                if (dot.classList.contains("close")) handleWindowControl("close", pane);
                if (dot.classList.contains("minimize")) handleWindowControl("minimize", pane);
                if (dot.classList.contains("maximize")) handleWindowControl("maximize", pane);
            }
            return;
        }

        // Suporte para Escape
        if (e.key === "Escape") {
            // Se houver uma janela maximizada, desmaximiza ela primeiro
            const maximizedPane = document.querySelector(".window-pane.maximized");
            if (maximizedPane) {
                maximizedPane.classList.remove("maximized");
                return;
            }

            const activeSections = document.querySelectorAll(".spa-section");
            activeSections.forEach(sec => {
                if (sec.style.display === "block" || sec.style.display === "") {
                    if (sec.id === "login" || sec.id === "admin" || sec.id === "perguntas") {
                        sec.style.display = "none";
                        window.location.hash = "home";
                        const homeSec = document.getElementById("home");
                        if (homeSec) homeSec.scrollIntoView({ behavior: 'smooth' });
                    }
                }
            });
        }
    });


    console.log("%c>>> Inicializando ambiente Emilio Tahara", "color: #00ff88; font-weight: bold; font-family: monospace; font-size: 14px;");
    console.log("%c[OK] Infraestrutura pronta.", "color: #00ff88; font-family: monospace;");
    console.log("%c[OK] Segurança validada.", "color: #00ff88; font-family: monospace;");
    console.log("%c[OK] Python rodando nos bastidores.", "color: #00ff88; font-family: monospace;");
    console.log("%cQue bom ter você por aqui. Procure os lugares certos para a pessoa certa.", "color: #9ca3af; font-family: monospace;");
});
