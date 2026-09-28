# ADR-0011 — Hospedagem: Vercel no MVP, VPS após o lançamento

- **Status:** aceito (validado pelo usuário em 2026-09-27)
- **Data:** 2026-09-27

## Contexto
O plano Hobby da Vercel é gratuito, mas restrito a uso não comercial. O usuário quer começar na Vercel e **migrar o app para uma VPS própria após o lançamento (`1.0.0`)**. Foi avaliado também trocar o Supabase por um Postgres puro na VPS.

## Decisão

### Hospedagem
- **MVP (até `1.0.0`): Vercel Hobby.** O Orçô é gratuito, sem anúncios nem cobrança, portanto não comercial.
- **Após o `1.0.0`: migrar o app Next.js para uma VPS própria** (Docker com `output: 'standalone'`, atrás de Caddy/Nginx com HTTPS). A migração vira um projeto próprio, planejado no pós-lançamento.
- Se houver monetização **antes** da migração, a Vercel precisa ir para o plano Pro.

### Banco, Auth e Storage
- **Continuam no Supabase.** Na migração, escolher entre:
  1. **Supabase gerenciado** (app na VPS, dados no Supabase Cloud); ou
  2. **Supabase self-hosted** na VPS (Docker Compose), com as mesmas APIs.
- As duas opções **não exigem mudança de código**.

### Regra de portabilidade (vale desde já)
- **Proibido** usar pacotes `@vercel/*` e recursos exclusivos da Vercel (Edge Config, KV, Blob, Postgres, `@vercel/og`, Analytics pagos etc.) sem novo ADR.
- O cron de lembretes é uma **rota HTTP comum** protegida por `CRON_SECRET`: na Vercel é chamada pelo Vercel Cron; na VPS, por um cron do sistema.
- Configurações específicas da Vercel ficam restritas ao `vercel.json` e aos workflows de deploy.
- Usar só APIs do Next.js que funcionam em `next start`/standalone (ex.: `after()`, Route Handlers, proxy).

## Alternativas descartadas
- **Postgres puro na VPS:** o Supabase fornece Auth (GoTrue), RLS com `auth.uid()`, PostgREST/`supabase-js` e Storage, todos centrais na arquitetura (ADR-0002, 0005, 0008). Trocar exigiria reescrever autenticação, camada de dados, estratégia de RLS e storage (cerca de 40% do backend), além de migrar usuários e arquivos.
- **Vercel Pro desde o início:** custo sem necessidade enquanto o produto for gratuito.

## Consequências
- ~~Na VPS perdemos os previews automáticos por PR: será preciso um substituto (ex.: staging fixo na VPS) no projeto de migração.~~ **Revisão (2026-09-28, NBB-35):** o projeto já não usa preview por PR; o staging fixo existe desde a M1. Se fizer falta na VPS, ferramentas como Coolify ou Dokploy oferecem preview por PR.
- ~~O workflow de release (ADR-0010) terá o passo de deploy trocado (Vercel CLI → build de imagem + deploy na VPS).~~ **Revisão (2026-09-28, NBB-35):** o pipeline da VPS foi antecipado. Staging e produção já publicam pelo GitHub Actions, e só a receita `deploy-vercel.yml` conhece a Vercel. Na migração, troca-se só esse arquivo (Vercel CLI → build de imagem + deploy na VPS) e apaga-se `tools/deploy/` e `vercel.json`. O gatilho de produção (release criada pelo usuário → `production.yml`: verify → migrate → deploy) continua igual na VPS; só o passo `deploy` muda (ex.: SSH + pull + build + restart, ou nova imagem Docker).
