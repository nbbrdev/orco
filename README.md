# Orçô

Orçamentos simples para freelancers: crie, envie por link ou PDF e receba a aprovação do cliente em minutos.

- **Produção:** https://orco.nbbrdev.com
- **Documentação:** [`docs/`](docs/README.md) (escopo, regras de negócio, fluxos, arquitetura, segurança)
- **Planejamento:** Linear, projeto Orçô

## Rodando localmente

Requisitos: **Node 24** (`.nvmrc`), npm e **Docker** (Postgres, RustFS e Mailpit locais pelo `compose.dev.yaml`).

Arquitetura: VPS própria com Docker Compose, PostgreSQL + Drizzle com RLS, Better Auth, RustFS e e-mail por SMTP. Ver [`docs/04-arquitetura.md`](docs/04-arquitetura.md) e [`docs/08-infra-deploy.md`](docs/08-infra-deploy.md).

```bash
npm install
cp .env.example .env.local   # os valores locais já vêm preenchidos
npm run db:start             # Postgres, RustFS e Mailpit no Docker
npm run db:migrate           # aplica as migrations
npm run dev                  # http://localhost:3000
```

## Scripts

| Comando                         | O que faz                                       |
| ------------------------------- | ----------------------------------------------- |
| `npm run dev`                   | servidor de desenvolvimento                     |
| `npm run build`                 | build de produção                               |
| `npm run lint`                  | ESLint (falha com qualquer aviso)               |
| `npm run typecheck`             | checagem de tipos do TypeScript                 |
| `npm test`                      | testes unitários (Vitest), sem Docker           |
| `npm run test:integration`      | testes contra o Postgres local (RLS)            |
| `npm run test:coverage`         | unitários + integração com cobertura (Docker)   |
| `npm run test:e2e`              | E2E no navegador (Playwright; build antes)      |
| `npm run db:start` / `db:stop`  | sobe / desce os serviços locais (Docker)        |
| `npm run db:migrate`            | aplica as migrations (role `orco_owner`)        |
| `npm run db:generate -- <nome>` | gera uma migration a partir do schema (Drizzle) |
| `npm run db:reset`              | apaga os dados locais e recria do zero          |
| `npm run auth:generate`         | regera as tabelas de login (CLI do Better Auth) |
| `npm run format`                | formata o código com Prettier                   |

## Contribuindo

Veja [`docs/06-regras-dev.md`](docs/06-regras-dev.md): um PR por issue, título em Conventional Commits com o ID do Linear (ex.: `feat(quotes): adiciona desconto por item [NBB-47]`), squash merge.
