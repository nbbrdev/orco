# 08 — Infraestrutura e deploy

> Status: rascunho para validação · Última atualização: 2026-09-29
>
> Arquitetura redefinida em 2026-09-29: **VPS própria com Docker Compose**, sem Supabase e sem Vercel ([ADR-0012](decisoes/0012-hospedagem-vps.md)). Executado na **M1**.

## Ambientes

| Ambiente | App | Banco e arquivos | Gatilho |
|---|---|---|---|
| Local | `npm run dev` (`APP_ENV=development`) | `compose.dev.yaml`: Postgres, RustFS e Mailpit no Docker (`npm run db:start`) | — |
| **Staging** | container `app` do projeto `orco-staging` na VPS, em **`https://staging.orco.nbbrdev.com`** (`APP_ENV=staging`) | Postgres e RustFS do próprio projeto | merge na `main` com CI verde (`staging.yml`) |
| Produção | container `app` do projeto `orco-production`, em `https://orco.nbbrdev.com` (`APP_ENV=production`) | Postgres e RustFS do próprio projeto | **versão criada pelo usuário** (`gh release create vX.Y.Z` → `production.yml`), ADR-0010 |

**Não há preview por PR.** Um PR é revisado pelo código, pela explicação, pelo CI e rodando a branch localmente, inclusive no celular pelo endereço "Network" do `npm run dev` na mesma Wi-Fi (as faixas `192.168.*.*` e `10.*.*.*` estão liberadas em `allowedDevOrigins` no `next.config.ts`). Depois do merge, o teste acontece no staging.

## VPS

- **Hostinger KVM 1 ou KVM 2**, Ubuntu LTS. Contratada na NBB-35.
- O build acontece no GitHub Actions; a VPS só roda os containers. Uso estimado de ~1,5 GB para os dois ambientes.
- **Base da máquina** (passo a passo em `deploy/README.md`):
  - usuário `deploy` sem senha, **SSH só por chave** (root e senha desligados);
  - firewall `ufw` com só **22, 80 e 443** abertas;
  - atualizações automáticas de segurança (`unattended-upgrades`);
  - Docker Engine + plugin Compose;
  - Nginx + Certbot.
- **Pasta** `/opt/orco/`, com `compose.yaml` (cópia de `deploy/compose.yaml`), `production.env` e `staging.env`. Os segredos existem **só nesses arquivos**, com permissão restrita ao usuário `deploy`.

## Nginx e HTTPS

- **Nginx instalado no Ubuntu** (fora do Docker), como proxy reverso. Configuração versionada em `deploy/nginx/orco.conf`:
  - `orco.nbbrdev.com` → `127.0.0.1:3000`;
  - `staging.orco.nbbrdev.com` → `127.0.0.1:3001`.
- **Certbot** (`certbot --nginx -d orco.nbbrdev.com -d staging.orco.nbbrdev.com`) emite os certificados do Let's Encrypt, adiciona o HTTPS à configuração e instala a **renovação automática** (timer do systemd).
- O Nginx repassa ao app os headers `X-Forwarded-For`, `X-Forwarded-Proto` e `Host`. O IP e o user agent do cliente (ADR-0005) vêm daí.
- **DNS na Hostinger** (zona `nbbrdev.com`): registros **A** `orco` e `staging.orco` → IP da VPS.
- Nome ASCII: o slug `orco` é usado na URL porque domínios com acento viram *punycode*. A marca **Orçô** aparece só na interface.

## Docker Compose

Um único `deploy/compose.yaml`, usado por dois **projetos** (`orco-production` e `orco-staging`). Cada projeto tem **rede e volumes próprios**: o staging não alcança o banco de produção.

| Serviço | Imagem | Papel |
|---|---|---|
| `app` | `ghcr.io/nbbrdev/orco:<tag>` | o Orçô; porta `127.0.0.1:3000` (prod) ou `:3001` (staging), alcançada só pelo Nginx |
| `migrate` | a mesma do app | tarefa avulsa (`profiles: [tools]`): aplica as migrations do Drizzle com a role `orco_owner` |
| `db` | `postgres:17-alpine` (versão fixa) | banco; volume `dbdata`; **sem porta publicada**; `healthcheck` com `pg_isready` |
| `rustfs` | RustFS (versão fixa) | arquivos (logos), compatível com S3; volume próprio; **sem porta publicada** ([ADR-0015](decisoes/0015-arquivos-rustfs.md)) |

