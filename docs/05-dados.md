# 05 — Modelo de dados

> Status: rascunho para validação · Última atualização: 2026-09-29
>
> Nomes em inglês (ver [04-arquitetura.md](04-arquitetura.md)). Toda alteração de schema é feita no schema do Drizzle (`src/lib/db/`), gera uma migration SQL em `db/migrations/` (revisada no PR) e atualiza este documento ([ADR-0014](decisoes/0014-banco-drizzle-rls-roles.md)).

## Roles e schemas

| Schema | Conteúdo | Quem acessa |
|---|---|---|
| `auth` | tabelas do **Better Auth** (NBB-79): `user`, `account` (senha e Google), `session`, `verification` (tokens dos links). Geradas pelo CLI do Better Auth (`src/lib/db/schema/auth.ts`) | só a role **`app_auth`** |
| `public` | tabelas do produto (abaixo) | só a role **`app_user`**, sempre com RLS |
| `app` | funções auxiliares (ex.: `app.current_user_id()`) | `app_user` (execute) |

- A role **`orco_owner`** é dona de tudo e só é usada pelas migrations.
- `app_user` e `app_auth` não têm `BYPASSRLS` nem DDL.

## Convenções

- PK `id uuid default gen_random_uuid()`. Exceção: `profiles.id` = `auth.user.id`.
- O `id` do usuário é `uuid`: o Better Auth usa `generateId: "uuid"`, e o Postgres gera (confirmado na NBB-79).
- Toda tabela de domínio tem `user_id uuid not null references auth.user(id) on delete cascade`.
- Nas policies, o usuário da requisição é `app.current_user_id()`, que lê `current_setting('app.user_id', true)` definido por `withUserDb` na transação. Sem ele, retorna nulo e nenhuma linha é visível.
- `created_at` / `updated_at timestamptz not null default now()`, com `updated_at` mantido por trigger.
- Dinheiro em **centavos** (`bigint`, `check >= 0`). Percentuais em **pontos-base** (`int`, 0–10000 = 0–100,00%).
- Textos livres com limite de tamanho via `check (char_length(x) <= N)`.
- **RLS habilitada e forçada (`FORCE`) em todas as tabelas do produto.** Sem policy = sem acesso.

## Tabelas

### `profiles`
| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK → auth.user (`on delete cascade`) | criado pelo trigger `app.handle_new_user` no cadastro |
| display_name | text null | ≤ 80 |
| business_name | text null | ≤ 120 |
| document | text null | CPF (11 dígitos) ou CNPJ (12 letras/números + 2 dígitos, formato alfanumérico da Receita), sem pontuação; dígito verificador conferido no servidor (RN-08, `src/lib/document.ts`) |
| phone | text null | ≤ 20; brasileiro com DDD, no formato `(11) 91234-5678` (RN-08, NBB-84) |
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
| quotes_month | date null | mês (dia 1º, fuso de São Paulo) do contador abaixo (RN-38, NBB-46) |
| quotes_month_count | int not null default 0 | orçamentos criados no mês; excluir não devolve a vaga (RN-38). Só o trigger `app.prepare_new_quote` mexe |
| email_notifications | boolean not null default true | respostas + lembretes por e-mail (RN-41) |
| push_prompted_at | timestamptz null | quando a permissão de push já foi pedida, para não pedir de novo (RN-45) |
| created_at, updated_at | timestamptz | `updated_at` pelo trigger `app.set_updated_at` |

**RLS:** select/update onde `id = app.current_user_id()`. Sem insert (feito pelo trigger) nem delete (feito em cascata). A `app_user` só pode alterar as colunas editáveis pela pessoa: `id`, `next_quote_number` e as datas ficam fora do `GRANT UPDATE` (NBB-42). Uma única policy de insert, para a `orco_owner`, que roda o trigger.

Migration `0003_profiles` (NBB-42, 2026-10-02): a tabela completa já nasce com todas as colunas, mesmo as usadas só mais tarde (`logo_path`, `next_quote_number`, `push_prompted_at`), e cria o perfil das contas que já existiam.

### `clients`
| Coluna | Tipo | Notas |
|---|---|---|
| id, user_id, timestamps | | |
| name | text not null | 1–120 (RN-07) |
| email | text null | ≤ 254; só o formato (RN-08) |
| phone | text null | ≤ 20; brasileiro com DDD, no formato `(11) 91234-5678` (RN-08, NBB-84) |
| document | text null | mesmo formato do `profiles.document`; dígito verificador conferido no servidor (RN-08) |
| address | text null | ≤ 300 |
| internal_notes | text null | ≤ 2000, **privado**, fora do snapshot (RN-07) |

