# Orçô — instruções para agentes

@AGENTS.md

> **Next.js 16:** antes de escrever código de Next, consulte `node_modules/next/dist/docs/`. Exemplo de mudança: o antigo `middleware.ts` agora se chama **`proxy.ts`** (`src/proxy.ts`).

SaaS gratuito para freelancers criarem orçamentos (slug técnico `orco`). Next.js + Supabase + Vercel.
Produção: https://orco.nbbrdev.com · Repo: `nbbrdev/orco` (público) · Linear: time "Nbbr dev" (chave `NBB`), projeto "Orçô".

## Fontes da verdade
- **Conteúdo:** `docs/`. Leia `docs/README.md` primeiro. Escopo em `docs/02-escopo.md`: **nada fora dele é implementado**.
- **Planejamento:** Linear, time "Nbbr dev", projeto "Orçô". Toda tarefa de código tem issue; branches e commits citam o ID.
- Mudou `docs/`? Atualize o Linear Doc correspondente na mesma sessão, e vice-versa.

## Fase atual
**M1: Setup técnico** (M0 concluída em 2026-09-28). Meta: `v0.1.0` no ar. Sequência de PRs e issues no milestone M1 do Linear.
Stack de ferramentas: **Node 24 LTS**, **npm**, Supabase CLI como devDependency (`npx supabase`), Vercel CLI via `npx vercel`.

## Como trabalhar com o usuário
- O usuário quer **participar das decisões técnicas e aprender**. Não decida sozinho: apresente opções com prós e contras e uma recomendação, e pergunte.
- Decisão que ele não confirmou fica como **proposto** nos ADRs.
- Explicações necessárias para uma decisão vão **dentro** da pergunta (texto/preview das opções): texto escrito antes da pergunta pode não aparecer para ele.
- **Eu implemento, ele revisa:** um PR por issue, com explicação do que e por quê; merge (squash) só após o OK dele.

## Regras de trabalho (definidas pelo usuário)
1. **Sempre use as ferramentas Write e Edit para criar ou editar arquivos.** Nada de scripts Python, `sed`, `awk`, heredocs ou redirecionamento de shell para modificar arquivos: o usuário acompanha as mudanças pelos diffs. Exceção: geradores/CLIs oficiais (`create-next-app`, `shadcn`, `supabase init/db diff/gen types`, `npm install`) podem criar arquivos, e o Prettier (`npm run format`) pode reformatar; tudo é revisado no PR.
2. **Código sempre em inglês:** variáveis, funções, classes, tipos, arquivos de código, tabelas e colunas. Textos da UI, URLs e mensagens para o usuário final ficam em pt-BR.

## Regras inegociáveis
- **Simplicidade:** nada adiciona passo, campo obrigatório ou tela ao fluxo principal sem justificativa (`docs/01-visao.md`).
- **Segurança:** siga `docs/07-seguranca.md`. RLS em todas as tabelas; senhas só via Supabase Auth; autorização com `getUser()`/`getClaims()`, nunca `getSession()`; `service_role` só em `src/lib/supabase/admin.ts`; Zod no servidor.
- **Dinheiro** em centavos inteiros; cálculo só em `src/lib/money.ts`.
- **Portabilidade:** nada de `@vercel/*` ou recursos exclusivos da Vercel; o app vai migrar para uma VPS após o `1.0.0` (ADR-0011).
- **Repo público:** nenhum segredo, dado real ou PII em código, docs, seeds ou testes.
- Commits e **títulos de PR** em Conventional Commits, pt-BR, com o ID do Linear: eles definem a versão (SemVer via release-please, ADR-0010).
- Produção só recebe **releases** (merge do PR do release-please → tag `vX.Y.Z`). Nunca criar tags, editar o `CHANGELOG.md` ou a versão do `package.json` à mão.
- Regras numeradas (RN, RF, RNF, F, ADR) nunca são renumeradas.
