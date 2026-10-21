# 08 — Infraestrutura e deploy

> Status: rascunho para validação · Última atualização: 2026-10-21
>
> Arquitetura redefinida em 2026-09-29: **VPS própria com Docker Compose**, sem Supabase e sem Vercel ([ADR-0012](decisoes/0012-hospedagem-vps.md)). Executado na **M1**.
>
> **2026-10-21:** sem staging; a produção é o único ambiente na VPS ([ADR-0017](decisoes/0017-sem-staging.md)).

## Ambientes

| Ambiente | App | Banco e arquivos | Gatilho |
|---|---|---|---|
| Local | `npm run dev` (`APP_ENV=development`) | `compose.dev.yaml`: Postgres, RustFS e Mailpit no Docker (`npm run db:start`) | — |
| Produção | container `app` do projeto `orco-production`, em `https://orco.nbbrdev.com` (`APP_ENV=production`) | Postgres e RustFS do próprio projeto | **versão criada pelo usuário** (`gh release create vX.Y.Z` → `production.yml`), ADR-0010 |

**Não há staging nem preview por PR** ([ADR-0017](decisoes/0017-sem-staging.md)). Um PR é revisado pelo código, pela explicação, pelo CI e rodando a branch localmente, inclusive no celular pelo endereço "Network" do `npm run dev` na mesma Wi-Fi (as faixas `192.168.*.*` e `10.*.*.*` estão liberadas em `allowedDevOrigins` no `next.config.ts`). **O merge na `main` não publica nada**: a produção só muda com a release. O que precisa de HTTPS (PWA, push, login real com o Google) é conferido na produção, depois da release.

## VPS

- **Hostinger KVM 2**, **Ubuntu 26.04 LTS**. Contratada em 2026-09-30 (NBB-35).
- O build acontece no GitHub Actions; a VPS só roda os containers.
- **A VPS é compartilhada entre projetos** (decidido em 2026-10-01). A **base da máquina** fica no repositório privado **`nbbrdev/vps`** (guia + arquivos gerais, projeto "VPS" no Linear):
  - usuário de administração com chave dedicada; usuário `deploy` sem senha; **SSH só por chave** (root e senha desligados, `10-hardening.conf`);
  - firewall `ufw` com só **22, 80 e 443** abertas;
  - atualizações automáticas de segurança (`unattended-upgrades`), sem reinício automático;
  - Docker Engine + plugin Compose;
  - Nginx base (site padrão que recusa IP e domínio desconhecido, `server_tokens off`) e Certbot.
- **O que é do Orçô** fica neste repositório (`deploy/README.md`): `/opt/orco/`, o `deploy.sh`, o `.env`, o site no Nginx, o certificado, a linha da chave de deploy e a porta **3000**.
- **A pasta da produção:** `/opt/orco/production/`, com:
  - `.env`: os segredos, criado à mão (modelo `deploy/env.example`), `chmod 600`. Os segredos existem **só nesse arquivo**;
  - `compose.yaml`, `init.sh` e `roles.sql`, copiados **de dentro da imagem** da versão no ar a cada deploy;
  - `image.env`: a imagem no ar (`ORCO_IMAGE=…:<tag>@sha256:<digest>`).
- `/opt/orco/bin/deploy.sh` (dono root): o único comando que a chave de deploy do GitHub consegue rodar (seção **Deploy por SSH**).

## Nginx e HTTPS

- **Nginx instalado no Ubuntu** (fora do Docker), como proxy reverso, um só para a VPS. O **site do Orçô** é versionado em `deploy/nginx/orco.nbbrdev.com.conf` (na VPS: `/etc/nginx/sites-available/orco.nbbrdev.com`); o que vale para todos os sites fica no `nbbrdev/vps`:
  - `orco.nbbrdev.com` → `127.0.0.1:3000`.