Índice: `(user_id, name)`. **RLS:** CRUD onde `user_id = app.current_user_id()` (uma policy `FOR ALL`). A `app_user` só altera as colunas editáveis: `id`, `user_id` e as datas ficam fora do `GRANT UPDATE`. `updated_at` pelo trigger `app.set_updated_at`.

**Limite de 1.000 clientes por conta (RN-38):** garantido pelo trigger `app.enforce_client_limit` (`BEFORE INSERT`). Antes de contar, ele trava a linha do perfil da pessoa (`SELECT … FOR UPDATE`), para que dois cadastros simultâneos entrem em fila e o segundo já conte o primeiro. Acima do limite, lança o erro `OR001`, que o app traduz na mensagem da tela.

Migration `0004_clients` (NBB-44, 2026-10-03). A FK de `quotes.client_id`, que impede excluir um cliente com orçamentos (RN-09), nasce com a tabela `quotes` (M4, NBB-46).

### `catalog_items`
| Coluna | Tipo | Notas |
|---|---|---|
| id, user_id, timestamps | | |
| name | text not null | 1–200 |
| unit | text null | ≤ 10, texto livre (RN-10) |
| unit_price_cents | bigint null | opcional (RN-10); 0 a 999.999.999 (R$ 9.999.999,99, NBB-45 I3-A) |

Índice: `(user_id, name)`. **RLS:** CRUD onde `user_id = app.current_user_id()` (uma policy `FOR ALL`). Mesmo padrão dos clientes: `GRANT UPDATE` só em `name`, `unit` e `unit_price_cents`; `updated_at` pelo trigger `app.set_updated_at`.

**Limite de 500 itens por conta (RN-38):** trigger `app.enforce_catalog_item_limit`, igual ao dos clientes (trava a linha do perfil antes de contar); lança o erro `OR002`.

Migration `0005_catalog_items` (NBB-45, 2026-10-03).

### `quotes`
| Coluna | Tipo | Notas |
|---|---|---|
| id, user_id, timestamps | | |
| number | int not null | `unique (user_id, number)`, atribuído pelo trigger `app.prepare_new_quote` (RN-12) |
| status | enum `quote_status` (`draft`,`sent`,`approved`,`rejected`) | `expired` é derivado (RN-26) |
| version | int not null default 1 | RN-24 |
| client_id | uuid null → clients `on delete no action` | FK composta `(client_id, user_id)`: só um cliente da mesma conta. Impede excluir cliente com orçamentos (RN-09). `NO ACTION` (e não `RESTRICT`) para que a cascata da exclusão de conta funcione, já que a checagem ocorre no fim do statement |
| client_name, client_email, client_phone, client_document, client_address | text null | **snapshot** (RN-20) |
| discount_type | enum (`percent`,`amount`) null | desconto geral (RN-17) |
| discount_value | bigint not null default 0 | pontos-base ou centavos |
| subtotal_cents, discount_cents, total_cents | bigint not null default 0 | calculados no servidor |
| valid_until | date not null | RN-19 |
| payment_terms | text null | ≤ 500, condições de pagamento (RN-44) |
| delivery_time | text null | ≤ 500, prazo de execução (RN-44) |
| notes | text null | ≤ 2000, visível ao cliente |
| internal_notes | text null | ≤ 2000, **privado**, editável em qualquer status, não incrementa a versão (RN-20a) |
| public_token | text not null unique | 32 bytes aleatórios em base64url, 43 caracteres (RN-30), gerados por `app.generate_public_token()` |
| sent_at, responded_at, first_viewed_at | timestamptz null | |
| response_seen_at | timestamptz null | quando o dono viu a resposta (destaque "novo", RN-42) |
| reminder_sent_at | timestamptz null | lembrete de vencimento já enviado para a validade atual; zerado ao prorrogar (RN-43) |
| view_count | int not null default 0 | RN-35 |

