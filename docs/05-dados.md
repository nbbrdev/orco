# 05 — Modelo de dados

> Status: rascunho para validação · Última atualização: 2026-09-29
>
> Nomes em inglês (ver [04-arquitetura.md](04-arquitetura.md)). Toda alteração de schema é feita no schema do Drizzle (`src/lib/db/`), gera uma migration SQL em `db/migrations/` (revisada no PR) e atualiza este documento ([ADR-0014](decisoes/0014-banco-drizzle-rls-roles.md)).

## Roles e schemas

| Schema | Conteúdo | Quem acessa |
|---|---|---|
| `auth` | tabelas do **Better Auth** (usuários, contas, sessões, verificações); detalhadas na M2 (NBB-39) | só a role **`app_auth`** |
| `public` | tabelas do produto (abaixo) | só a role **`app_user`**, sempre com RLS |
| `app` | funções auxiliares (ex.: `app.current_user_id()`) | `app_user` (execute) |

- A role **`orco_owner`** é dona de tudo e só é usada pelas migrations.
- `app_user` e `app_auth` não têm `BYPASSRLS` nem DDL.

## Convenções

- PK `id uuid default gen_random_uuid()`. Exceção: `profiles.id` = `auth.users.id`.
- O `id` do usuário é `uuid`, com o Better Auth configurado para gerar UUIDs (a confirmar na NBB-39).
- Toda tabela de domínio tem `user_id uuid not null references auth.users(id) on delete cascade`.
- Nas policies, o usuário da requisição é `app.current_user_id()`, que lê `current_setting('app.user_id', true)` definido por `withUserDb` na transação. Sem ele, retorna nulo e nenhuma linha é visível.
- `created_at` / `updated_at timestamptz not null default now()`, com `updated_at` mantido por trigger.
- Dinheiro em **centavos** (`bigint`, `check >= 0`). Percentuais em **pontos-base** (`int`, 0–10000 = 0–100,00%).
- Textos livres com limite de tamanho via `check (char_length(x) <= N)`.
- **RLS habilitada e forçada (`FORCE`) em todas as tabelas do produto.** Sem policy = sem acesso.

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
| logo_path | text null | chave do objeto no bucket `logos` do RustFS |
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

**RLS:** select/update onde `id = app.current_user_id()`. Sem insert (feito pelo trigger) nem delete (feito em cascata).

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

Índice: `(user_id, name)`. **RLS:** CRUD onde `user_id = app.current_user_id()`.

### `catalog_items`
| Coluna | Tipo | Notas |
|---|---|---|
| id, user_id, timestamps | | |
| name | text not null | 1–200 |
| unit | text null | ≤ 10 |
| unit_price_cents | bigint null | ≥ 0 quando informado; opcional (RN-10) |

**RLS:** CRUD onde `user_id = app.current_user_id()`.

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
**RLS:** select/insert/delete/update onde `user_id = app.current_user_id()`. A trava de conteúdo (RN-25) fica num **trigger** `BEFORE UPDATE`: em `approved`/`rejected`, qualquer coluna diferente de `internal_notes`, `response_seen_at` e `updated_at` gera erro. (A RLS filtra linhas, não colunas, por isso a trava por coluna é trigger.)
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

Limite de 100 itens por orçamento (RN-14), via trigger. **RLS:** CRUD onde `user_id = app.current_user_id()` e o orçamento pai é editável.

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

**RLS:** apenas select para o dono. Insert **somente** via funções `SECURITY DEFINER` (ver abaixo).

### `push_subscriptions`
| Coluna | Tipo | Notas |
|---|---|---|
| id, user_id, created_at | | um usuário pode ter vários aparelhos |
| endpoint | text not null unique | URL do serviço de push do navegador |
| p256dh | text not null | chave pública da assinatura |
| auth | text not null | segredo de autenticação da assinatura |
| user_agent | text null | ≤ 500, para o usuário identificar o aparelho |
| last_used_at | timestamptz null | |

**RLS:** select/insert/delete onde `user_id = app.current_user_id()`. Assinaturas que retornam `404`/`410` no envio são apagadas pelo servidor (expiradas). O envio é feito pelo servidor, com `withUserDb` do dono do orçamento (RN-45).

### `rate_limits`
| Coluna | Tipo | Notas |
|---|---|---|
| key | text | ex.: `pdf:user:<uuid>`, `public:ip:<ip>` |
| window_start | timestamptz | |
| count | int | |

PK `(key, window_start)`. **RLS habilitada sem policies**: acesso só por função. Limpeza de janelas antigas feita dentro da própria função.

## Arquivos (RustFS, ADR-0015)

- Bucket `logos` no RustFS do ambiente. Chave `{user_id}/{uuid}.webp`, com UUID gerado pelo servidor.
- **Escrita** (envio, troca, remoção) só pelo servidor, depois de validar a sessão: o `user_id` da chave é sempre o da sessão, nunca um valor vindo do navegador.
- **Leitura** por uma rota do app, permitida para quem tem a chave (UUID inadivinhável), porque o logo aparece na página pública e no PDF.
- Tipos `image/png`, `image/jpeg`, `image/webp` e até 5 MB, validados no servidor (RN-05). Na prática, chega um WebP de até 1024 px, já redimensionado no navegador.

## Funções

| Função | Executável por | Descrição |
|---|---|---|
| `handle_new_user()` | trigger em `auth.users` | cria `profiles` |
| `assign_quote_number()` | trigger em `quotes` | pega e incrementa `profiles.next_quote_number` com lock de linha |
| `get_public_quote(token)` | `app_user` (só o servidor chama) | retorna campos mínimos do orçamento + perfil público; registra `viewed` (RN-35); aplica RN-31 |
| `respond_to_quote(token, decision, name, reason, ip, ua)` | `app_user` (só o servidor chama) | valida RN-32, grava status + evento (RN-34) em transação |
| `check_rate_limit(key, limit, window_seconds)` | `app_user` | janela fixa; retorna permitido/negado |
| `regenerate_public_token(quote_id)` | `app_user` (dono, via RLS) | RN-36 |
| `anonymize_old_event_ips()` | tarefa agendada na VPS | RN-37 |
| `quotes_due_for_reminder()` | `app_user` (rota do cron) | orçamentos `sent`, sem resposta, com `valid_until = amanhã (SP)` e `reminder_sent_at` nulo; usada pelo lembrete diário (RN-43) |

Todas as funções `SECURITY DEFINER` pertencem à `orco_owner` e usam `set search_path = ''` e nomes totalmente qualificados. `PUBLIC` não tem `execute` em nada; cada função concede `execute` só à role indicada. O banco não tem porta pública, então as funções públicas só são chamadas pelo servidor do Next.js (ver [07-seguranca.md](07-seguranca.md), ADR-0005 e ADR-0014), com IP e user agent vindos do Nginx.

## Exclusão de conta

Server Action (sessão validada) → remove os objetos em `logos/{user_id}/` no RustFS → o Better Auth apaga o usuário (role `app_auth`) → a cascata (`on delete cascade`) apaga todas as tabelas do produto. O RustFS não participa da cascata, por isso a remoção explícita.
