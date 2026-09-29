# 08 — Infraestrutura e deploy

> Status: rascunho para validação · Última atualização: 2026-09-28
>
> Nada desta página é criado na M0; tudo é executado na **M1**.

## Ambientes

| Ambiente | App | Banco | Gatilho |
|---|---|---|---|
| Local | `npm run dev` (`APP_ENV=development`) | Supabase CLI no **Docker** (`npm run db:start`) | — |
| **Staging** | Deploy "Preview" da Vercel em **`https://staging.orco.nbbrdev.com`** (`APP_ENV=staging`) | Supabase **`orco-staging`** | merge na `main` com CI verde (`staging.yml`) |
| Produção | Vercel Production em `https://orco.nbbrdev.com` (`APP_ENV=production`) | Supabase **`orco-prod`** | **versão criada pelo usuário** (`gh release create vX.Y.Z` → `production.yml`), ADR-0010 |

Os 2 projetos do plano Free são `orco-staging` e `orco-prod` (ADR-0008).

**Não há preview por PR** (decisão de 2026-09-28): um PR é revisado pelo código, pela explicação, pelo CI e rodando a branch localmente (inclusive no celular, pelo endereço "Network" do `npm run dev` na mesma Wi-Fi; as faixas privadas `192.168.*.*` e `10.*.*.*` estão liberadas em `allowedDevOrigins` no `next.config.ts`). Depois do merge, o teste acontece no staging. Motivos: um único endereço de teste, banco sempre coerente com o código, token da Vercel fora do alcance de PRs e pipeline igual ao da futura VPS (ADR-0011).

## Vercel

- Projeto `orco` **sem integração Git**: a Vercel nunca publica sozinha. O `vercel.json` trava isso no repositório (`git.deploymentEnabled: false`). Framework Next.js, Node 24.
- **Todos os deploys saem do GitHub Actions**, pela "receita" reutilizável `deploy-vercel.yml`: `vercel pull` (variáveis do ambiente) → `vercel build` → `vercel deploy --prebuilt` → `vercel alias set` (staging). É o único arquivo que conhece a Vercel; na VPS, só ele muda.
  - Staging: `staging.yml` chama a receita com o ambiente Preview da Vercel e aponta `staging.orco.nbbrdev.com` para o novo deploy.
  - Produção: `production.yml` chama a receita com `--prod` quando o usuário publica uma release.
- **Vercel CLI isolado em `tools/deploy/`** (versão exata e lockfile próprio, vigiado pelo Dependabot). Fica fora do `package.json` do app porque traz centenas de pacotes com vulnerabilidades conhecidas (ex.: `undici`), que reprovariam o `npm audit` do app. Ele só roda no job de deploy.
- Sem ambiente Development na Vercel: as chaves locais são as padrão do Supabase CLI e ficam no `.env.local`.
- Plano **Hobby** no MVP (produto gratuito, não comercial). Após o `1.0.0`, o app migra para uma **VPS própria** (ADR-0011). Se houver monetização antes disso, a Vercel precisa ir para o Pro.
- **Portabilidade:** nada de `@vercel/*` ou recursos exclusivos da Vercel; o código precisa rodar em `next start`/standalone (ADR-0011).
- Env vars por ambiente da Vercel: **Preview = staging**, **Production = produção**, conforme [06-regras-dev.md](06-regras-dev.md) §8.
- Domínio: `orco.nbbrdev.com` adicionado ao projeto. No painel de DNS da **Hostinger** (zona `nbbrdev.com`), criar um registro **CNAME** com nome `orco` apontando para o alvo que a Vercel indicar (normalmente `cname.vercel-dns.com`). O certificado TLS é emitido automaticamente pela Vercel. O domínio raiz e os outros subdomínios não são afetados.
- Nome ASCII: o slug `orco` é usado na URL porque domínios com acento (IDN) viram *punycode* (`xn--…`) em vários contextos. A marca **Orçô** aparece só na interface.
- **Staging com domínio fixo:** `staging.orco.nbbrdev.com` é um *alias* movido pelo `staging.yml` para cada novo deploy da `main`. CNAME `staging.orco` na Hostinger → alvo da Vercel. É a URL usada para testar no celular, instalar o PWA de teste e testar push.
- **Proteção do staging (no app, não na Vercel):** a Deployment Protection da Vercel fica **desligada**, senão ela pediria o login da Vercel até no link público do orçamento. Em seu lugar, o proxy (`src/proxy.ts`) exige **HTTP Basic Auth** quando `APP_ENV=staging`, **exceto** em `/p/*`, `/api/p/*`, `/sw.js` e `/manifest.webmanifest`. Assim, um "cliente de teste" consegue abrir o link público de um orçamento de staging. As credenciais ficam em `STAGING_BASIC_AUTH_USER`/`STAGING_BASIC_AUTH_PASSWORD`, só no ambiente Preview. Sem elas, o staging responde **503** (fica fechado, nunca aberto por esquecimento). O staging também envia `X-Robots-Tag: noindex, nofollow` em todas as rotas.
- **Vercel Cron** (`vercel.json`): `/api/cron/lembretes` 1× por dia às 12:00 UTC (9h em São Paulo). No Hobby, o horário tem precisão de ± 1 h e há limite de jobs diários, o que é suficiente. `CRON_SECRET` configurado em Production.

