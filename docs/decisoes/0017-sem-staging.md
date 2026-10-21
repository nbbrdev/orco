# ADR-0017 — Sem staging: a produção é o único ambiente na VPS

- **Status:** aceito (decidido pelo usuário em 2026-10-21, NBB-122)
- **Data:** 2026-10-21
- **Revisa:** o staging dos ADR-0008, ADR-0010 e ADR-0012

## Contexto
Desde a M1, a VPS tinha dois ambientes: o **staging** (`staging.orco.nbbrdev.com`), publicado a cada merge na `main` com o CI verde, e a **produção**, publicada pela release criada pelo usuário. O staging servia para ver o código no ar antes da release e para testar o que precisa de HTTPS (PWA e push).

Depois do lançamento (`v1.0.0`), o projeto é pequeno, mantido por uma pessoa, e o staging virou mais uma coisa para manter: um segundo banco, um segundo `.env`, um cliente OAuth e uma chave do Resend a mais, o Basic Auth no app, um site no Nginx, uma linha no cron e um workflow. O usuário pediu para simplificar.

## Decisão
- **Remover o staging.** Na VPS fica só a produção (`/opt/orco/production`, projeto Compose `orco-production`).
- **A produção continua saindo pela release** criada pelo usuário (`gh release create vX.Y.Z --target main --generate-notes` → `production.yml`), como no ADR-0010 (S1-B). **O merge na `main` não publica nada.**
- **O CI continua como está**, com os testes de integração e os E2E (S2-C).
- **Ganha um job `image` no CI**, que monta a imagem Docker da produção em todo PR e push, sem enviar (IMG1-A). É um check obrigatório para o merge (IMG2-A). Era o staging que mostrava um `Dockerfile` quebrado logo depois do merge; sem ele, isso só apareceria na release.
- **Sai do código tudo o que era do staging** (S3-A): o Basic Auth (`src/lib/basic-auth.ts`), o `APP_ENV=staging`, o `staging.yml`, as variáveis `STAGING_*`, o bloqueio do staging no `robots.txt` e o caso `staging` do `deploy.sh` e do `daily.sh`. A comparação em tempo constante do segredo do agendamento diário vai para `src/lib/security/safe-equal.ts`.

## Consequências
- **Menos para manter** no código, na VPS, no GitHub, no Google e no Resend.
- **Não há mais onde ver o código no ar antes da release.** O teste é local (`npm run dev`, ou `npm run build && npm run start`), e o que precisa de HTTPS (PWA, push, login real com o Google) é testado direto na produção.
- **Uma release aplica as migrations direto na produção**, sem passar antes por outro banco. Isso reforça o backup obrigatório antes de toda release (docs/06 §4.1) e a regra de toda migration ser compatível com a versão anterior do código.
- **Desmontagem fora do repositório** (feita pelo usuário, passo a passo em `deploy/README.md`): o projeto `orco-staging` na VPS (containers, volumes, `/opt/orco/staging`), o site no Nginx, o certificado, a linha do cron, a chave de deploy no `authorized_keys`, o registro DNS `staging.orco`, o environment `staging` no GitHub, o cliente OAuth `orco-staging` no Google e a chave do staging no Resend.
