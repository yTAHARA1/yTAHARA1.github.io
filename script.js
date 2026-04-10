/**
 * Logica das animações de scroll e micro-interações
 */

document.addEventListener("DOMContentLoaded", () => {
    
    // 1. Efeito Reveal on Scroll
    // O IntersectionObserver verifica se um elemento com a classe .reveal apareceu na tela
    const observerOptions = {
        root: null,
        rootMargin: "0px",
        threshold: 0.1 // Ativa quando 10% do elemento está visível
    };

    const revealObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Adiciona a classe 'active' que dispara a transição no CSS
                entry.target.classList.add("active");
                // Remove a observação do elemento após ele ser revelado
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const revealElements = document.querySelectorAll(".reveal");
    revealElements.forEach(el => {
        revealObserver.observe(el);
    });

    // 2. Comportamento suave no Menu (Smooth Scroll)
    // O CSS "scroll-behavior: smooth;" já resolve a maior parte, 
    // mas scripts adicionais garantem uma distância correta (header fixo).
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const targetElement = document.querySelector(this.getAttribute('href'));
            
            if(targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth'
                });
            }
        });
    });

    // 3. Efeito log no console do desenvolvedor (Easter Egg para recrutadores técnicos)
    console.log("%c>>> Inicializando ambiente Emilio Tahara", "color: #00ff88; font-weight: bold; font-family: monospace; font-size: 14px;");
    console.log("%c[OK] Infraestrutura pronta.", "color: #00ff88; font-family: monospace;");
    console.log("%c[OK] Segurança validada.", "color: #00ff88; font-family: monospace;");
    console.log("%c[OK] Python rodando nos bastidores.", "color: #00ff88; font-family: monospace;");
    console.log("%cQue bom ter você por aqui. Procure os lugares certos para a pessoa certa.", "color: #9ca3af; font-family: monospace;");
});
