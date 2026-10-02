# 06 — Regras de desenvolvimento e processo

> Status: rascunho para validação · Última atualização: 2026-09-29

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
| RT-01 | Criar e editar arquivos **somente** com as ferramentas de edição do agente (Write/Edit), para que cada mudança apareça como diff revisável. **Proibido** usar scripts Python, `sed`, `awk`, heredocs ou redirecionamento de shell para modificar arquivos. **Exceção (2026-09-28):** geradores e CLIs **oficiais** podem criar arquivos (`create-next-app`, `shadcn add`, `drizzle-kit generate` para as migrations, `npm install` para o lockfile) e o **Prettier** pode reformatar arquivos (`npm run format`, só forma, nunca lógica); tudo é revisado no diff do PR. |
| RT-02 | **Código sempre em inglês**: variáveis, funções, classes, tipos, nomes de arquivo de código, tabelas, colunas, enums. Textos de UI, URLs e mensagens ao usuário final ficam em pt-BR. |
| RT-03 | O agente **não toma nenhuma decisão sozinho, nem as que parecem pequenas** (valores, limites, fusos, nomes, labels, regras novas, configurações extras). Para cada uma, explica **o problema**, apresenta as soluções possíveis com prós e contras e uma recomendação, e o usuário decide **antes** de o agente escrever. Algo decidido sem o usuário é apontado antes do merge. Só o que é puramente mecânico (ex.: formatação, seguir um padrão já decidido) dispensa a pergunta; na dúvida, pergunta. O que o usuário não confirmou fica como "proposto". Revisado em 2026-09-30 (NBB-74). |

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

- Branch padrão `main`, **protegida** (inclusive para administradores): sem push direto, PR obrigatório, CI + CodeQL + título de PR verdes, histórico linear, conversas resolvidas, sem force push nem exclusão.
- **Aprovações exigidas: 0.** O repositório tem uma única conta (nbbrdev), e o GitHub não permite aprovar o próprio PR. A revisão acontece na conversa com o agente, antes do merge.
- Merge **somente squash**; a branch é apagada automaticamente. O commit na `main` usa **o título do PR** e fica **sem corpo** (o contexto está no PR, linkado pelo `(#n)` do título).
- Branch: `<tipo>/<ID-linear>-<descricao-curta>`, ex.: `feat/NBB-12-editor-orcamento`.
- Commits em **Conventional Commits**, em pt-BR, com o ID do Linear:
  `feat(quotes): adiciona desconto percentual [NBB-12]`
  Tipos: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `perf`, `security`.
- PR: título igual ao do commit squash; o template traz a issue do Linear, o que mudou, como testar, os checklists de segurança ([07-seguranca.md](07-seguranca.md)) e de simplicidade, e o impacto em `/docs`.
- Um PR resolve uma issue. PRs pequenos.
- O **título do PR** segue Conventional Commits e é validado no CI (`pr-title.yml`). É ele que vira o commit no squash merge, e o padrão serve para três coisas:
  - histórico da `main` legível (novidade, correção, manutenção);
  - vínculo com a issue do Linear;
  - **notas das releases**, que o GitHub gera a partir dos títulos dos PRs.

## 4.1 Versionamento e releases (ADR-0010, revisado em 2026-09-28)

- **Merge na `main` = deploy automático em staging** (`staging.yml`), nunca em produção.
- **Produção só recebe versões criadas pelo usuário**, com uma tag `vX.Y.Z` no commit da `main`. O agente **nunca** publica tags ou releases; só cria um **rascunho** a pedido do usuário, que revisa e publica.
- **Como lançar:**
  0. **Fazer o backup do banco da produção pelo DBeaver** (`deploy/README.md`, "Backup pelo DBeaver"). Não há backup automático, e a release aplica migrations na produção (decisão do usuário em 2026-09-30).
  1. Conferir que o CI da `main` está verde.
  2. Escolher o número (**SemVer**) olhando os títulos dos PRs desde a última versão:
     - algum `feat` → sobe o **minor** (0.1.0 → 0.**2**.0);
     - só `fix`/`perf`/`security` → sobe o **patch** (0.1.0 → 0.1.**1**);
     - na fase `0.x`, mudança que quebra (`feat!`) também sobe só o minor;
     - `1.0.0` no go-live.
  3. `gh release create vX.Y.Z --target main --generate-notes`. Cria a tag e a página da versão, com notas geradas dos títulos dos PRs.
  4. O workflow `production.yml` roda sozinho:
     - **verify**: a tag está no formato `vX.Y.Z`, está na `main` e o CI daquele commit passou;
     - **build**: imagem `vX.Y.Z` no GHCR (receita comum `deploy-vps.yml`, a mesma do staging);
     - **deploy**: SSH com a chave da produção → `deploy.sh production` → migrations no banco de produção → `docker compose up -d` no projeto `orco-production` (ADR-0012).
  5. Conferir `https://orco.nbbrdev.com`: a versão nova aparece na página.
