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
