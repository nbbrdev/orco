# 06 — Regras de desenvolvimento e processo

> Status: rascunho para validação · Última atualização: 2026-09-27

## 1. Fontes da verdade

| O quê | Onde |
|---|---|
| Conteúdo: escopo, regras, fluxos, arquitetura, dados, segurança | `/docs` no repositório |
| Planejamento e andamento: fases, milestones, issues, status, prioridade | Linear, projeto **Orçô** (time Nbbr dev) |
| Espelho dos docs para consulta e comentários | Linear Docs do projeto |

- Uma mudança em `/docs` é refletida no Linear Doc correspondente **na mesma sessão**, e vice-versa.
- Uma mudança de escopo atualiza [02-escopo.md](02-escopo.md) e o Linear Doc "Escopo". Uma decisão técnica gera um ADR em [decisoes/](decisoes/).
- **Nada é implementado fora do escopo.** Ideias novas viram issue no Linear em **Backlog, sem milestone**, até serem promovidas.
- Pendências ficam marcadas inline com `> ⚠️ PENDENTE:`, listadas em [pendencias.md](pendencias.md) e registradas como issue `docs` na M0.
- Regras de negócio (`RN-xx`), requisitos (`RF/RNF-xx`) e fluxos (`F-xx`) **nunca são renumerados**; os revogados ficam riscados.

## 1.1 Regras de trabalho com agentes de IA

Definidas pelo usuário e válidas para qualquer agente (ex.: Claude Code) que trabalhe no repositório:

| # | Regra |
|---|---|
| RT-01 | Criar e editar arquivos **somente** com as ferramentas de edição do agente (Write/Edit), para que cada mudança apareça como diff revisável. **Proibido** usar scripts Python, `sed`, `awk`, heredocs ou redirecionamento de shell para modificar arquivos. |
| RT-02 | **Código sempre em inglês**: variáveis, funções, classes, tipos, nomes de arquivo de código, tabelas, colunas, enums. Textos de UI, URLs e mensagens ao usuário final ficam em pt-BR. |
| RT-03 | O agente não decide sozinho questões técnicas ou de produto relevantes: apresenta opções com prós e contras e uma recomendação, e o usuário decide. O que o usuário não confirmou fica como "proposto". |

Novas regras de trabalho são adicionadas aqui (RT-xx) e em `CLAUDE.md`.

## 2. Filtro de simplicidade

Antes de qualquer feature ou PR, responda: **isso adiciona passo, campo obrigatório ou tela ao fluxo principal?** Se sim, é preciso justificativa escrita na issue e aprovação. Na dúvida, fica de fora. Ver [01-visao.md](01-visao.md).

## 3. Linear

- Toda tarefa de código tem uma issue.
- Toda issue tem **milestone** (fase), exatamente **um label de Área** (grupo de seleção única: `Docs`, `Frontend`, `Backend`, `Database`, `Infra`, `Security`, `UX`) e, quando aplicável, um **tipo** (`Feature`, `Bug`, `Improvement`).
- Nomes de labels sempre começam com letra maiúscula.
- A descrição da issue traz contexto, referências (RN/RF/F), critérios de aceite em checklist e fora de escopo.
- Status: `Backlog` → `Todo` (fase atual) → `In Progress` → `Done`. Com a integração GitHub↔Linear, o PR aberto move para In Progress e o merge move para Done.
- Issues de validação (fluxos, regras) só fecham com **aprovação explícita do usuário**.

## 4. Git e GitHub

- Branch padrão `main`, **protegida**: sem push direto, PR obrigatório, CI + CodeQL verdes, histórico linear (squash merge), branch atualizada.
- Branch: `<tipo>/<ID-linear>-<descricao-curta>`, ex.: `feat/NBB-12-editor-orcamento`.
- Commits em **Conventional Commits**, em pt-BR, com o ID do Linear:
  `feat(quotes): adiciona desconto percentual [NBB-12]`
  Tipos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `perf`, `security`.
- PR: título igual ao do commit squash; o template traz a issue do Linear, o que mudou, como testar, os checklists de segurança ([07-seguranca.md](07-seguranca.md)) e de simplicidade, e o impacto em `/docs`.
- Um PR resolve uma issue. PRs pequenos.
- O **título do PR** segue Conventional Commits e é validado no CI (`pr-title.yml`), porque é ele que vira o commit no squash merge e alimenta o versionamento.

## 4.1 Versionamento e releases (ADR-0010)

- **SemVer** calculado dos commits: `fix:` → patch · `feat:` → minor · `feat!:` / `BREAKING CHANGE:` → major. Fase `0.x` até o go-live; `1.0.0` no lançamento.
- Merge na `main` = deploy em **staging**, nunca em produção.
- O **release-please** mantém um PR de release (`chore(main): release X.Y.Z`). **Lançar = fazer merge desse PR**: gera a tag `vX.Y.Z`, o GitHub Release e o `CHANGELOG.md`, e o workflow `release.yml` aplica as migrations e publica em produção.
- Nunca criar tags ou editar o `CHANGELOG.md` / a versão do `package.json` à mão.
- Meta de versões por fase: M1 → `0.1.0`, M2 → `0.2.0`, …, M6 → `0.6.0`, M7 (go-live) → `1.0.0`.
- Notas de cada versão também são publicadas como status update do projeto no Linear.