- **Hardening do `app`:** imagem com usuário não-root, `read_only: true` + `tmpfs` para `/tmp`, `security_opt: no-new-privileges`, `restart: unless-stopped`.
- **Logs** limitados (`json-file`, 10 MB × 3 arquivos) em todos os serviços, para não encher o disco.
- O app só liga depois que o banco responde (`depends_on: condition: service_healthy`).

**Deploy de um ambiente** (o que os workflows rodam por SSH):

```bash
cd /opt/orco
docker compose -p orco-production --env-file production.env pull
docker compose -p orco-production --env-file production.env run --rm migrate
docker compose -p orco-production --env-file production.env up -d
```

Primeiro o banco muda, depois o código. As migrations precisam ser compatíveis com a versão anterior do código.

## Imagens (GHCR)

- `Dockerfile` na raiz:
  - build multi-stage, com Next `output: 'standalone'`;
  - Node 24 Alpine, usuário não-root;
  - `LABEL org.opencontainers.image.source=https://github.com/nbbrdev/orco`.
- **Nenhum segredo entra na imagem.** Os segredos chegam na hora de rodar, pelo `.env` da VPS. As variáveis `NEXT_PUBLIC_*` (versão do app, site key do Turnstile) são públicas por natureza e são embutidas no build. Por isso staging e produção têm **imagens separadas**.
- Publicada em `ghcr.io/nbbrdev/orco`, **pública** (a VPS baixa sem login). O envio usa o `GITHUB_TOKEN` com `packages: write`.
- Etiquetas: `staging-<commit>` e `vX.Y.Z`. As antigas ficam guardadas para rollback.

## Workflows (`.github/workflows/`)

| Arquivo | Gatilho | Passos |
|---|---|---|
| `ci.yml` | PR e push em `main` | checkout → Node do `.nvmrc` → `npm ci` → Prettier → lint → typecheck → Vitest (unitários + integração com Postgres em service container) → build → `npm audit --audit-level=high` |
| `codeql.yml` | PR, push em `main`, semanal | CodeQL `javascript-typescript`, suite `security-extended` |
| `pr-title.yml` | PR aberto/editado | título em Conventional Commits com `[NBB-xx]` |
| `staging.yml` | **CI concluído com sucesso** num push na `main` (ou manual) | build da imagem `staging-<commit>` → GHCR → SSH na VPS → `pull` → `migrate` → `up -d` no projeto `orco-staging`. Nunca roda para PR ou fork; um de cada vez |
| `production.yml` | release publicada pelo usuário (`gh release create vX.Y.Z --target main --generate-notes`) | `verify` (formato `vX.Y.Z`, commit na `main`, check `ci` verde) → build `vX.Y.Z` → GHCR → SSH → `pull` → `migrate` → `up -d` no projeto `orco-production`. Rollback de código: "Re-run" da execução de uma versão anterior |
| `backup.yml` | diário 06:00 UTC (03:00 SP) | SSH → `pg_dump` do banco de produção + conteúdo do RustFS → criptografa com `age` (chave **pública**) → artifact de **30 dias** |

- **Segredos do GitHub:** só o acesso SSH, nos environments `staging` (só `main`) e `production` (só tags `v*`):
  - `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` e `VPS_KNOWN_HOSTS`;
  - `BACKUP_AGE_PUBLIC_KEY` (production).
- Regras de workflow: `permissions:` mínimas por job, actions fixadas por SHA, inputs passados por variável de ambiente, secrets nunca impressos.

## Backups e restauração

- **Diário e automático** (`backup.yml`). O arquivo `orco-backup-AAAA-MM-DD.tar.age` contém:
  - o dump do Postgres (`pg_dump -Fc`, com roles, schema e dados);
  - os objetos do RustFS.
- **Criptografia com `age`:**
  - a chave **pública** fica no GitHub e só serve para trancar;
  - a chave **privada** fica **só com o dono do projeto**, no gerenciador de senhas;
  - artifacts de repositório público podem ser baixados por qualquer pessoa logada, por isso a criptografia é obrigatória.
- **Acesso:** GitHub → Actions → Backup → execução do dia → Artifacts; ou `gh run download <id>`.
- **Restauração** (documentada em `deploy/README.md`):
  1. `age -d -i <chave-privada>`;
  2. `pg_restore` num banco novo;
  3. reenviar os objetos ao RustFS.
- **Teste de restauração** numa máquina limpa antes do go-live (M7, NBB-58).
- **Reforço:** snapshots da VPS na Hostinger, se o plano incluir.