- **Hotfix:** PR `fix:` → merge → nova versão patch.
- **Rollback de código:** "Re-run all jobs" na execução do `production.yml` de uma versão anterior (a imagem antiga continua no GHCR). Migrations **não voltam**: a correção vem numa migration nova, e por isso toda migration precisa ser compatível com a versão anterior do código.
- A versão é **a tag**. O `package.json` **não tem** o campo `version` (o app é `private`, nunca publicado no npm), para não existir um número desatualizado. O app mostra a versão via `NEXT_PUBLIC_APP_VERSION`, injetada no build. Não há `CHANGELOG.md`: as notas ficam nas GitHub Releases.
- Meta de versões por fase: M1 → `0.1.0`, M2 → `0.2.0`, …, M6 → `0.6.0`, M7 (go-live) → `1.0.0`.

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
- **Portabilidade (ADR-0012):** o app roda como `next start`/standalone num container; nada de SDKs presos a um provedor de hospedagem (ex.: `@vercel/*`). Arquivos via API S3 (ADR-0015) e e-mail via SMTP (ADR-0016), trocáveis por configuração.
- **Server-only:** módulos com segredos ou acesso direto a banco, arquivos e e-mail (`src/lib/db`, `src/lib/auth`, `src/lib/storage`, `src/lib/email`) começam com `import "server-only"`.
- Componentes de UI: shadcn/ui em `src/components/ui` (não editar sem motivo); componentes do produto fora dessa pasta.
- Acessibilidade: todo input com label, todo botão-ícone com `aria-label`.
- **Visual:** cores, tipografia, cantos e status só pelos tokens de [12-identidade-visual.md](12-identidade-visual.md) (variáveis CSS mapeadas no Tailwind/shadcn). Nada de cor literal em componente.

## 6. Banco

- **PostgreSQL 17 + Drizzle** (ADR-0014). O schema fica em TypeScript em `src/lib/db/`, e os tipos vêm dele (sem arquivo de tipos gerado à parte).
- **Fluxo de uma mudança:**
  1. editar o schema;
  2. `npm run db:generate -- <nome>` (o `drizzle-kit` gera o SQL em `db/migrations/`);
  3. **revisar o SQL** (RLS, policies, grants, triggers e funções podem ser escritos à mão na migration);
  4. `npm run db:reset` para testar do zero.
- **Tabelas de login (Better Auth):** não são editadas à mão. Mudou uma opção em `src/lib/auth/options.ts` ou a versão do Better Auth? `npm run auth:generate` (regera `src/lib/db/schema/auth.ts`) → refazer o ajuste das datas para `timestamptz` (comentário no topo do arquivo) → `npm run db:generate`. O CLI (`auth`) fica sempre na **mesma versão** do `better-auth`: com versão diferente, ele ignorou o schema `auth` no teste da NBB-79.
- **Banco local:** `npm run db:start` / `db:stop` sobem e descem o `compose.dev.yaml`:
  - Postgres em `127.0.0.1:55432`;
  - RustFS em `:9000`, com console em `:9001`;
  - Mailpit em `:8025`.

  As credenciais locais são fictícias (as mesmas do `.env.example`). `npm run db:reset` apaga os dados e recria tudo do zero (roles + migrations).
- **Roles:** nascem uma vez por banco novo, pelo `db/bootstrap/roles.sql`, executado como superusuário pelo `init.sh` do container, pelo CI e, na VPS, pelo mesmo `init.sh`. Schemas, permissões automáticas e funções auxiliares ficam nas migrations (`0000_base_security.sql`).
- **Aplicar migrations:** `npm run db:migrate` (role `orco_owner`, pelo `scripts/migrate.mts`).
- **Testes de integração:** `npm run test:integration` (precisa do `db:start` + `db:migrate`). No CI, rodam dentro do check `ci`, com um Postgres temporário (ver §7).
- **Três roles:** migrations com `orco_owner`; o app com `app_user` (produto) e `app_auth` (login). Nunca conectar o app com a role dona ou com superusuário.
- Nunca alterar o banco de staging ou produção à mão: migrations chegam lá só pelo serviço `migrate`, disparado pelos workflows.
- Uma migration aplicada nunca é editada; a correção vem em nova migration. Toda migration precisa ser compatível com a versão anterior do código (o banco muda antes do código no deploy).
- Tabela nova = `ENABLE` + `FORCE ROW LEVEL SECURITY` + policies + grants + teste de RLS, no mesmo PR.
- [05-dados.md](05-dados.md) atualizado no mesmo PR.

## 7. Testes