Índices: `(user_id, status)`, `(user_id, created_at desc)`, `(user_id, updated_at desc)` (ordem da lista, NBB-48), `(client_id)`, `unique(public_token)`, `unique(id, user_id)` (alvo da FK dos itens).
**`updated_at` = última atividade** (migration `0008_quote_list`, NBB-48 L2-A): a lista ordena por ele. O trigger `app.set_quote_updated_at` não o muda quando só mudam os campos de acompanhamento (`view_count`, `first_viewed_at`, `response_seen_at`, `reminder_sent_at`): ver a resposta, uma visualização do cliente ou um lembrete não reordenam a lista. Qualquer outro update conta, inclusive o salvamento do editor que regrava os totais iguais.
**RLS:** select/insert/delete/update onde `user_id = app.current_user_id()` (uma policy `FOR ALL`).
**Criação** (migration `0006_quotes`, NBB-46): o trigger `app.prepare_new_quote` (`BEFORE INSERT`) dá o número, e todo orçamento nasce `draft`, na versão 1, com um token novo e sem as datas e a contagem da M6, não importa o que o app mande. O insert fica liberado em todas as colunas porque o Drizzle sempre lista todas; no **update**, a `app_user` só altera as colunas que o app preenche (sem `number`, `public_token`, `version`, `sent_at`, `responded_at`, a contagem e as datas da M6). O mesmo trigger conta o **limite de 200 orçamentos criados no mês** (RN-38) em `profiles.quotes_month_count`; acima disso, erro `OR003`, e o número não é gasto.
**Regras no update** (trigger `app.check_quote_update`, migration `0007_quote_rules`, NBB-46). "Conteúdo" é o que o cliente vê: tudo menos as anotações internas, as datas, a contagem, a versão e o status.
- **Transições** (RN-22 a RN-27): a `app_user` só faz `draft` → `sent`, e o banco confere a RN-13 (ao menos 1 item, todos com descrição e valor; senão, erro `OR007`) e preenche o `sent_at`. `sent` → `approved`/`rejected` só pela dona (as funções da M6), que preenche o `responded_at`. Qualquer outra mudança: erro `OR005`. Expirado é `sent` com a validade vencida (RN-26); prorrogar só muda a `valid_until` e zera o `reminder_sent_at` (RN-43).
- **Versão** (RN-24): editar o conteúdo de um orçamento `sent` sobe a `version` **uma vez por transação** (um salvamento do editor mexe em várias linhas). Se a linha já foi alterada na transação, o `xmin` dela é o id da transação atual (`pg_current_xact_id()`), e a versão não sobe de novo. Mexer nos itens também versiona (trigger `app.bump_quote_version_from_item`).
- **Trava** (RN-25): em `approved`/`rejected`, só mudam `internal_notes`, `response_seen_at`, `updated_at`, a contagem de visualizações da M6 (`view_count`, `first_viewed_at`) e o `public_token` (novo link, RN-36; migration `0010_public_response`, NBB-52 R1-A, que também tira o token do "conteúdo": trocar o link não sobe a versão); o resto, inclusive o status (a resposta é definitiva, RN-32), dá erro `OR006`. (A RLS filtra linhas, não colunas, por isso a trava é trigger.)

### `quote_items`
| Coluna | Tipo | Notas |
|---|---|---|
| id, user_id, timestamps | | `user_id` duplicado para simplificar a RLS |
| quote_id | uuid not null → quotes `on delete cascade` | FK composta `(quote_id, user_id)`: só um orçamento da mesma conta |
| position | int not null | ordem de exibição |
| catalog_item_id | uuid null → catalog_items `on delete set null (catalog_item_id)` | origem; usada para atualizar rascunhos quando o item do catálogo muda (RN-11). FK composta `(catalog_item_id, user_id)`; ao excluir o item do catálogo, só esta coluna vira nula |
| description | text not null default '' | ≤ 500 (snapshot); vazia aceita no rascunho, exigida no envio (RN-13) |
| unit | text null | ≤ 10 |
| quantity | numeric(12,3) not null default 1 | > 0 (RN-14) |
| unit_price_cents | bigint null | 0 a 999.999.999 (o teto do catálogo); nulo só em rascunho (RN-10, RN-13) |
| gross_cents | bigint not null | quantidade × preço (RN-15) |
| discount_type | enum (`percent`,`amount`) null | RN-15a |
| discount_value | bigint not null default 0 | pontos-base ou centavos |
| discount_cents | bigint not null default 0 | ≤ gross_cents |
| line_total_cents | bigint not null | gross − discount (RN-15) |

**RLS:** CRUD onde `user_id = app.current_user_id()` (uma policy `FOR ALL`). O trigger `app.check_quote_item_change` (`BEFORE INSERT/UPDATE/DELETE`) trava a linha do orçamento e:
- recusa mexer nos itens de um orçamento respondido (RN-25, erro `OR006`), para a `app_user`; as cascatas de exclusão (orçamento, conta) passam;
- limita a **100 itens por orçamento** (RN-14, erro `OR004`), contando depois da trava, então dois itens ao mesmo tempo entram em fila.

