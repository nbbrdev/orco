# ADR-0001 — Stack principal

- **Status:** aceito; **parcialmente substituído** em 2026-09-29
- **Data:** 2026-09-27

> **Revisão (2026-09-29):** Supabase e Vercel saíram da stack. Hospedagem: [ADR-0012](0012-hospedagem-vps.md) (VPS + Docker). Login: [ADR-0013](0013-auth-better-auth.md) (Better Auth). Banco: [ADR-0014](0014-banco-drizzle-rls-roles.md) (Postgres + Drizzle + RLS). Arquivos: [ADR-0015](0015-arquivos-rustfs.md) (RustFS). E-mail: [ADR-0016](0016-email-smtp.md) (SMTP). O resto da stack continua: Next.js, TypeScript, Tailwind/shadcn, RHF + Zod, Vitest/Playwright.

## Contexto
O Orçô é um SaaS público e gratuito, mantido por uma pessoa, hospedado na Vercel com Supabase. As prioridades são velocidade de desenvolvimento, custo zero no MVP, boa experiência mobile e segurança.

## Decisão
- **Next.js (App Router) + TypeScript strict + npm + Node 24 LTS.** Integração nativa com a Vercel, Server Components e Server Actions para manter a lógica no servidor.
- **Supabase** (Postgres + Auth + Storage) com `@supabase/ssr`. Auth pronto, RLS no banco, plano Free.
- **Tailwind + shadcn/ui.** Componentes acessíveis (Radix) copiados para o repo, sem lock-in.
- **React Hook Form + Zod.** Formulários dinâmicos (itens do orçamento) e um schema compartilhado entre client e servidor.
- **Vitest + Playwright.** Unitário para a lógica de dinheiro e regras; E2E para os fluxos críticos.

## Revisões
- **2026-09-28:** gerenciador de pacotes trocado de **pnpm para npm** (decisão do usuário: nada extra para instalar; o npm já vem com o Node). Custos aceitos: instalação um pouco mais lenta, mais disco e menos rigidez contra dependências não declaradas, mitigada pelo ESLint (`import/no-extraneous-dependencies`). Runtime fixado em **Node 24 LTS** (`.nvmrc` + `engines`).
- **2026-09-28 · Tema com next-themes:** o usuário pode escolher **Automático** (padrão, segue o sistema), **Claro** ou **Escuro**. Antes, o tema seguia só o sistema via CSS puro. Com o next-themes, a classe `.dark` vai no `<html>` e a escolha fica no `localStorage` do navegador. Ele injeta um script inline que evita a "piscada" do tema errado e que precisa receber o `nonce` da CSP (NBB-36). Custos aceitos: +1 dependência e +1 opção no perfil; a escolha vale por aparelho, não por conta.

## Consequências
- Um único runtime (Node/TS) de ponta a ponta.
- Dependência de Vercel e Supabase. Mitigação: Postgres padrão com migrations SQL portáveis.
- Sentry e Upstash ficam fora do MVP (ver ADR-0004).
