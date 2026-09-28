# ADR-0005 — Acesso público ao orçamento via RPC server-side

- **Status:** aceito (validado pelo usuário em 2026-09-27)
- **Data:** 2026-09-27

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
