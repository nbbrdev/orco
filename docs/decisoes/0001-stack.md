# ADR-0001 — Stack principal

- **Status:** aceito
- **Data:** 2026-09-27

## Contexto
O Orçô é um SaaS público e gratuito, mantido por uma pessoa, hospedado na Vercel com Supabase. As prioridades são velocidade de desenvolvimento, custo zero no MVP, boa experiência mobile e segurança.

## Decisão
- **Next.js (App Router) + TypeScript strict + pnpm.** Integração nativa com a Vercel, Server Components e Server Actions para manter a lógica no servidor.
- **Supabase** (Postgres + Auth + Storage) com `@supabase/ssr`. Auth pronto, RLS no banco, plano Free.
- **Tailwind + shadcn/ui.** Componentes acessíveis (Radix) copiados para o repo, sem lock-in.
- **React Hook Form + Zod.** Formulários dinâmicos (itens do orçamento) e um schema compartilhado entre client e servidor.
- **Vitest + Playwright.** Unitário para a lógica de dinheiro e regras; E2E para os fluxos críticos.

## Consequências
- Um único runtime (Node/TS) de ponta a ponta.
- Dependência de Vercel e Supabase. Mitigação: Postgres padrão com migrations SQL portáveis.
- Sentry e Upstash ficam fora do MVP (ver ADR-0004).