- **Certbot** (`certbot --nginx -d orco.nbbrdev.com`) emite o certificado do Let's Encrypt, adiciona o HTTPS à configuração e instala a **renovação automática** (timer do systemd).
- O Nginx repassa ao app os headers `X-Forwarded-For`, `X-Forwarded-Proto` e `Host`. O IP e o user agent do cliente (ADR-0005) vêm daí.
- **DNS na Hostinger** (zona `nbbrdev.com`): registro **A** `orco` → IP da VPS.
- Nome ASCII: o slug `orco` é usado na URL porque domínios com acento viram *punycode*. A marca **Orçô** aparece só na interface.

## Docker Compose

Um `deploy/compose.yaml`, usado pelo projeto `orco-production`, com **rede e volumes próprios**.

| Serviço | Imagem | Papel |
|---|---|---|
| `app` | `ghcr.io/nbbrdev/orco:<tag>` | o Orçô; porta `127.0.0.1:3000`, alcançada só pelo Nginx |
| `migrate` | a mesma do app | tarefa avulsa (`profiles: [tools]`): aplica as migrations do Drizzle com a role `orco_owner` |
| `db` | `postgres:17-alpine` (versão fixa) | banco; volume `dbdata`; porta publicada **só em `127.0.0.1`** da VPS (5433), para o backup pelo DBeaver via túnel SSH; `healthcheck` com `pg_isready` |
| `rustfs` | RustFS (versão fixa) | arquivos (logos), compatível com S3; volume próprio; **sem porta publicada** ([ADR-0015](decisoes/0015-arquivos-rustfs.md)) |

- **Hardening do `app`:** imagem com usuário não-root, `read_only: true` + `tmpfs` para `/tmp`, `security_opt: no-new-privileges`, `restart: unless-stopped`.
- **Logs** limitados (`json-file`, 10 MB × 3 arquivos) em todos os serviços, para não encher o disco.
- O app só liga depois que o banco responde (`depends_on: condition: service_healthy`).

- O app recebe **só as variáveis que usa**, listadas no `compose.yaml` (nunca a senha do superusuário do banco). As URLs de conexão são montadas pelo compose com as senhas do `.env`.

## Deploy por SSH

Decidido em 2026-09-29 (NBB-35). O GitHub guarda a chave SSH de deploy no environment `production`, e ela fica presa a um único comando no `authorized_keys` do usuário `deploy`:

```
command="/opt/orco/bin/deploy.sh production",restrict ssh-ed25519 AAAA... orco-production-deploy
```

- O workflow manda só `<tag>@sha256:<digest>`, que chega ao script em `$SSH_ORIGINAL_COMMAND`.
- O `deploy.sh`:
  1. aceita só `vX.Y.Z`, sempre com o digest (a impressão digital exata da imagem construída naquela execução);
  2. baixa a imagem e copia de dentro dela o `compose.yaml` e o bootstrap do banco para a pasta da produção;
  3. grava `image.env`;
  4. roda `migrate` e depois `up -d`.
- **Primeiro o banco muda, depois o código.** As migrations precisam ser compatíveis com a versão anterior do código. Sem staging, a release aplica as migrations direto na produção: por isso o backup antes de toda release ([06-regras-dev.md](06-regras-dev.md) §4.1).
- **Se a chave vazar**, o máximo possível é subir de novo uma imagem nossa que já existe: sem terminal, sem ler o `.env`, sem mandar arquivos. A administração da VPS usa a chave pessoal do dono.
- O `deploy.sh` é instalado à mão e não se atualiza sozinho, de propósito. Passo a passo em `deploy/README.md`.

## Imagens (GHCR)

- `Dockerfile` na raiz:
  - build multi-stage, com Next `output: 'standalone'`;
  - Node 24 Alpine, usuário não-root; os arquivos do app ficam com dono root (só leitura para o app);
  - `LABEL org.opencontainers.image.source=https://github.com/nbbrdev/orco`.
