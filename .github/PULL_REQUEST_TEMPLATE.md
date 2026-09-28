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
<!-- Passos para verificar no preview/staging ou localmente. -->

## Checklist de simplicidade
- [ ] Não adiciona passo, campo obrigatório ou tela ao fluxo principal (ou a justificativa está acima)
- [ ] Respeita o orçamento de simplicidade do fluxo (`docs/10-fluxos.md`)

## Checklist de segurança
- [ ] Tabela nova/alterada tem RLS + teste de RLS
- [ ] Entrada validada com Zod no servidor
- [ ] Nenhum segredo, dado real ou PII em código, log ou teste
- [ ] Nenhum uso de `getSession()` para autorização
- [ ] Nenhuma importação de `lib/supabase/admin` fora dos pontos permitidos
- [ ] Sem `dangerouslySetInnerHTML` com dado de usuário

## Documentação
- [ ] `/docs` atualizado (ou não se aplica)
- [ ] Linear Docs sincronizados (ou não se aplica)
