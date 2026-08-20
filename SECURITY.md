# Segurança do portfólio

Este projeto usa Firebase Authentication, Cloud Firestore e App Check. As alterações de segurança devem ser publicadas em etapas para evitar a interrupção do site.

## Ordem segura de publicação

1. Publique primeiro os arquivos do site (`index.html`, `app.js`, `firebase-config.js` e `security-utils.js`).
2. Teste cadastro, verificação de e-mail, entrada, envio de pergunta e painel administrativo.
3. Somente depois publique `firestore.rules` no Firebase Console.
4. Mantenha o App Check sem imposição por 24 a 48 horas e acompanhe as métricas.
5. Quando as solicitações válidas estiverem reconhecidas, ative a imposição primeiro no Cloud Firestore e, depois, no Authentication.

## Testes locais

Instale as dependências com `pnpm install` e execute `pnpm test`. Os testes usam o simulador local e nunca acessam o banco de produção.

## App Check em ambiente local

O site gera um token de depuração apenas em `localhost` ou `127.0.0.1`. Copie o token exibido no console do navegador e cadastre-o em Firebase Console > App Check > Gerenciar tokens de depuração. Nunca salve esse token no repositório nem o compartilhe.

## Observações

- A chave de site do reCAPTCHA Enterprise é pública; tokens de depuração não são.
- Remover um documento da coleção `users` bloqueia o perfil no site, mas não exclui a conta do Firebase Authentication. A conta deve ser removida separadamente no Firebase Console.
- O site aceita somente links HTTPS nos projetos e certificados.
