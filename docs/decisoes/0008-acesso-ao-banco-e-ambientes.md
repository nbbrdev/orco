# ADR-0008 — Acesso ao banco, schema e ambientes

- **Status:** aceito (validado pelo usuário em 2026-09-27)
- **Data:** 2026-09-27

## Contexto
A segurança do Orçô se apoia na RLS do Postgres (ver [07-seguranca.md](../07-seguranca.md)). Foi avaliado usar um ORM (Prisma ou Drizzle) e definido como organizar schema, migrations e ambientes.

## Decisão

### Acesso: `supabase-js` + tipos gerados, sem ORM
- Queries via `@supabase/supabase-js` / `@supabase/ssr`, que executam **como o usuário logado**, de modo que a RLS se aplica automaticamente.
- Tipos TS gerados com `supabase gen types typescript` em `src/types/database.ts`.

**Descartados:**
- **Prisma:** conecta como `postgres` e **ignora a RLS**, então a autorização dependeria de lembrar o `where userId` em toda query. Não gerencia policies, triggers nem funções (o schema ficaria dividido) e exige configuração de pooler em serverless.
- **Drizzle:** mais leve e declara RLS no schema, mas também conecta como `postgres` por padrão, com o mesmo risco de autorização.

### Schema: declarativo + diff
- `supabase/schemas/*.sql` descreve o **estado atual** do banco: tabelas, RLS, policies, funções e triggers.
- Migrations são **geradas** com `supabase db diff -f <nome>`, **revisadas** e commitadas em `supabase/migrations/`.
- Migrations aplicadas nunca são editadas.
- `supabase db reset` recria o banco local (migrations + `seed.sql`).

### Ambientes
| Ambiente | Banco | Uso |
|---|---|---|
| Local | Supabase CLI no **Docker** | Desenvolvimento e testes |
| Preview (Vercel, por PR) | Projeto Supabase **staging** (nuvem, Free) | Testar PRs de verdade, sem dados reais |
| Produção | Projeto Supabase **prod** (nuvem, Free) | Usuários reais |

- As migrations chegam ao **staging** quando um PR que altera `supabase/migrations/` é aberto ou atualizado (e no merge em `main`), e à **produção** somente no **release** (ADR-0010). Ambos rodam pelo GitHub Actions (`supabase db push`), nunca pelo painel.
- Dados de staging são fictícios e podem ser apagados a qualquer momento.

## Consequências
- Requer **Docker Desktop** na máquina de desenvolvimento.
- Os 2 projetos do plano Free ficam ocupados (staging e prod). Projetos Free pausam após 7 dias sem uso; staging pode pausar sem problema, prod precisa de atividade ou de upgrade.
- Com PRs simultâneos alterando o banco, o staging reflete o último aplicado. Aceitável para desenvolvimento solo.
- Aprender SQL/Postgres de verdade: tabelas, constraints, RLS e funções.
