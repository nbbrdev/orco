# ADR-0005 — Acesso público ao orçamento via RPC server-side

- **Status:** aceito; **mecânica revisada** pelo [ADR-0014](0014-banco-drizzle-rls-roles.md) (2026-09-29)
- **Data:** 2026-09-27

> **Revisão (2026-09-29):** o **princípio** continua (token de 256 bits, acesso só pelo servidor, funções `SECURITY DEFINER` com campos mínimos, respostas idênticas para token inválido). O que muda: não há mais `service_role` nem API pública do Supabase. As funções ficam no nosso Postgres (dono `orco_owner`), com `EXECUTE` para a role `app_user`, e são chamadas só pelo servidor do Next.js. O banco não tem porta pública. IP e user agent vêm dos headers do Nginx.

## Contexto
O cliente final acessa o orçamento sem login, por um link. Abrir RLS para `anon` exporia tabelas inteiras a filtros arbitrários via API REST do Supabase. A resposta do cliente precisa registrar IP e user agent confiáveis.

## Decisão
- Token de **256 bits** (`gen_random_bytes(32)`, base64url) por orçamento, regenerável.
- `anon` não tem acesso a nenhuma tabela nem função.
- Funções `SECURITY DEFINER` com `search_path = ''`: `get_public_quote(token)` e `respond_to_quote(...)`, que retornam apenas os campos mínimos e validam as regras RN-31/RN-32.
- `execute` dessas funções concedido **somente a `service_role`**. São chamadas exclusivamente pelo servidor Next.js, a partir de `src/lib/supabase/admin.ts` (`server-only`), com importação restrita por lint.
- IP e user agent são lidos dos headers da Vercel no servidor e passados à função.

## Alternativa descartada
RLS liberando leitura para `anon`: uma policy não "sabe" o token digitado na URL, então liberar leitura por token exige truques frágeis. Um erro vazaria os orçamentos de todos os usuários, e o IP registrado na aprovação seria falsificável.

## Consequências
- Nenhuma superfície pública direta no banco.
- A `service_role` existe no servidor, mas o uso fica limitado a um módulo e a RPCs estreitas (defesa em profundidade).
- Mesmo com a chave, as RPCs não expõem nada além do orçamento do token informado.