### `quote_events`
| Coluna | Tipo | Notas |
|---|---|---|
| id, created_at | | |
| quote_id | uuid not null → quotes `on delete cascade` | FK composta `(quote_id, user_id)`, como nos itens |
| user_id | uuid not null | dono do orçamento |
| type | enum `quote_event_type` (`viewed`,`approved`,`rejected`) | |
| quote_version | int not null | a versão vista ou respondida (RN-24, RN-34) |
| ip | inet null | apagado (vira nulo) após 12 meses (RN-37, NBB-52 D6-A); **a `app_user` não lê esta coluna** (D8-A) |
| user_agent | text null | ≤ 500 |
| respondent_name | text null | ≤ 120 (RN-33) |
| reason_code | enum `reject_reason` (`price`,`deadline`,`gave_up`,`other`) null | motivo rápido da recusa (RN-33) |
| reason | text null | ≤ 1000, texto livre da recusa (RN-33) |

Índices: `(quote_id, created_at)` e `(created_at)` (anonimização). **RLS** `ENABLE` + `FORCE`: a `app_user` só faz select dos eventos dos próprios orçamentos e **sem a coluna `ip`** (`GRANT SELECT` por coluna): o IP é dado pessoal do cliente final e fica só para o administrador, pelo DBeaver (D8-A). Escrita **somente** pelas funções `SECURITY DEFINER` (ver abaixo), com uma policy para a `orco_owner`. Migration `0009_public_quote` (NBB-52).

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
| key | text | ex.: `signup:ip:<ip>`, `signup-email:day`, `pdf:user:<uuid>` |
| window_start | timestamptz | início da janela, no relógio de São Paulo |
| count | int | |

PK `(key, window_start)`. Criada na NBB-39 (migration `0002_rate_limits`, escrita à mão). **RLS `ENABLE` + `FORCE` com uma única policy, para a `orco_owner`** (a dona, usada pela função `SECURITY DEFINER`); a `app_user` não tem nenhuma permissão na tabela. Limpeza das janelas antigas da mesma chave feita dentro da própria função.

## Arquivos (RustFS, ADR-0015)

- Bucket `logos` no RustFS do ambiente, criado pelo próprio app na primeira vez que precisa dele (NBB-81, L1).
- Chave `{uuid}.{webp|png|jpg}`, com o UUID gerado pelo servidor e **sem o id da conta**, porque o endereço do logo é público (NBB-81, L4). O perfil guarda a chave em `profiles.logo_path`; só existe um logo por conta.
- **Escrita** (envio, troca, remoção) só pelo servidor, depois de validar a sessão: o perfil alterado é sempre o da sessão (`withUserDb`). Na troca e na remoção, o arquivo anterior é apagado.
- **Leitura** pela rota pública `/api/p/logos/{uuid}.{ext}` (liberada do Basic Auth no staging, como `/p/*`), com cache "imutável": trocar o logo gera outro nome.
- Tipos PNG, JPEG e WebP e até 5 MB, conferidos no servidor pelos primeiros bytes do arquivo (RN-05). Na prática, chega um WebP (ou PNG, no Safari) de até 1024 px, já reduzido no navegador.

## Funções

