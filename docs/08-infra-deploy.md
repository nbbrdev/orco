# 08 — Infraestrutura e deploy

> Status: rascunho para validação · Última atualização: 2026-09-27
>
> Nada desta página é criado na M0; tudo é executado na **M1**.

## Ambientes

| Ambiente | App | Banco | Gatilho |
|---|---|---|---|
| Local | `pnpm dev` | Supabase CLI no **Docker** | — |
| Preview (por PR) | Vercel Preview, URL gerada por PR | Supabase **`orco-staging`** | PR aberto/atualizado |
| **Staging** | Vercel Preview da `main` em **`https://staging.orco.nbbrdev.com`** | Supabase **`orco-staging`** | merge na `main` |
| Produção | Vercel Production em `https://orco.nbbrdev.com` | Supabase **`orco-prod`** | **release** (merge do PR do release-please → tag `vX.Y.Z`), ADR-0010 |

Os 2 projetos do plano Free são `orco-staging` e `orco-prod` (ADR-0008).

## Vercel

- Projeto `orco` ligado ao repositório GitHub. Framework Next.js, pnpm.
- **Deploy automático de produção desligado** (ADR-0010). A integração Git gera só previews (PRs e `main`). Produção é publicada pela **Vercel CLI no GitHub Actions** (`release.yml`): `vercel pull --environment=production` → `vercel build --prod` → `vercel deploy --prebuilt --prod`. A configuração exata (ex.: `git.deploymentEnabled` no `vercel.json` ou a opção de produção no painel) é validada na M1.
- Ambiente **Development** na Vercel com as variáveis do Supabase local, para `vercel env pull` gerar o `.env.local`.
- Plano Hobby no MVP. ⚠️ O Hobby é restrito a uso **não comercial**; ao monetizar, migrar para o Pro.
- Env vars por ambiente (Preview ≠ Production), conforme [06-regras-dev.md](06-regras-dev.md) §8.
- Domínio: `orco.nbbrdev.com` adicionado ao projeto. No painel de DNS da **Hostinger** (zona `nbbrdev.com`), criar um registro **CNAME** com nome `orco` apontando para o alvo que a Vercel indicar (normalmente `cname.vercel-dns.com`). O certificado TLS é emitido automaticamente pela Vercel. O domínio raiz e os outros subdomínios não são afetados.
- Nome ASCII: o slug `orco` é usado na URL porque domínios com acento (IDN) viram *punycode* (`xn--…`) em vários contextos. A marca **Orçô** aparece só na interface.
- **Staging com domínio fixo:** `staging.orco.nbbrdev.com` atribuído à branch `main` no ambiente Preview (sempre o último deploy da `main`). CNAME `staging.orco` na Hostinger → alvo da Vercel. É a URL usada para testar no celular, instalar o PWA de teste e testar push.
- **Proteção de previews e staging (no app, não na Vercel):** a Deployment Protection da Vercel é "tudo ou nada" por deploy, então fica **desligada**. Em seu lugar, o middleware exige **HTTP Basic Auth** quando `VERCEL_ENV=preview`, **exceto** em `/p/*`, `/api/p/*`, `/sw.js` e `/manifest.webmanifest`. Assim, um "cliente de teste" consegue abrir o link público de um orçamento de staging. As credenciais ficam em `STAGING_BASIC_AUTH_USER`/`STAGING_BASIC_AUTH_PASSWORD`, só no ambiente Preview. Staging e previews também enviam `X-Robots-Tag: noindex` em todas as rotas.
- **Vercel Cron** (`vercel.json`): `/api/cron/lembretes` 1× por dia às 12:00 UTC (9h em São Paulo). No Hobby, o horário tem precisão de ± 1 h e há limite de jobs diários, o que é suficiente. `CRON_SECRET` configurado em Production.

## Web Push (VAPID)

- Par de chaves VAPID gerado uma vez (`npx web-push generate-vapid-keys`): a pública vai em `NEXT_PUBLIC_VAPID_PUBLIC_KEY` e a privada só no servidor. Um par por ambiente (staging e prod), já que as assinaturas ficam presas à chave.
- `VAPID_SUBJECT = mailto:<e-mail de contato do projeto>`.
- Trocar as chaves invalida todas as assinaturas, e os usuários precisariam reativar o push.

## Supabase