## Web Push (VAPID)

- Par de chaves VAPID gerado uma vez (`npx web-push generate-vapid-keys`): a pública vai em `NEXT_PUBLIC_VAPID_PUBLIC_KEY` e a privada só no servidor. Um par por ambiente (staging e prod), já que as assinaturas ficam presas à chave.
- `VAPID_SUBJECT = mailto:<e-mail de contato do projeto>`.
- Trocar as chaves invalida todas as assinaturas, e os usuários precisariam reativar o push.
- PWA e push são testados **no staging** (URL fixa com HTTPS). Localmente pelo celular não dá: falta HTTPS.
- **Risco a verificar na fase do PWA:** no iPhone, o push exige o app instalado na tela inicial, e o app instalado pode não repassar a senha do Basic Auth. Se acontecer, trocar o Basic Auth do staging por um login próprio.

## Supabase

- Região: `sa-east-1` (São Paulo), pela latência e por manter os dados no Brasil.
- Auth:
  - Site URL = URL de produção (no projeto staging: `https://staging.orco.nbbrdev.com`). Redirect URLs: no `orco-prod`, `https://orco.nbbrdev.com/**`; no `orco-staging`, `https://staging.orco.nbbrdev.com/**` e `http://localhost:3000/**`. Sem previews, não há domínios `*.vercel.app`.
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

- Domínio de envio `orco.nbbrdev.com` **verificado** (2026-09-28), com registros na Hostinger:
  - DKIM `resend._domainkey.orco`;
  - SPF/MX em `send.orco`;
  - DMARC herdado do domínio raiz (`_dmarc.nbbrdev.com`, `p=none`).

  Usar o subdomínio isola a reputação de envio do domínio principal. O domínio raiz `nbbrdev.com` também está no Resend, para outros usos.
- **Remetente:** `Orçô <nao-responda@orco.nbbrdev.com>`, sem Reply-To. Os e-mails avisam no rodapé que a caixa não recebe respostas.
- Dois usos:
  1. **SMTP do Supabase Auth** (confirmação, recuperação, troca de e-mail, link de acesso e aviso de senha alterada), configurado no **painel de cada projeto**:
     - SMTP: `smtp.resend.com:465`, usuário `resend`;
     - senha: API key `supabase-smtp` com só *Sending access* e só o domínio `orco.nbbrdev.com`.

     Os **templates** em pt-BR são versionados em `supabase/templates/` (usados direto pelo Supabase local) e colados no painel, conforme o checklist em `supabase/templates/README.md`. Os links usam `token_hash` → `/auth/confirm`.
  2. **API do Resend no app** (notificação de resposta ao freelancer, RN-40): `RESEND_API_KEY` na Vercel, só no servidor. Templates com React Email.
