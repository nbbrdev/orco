# ADR-0012 — Hospedagem numa VPS própria com Docker Compose

- **Status:** aceito (decidido pelo usuário em 2026-09-29)
- **Data:** 2026-09-29
- **Substitui:** ADR-0011 (Vercel no MVP, VPS depois) e as partes de Vercel/Supabase dos ADR-0001, 0008, 0009 e 0010

## Contexto
O plano era começar na Vercel + Supabase e migrar para uma VPS depois do `1.0.0`. Na M1, a configuração de painéis e segredos em serviços de terceiros cresceu:
- projetos, SMTP e templates no painel do Supabase;
- projeto, variáveis e domínios na Vercel;
- o CLI da Vercel trouxe 22 alertas de dependências.

Como ainda não existiam telas nem tabelas, o usuário decidiu **antecipar a VPS**: o Orçô nasce nela, com o próprio Postgres.

## Decisão

### Máquina
- **VPS Hostinger KVM 1 ou KVM 2**, com **Ubuntu** (LTS).
- O build acontece no GitHub Actions, então a VPS só roda os containers. A KVM 1 basta no início (~1,5 GB de uso estimado) e pode subir de plano depois.

### Porteiro e HTTPS
- **Nginx instalado no Ubuntu** (`apt`), fora do Docker, como proxy reverso:
  - `orco.nbbrdev.com` → `127.0.0.1:3000` (produção);
  - `staging.orco.nbbrdev.com` → `127.0.0.1:3001`.
- **Certbot** (`certbot --nginx`) emite e renova os certificados do Let's Encrypt automaticamente.
- A configuração do site é versionada em `deploy/nginx/orco.nbbrdev.com.conf`.
- **Revisão (2026-10-01, decisão do usuário):** a VPS (Hostinger KVM 2, Ubuntu 26.04) é **compartilhada entre projetos**. A base da máquina (SSH, firewall, Docker, usuário `deploy`, Nginx geral com site padrão que recusa IP/domínio desconhecido, Certbot) fica no repositório privado `nbbrdev/vps`; cada projeto traz o seu site no Nginx, a sua pasta em `/opt/` e as suas portas.

### Execução
- **Docker Compose**: um único `deploy/compose.yaml` usado por **dois projetos**, `orco-production` e `orco-staging`, na **mesma VPS**.
- Serviços de cada projeto:
  - `app`;
  - `migrate` (tarefa avulsa);
  - `db` (Postgres 17);
  - `rustfs` (arquivos, ADR-0015).
- Cada projeto tem rede e volumes próprios: o staging **não alcança** o banco de produção.
- O **RustFS não publica portas**; só o app do mesmo projeto o alcança. O app escuta só em `127.0.0.1`, e apenas o Nginx o alcança. O **banco** também fica só em `127.0.0.1` da VPS (5433 produção, 5434 staging), para o backup manual pelo DBeaver via túnel SSH (revisão de 2026-10-01, NBB-75); a internet não o alcança.
- Hardening do app: usuário não-root na imagem, `read_only`, `no-new-privileges`, logs limitados (10 MB × 3).
- Os segredos de cada ambiente ficam **só na VPS**, nunca no repositório nem na imagem.
- **Uma pasta por ambiente** (`/opt/orco/staging/`, `/opt/orco/production/`), cada uma com seu `.env` e seu `compose.yaml`. Os ambientes rodam versões diferentes, e o deploy de um nunca altera os arquivos do outro (decidido pelo usuário em 2026-09-29, NBB-35).

### Imagens e deploy
- Imagem do app construída no **GitHub Actions** e publicada no **GHCR** (`ghcr.io/nbbrdev/orco:<tag>`), **pública**. O código já é público, e nenhum segredo entra na imagem.
- Etiquetas: `staging-<commit>` (staging) e `vX.Y.Z` (produção). Rollback = subir uma etiqueta anterior.
- Deploy por **SSH** a partir dos workflows (`staging.yml` a cada merge com CI verde; `production.yml` na release criada pelo usuário, ADR-0010):

  ```
  pull → run --rm migrate → up -d
  ```

  Primeiro o banco, depois o código.
