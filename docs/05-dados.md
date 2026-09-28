# 05 — Modelo de dados

> Status: rascunho para validação · Última atualização: 2026-09-27
>
> Nomes em inglês (ver [04-arquitetura.md](04-arquitetura.md)). Toda alteração de schema entra por migration em `supabase/migrations/` e atualiza este documento.

## Convenções

- PK `id uuid default gen_random_uuid()`. Exceção: `profiles.id` = `auth.users.id`.
- Toda tabela de domínio tem `user_id uuid not null references auth.users(id) on delete cascade`.
- `created_at` / `updated_at timestamptz not null default now()`, com `updated_at` mantido por trigger.
- Dinheiro em **centavos** (`bigint`, `check >= 0`). Percentuais em **pontos-base** (`int`, 0–10000 = 0–100,00%).
- Textos livres com limite de tamanho via `check (char_length(x) <= N)`.
- **RLS habilitada em todas as tabelas.** Sem policy = sem acesso.

## Tabelas

### `profiles`
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK → auth.users | criado por trigger no cadastro |
| display_name | text null | ≤ 80 |
| business_name | text null | ≤ 120 |
| document | text null | CPF/CNPJ só com dígitos, validado (RN-08) |
| phone | text null | ≤ 20 |
| contact_email | text null | ≤ 254 |
| logo_path | text null | caminho no bucket `logos` |
| website | text null | URL http(s), ≤ 200 |
| instagram | text null | @usuário, ≤ 60 |
| payment_info | text null | texto livre informativo, ≤ 500 (RN-04) |
| default_validity_days | int not null default 15 | check 1–365 (RN-19) |
| default_notes | text null | ≤ 2000 |
| default_payment_terms | text null | ≤ 500 (RN-44) |
| default_delivery_time | text null | ≤ 500 (RN-44) |
| next_quote_number | int not null default 1 | contador (RN-12) |
| email_notifications | boolean not null default true | respostas + lembretes por e-mail (RN-41) |
| push_prompted_at | timestamptz null | quando a permissão de push já foi pedida, para não pedir de novo (RN-45) |

**RLS:** select/update onde `id = auth.uid()`. Sem insert (feito pelo trigger) nem delete (feito em cascata).

### `clients`
| Coluna | Tipo | Notas |
|---|---|---|
| id, user_id, timestamps | | |
| name | text not null | 1–120 (RN-07) |
| email | text null | |
| phone | text null | |
| document | text null | validado (RN-08) |
| address | text null | ≤ 300 |
| internal_notes | text null | ≤ 2000, **privado**, fora do snapshot (RN-07) |

Índice: `(user_id, name)`. **RLS:** CRUD onde `user_id = auth.uid()`.

### `catalog_items`
| Coluna | Tipo | Notas |
|---|---|---|
| id, user_id, timestamps | | |
| name | text not null | 1–200 |
| unit | text null | ≤ 10 |
| unit_price_cents | bigint null | ≥ 0 quando informado; opcional (RN-10) |

**RLS:** CRUD onde `user_id = auth.uid()`.

### `quotes`
| Coluna | Tipo | Notas |
|---|---|---|
| id, user_id, timestamps | | |
| number | int not null | `unique (user_id, number)`, atribuído por trigger (RN-12) |
| status | enum `quote_status` (`draft`,`sent`,`approved`,`rejected`) | `expired` é derivado (RN-26) |
| version | int not null default 1 | RN-24 |
| client_id | uuid null → clients `on delete no action` | impede excluir cliente com orçamentos (RN-09). `NO ACTION` (e não `RESTRICT`) para que a cascata da exclusão de conta funcione, já que a checagem ocorre no fim do statement |
| client_name, client_email, client_phone, client_document, client_address | text null | **snapshot** (RN-20) |
| discount_type | enum (`percent`,`amount`) null | desconto geral (RN-17) |
| discount_value | bigint not null default 0 | pontos-base ou centavos |
| subtotal_cents, discount_cents, total_cents | bigint not null default 0 | calculados no servidor |
| valid_until | date not null | RN-19 |
| payment_terms | text null | ≤ 500, condições de pagamento (RN-44) |
| delivery_time | text null | ≤ 500, prazo de execução (RN-44) |
| notes | text null | ≤ 2000, visível ao cliente |
| internal_notes | text null | ≤ 2000, **privado**, editável em qualquer status, não incrementa a versão (RN-20a) |
| public_token | text not null unique | 32 bytes aleatórios em base64url (RN-30) |
| sent_at, responded_at, first_viewed_at | timestamptz null | |
| response_seen_at | timestamptz null | quando o dono viu a resposta (destaque "novo", RN-42) |
| reminder_sent_at | timestamptz null | lembrete de vencimento já enviado para a validade atual; zerado ao prorrogar (RN-43) |
| view_count | int not null default 0 | RN-35 |

Índices: `(user_id, status)`, `(user_id, created_at desc)`, `unique(public_token)`.
**RLS:** select/insert/delete/update onde `user_id = auth.uid()`. A trava de conteúdo (RN-25) fica num **trigger** `BEFORE UPDATE`: em `approved`/`rejected`, qualquer coluna diferente de `internal_notes`, `response_seen_at` e `updated_at` gera erro. (A RLS filtra linhas, não colunas, por isso a trava por coluna é trigger.)
**Trigger:** transições de status válidas (RN-22–RN-27) garantidas no banco, e não só na aplicação.

