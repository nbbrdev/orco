# Orçô — instruções para agentes

@AGENTS.md

> **Next.js 16:** antes de escrever código de Next, consulte `node_modules/next/dist/docs/`. Exemplo de mudança: o antigo `middleware.ts` agora se chama **`proxy.ts`** (`src/proxy.ts`).

SaaS gratuito para freelancers criarem orçamentos (slug técnico `orco`). Next.js + PostgreSQL (Drizzle, RLS) + Better Auth, numa **VPS própria com Docker Compose e Nginx** (ADR-0012 a 0016). Sem Supabase e sem Vercel desde 2026-09-29.
Produção: https://orco.nbbrdev.com · Repo: `nbbrdev/orco` (público) · Linear: time "Nbbr dev" (chave `NBB`), projeto "Orçô".

## Fontes da verdade
- **Conteúdo:** `docs/`. Leia `docs/README.md` primeiro. Escopo em `docs/02-escopo.md`: **nada fora dele é implementado**.
- **Planejamento:** Linear, time "Nbbr dev", projeto "Orçô". Toda tarefa de código tem issue; branches e commits citam o ID.
- Mudou `docs/`? Atualize o Linear Doc correspondente na mesma sessão, e vice-versa.

## Fase atual
**M5: PDF** (meta: `v0.5.0`). A **M4** foi concluída em 2026-10-03, com a `v0.4.0` no ar (orçamentos com numeração, status e trava no banco; editor com itens, descontos e salvamento automático; lista com abas e busca; duplicar, excluir e prorrogar).

Ordem da M5 (decidida com o usuário em 2026-10-03; só a `v0.5.0` no fim, o staging recebe cada merge):
1. NBB-50: template do PDF com react-pdf e a marca do freelancer;
2. NBB-51: rotas de PDF (prévia, download do dono e download público).

Lembretes para a M6, na NBB-53: no modo leitura de aprovado/recusado, só as anotações internas são salvas (RN-20a); registrar visualizações não pode mudar o `updated_at` (o trigger `app.set_quote_updated_at` já cuida disso).

A base da VPS (compartilhada entre projetos) fica no repositório privado `nbbrdev/vps` (projeto "VPS" no Linear).

Stack de ferramentas: **Node 24 LTS**, **npm**, **Docker** (`compose.dev.yaml` local; `deploy/compose.yaml` na VPS), **Drizzle** (`drizzle-kit`), imagens no **GHCR**.

## Como trabalhar com o usuário
- O usuário quer **participar das decisões técnicas e aprender**. **Nenhuma decisão sozinho, nem as pequenas** (valores, limites, fusos, nomes, labels, regras novas, configurações extras): para cada uma, explique o problema, as soluções com prós e contras e uma recomendação, e pergunte **antes** de escrever. Se algo foi decidido sem ele, aponte antes do merge. Na dúvida, pergunte (RT-03).
- Decisão que ele não confirmou fica como **proposto** nos ADRs.
- Explicações de uma decisão vão **no chat**, num turno que termina com a pergunta em texto. Nada de explicação longa dentro do AskUserQuestion (fica difícil de ler), nem texto antes dele no mesmo turno (pode não aparecer).
- Responda sempre em **pt-BR**.
- **Eu implemento, ele revisa:** um PR por issue, com explicação do que e por quê; merge (squash) só após o OK dele.

## Regras de trabalho (definidas pelo usuário)
1. **Sempre use as ferramentas Write e Edit para criar ou editar arquivos.** Nada de scripts Python, `sed`, `awk`, heredocs ou redirecionamento de shell para modificar arquivos: o usuário acompanha as mudanças pelos diffs. Exceção: geradores/CLIs oficiais (`create-next-app`, `shadcn`, `drizzle-kit generate`, `npm install`) podem criar arquivos, e o Prettier (`npm run format`) pode reformatar; arquivos binários (ex.: PNG) só com autorização do usuário; tudo é revisado no PR.
2. **Código sempre em inglês:** variáveis, funções, classes, tipos, arquivos de código, tabelas e colunas. Textos da UI, URLs e mensagens para o usuário final ficam em pt-BR.

## Regras inegociáveis
- **Simplicidade:** nada adiciona passo, campo obrigatório ou tela ao fluxo principal sem justificativa (`docs/01-visao.md`).
- **Segurança:** siga `docs/07-seguranca.md`:
  - RLS (`ENABLE` + `FORCE`) em todas as tabelas do produto, com teste contra Postgres real;
  - o app conecta **só** como `app_user` (produto) e `app_auth` (login), nunca como `orco_owner`/superusuário;
  - todo acesso a dados do produto via `withUserDb(userId, …)`, com o usuário da **sessão validada no servidor**;
  - senhas só via Better Auth;
  - Zod no servidor;
  - módulos de banco, auth, e-mail e arquivos com `server-only`.
- **Dinheiro** em centavos inteiros; cálculo só em `src/lib/money.ts`.
- **Portabilidade:** o app roda como container `next start`/standalone; nada de SDKs presos a provedor de hospedagem; arquivos via API S3 e e-mail via SMTP (ADR-0012/0015/0016).
- **Repo público:** nenhum segredo, dado real ou PII em código, docs, seeds, testes ou imagem Docker. Segredos do app só nos `.env` da VPS.
- Commits e **títulos de PR** em Conventional Commits, pt-BR, com o ID do Linear: viram o histórico da `main` e as notas das releases (ADR-0010).
- Produção só recebe **versões criadas pelo usuário** (`gh release create vX.Y.Z --target main --generate-notes` → `production.yml`). O agente **nunca** publica tags ou releases; só cria um **rascunho** se o usuário pedir, e a publicação é sempre dele (docs/06-regras-dev.md §4.1).
- Regras numeradas (RN, RF, RNF, F, ADR) nunca são renumeradas.