- Os passos de build e deploy ficam num **workflow comum** (`deploy-vps.yml`), chamado pelo `staging.yml` e pelo `production.yml`: staging e produção publicam exatamente do mesmo jeito (decidido pelo usuário em 2026-09-30, NBB-63).
- A imagem leva **tudo de uma versão**: o app, as migrations e os arquivos de deploy (`compose.yaml` e bootstrap do banco).
- O GitHub guarda só o acesso SSH (`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`) nos environments `staging` e `production`.
- **Chaves de deploy restritas** (decidido pelo usuário em 2026-09-29, NBB-35):
  - uma chave por ambiente, presa no `authorized_keys` a um único comando (`command="/opt/orco/bin/deploy.sh <ambiente>",restrict`);
  - o workflow só escolhe a imagem (`<tag>@sha256:<digest>`), e o script valida o formato;
  - os arquivos de deploy vêm de dentro da imagem, nunca pelo SSH.

  O usuário `deploy` está no grupo `docker`, o que equivale a root. Com a restrição, uma chave vazada só consegue subir de novo uma imagem nossa já existente naquele ambiente.

### Backups
- **Revisão (2026-09-30/10-01, decisão do usuário, NBB-75):** o workflow diário de backup (com `age` e artifact de 30 dias) foi **descartado** para simplificar. O backup é **manual, pelo DBeaver, antes de cada release**, só do banco (o RustFS fica fora). Passo a passo em `deploy/README.md`.
- Snapshots da Hostinger como reforço opcional.

### Agendamentos
- Tarefas diárias (lembrete de vencimento, RN-43; anonimização de IPs, RN-37) rodam por **agendamento na VPS** (cron do sistema ou container agendado), sem Vercel Cron e sem `pg_cron`. A forma exata é decidida na issue de cada tarefa.

## Alternativas descartadas
- **Continuar na Vercel + Supabase até o 1.0:** mais painéis e segredos em terceiros, e uma migração grande depois.
- **Tudo instalado direto no Ubuntu (sem Docker):**
  - staging e produção dividiriam a mesma instalação do Node e do Postgres;
  - a configuração ficaria espalhada pela máquina;
  - seria difícil de reproduzir numa VPS nova.
- **Misto (app em container, Postgres nativo):** metade versionada, metade manual; o banco ficaria exposto numa porta local.
- **Coolify/Dokploy:** trariam de volta um painel com configuração fora do repositório.
- **Caddy / Nginx em container:** o Nginx no Ubuntu com `certbot --nginx` é o caminho mais simples e documentado para o HTTPS. Em container, o primeiro certificado exigiria um roteiro próprio.
- **Docker Hub:** exige outra conta e mais um token. O GHCR usa o token automático das Actions.
- **Pasta única para os dois ambientes:** um deploy de staging trocaria o `compose.yaml` usado também pela produção.
- **Chave SSH com terminal livre:** mais simples, mas uma chave vazada daria controle total da VPS.
- **Imagem separada para as migrations:** dois builds e duas etiquetas para manter em sincronia a cada versão.

## Consequências
- Somem as contas e os painéis de Supabase e Vercel. Os únicos terceiros são o Resend (e-mail) e o Google (OAuth). O Cloudflare Turnstile saiu em 2026-09-29 (NBB-70, RN-46).
- Surgem responsabilidades de operação:
  - atualizações de segurança do Ubuntu (`unattended-upgrades`);
  - firewall (`ufw`: 22, 80 e 443);
  - SSH só por chave;
  - monitorar o disco e fazer o backup manual antes de cada release.
- Novos arquivos:
  - `Dockerfile`, `compose.dev.yaml`;
  - `deploy/compose.yaml`, `deploy/deploy.sh`, `deploy/nginx/orco.nbbrdev.com.conf`, `deploy/env.example`, `deploy/README.md`.
- `staging.yml`/`production.yml` passam a publicar na VPS, pelo `deploy-vps.yml`.
- As variáveis `NEXT_PUBLIC_*` são embutidas no build, por isso staging e produção têm **imagens separadas**.
