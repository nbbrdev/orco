# ADR-0016 — E-mails do app por SMTP (Nodemailer + Resend)

- **Status:** aceito (decidido pelo usuário em 2026-09-29)
- **Data:** 2026-09-29
- **Substitui:** o SMTP configurado no painel do Supabase Auth (NBB-37) e a "API do Resend no app" dos ADR-0002/0009

## Contexto
Sem o Supabase Auth, o **app** passa a enviar todos os e-mails:
- os de conta: confirmação, recuperação, troca de e-mail e aviso de senha alterada;
- as notificações ao freelancer: resposta do cliente e lembrete.

O domínio de envio `orco.nbbrdev.com` já está verificado no Resend (DKIM, SPF/MX; DMARC herdado).

## Decisão
- O app envia por **SMTP** com a biblioteca **Nodemailer**, num módulo único, `src/lib/email/`. **Só o destino muda** por ambiente:
  - **local:** o **Mailpit** do `compose.dev.yaml`. Nada sai para a internet, e os e-mails são vistos em `http://localhost:8025`;
  - **staging e produção:** `smtp.resend.com:465`, usuário `resend`, senha = API key do Resend (**só *Sending access*, só o domínio `orco.nbbrdev.com`**; já criadas: `supabase-smtp-staging` e `supabase-smtp-prod`).
- **Remetente:** `Orçô <nao-responda@orco.nbbrdev.com>`, sem Reply-To.
- **Templates:** os HTML em pt-BR já aprovados (logo à esquerda do nome, botão teal, rodapé "Esta caixa não recebe respostas") viram **funções TypeScript** que **escapam** qualquer texto variável (nome, e-mail) antes de inserir no HTML.
- Os links usam `SITE_URL` do ambiente. A logo vem de `{SITE_URL}/email/logo.png`.
- Falha no envio de **notificação** é logada sem PII e não quebra a ação que a originou (RN-42). Falha no envio de e-mail de **conta** é informada ao usuário ("não conseguimos enviar, tente de novo").
- Implementado na **M2**, junto do Better Auth (NBB-39).

## Alternativas descartadas
- **API HTTP do Resend:** tem recursos extras (agendamento, lote), mas é específica do Resend e não funciona com o Mailpit. Exigiria um caminho de envio só para o ambiente local.

## Consequências
- Um único caminho de envio em todos os ambientes, testável localmente.
- Trocar de provedor de e-mail = trocar host e senha no `.env`.
- Variáveis `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` e `EMAIL_FROM`, só no servidor.
- Limite do Resend Free (100/dia, 3.000/mês) vale para todos os e-mails somados.
