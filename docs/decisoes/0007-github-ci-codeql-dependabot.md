# ADR-0007 — GitHub público, CI, CodeQL e Dependabot

- **Status:** aceito
- **Data:** 2026-09-27

## Contexto
É preciso garantir qualidade e segurança continuamente, sem custo. No GitHub, CodeQL (code scanning) é gratuito só em repositórios públicos; em privado exige GitHub Advanced Security, que é pago.

## Decisão
- Repositório **público** no GitHub.
- `main` protegida: PR obrigatório, CI e CodeQL como checks obrigatórios, squash merge, histórico linear.
- **CI** (GitHub Actions): lint, typecheck, Vitest, build e `npm audit` em todo PR.
- **CodeQL** `security-extended` em PR, push e semanalmente.
- **Dependabot** (npm + github-actions) semanal, com security updates ativas.
- **Secret scanning + push protection** ativos.
- Integração GitHub↔Linear (IDs nos branches e commits). ~~GitHub↔Vercel (previews).~~ **Revisão (2026-09-28, NBB-35):** sem integração com a Vercel; os deploys saem do Actions (ADR-0010).

## Consequências
- O código é visível publicamente: a segurança não pode depender de sigilo do código, e segredos ou dados reais nunca vão para o repositório (ver [07-seguranca.md](../07-seguranca.md) §11).
- Artifacts de Actions podem ser baixados por qualquer usuário logado: nada sensível vira artifact. (Os backups do banco não passam pelo GitHub: são manuais, pelo DBeaver, desde 2026-09-30.)
