# ADR-0014 — Postgres próprio com Drizzle e RLS por roles

- **Status:** aceito (decidido pelo usuário em 2026-09-29)
- **Data:** 2026-09-29
- **Substitui:** ADR-0008 (supabase-js, Supabase CLI e projetos na nuvem) e a mecânica do ADR-0005. O **princípio** do ADR-0005 continua: o acesso público só por token, só pelo servidor, com campos mínimos.

## Contexto
A segurança do Orçô se apoia em "**RLS em todas as tabelas**": o próprio banco impede que um usuário veja os dados de outro, mesmo com um bug no app. No Supabase isso era automático. Com o Postgres próprio (ADR-0012), precisamos montar essa proteção e escolher como o app fala com o banco.

## Decisão

### Banco e ferramenta
- **PostgreSQL 17**, um por ambiente (container `db`, ADR-0012). No desenvolvimento local, via `compose.dev.yaml`.
- **Drizzle**:
  - tabelas descritas em TypeScript (`src/lib/db/`);
  - consultas próximas do SQL, com tipos;
  - **migrations SQL geradas pelo `drizzle-kit`** e **revisadas no PR**, nunca editadas depois de aplicadas.
- As migrations rodam pelo serviço `migrate` (tarefa avulsa, ADR-0012) **antes** de cada deploy.

### Três roles
| Role | Quem usa | Pode |
|---|---|---|
| `orco_owner` | **só** as migrations | dona das tabelas e funções; cria e altera o schema |
| `app_auth` | o Better Auth (ADR-0013) | **só** as tabelas de login |
| `app_user` | o resto do app | **só** as tabelas do produto, **sempre com RLS**; sem `BYPASSRLS`, sem DDL |

- O app abre **duas conexões**, uma com `app_auth` e outra com `app_user`, em `src/lib/db/`.
- Um bug numa tela de orçamentos não alcança senhas e sessões. Um bug no login não alcança os dados dos clientes.

### RLS
- Toda tabela do produto tem `ENABLE ROW LEVEL SECURITY` **e** `FORCE ROW LEVEL SECURITY` (vale até para a dona).
- O usuário da requisição chega ao banco por uma **configuração de transação**. A função `withUserDb(userId, fn)` abre uma transação e executa:

  ```sql
  select set_config('app.user_id', $1, true)
  ```

  O `true` faz o valor valer **só naquela transação**, então não vaza para outra requisição que reaproveite a conexão.
- As policies usam uma função auxiliar (ex.: `app.current_user_id()`, que lê `current_setting('app.user_id', true)`):

  ```sql
  user_id = app.current_user_id()
  ```

  Sem a configuração, a função retorna nulo e **nenhuma linha** é visível (fecha por padrão).
- Todo acesso do app a dados do produto passa por `withUserDb`. Consultas fora dela não enxergam nada.

### Acesso público ao orçamento (princípio do ADR-0005)
- Funções `SECURITY DEFINER` (donas: `orco_owner`), com `set search_path = ''`: `get_public_quote(token)`, `respond_to_quote(...)` etc. Retornam só os campos necessários.
- `EXECUTE` concedido à `app_user`. Não existe acesso público direto ao banco (ele não tem porta pública), então só o **servidor** as chama, com IP e user agent lidos do Nginx.

### Testes
- Testes de integração contra um **Postgres real**, localmente e no CI (service container). Toda tabela nova precisa provar:
  - outro usuário não lê nem altera;
  - sem usuário na transação, nada é visível.

## Alternativas descartadas
- **Autorização só no app:** um filtro esquecido vazaria dados de outros usuários sem nenhuma barreira no banco.
- **Prisma:** mais pesado, esconde o SQL e tem suporte limitado a RLS.
- **Kysely:** não gera migrations a partir do schema.
- **Uma única role para o app:** perde o isolamento entre login e dados do produto.

## Consequências
- Somem `supabase-js`, `@supabase/ssr`, o Supabase CLI, `src/lib/supabase/*` e `src/types/database.ts`. Os tipos vêm do schema do Drizzle.
- Novos scripts: `db:start`, `db:stop`, `db:generate`, `db:migrate`, `db:reset`.
- Toda query do produto dentro de uma transação: custo pequeno, benefício de segurança alto.
- `pg_cron` não é usado (a imagem oficial do Postgres não o traz). As tarefas agendadas rodam na VPS (ADR-0012).
