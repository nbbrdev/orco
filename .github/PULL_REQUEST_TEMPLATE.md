<!--
Título do PR = commit na main (squash). Formato: tipo(escopo): descrição [NBB-xx]
Ex.: feat(quotes): adiciona desconto por item [NBB-47]
Tipos: feat, fix, perf, security, docs, refactor, test, chore, ci
-->

## Issue

NBB-

## O que muda

<!-- O que foi feito e por quê, em poucas linhas. -->

## Como testar

<!--
Não há preview por PR: teste a branch localmente e, depois do merge, no staging.
Local: `git switch <branch>` → `npm ci` → `npm run db:start` → `npm run dev`.
No celular (mesma Wi-Fi): abra o endereço "Network" que o `npm run dev` mostra.
PWA e push só no staging (precisam de HTTPS).
-->

1.

## Checklist de simplicidade

- [ ] Não adiciona passo, campo obrigatório ou tela ao fluxo principal (ou a justificativa está acima)
- [ ] Respeita o orçamento de simplicidade do fluxo (`docs/10-fluxos.md`)

## Checklist de segurança

- [ ] Tabela nova/alterada tem RLS (`ENABLE` + `FORCE`) + teste de RLS contra Postgres real
- [ ] Acesso a dados do produto só via `withUserDb`, com o usuário da sessão validada no servidor
- [ ] O app não se conecta como `orco_owner`/superusuário; `app_auth` só nas tabelas de login
- [ ] Entrada validada com Zod no servidor
- [ ] Nenhum segredo, dado real ou PII em código, log, teste ou imagem Docker
- [ ] Sem `dangerouslySetInnerHTML` com dado de usuário

## Documentação

- [ ] `/docs` atualizado (ou não se aplica)
- [ ] Linear Docs sincronizados (ou não se aplica)
