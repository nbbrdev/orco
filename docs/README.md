# Documentação do Orçô

> **Orçô**: orçamentos simples para freelancers. Crie, envie e receba aprovação em minutos.

Esta pasta é a **fonte da verdade do conteúdo** do projeto. O **planejamento e o andamento** (fases, milestones, issues) ficam no **Linear**, projeto [**Orçô**](https://linear.app/nbbrdev/project/orco-2a2c096fa538) (time Nbbr dev, chave `NBB`).

**Produção:** https://orco.nbbrdev.com · **Repositório:** https://github.com/nbbrdev/orco

## Índice

| Doc | Conteúdo |
|---|---|
| [01-visao.md](01-visao.md) | Problema, proposta, público, **princípio de simplicidade**, métricas |
| [02-escopo.md](02-escopo.md) | Dentro / fora do MVP, delimitações, futuro |
| [03-requisitos.md](03-requisitos.md) | Requisitos funcionais (RF) e não funcionais (RNF) |
| [04-arquitetura.md](04-arquitetura.md) | Stack, estrutura de pastas, padrões de fluxo técnico |
| [05-dados.md](05-dados.md) | Roles, tabelas, RLS, funções, arquivos |
| [06-regras-dev.md](06-regras-dev.md) | Processo (Linear, Git), código, banco, testes, env vars, DoD |
| [07-seguranca.md](07-seguranca.md) | Autenticação, RLS, criptografia, headers, LGPD, backup manual |
| [08-infra-deploy.md](08-infra-deploy.md) | VPS, Docker Compose, Nginx, deploy, backup manual, DNS, GitHub (CI, CodeQL, Dependabot) |
| [09-regras-negocio.md](09-regras-negocio.md) | Regras de negócio numeradas (RN) |
| [10-fluxos.md](10-fluxos.md) | Jornadas de usuário (F), com orçamento de simplicidade |
| [11-mapa.md](11-mapa.md) | Atores, entidades, estados, mapa de telas, glossário |
| [12-identidade-visual.md](12-identidade-visual.md) | Logo, cores, tipografia, forma, temas e PDF |
| [decisoes/](decisoes/) | ADRs: registro de decisões técnicas (0001–0016; os substituídos continuam como histórico) |
| [pendencias.md](pendencias.md) | Perguntas em aberto |

## Fases

| # | Milestone | Objetivo | Versão |
|---|---|---|---|
| M0 | Documentação & Negócio | Escopo, regras, fluxos e mapa **validados** ✅ | — |
| M1 | Setup técnico | Repo, CI/CodeQL/Dependabot, Next.js, Postgres + Drizzle + RLS, VPS com Docker e Nginx, deploy automatizado, backup manual ✅ (no ar em 2026-10-01) | `0.1.0` |
| M2 | Auth & Perfil | Cadastro, login, Google, perfil e logo, PWA e tema ✅ (no ar em 2026-10-03) | `0.2.0` |
| M3 | Clientes & Catálogo | CRUDs ✅ (no ar em 2026-10-03) | `0.3.0` |
| M4 | Orçamentos | Editor, cálculo, status, duplicar ← *fase atual* | `0.4.0` |
| M5 | PDF | PDF com marca | `0.5.0` |
| M6 | Link público + aprovação | Página do cliente, aprovar/recusar, notificações (e-mail, push, lembrete) | `0.6.0` |
| M7 | Hardening & Lançamento | Usabilidade, performance, segurança, LGPD, go-live | **`1.0.0`** |

Versionamento e releases: [ADR-0010](decisoes/0010-versionamento-e-releases.md). Produção só recebe versões com tag.

**Portão da M0:** a M1 só começa com todos os fluxos e regras `✅ validados` e sem pendências bloqueantes. Cumprido em 2026-09-28.

## Como manter

- Mudou algo aqui? Atualize o Linear Doc correspondente na mesma sessão.
- Decisão técnica nova vira ADR em `decisoes/NNNN-titulo.md` (Contexto, Decisão, Consequências).
- Pendência nova: marque `> ⚠️ PENDENTE:` no texto e adicione em [pendencias.md](pendencias.md).
- Numerações (RN, RF, RNF, F, P, ADR) nunca são reaproveitadas.