- Plano Free: 3.000 e-mails/mês, 100/dia, compartilhados entre os dois usos.

## Cloudflare Turnstile

- Widget em modo "managed/invisible" para os hostnames de produção, `staging.orco.nbbrdev.com` e localhost.
- Site key no app (pública, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`); secret key na Vercel, só no servidor (`TURNSTILE_SECRET_KEY`).

## GitHub (ADR-0007)

- Repositório **público** [`nbbrdev/orco`](https://github.com/nbbrdev/orco) (remote SSH `git@github-indie:nbbrdev/orco.git`, usando um alias de host do `~/.ssh/config`), branch `main` protegida ([06-regras-dev.md](06-regras-dev.md) §4).
- Configurações de segurança: Dependabot alerts + security updates, secret scanning + push protection, CodeQL (code scanning).
- Integrações: Linear (vincula PRs e issues). A Vercel **não** é integrada ao GitHub: ela só recebe deploys enviados pelo Actions.

### Workflows (`.github/workflows/`)

| Arquivo | Gatilho | Passos |
|---|---|---|
| `ci.yml` | PR e push em `main` | checkout → Node do `.nvmrc` (cache do npm) → `npm ci` → Prettier (`format:check`) → lint → typecheck → Vitest → build → `npm audit --audit-level=high` |
| `codeql.yml` | PR, push em `main`, semanal | CodeQL `javascript-typescript`, suite `security-extended` |
| `e2e.yml` | a partir da M2; a definir (local no CI ou contra o staging após o deploy) | Playwright |
| `pr-title.yml` | PR aberto/editado | valida o título em Conventional Commits |
| `staging.yml` | **CI concluído com sucesso** num push na `main` (ou manual) | 1) `migrate`: `supabase db push --db-url` no **orco-staging** (Session Pooler, environment `staging`, sem Access Token); 2) `deploy`: chama `deploy-vercel.yml` no **mesmo commit** que o CI validou e move o alias `staging.orco.nbbrdev.com`. Nunca roda para PR ou fork; um de cada vez, sem cancelar no meio. Sem a variable `VERCEL_PROJECT_ID`, o `deploy` fica "skipped" |
| `deploy-vercel.yml` | só quando chamado (`workflow_call`) | receita de publicar: `npm ci` (app + `tools/deploy`) → `vercel pull` → `build` → `deploy --prebuilt` → `alias set` (opcional). Registra a URL no environment do GitHub |
| `production.yml` | release publicada pelo usuário (`gh release create vX.Y.Z --target main --generate-notes`) | 1. `verify`: tag no formato `vX.Y.Z`, commit na `main` e check `ci` verde nele; 2. `migrate`: `supabase db push` no **orco-prod** (environment `production`, só tags `v*`); 3. `deploy`: `deploy-vercel.yml` com `--prod` e a versão da tag ("skipped" sem a Vercel). Republicar/rollback: "Re-run all jobs" na execução da versão |
| `backup.yml` | diário 06:00 UTC (03:00 SP) | `supabase db dump` do **orco-prod** via Session Pooler (roles + schema + dados) → criptografa com `age` (chave **pública**) → `upload-artifact` com retenção de **30 dias** |

Regras de workflow: `permissions:` mínimas por job, actions de terceiros fixadas por SHA, secrets nunca impressos.

### `dependabot.yml`

- Ecossistemas `npm` (/) e `github-actions` (/), semanal.
- Grupos: `minor-and-patch` agrupados; majors em PR separado.
- Label `dependencies`.

### Templates

- `.github/PULL_REQUEST_TEMPLATE.md`: issue do Linear, o que mudou, como testar, checklist de segurança, checklist de simplicidade, docs atualizados.
- `.github/CODEOWNERS`: `* @nbbrdev`.
