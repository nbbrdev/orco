# ADR-0006 — Dinheiro em centavos inteiros

- **Status:** aceito (validado pelo usuário em 2026-09-27)
- **Data:** 2026-09-27

## Contexto
Ponto flutuante gera erros de arredondamento (0.1 + 0.2 não é 0.3). Orçamento com total errado destrói a confiança no produto.

## Decisão
- Todo valor monetário é armazenado e trafegado como **inteiro em centavos** (`bigint` no Postgres, `number` inteiro no TS, que é seguro até ~R$ 90 trilhões).
- Percentuais em **pontos-base** (0–10000).
- Quantidade como `numeric(12,3)`; total da linha = `round(quantidade × preço_centavos)`, meio-para-cima (RN-15).
- **No TypeScript**, a quantidade é representada em **milésimos inteiros** (1,5 → `1500`) e as multiplicações usam **BigInt**, com checagem de faixa segura. Nenhum cálculo passa por ponto flutuante (implementado em `src/lib/money.ts`, NBB-38).
- Uma única implementação de cálculo em `src/lib/money.ts`, com 100% de cobertura de testes, usada no client, no servidor e no PDF. O servidor sempre recalcula.
- Formatação `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })` só na exibição.

## Alternativa descartada
`numeric` no Postgres + `decimal.js` no TS: exato e mais natural de ler, mas com mais dependências e conversões em toda a pilha.

## Consequências
- Inputs de dinheiro convertem "1.234,56" ↔ 123456 na borda.
- É proibido `float`/`real`/`double precision` para dinheiro no banco.