- **Uma imagem leva tudo de uma versão:** o app, as migrations com o script que as aplica (`/app/migrator`) e os arquivos de deploy (`/app/deploy`). Rollback volta tudo junto.
- **Nenhum segredo entra na imagem.** Os segredos chegam na hora de rodar, pelo `.env` da VPS. As variáveis `NEXT_PUBLIC_*` (a versão do app) são públicas por natureza e são embutidas no build.
- **O CI monta a imagem em todo PR e push, sem enviar** (job `image`, NBB-122 IMG1-A): um `Dockerfile` quebrado aparece no PR, e não só na release.
- Publicada em `ghcr.io/nbbrdev/orco`, **pública** (a VPS baixa sem login), só na release. O envio usa o `GITHUB_TOKEN` com `packages: write`.
- Etiquetas: `vX.Y.Z`. As antigas ficam guardadas para rollback. (As `staging-<commit>` antigas podem ser apagadas no GHCR.)

## Workflows (`.github/workflows/`)

| Arquivo | Gatilho | Passos |
|---|---|---|
| `ci.yml` | PR e push em `main` | job **`ci`**: checkout → Node do `.nvmrc` → `npm ci` → Prettier → lint → typecheck → Vitest (unitários + integração com Postgres e Mailpit em service containers) → build → E2E (Playwright) → `npm audit --audit-level=high --omit=dev` (só produção). Job **`image`**, em paralelo: monta a imagem Docker da produção, sem enviar (mesmo cache do deploy) |
| `codeql.yml` | PR, push em `main`, semanal | CodeQL `javascript-typescript`, suite `security-extended` |
| `pr-title.yml` | PR aberto/editado | título em Conventional Commits com `[NBB-xx]` |
| `deploy-vps.yml` | **nunca sozinho**: chamado pelo `production.yml` (`workflow_call`) | build da imagem (`NEXT_PUBLIC_APP_VERSION`) → GHCR → SSH com a chave do environment → `deploy.sh production` com `<tag>@<digest>`. Sem os secrets da VPS: erro |
| `production.yml` | release publicada pelo usuário (`gh release create vX.Y.Z --target main --generate-notes`) | `verify` (formato `vX.Y.Z`, commit na `main`, check `ci` verde) → chama o `deploy-vps.yml` com `vX.Y.Z`. Rollback de código: "Re-run all jobs" na execução de uma versão anterior |

- **Checks obrigatórios para o merge** (proteção da `main`): `ci`, `image`, `codeql` e `pr-title`.
- **Segredos do GitHub:** só o acesso SSH de deploy, no environment `production` (só tags `v*`): `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` e `VPS_KNOWN_HOSTS`. O `production.yml` passa `secrets: inherit` ao `deploy-vps.yml`; sem isso, o workflow chamado não enxerga nenhum secret.
- Regras de workflow: `permissions:` mínimas por job, actions fixadas por SHA, inputs passados por variável de ambiente, secrets nunca impressos.

## Backup (manual)

- **Sem backup automático** (decidido pelo usuário em 2026-09-30, NBB-75). O dono faz o backup **pelo DBeaver, antes de cada release a partir da primeira depois da `v1.0.0`** (passo 0 de `docs/06-regras-dev.md` §4.1; até ela, a produção não tinha usuários reais, decisões de 2026-10-05). Passo a passo em `deploy/README.md`, "Backup pelo DBeaver".
- O `db` da produção publica o Postgres **só em `127.0.0.1`** da VPS (`DB_PORT` no `.env`: **5433**). O DBeaver entra por **túnel SSH** com a chave de administração, como `postgres`.
- Formato custom (`pg_dump`), só o banco; os logos do RustFS ficam fora. Restauração: banco novo, sem migrations (roles pelo bootstrap) → **Tools → Restore** no DBeaver, como `postgres`. Teste de restauração no banco local feito em 2026-10-06 com o primeiro backup da produção (NBB-96); a parte técnica já tinha sido testada com um backup local em 2026-10-05 (NBB-58).
- **Reforço opcional:** snapshots da VPS no painel da Hostinger.

## Agendamentos

