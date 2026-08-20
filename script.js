

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

    if (titleEl && subtitleEl) {
        const titleHtml = titleEl.innerHTML;
        const subtitleHtml = subtitleEl.innerHTML;
        
        // Check for reduced motion preference
        const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        
        if (prefersReducedMotion) {
            // Show immediately
            titleEl.innerHTML = titleHtml;
            subtitleEl.innerHTML = subtitleHtml;
        } else {
            // Set up containers
            titleEl.innerHTML = "";
            subtitleEl.innerHTML = "";
            if (skipBtn) skipBtn.style.display = "inline-block";

            let titleIndex = 0;
            let subtitleIndex = 0;
            let titleTimer = null;
            let subtitleTimer = null;
            
            // Add cursor
            const cursor = document.createElement("span");
            cursor.className = "terminal-cursor";
            titleEl.appendChild(cursor);

            function typeTitle() {
                if (titleIndex < titleHtml.length) {
                    // Remove cursor temporarily to insert text
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
                    titleTimer = setTimeout(typeTitle, 25);
                } else {
                    // Title done, move cursor to subtitle
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
                    subtitleTimer = setTimeout(typeSubtitle, 15);
                } else {
                    // Complete
                    finishTyping();
                }
            }

            function finishTyping() {
                clearTimeout(titleTimer);
                clearTimeout(subtitleTimer);
                cursor.remove();
                titleEl.innerHTML = titleHtml;
                subtitleEl.innerHTML = subtitleHtml;
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

            // Start typing
            typeTitle();
        }
    }


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
            const parentSection = pane.closest(".spa-section");
            if (parentSection && ["login", "admin", "perguntas"].includes(parentSection.id)) {
                parentSection.style.display = "none";
                window.location.hash = "home";
                const homeSec = document.getElementById("home");
                if (homeSec) homeSec.scrollIntoView({ behavior: 'smooth' });
            }
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
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
