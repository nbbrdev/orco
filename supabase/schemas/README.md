# Schema declarativo

Este diretório é a **fonte da verdade** do banco (docs/06-regras-dev.md §6). Cada arquivo `.sql`
descreve o estado desejado de um domínio (tabelas, índices, RLS, policies, funções). As migrations
em `supabase/migrations/` são **geradas** a partir daqui, nunca escritas do zero.

## Fluxo de uma mudança

1. Suba o banco local: `npm run db:start` (precisa do Docker).
2. Edite ou crie o arquivo do domínio aqui, ex.: `20_quotes.sql`.
3. Gere a migration: `npm run db:diff -- <nome_em_snake_case>`.
4. **Revise** o SQL gerado em `supabase/migrations/` (o diff não detecta tudo: renomeações viram
   drop + create, por exemplo).
5. Recrie o banco do zero e confira: `npm run db:reset`.
6. Atualize os tipos: `npm run db:types` → `src/types/database.ts`.
7. Escreva os testes de RLS e atualize `docs/05-dados.md` no mesmo PR.

Depois do merge na `main`, o workflow `db-migrate-staging.yml` aplica a migration no staging. Em
produção ela entra só com o release (ADR-0010).

## Regras

- Os arquivos são aplicados em **ordem alfabética**: use prefixos numéricos (`00_`, `10_`, `20_`)
  para que dependências venham antes.
- Toda tabela com `enable row level security` e policies no mesmo arquivo (docs/07-seguranca.md).
- Migration já aplicada nunca é editada; a correção vem em uma nova.
- Nada de dados reais aqui: o repositório é público.
