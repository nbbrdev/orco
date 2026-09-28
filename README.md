# Orçô

Orçamentos simples para freelancers: crie, envie por link ou PDF e receba a aprovação do cliente em minutos.

- **Produção:** https://orco.nbbrdev.com
- **Documentação:** [`docs/`](docs/README.md) (escopo, regras de negócio, fluxos, arquitetura, segurança)
- **Planejamento:** Linear, projeto Orçô

## Rodando localmente

Requisitos: **Node 24** (`.nvmrc`), npm e Docker (para o Supabase local, a partir da M1).

```bash
npm install
cp .env.example .env.local   # preencha os valores
npm run dev                  # http://localhost:3000
```

## Scripts

| Comando             | O que faz                         |
| ------------------- | --------------------------------- |
| `npm run dev`       | servidor de desenvolvimento       |
| `npm run build`     | build de produção                 |
| `npm run lint`      | ESLint (falha com qualquer aviso) |
| `npm run typecheck` | checagem de tipos do TypeScript   |
| `npm test`          | testes unitários (Vitest)         |
| `npm run format`    | formata o código com Prettier     |

## Contribuindo

Veja [`docs/06-regras-dev.md`](docs/06-regras-dev.md): um PR por issue, título em Conventional Commits com o ID do Linear (ex.: `feat(quotes): adiciona desconto por item [NBB-47]`), squash merge.