| Função | Executável por | Descrição |
|---|---|---|
| `app.handle_new_user()` | trigger `user_create_profile` em `auth.user` (`SECURITY DEFINER`) | cria o `profiles` da conta nova na mesma transação do cadastro (e-mail ou Google) |
| `app.set_updated_at()` | trigger `BEFORE UPDATE` de cada tabela (menos `quotes`) | mantém o `updated_at` (convenção) |
| `app.set_quote_updated_at()` | trigger `BEFORE UPDATE` em `quotes` | o `updated_at` como última atividade: não muda quando só mudam visualizações, "visto" e lembrete (NBB-48) |
| `app.normalize_search(text)` | `app_user` (busca da lista; `SECURITY DEFINER`) | minúsculas e sem acentos, pela extensão `unaccent` (no schema `extensions`, sem acesso do app), igual à busca de clientes no navegador (NBB-48 L5-A) |
| `app.enforce_client_limit()` | trigger `BEFORE INSERT` em `clients` | limite de 1.000 clientes por conta (RN-38); erro `OR001` (NBB-44) |
| `app.enforce_catalog_item_limit()` | trigger `BEFORE INSERT` em `catalog_items` | limite de 500 itens por conta (RN-38); erro `OR002` (NBB-45) |
| `app.prepare_new_quote()` | trigger `BEFORE INSERT` em `quotes` (`SECURITY DEFINER`) | pega e incrementa `profiles.next_quote_number` com lock de linha (RN-12) e força os valores iniciais (rascunho, versão 1, token novo); conta o limite de 200 por mês (RN-38); confere que o orçamento é da conta da transação (NBB-46) |
| `app.check_quote_update()` | trigger `BEFORE UPDATE` em `quotes` | transições de status e RN-13 no envio, versão uma vez por transação, trava do respondido (RN-22 a RN-27, NBB-46) |
| `app.check_quote_item_change()` | trigger `BEFORE INSERT/UPDATE/DELETE` em `quote_items` | trava do respondido e limite de 100 itens (RN-14, RN-25) |
| `app.bump_quote_version_from_item()` | trigger `AFTER` em `quote_items` (`SECURITY DEFINER`) | sobe a versão do orçamento enviado quando um item muda, uma vez por transação (RN-24) |
| `app.generate_public_token()` | `app_user` (default de `quotes.public_token`; `SECURITY DEFINER`) | 32 bytes de `gen_random_bytes` (extensão `pgcrypto`, no schema `extensions`, sem acesso do app) em base64url (RN-30, NBB-46) |
| `app.get_public_quote(token)` | `app_user` (só o servidor chama; `SECURITY DEFINER`) | um único JSON com o orçamento, os itens e o perfil público, só se enviado, aprovado ou recusado (RN-31); rascunho, excluído e token inválido dão nulo. Nada de ids, dono, e-mail da conta, anotações internas, token ou contagem. **Só lê** (NBB-52 D2-A, D4-A) |
| `app.register_quote_view(token, ip, user_agent)` | `app_user` (só o servidor chama; `SECURITY DEFINER`) | conta a visualização e, na primeira, grava o evento `viewed` (RN-35); devolve `true` só na primeira. Quem decide se conta (não é robô nem o dono logado) é a página. Não muda o `updated_at` nem a versão (NBB-52 D2-A) |
| `app.respond_to_quote(token, decision, expected_version, respondent_name, reason_code, reason, ip, user_agent)` | `app_user` (só o servidor chama; `SECURITY DEFINER`) | resposta única (RN-32): só um enviado, dentro da validade (dia de São Paulo) e na versão que a página mostrou (NBB-52 R2-A); grava o status e o evento com IP, navegador, versão e o nome (aprovar) ou o motivo (recusar) (RN-33, RN-34), numa transação. Devolve `ok`, `not_found`, `already_responded`, `expired` ou `outdated` |
| `app.check_rate_limit(key, limit, window_seconds)` | `app_user` | janela fixa alinhada ao relógio de São Paulo (86400 = vira à meia-noite de Brasília); conta mais um uso e retorna permitido/negado (NBB-39) |
| `app.regenerate_public_token(quote_id)` | `app_user` (só o dono, pela conta da transação; `SECURITY DEFINER`, porque a `app_user` não altera o token) | troca o token na hora, em qualquer status (RN-36, NBB-52 R1-A); devolve o token novo, ou nulo se o orçamento não é da conta |
| `app.anonymize_old_event_ips()` | `app_user`, pela tarefa agendada na VPS (o mesmo agendamento diário do lembrete, NBB-62) | apaga o IP dos eventos com mais de 12 meses (RN-37, NBB-52 D5-A/D6-A) |
| `quotes_due_for_reminder()` | `app_user` (rota do cron) | orçamentos `sent`, sem resposta, com `valid_until = amanhã (SP)` e `reminder_sent_at` nulo; usada pelo lembrete diário (RN-43) |

Todas as funções `SECURITY DEFINER` pertencem à `orco_owner` e usam `set search_path = ''` e nomes totalmente qualificados. `PUBLIC` não tem `execute` em nada; cada função concede `execute` só à role indicada. O banco não tem porta pública, então as funções públicas só são chamadas pelo servidor do Next.js (ver [07-seguranca.md](07-seguranca.md), ADR-0005 e ADR-0014), com IP e user agent vindos do Nginx.

## Exclusão de conta

Server Action (sessão validada + "EXCLUIR" digitado) → remove o logo do RustFS (pelo `profiles.logo_path`) → apaga a linha em `auth.user` pela role `app_auth` → a cascata (`on delete cascade`) apaga sessões, contas de login (senha e Google) e todas as tabelas do produto → limpa o cookie. O RustFS não participa da cascata, por isso a remoção explícita.

Decidido em 2026-10-03 (NBB-43):
- A Server Action apaga direto, sem o `deleteUser` do Better Auth. Ele exigiria login de menos de 24 h ou a senha, e quem entra com o Google não tem senha (E1).
- Se o logo não puder ser apagado, **a conta não é apagada** e a pessoa tenta de novo: nada fica para trás (E2).
- Código em `src/features/auth/delete-account.ts`.
