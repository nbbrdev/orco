# ADR-0009 — PWA, notificações push e jobs agendados

- **Status:** aceito (validado pelo usuário em 2026-09-27)
- **Data:** 2026-09-27

## Contexto
Na validação do escopo, o usuário incluiu no MVP: PWA instalável, lembrete de vencimento e notificações push (resposta do cliente, lembrete e visualização). É preciso definir como fazer isso sem serviços pagos e sem comprometer a simplicidade.

## Decisão

### PWA
- `app/manifest.ts` do Next.js (nome "Orçô", ícones, `display: standalone`, cores do tema).
- Service worker próprio e mínimo (`public/sw.js`): trata **apenas** os eventos `push` e `notificationclick`. **Sem cache offline** e sem bibliotecas como Workbox ou next-pwa.

### Push
- **Web Push padrão** com a lib `web-push` no servidor e chaves **VAPID**. Sem Firebase Cloud Messaging nem OneSignal.
- Tabela `push_subscriptions` (N aparelhos por usuário); assinaturas 404/410 são apagadas.
- A permissão é pedida só após o 1º orçamento enviado (RN-45); no iPhone, exige o app instalado (iOS 16.4+).

### E-mail + push centralizados
- `src/lib/notify.ts` → `notifyFreelancer(userId, event)`: respeita as preferências, envia os dois canais em paralelo e nunca propaga erro (RN-42).

### Jobs agendados
- **Vercel Cron** (1×/dia) para o lembrete de vencimento: precisa enviar e-mail e push, o que é código da aplicação.
- **pg_cron** continua só para manutenção interna do banco (anonimizar IPs, RN-37).

## Alternativas descartadas
- **OneSignal / FCM:** mais uma conta e SDK de terceiros no client, e os dados dos usuários passam por eles. O Web Push padrão resolve.
- **pg_cron + pg_net chamando a API do Resend direto do banco:** lógica de notificação duplicada em SQL, e o push ficaria difícil de enviar dali.
- **next-pwa / Workbox:** voltados a cache offline, que está fora do escopo; um SW de ~30 linhas basta.

## Consequências
- Novas variáveis: `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET`.
- Testes manuais em Android, iPhone (instalado) e desktop, já que push é difícil de testar em E2E.
- Trocar as chaves VAPID invalida as assinaturas existentes.