| Tipo | O que testa | Ferramenta e pasta | Obrigatório para | Situação |
|---|---|---|---|---|
| **Unitário** | Uma função isolada, sem banco nem rede | Vitest, `tests/unit/` | `money.ts` (100%), `dates.ts`, schemas Zod, validação CPF/CNPJ, transições de status, segurança (CSP, headers, proxy, Basic Auth) | ✅ em uso |
| **Integração** | O código junto com um **Postgres real** (RLS, roles, funções, login) e o **Mailpit** (envio de e-mail por SMTP) | Vitest, `tests/integration/` (local: `compose.dev.yaml`; CI: service containers) | toda tabela e função (docs/07 §3); envio de e-mail | ✅ em uso |
| **E2E** | Um fluxo inteiro no navegador, como o usuário faria | Playwright, `tests/e2e/` | F-01, F-05, F-06, F-07, F-08 (RNF-15) | ⏳ entra na M2 (NBB-72) |

**Sem smoke test automático** (decidido em 2026-09-30: projeto pequeno, simplicidade). Depois de cada release, a conferência do ambiente publicado é manual: abrir o site, ver a versão e o HTTPS. O E2E testa o código antes do merge, não o ambiente no ar.

**Como rodar:**

| Comando | Roda | Precisa do Docker? |
|---|---|---|
| `npm test` | só os unitários (o do dia a dia) | não |
| `npm run test:watch` | unitários, repetindo a cada alteração | não |
| `npm run test:integration` | só a integração | sim (`db:start` + `db:migrate`) |
| `npm run test:coverage` | unitários + integração numa execução só, com relatório de cobertura (terminal e `coverage/index.html`) | sim |

**Cobertura:**
- Mede quais linhas de `src/lib/` os testes executaram. Unitários e integração rodam **juntos** para o relatório somar os dois: código que só roda com banco (ex.: `src/lib/db/`) aparece com a cobertura real, e não com 0%.
- Todo arquivo de `src/lib/` aparece no relatório, mesmo sem teste nenhum, para nada ficar escondido.
- **Trava no CI:** 100% em `money.ts` e `dates.ts` (RNF-14). O resto aparece no relatório sem trava; a trava para o código de banco é reavaliada na M2 (NBB-73).
- No CI, os testes rodam depois das roles e das migrations no Postgres temporário, num passo só (`npm run test:coverage`).

**Regras:**
- Bug corrigido = teste que reproduz o bug.
- Dados sempre fictícios (`@example.com`, CPFs de teste gerados), nunca reais (docs/07 §11).
- Testes de integração criam e apagam o que usam; não dependem da ordem nem de dados deixados por outro teste.

## 8. Variáveis de ambiente

**Do app** (em `.env.local` localmente; em `/opt/orco/<ambiente>/.env` na VPS):

| Variável | Pública? |
|---|---|
| `APP_ENV` (`development` \| `staging` \| `production`; ausente = `development`) | não é segredo |
| `SITE_URL` (ex.: `https://orco.nbbrdev.com`; base dos links de e-mail) | não é segredo |
| `DATABASE_URL_APP` (role `app_user`), `DATABASE_URL_AUTH` (role `app_auth`) | **Não** |
| `DATABASE_URL_OWNER` (role `orco_owner`; **só** no serviço `migrate`) | **Não** |
| `POSTGRES_PASSWORD` e senhas das roles (usadas pelo container `db` e pela migration de roles) | **Não** |
| `BETTER_AUTH_SECRET` (assina sessões e tokens) | **Não** |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | **Não** |
| `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` (RustFS) | **Não** |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` | **Não** |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (build) / `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Sim / **Não** |
| `CRON_SECRET` | **Não** |
| `STAGING_BASIC_AUTH_USER`, `STAGING_BASIC_AUTH_PASSWORD` (só no staging) | **Não** |
| `NEXT_PUBLIC_APP_VERSION` (injetada no build: `vX.Y.Z`, `staging-<commit>`; ausente = `dev`) | Sim |

**Do GitHub** (Environments `staging` = só `main`, `production` = só tags `v*`):

| Segredo | Para quê |
|---|---|
| `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS` | entrar na VPS por SSH para o deploy (a chave de cada environment só roda o `deploy.sh`) |

- **Da VPS:** `DB_PORT` (porta do banco só em `127.0.0.1`, para o backup pelo DBeaver: 5433 produção, 5434 staging) fica no `.env` de cada ambiente, junto das senhas.
- `.env.example` e `deploy/env.example` listam todas, sem valores. Variável nova do app também entra na lista `environment:` do serviço `app` em `deploy/compose.yaml`.

## 9. Definição de pronto (DoD)

- [ ] Critérios de aceite da issue atendidos
- [ ] Orçamento de simplicidade do fluxo respeitado (ver [10-fluxos.md](10-fluxos.md))
- [ ] Testes exigidos escritos e passando; CI e CodeQL verdes
- [ ] Checklist de segurança do PR ok
- [ ] Testado no celular (360 px) e no desktop
- [ ] `/docs` e Linear Docs atualizados, se algo mudou
- [ ] Testado localmente antes do merge e verificado no staging depois (não há preview por PR)
