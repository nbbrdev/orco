# ADR-0004 — Rate limit no Postgres

- **Status:** aceito
- **Data:** 2026-09-27

## Contexto
Rotas públicas (link do orçamento, aprovar/recusar) e a geração de PDF podem ser abusadas por bots. Funções serverless não compartilham memória, então o contador precisa de armazenamento externo.

## Opções consideradas
1. **Upstash Redis**: lib pronta, mas é mais um serviço e mais uma conta.
2. **Tabela + função no Postgres (Supabase)**: nenhum serviço novo, mais código próprio, uma query por checagem.
3. **Vercel Firewall**: sem código, mas limitado no plano Hobby e sem limite por usuário.

## Decisão
**Opção 2**: tabela `rate_limits` com janela fixa e função `check_rate_limit(key, limit, window_seconds)`, acessível só pelo servidor.

## Consequências
- Custo zero; o volume esperado no MVP é baixo.
- Interface isolada em `src/lib/rate-limit.ts`, trocável por Upstash sem mudar os pontos de uso.
- Limpeza das janelas antigas feita dentro da função.

## Implementação (2026-10-02, NBB-39)
- Adiantada da M6 para o anti-abuso do cadastro (RN-46). Migration `0002_rate_limits` (escrita à mão).
- Função `app.check_rate_limit` (`SECURITY DEFINER`, dona `orco_owner`, `execute` só para a `app_user`): conta mais um uso e diz se está dentro do limite.
- Janelas alinhadas ao **relógio de São Paulo**: com 86400 s, o teto diário vira à meia-noite de Brasília.
- Tabela com RLS `ENABLE` + `FORCE` e uma única policy, para a `orco_owner`; a `app_user` não tem permissão nenhuma nela, só usa a função.
- O login usa o limite embutido do Better Auth (em memória); esta tabela fica para o cadastro, o reenvio, a recuperação de senha (NBB-41) e, depois, o link público e o PDF.