## Agendamentos

- Sem Vercel Cron e sem `pg_cron`. Tarefas diárias (lembrete de vencimento, RN-43; anonimização de IPs, RN-37) rodam por **agendamento na VPS**: cron do sistema chamando a rota protegida por `CRON_SECRET`, ou um container agendado. A forma é decidida na issue de cada tarefa (NBB-62).

## Web Push (VAPID)

- Par de chaves VAPID gerado uma vez (`npx web-push generate-vapid-keys`): a pública vai em `NEXT_PUBLIC_VAPID_PUBLIC_KEY` e a privada só no servidor. Um par por ambiente.
- `VAPID_SUBJECT = mailto:<e-mail de contato do projeto>`.
- Trocar as chaves invalida todas as assinaturas.
- PWA e push são testados **no staging** (URL fixa com HTTPS). Localmente pelo celular não dá: falta HTTPS.
- **Risco a verificar na fase do PWA:** no iPhone, o app instalado na tela inicial pode não repassar a senha do Basic Auth do staging. Se acontecer, trocar por um login próprio do staging.

## Proteção do staging

- O proxy do app (`src/proxy.ts`) exige **HTTP Basic Auth** quando `APP_ENV=staging`, **exceto** em `/p/*`, `/api/p/*`, `/sw.js` e `/manifest.webmanifest`. Assim, um "cliente de teste" consegue abrir o link público de um orçamento de staging.
- Credenciais em `STAGING_BASIC_AUTH_USER`/`STAGING_BASIC_AUTH_PASSWORD`, só no `staging.env`. Sem elas, o staging responde **503**.
- `X-Robots-Tag: noindex, nofollow` em todas as rotas do staging.

## Resend (e-mail)

- Domínio de envio `orco.nbbrdev.com` **verificado** (2026-09-28), com registros na Hostinger:
  - DKIM `resend._domainkey.orco`;
  - SPF/MX em `send.orco`;
  - DMARC herdado do domínio raiz (`_dmarc.nbbrdev.com`, `p=none`).
- **Remetente:** `Orçô <nao-responda@orco.nbbrdev.com>`, sem Reply-To.
- O **app** envia tudo por **SMTP** ([ADR-0016](decisoes/0016-email-smtp.md)):
  - localmente para o **Mailpit** (`compose.dev.yaml`);
  - em staging e produção para `smtp.resend.com:465`, usuário `resend`, senha = API key com só *Sending access* e só o domínio `orco.nbbrdev.com`, uma por ambiente. As chaves antigas do SMTP do Supabase foram apagadas em 2026-09-29; as novas são criadas na M2 (NBB-39).
- Plano Free: 3.000 e-mails/mês, 100/dia, para todos os e-mails somados.

## Google OAuth

- Projeto no Google Cloud com tela de consentimento (nome Orçô, logo, links de privacidade e termos, domínio autorizado).
- Client OAuth Web com redirects para o **Better Auth** do app:
  - `https://orco.nbbrdev.com/api/auth/callback/google`;
  - `https://staging.orco.nbbrdev.com/api/auth/callback/google`;
  - `http://localhost:3000/api/auth/callback/google`.
- Client ID/secret nos `.env` da VPS (e no `.env.local`), só no servidor. Configurado na M2 (NBB-40).

## Cloudflare Turnstile

- Widget em modo "managed/invisible" para os hostnames de produção, `staging.orco.nbbrdev.com` e localhost.
- Site key pública (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, embutida no build); secret key só no servidor (`TURNSTILE_SECRET_KEY`).

## GitHub (ADR-0007)

- Repositório **público** [`nbbrdev/orco`](https://github.com/nbbrdev/orco) (remote SSH `git@github-indie:nbbrdev/orco.git`), com a branch `main` protegida ([06-regras-dev.md](06-regras-dev.md) §4).
- Dependabot alerts + security updates, secret scanning + push protection, CodeQL.
- Integração com o Linear (vincula PRs e issues).
- **`dependabot.yml`:**
  - ecossistemas `npm`, `github-actions` e `docker` (imagens do `Dockerfile` e do compose), semanal;
  - `minor-and-patch` agrupados; label `dependencies`.
- **Templates:**
  - `.github/PULL_REQUEST_TEMPLATE.md`: issue do Linear, o que mudou, como testar, checklists de segurança e de simplicidade, docs atualizados;
  - `.github/CODEOWNERS`: `* @nbbrdev`.