- Região: `sa-east-1` (São Paulo), pela latência e por manter os dados no Brasil.
- Auth:
  - Site URL = URL de produção (no projeto staging: `https://staging.orco.nbbrdev.com`). Redirect URLs = produção, `https://staging.orco.nbbrdev.com/**`, `https://*-<escopo-vercel>.vercel.app/**` (previews; o escopo é definido na M1) e `http://localhost:3000/**`.
  - Provedores: e-mail (confirmação ligada) e Google.
  - Política de senha: mínimo 8, sem exigência de tipos.
  - CAPTCHA nativo: **desligado** (o Turnstile é validado pela Server Action de cadastro; ver 07-seguranca §1).
  - SMTP customizado: Resend.
  - Templates de e-mail em pt-BR com a marca Orçô.
- Storage: bucket `logos` ([05-dados.md](05-dados.md)).
- Extensões: `pgcrypto` (tokens), `pg_cron` (RN-37).
- Migrations aplicadas em prod **somente pelo workflow de release** (`supabase db push`), junto com o deploy da versão. Nunca pelo painel.

## Google OAuth

- Projeto no Google Cloud com tela de consentimento (nome Orçô, logo, links de privacidade/termos, domínio autorizado).
- Client OAuth Web com redirect `https://<projeto>.supabase.co/auth/v1/callback`.
- Client ID/secret configurados no painel do Supabase.

## Resend

- Domínio de envio verificado (SPF, DKIM, DMARC) com registros criados no DNS da Hostinger. Remetente sugerido: `nao-responda@orco.nbbrdev.com`. ⚠️ PENDENTE confirmar o remetente. Usar o subdomínio isola a reputação de envio do domínio principal.
- Dois usos:
  1. **SMTP do Supabase Auth** (confirmação, recuperação): credenciais no painel do Supabase.
  2. **API do Resend no app** (notificação de resposta ao freelancer, RN-40): `RESEND_API_KEY` na Vercel, só no servidor. Templates com React Email.
- Plano Free: 3.000 e-mails/mês, 100/dia, compartilhados entre os dois usos.

## Cloudflare Turnstile

- Widget em modo "managed/invisible" para os hostnames de produção, `staging.orco.nbbrdev.com`, previews e localhost.
- Site key no app (pública, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`); secret key na Vercel, só no servidor (`TURNSTILE_SECRET_KEY`).

## GitHub (ADR-0007)

- Repositório **público** [`nbbrdev/orco`](https://github.com/nbbrdev/orco) (remote SSH `git@github-indie:nbbrdev/orco.git`, usando um alias de host do `~/.ssh/config`), branch `main` protegida ([06-regras-dev.md](06-regras-dev.md) §4).
- Configurações de segurança: Dependabot alerts + security updates, secret scanning + push protection, CodeQL (code scanning).
- Integrações: Vercel (deploys), Linear (vincula PRs e issues).

### Workflows (`.github/workflows/`)

| Arquivo | Gatilho | Passos |
|---|---|---|
| `ci.yml` | PR e push em `main` | checkout → pnpm (cache) → `install --frozen-lockfile` → lint → typecheck → Vitest → build → `pnpm audit --audit-level=high` |
| `codeql.yml` | PR, push em `main`, semanal | CodeQL `javascript-typescript`, suite `security-extended` |
| `e2e.yml` | deploy de preview concluído (a partir da M2) | Playwright contra a URL do preview |
| `pr-title.yml` | PR aberto/editado | valida o título em Conventional Commits |
| `db-migrate-staging.yml` | PR ou push em `main` com mudança em `supabase/migrations` | `supabase db push` no **orco-staging** |
| `release-please.yml` | push em `main` | mantém o PR de release (versão + `CHANGELOG.md`); no merge dele, cria a tag `vX.Y.Z` e o GitHub Release |
| `release.yml` | release publicado | `supabase db push` no **orco-prod** → Vercel CLI `build --prod` + `deploy --prebuilt --prod` → status update no Linear |
| `backup.yml` | diário (cron) | `pg_dump` → criptografa com age → envia ao destino ⚠️ PENDENTE |

Regras de workflow: `permissions:` mínimas por job, actions de terceiros fixadas por SHA, secrets nunca impressos.

### `dependabot.yml`

- Ecossistemas `npm` (/) e `github-actions` (/), semanal.
- Grupos: `minor-and-patch` agrupados; majors em PR separado.
- Label `dependencies`.

### Templates

- `.github/PULL_REQUEST_TEMPLATE.md`: issue do Linear, o que mudou, como testar, checklist de segurança, checklist de simplicidade, docs atualizados.
- `.github/CODEOWNERS`: `* @nbbrdev`.