### `quote_items`
| Coluna | Tipo | Notas |
|---|---|---|
| id, user_id, timestamps | | `user_id` duplicado para simplificar a RLS |
| quote_id | uuid not null → quotes `on delete cascade` | |
| position | int not null | ordem de exibição |
| catalog_item_id | uuid null → catalog_items `on delete set null` | origem; usada para atualizar rascunhos quando o item do catálogo muda (RN-11) |
| description | text not null | 1–500 (snapshot) |
| unit | text null | ≤ 10 |
| quantity | numeric(12,3) not null | > 0 (RN-14) |
| unit_price_cents | bigint null | ≥ 0; nulo só em rascunho (RN-10, RN-13) |
| gross_cents | bigint not null | quantidade × preço (RN-15) |
| discount_type | enum (`percent`,`amount`) null | RN-15a |
| discount_value | bigint not null default 0 | pontos-base ou centavos |
| discount_cents | bigint not null default 0 | ≤ gross_cents |
| line_total_cents | bigint not null | gross − discount (RN-15) |

Limite de 100 itens por orçamento (RN-14), via trigger. **RLS:** CRUD onde `user_id = auth.uid()` e o orçamento pai é editável.

### `quote_events`
| Coluna | Tipo | Notas |
|---|---|---|
| id, created_at | | |
| quote_id | uuid not null → quotes `on delete cascade` | |
| user_id | uuid not null | dono do orçamento |
| type | enum (`viewed`,`approved`,`rejected`) | |
| quote_version | int not null | RN-24 |
| ip | inet null | anonimizado após 12 meses (RN-37) |
| user_agent | text null | ≤ 500 |
| respondent_name | text null | ≤ 120 (RN-33) |
| reason_code | enum (`price`,`deadline`,`gave_up`,`other`) null | motivo rápido da recusa (RN-33) |
| reason | text null | ≤ 1000, texto livre da recusa (RN-33) |

**RLS:** apenas select para o dono. Insert **somente** via RPCs (ver abaixo).

### `push_subscriptions`
| Coluna | Tipo | Notas |
|---|---|---|
| id, user_id, created_at | | um usuário pode ter vários aparelhos |
| endpoint | text not null unique | URL do serviço de push do navegador |
| p256dh | text not null | chave pública da assinatura |
| auth | text not null | segredo de autenticação da assinatura |
| user_agent | text null | ≤ 500, para o usuário identificar o aparelho |
| last_used_at | timestamptz null | |

**RLS:** select/insert/delete onde `user_id = auth.uid()`. Assinaturas que retornam `404`/`410` no envio são apagadas pelo servidor (expiradas). O envio é feito pelo servidor com o admin client (RN-45).

### `rate_limits`
| Coluna | Tipo | Notas |
|---|---|---|
| key | text | ex.: `pdf:user:<uuid>`, `public:ip:<ip>` |
| window_start | timestamptz | |
| count | int | |

PK `(key, window_start)`. **RLS habilitada sem policies**: acesso só por função. Limpeza de janelas antigas feita dentro da própria função.

## Storage

- Bucket `logos` com **leitura pública**, porque o logo aparece na página pública e no PDF e não é sensível. Caminho `{user_id}/{uuid}.{ext}`.
- Escrita (insert/update/delete) só quando `(storage.foldername(name))[1] = auth.uid()::text`.
- Limite de 5 MB e MIME `image/png`, `image/jpeg`, `image/webp` configurados no bucket (RN-05). Na prática, chega um WebP de até 1024 px, já redimensionado no client.

## Funções (RPC)

| Função | Executável por | Descrição |
|---|---|---|
| `handle_new_user()` | trigger em `auth.users` | cria `profiles` |
| `assign_quote_number()` | trigger em `quotes` | pega e incrementa `profiles.next_quote_number` com lock de linha |
| `get_public_quote(token)` | **service_role** | retorna campos mínimos do orçamento + perfil público; registra `viewed` (RN-35); aplica RN-31 |
| `respond_to_quote(token, decision, name, reason, ip, ua)` | **service_role** | valida RN-32, grava status + evento (RN-34) em transação |
| `check_rate_limit(key, limit, window_seconds)` | **service_role** / authenticated | janela fixa; retorna permitido/negado |
| `regenerate_public_token(quote_id)` | authenticated (dono) | RN-36 |
| `anonymize_old_event_ips()` | agendado (pg_cron) | RN-37 |
| `quotes_due_for_reminder()` | **service_role** | orçamentos `sent`, sem resposta, com `valid_until = amanhã (SP)` e `reminder_sent_at` nulo; usada pelo cron diário (RN-43) |

Todas as funções `SECURITY DEFINER` usam `set search_path = ''` e nomes totalmente qualificados. `anon` **não** tem `execute` em nada. As RPCs públicas são chamadas só pelo servidor (ver [07-seguranca.md](07-seguranca.md) e ADR-0005), para que IP e user agent venham de fonte confiável.

## Exclusão de conta

Server Action → remove os arquivos em `logos/{user_id}/` → `auth.admin.deleteUser(user_id)` (service_role, server-only) → cascata apaga todas as tabelas. O Storage não entra na cascata, por isso a remoção explícita.
