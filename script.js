

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
            e.preventDefault();
            const targetElement = document.querySelector(this.getAttribute('href'));

            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });


    console.log("%c>>> Inicializando ambiente Emilio Tahara", "color: #00ff88; font-weight: bold; font-family: monospace; font-size: 14px;");
    console.log("%c[OK] Infraestrutura pronta.", "color: #00ff88; font-family: monospace;");
    console.log("%c[OK] Segurança validada.", "color: #00ff88; font-family: monospace;");
    console.log("%c[OK] Python rodando nos bastidores.", "color: #00ff88; font-family: monospace;");
    console.log("%cQue bom ter você por aqui. Procure os lugares certos para a pessoa certa.", "color: #9ca3af; font-family: monospace;");
});
