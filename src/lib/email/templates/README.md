# Templates de e-mail (referência para a M2)

HTML dos e-mails de conta **já aprovados pelo usuário** (NBB-37): pt-BR, logo à esquerda do nome, botão teal e rodapé "Esta caixa não recebe respostas".

| Arquivo                              | E-mail                               |
| ------------------------------------ | ------------------------------------ |
| `confirmation.html`                  | Confirme seu e-mail                  |
| `recovery.html`                      | Redefina sua senha                   |
| `email_change.html`                  | Confirme a troca de e-mail           |
| `magic_link.html`                    | Seu link de acesso (sem tela no MVP) |
| `password_changed_notification.html` | Sua senha foi alterada               |

- Estão no formato de template do Supabase Auth (`{{ .SiteURL }}`, `{{ .TokenHash }}`…), usado até 2026-09-29.
- Na **NBB-39 (M2)** viram funções TypeScript do módulo `src/lib/email/` (Nodemailer + SMTP, ADR-0016), com as variáveis inseridas **com escape** e os links apontando para as rotas do Better Auth.
- Depois da conversão, estes arquivos saem.
- A logo vem de `{SITE_URL}/email/logo.png` (`public/email/logo.png`).