- Sem Vercel Cron e sem `pg_cron`. Tarefas diárias (lembrete de vencimento, RN-43; anonimização de IPs, RN-37) rodam por **agendamento na VPS**: cron do sistema chamando a rota protegida por `CRON_SECRET`, ou um container agendado. A forma é decidida na issue de cada tarefa (NBB-62).
- **Como ficou** (NBB-62, 2026-10-04, L1-A): cron do sistema. O `deploy/orco.cron` vai para `/etc/cron.d/orco` e roda o `deploy/daily.sh` (em `/opt/orco/bin/`) às 12h UTC (9h de São Paulo) para a produção, como o usuário `deploy`. O script lê a `CRON_SECRET` e a `APP_PORT` do `.env` e faz `POST /api/cron/diario` em `127.0.0.1`. A saída vai para o log do sistema (`journalctl -t orco-daily`). Instalação e teste em `deploy/README.md`, "Agendamento diário". Dia perdido (VPS fora do ar) não é recuperado (L6, RN-42). Desde a NBB-30, a mesma tarefa limpa as janelas antigas dos limites de uso e as sessões expiradas.

## Web Push (VAPID)

- Par de chaves VAPID gerado uma vez (`npx web-push generate-vapid-keys`). As três variáveis no `.env` da VPS: `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT`. A pública é lida na hora pelo servidor e passada à página do perfil (não entra no build; NBB-61 P2-A). Sem as três, o push fica desligado.
- `VAPID_SUBJECT` = o endereço do site (`https://orco.nbbrdev.com`), para não expor e-mail.
- Trocar as chaves invalida todas as assinaturas.
- PWA e push são testados **na produção** (URL fixa com HTTPS), depois da release. Localmente pelo celular não dá: falta HTTPS.

## Resend (e-mail)

- Domínio de envio `orco.nbbrdev.com` **verificado** (2026-09-28), com registros na Hostinger:
  - DKIM `resend._domainkey.orco`;
  - SPF/MX em `send.orco`;
  - DMARC herdado do domínio raiz (`_dmarc.nbbrdev.com`, `p=none`).
- **Remetente:** `Orçô <nao-responda@orco.nbbrdev.com>`, sem Reply-To.
- O **app** envia tudo por **SMTP** ([ADR-0016](decisoes/0016-email-smtp.md)):
  - localmente para o **Mailpit** (`compose.dev.yaml`);
  - na produção para `smtp.resend.com:465`, usuário `resend`, senha = API key com só *Sending access* e só o domínio `orco.nbbrdev.com`.
- Plano Free: 3.000 e-mails/mês, 100/dia, para todos os e-mails somados.

## Google OAuth

- Projeto no Google Cloud com tela de consentimento (nome Orçô, público Externo), publicada no go-live (NBB-59).
- **Um cliente OAuth Web por ambiente** (`orco-local`, `orco-production`), cada um só com o redirect do seu ambiente para o **Better Auth** do app:
  - `https://orco.nbbrdev.com/api/auth/callback/google`;
  - `http://localhost:3000/api/auth/callback/google`.
- `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` no `.env` da VPS (e no `.env.local`), só no servidor; obrigatórios (o app não sobe sem). Passo a passo em `deploy/README.md`, "Login com Google".

## GitHub (ADR-0007)

- Repositório **público** [`nbbrdev/orco`](https://github.com/nbbrdev/orco) (remote SSH `git@github-indie:nbbrdev/orco.git`), com a branch `main` protegida ([06-regras-dev.md](06-regras-dev.md) §4).
- Dependabot alerts + security updates, secret scanning + push protection, CodeQL.
- Integração com o Linear (vincula PRs e issues).
- **`dependabot.yml`:**
  - ecossistemas `npm`, `github-actions`, `docker` (`Dockerfile`) e `docker-compose` (`compose.dev.yaml` e `deploy/compose.yaml`), semanal. Majors do Node e do Postgres ignorados: trocar o major do Postgres exige dump e restauração;
  - `minor-and-patch` agrupados; label `dependencies`.
- **Templates:**
  - `.github/PULL_REQUEST_TEMPLATE.md`: issue do Linear, o que mudou, como testar, checklists de segurança e de simplicidade, docs atualizados;
  - `.github/CODEOWNERS`: `* @nbbrdev`.