## 5. Código

- TypeScript `strict`, `noUncheckedIndexedAccess`. Sem `any` (use `unknown` + Zod).
- ESLint (`next/core-web-vitals` + `typescript-eslint` strict) e Prettier. O CI falha com warning.
- Identificadores, banco e arquivos de código em **inglês**. Textos da UI, URLs e mensagens em **pt-BR**.
- Organização por domínio em `src/features/<feature>/` (ver [04-arquitetura.md](04-arquitetura.md)).
- Server Components por padrão; `"use client"` só onde há interação.
- Mutações só via **Server Actions** (ou Route Handlers quando for binário/arquivo). Nunca escrever no banco a partir do client.
- Um schema Zod por entidade em `schemas.ts`, reutilizado no client (RHF) e no servidor.
- Dinheiro: **sempre centavos (`bigint` no banco, `number` inteiro no TS)**, com cálculo apenas em `src/lib/money.ts` e formatação só na borda (ADR-0006).
- Datas: `valid_until` como `date`; "hoje" sempre no fuso `America/Sao_Paulo` (`src/lib/dates.ts`).
- **Portabilidade (ADR-0011):** proibido usar `@vercel/*` ou recursos exclusivos da Vercel; o código deve rodar em `next start`/standalone.
- Componentes de UI: shadcn/ui em `src/components/ui` (não editar sem motivo); componentes do produto fora dessa pasta.
- Acessibilidade: todo input com label, todo botão-ícone com `aria-label`.
- **Visual:** cores, tipografia, cantos e status só pelos tokens de [12-identidade-visual.md](12-identidade-visual.md) (variáveis CSS mapeadas no Tailwind/shadcn). Nada de cor literal em componente.

## 6. Banco

- Acesso ao banco via `supabase-js` com tipos gerados, **sem ORM** (ADR-0008).
- O schema é **declarativo** em `supabase/schemas/*.sql`. Toda mudança começa ali → `supabase db diff -f <nome>` gera a migration → revisão manual da migration → `supabase db reset` para testar do zero.
- Nunca alterar o banco pelo painel em staging ou produção; migrations chegam lá só pelo CI.
- Uma migration aplicada nunca é editada; a correção vem em nova migration.
- Depois de cada migration: `supabase gen types typescript` → `src/types/database.ts` (commitado).
- Tabela nova = RLS + policies + teste de RLS no mesmo PR.
- [05-dados.md](05-dados.md) atualizado no mesmo PR.

## 7. Testes

| Tipo | Ferramenta | Obrigatório para |
|---|---|---|
| Unitário | Vitest | `money.ts` (100%), `dates.ts`, schemas Zod, validação CPF/CNPJ, transições de status |
| RLS/banco | Vitest + Supabase local (ou pgTAP) | toda tabela e função |
| E2E | Playwright | F-01, F-05, F-06, F-07, F-08 (RNF-15) |

Bug corrigido = teste que reproduz o bug.

## 8. Variáveis de ambiente

| Variável | Onde | Pública? |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Vercel, local | Sim |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (anon) | Vercel, local | Sim |
| `SUPABASE_SERVICE_ROLE_KEY` (secret key) | Vercel (server), local | **Não** |
| `NEXT_PUBLIC_SITE_URL` | Vercel, local | Sim |
| `RESEND_API_KEY` | Vercel (server), local | **Não** |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Vercel, local | Sim |
| `TURNSTILE_SECRET_KEY` | Vercel (server), local | **Não** |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Vercel, local | Sim |
| `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:`) | Vercel (server), local | **Não** |
| `CRON_SECRET` | Vercel (server) | **Não** |
| Resend SMTP, Google OAuth secret | **Painel do Supabase** (não no app) | Não |
| `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` e project refs (staging/prod) para `db push` | GitHub Secrets | Não |
| `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` (deploy de produção no release) | GitHub Secrets | Não |
| `LINEAR_API_KEY` (status update do projeto no release) | GitHub Secrets | Não |
| `NEXT_PUBLIC_APP_VERSION` (injetada no build a partir do `package.json`) | build | Sim |
| `STAGING_BASIC_AUTH_USER`, `STAGING_BASIC_AUTH_PASSWORD` | Vercel, **somente Preview** | **Não** |
| `SUPABASE_DB_URL` (Session Pooler do prod), `BACKUP_AGE_PUBLIC_KEY` | GitHub Secrets | Não |
| Chave **privada** do `age` (restauração de backups) | **Somente** com o dono do projeto (gerenciador de senhas), nunca no GitHub | Não |

`.env.example` lista todas, sem valores.

## 9. Definição de pronto (DoD)

- [ ] Critérios de aceite da issue atendidos
- [ ] Orçamento de simplicidade do fluxo respeitado (ver [10-fluxos.md](10-fluxos.md))
- [ ] Testes exigidos escritos e passando; CI e CodeQL verdes
- [ ] Checklist de segurança do PR ok
- [ ] Testado no celular (360 px) e no desktop
- [ ] `/docs` e Linear Docs atualizados, se algo mudou
- [ ] Preview da Vercel revisado
