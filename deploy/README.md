# Deploy na VPS

Como o Orçô é configurado na VPS e como os deploys funcionam. Decisões em [ADR-0012](../docs/decisoes/0012-hospedagem-vps.md), visão geral em [docs/08-infra-deploy.md](../docs/08-infra-deploy.md).

**Pré-requisito:** a VPS preparada pelo guia do repositório privado **`nbbrdev/vps`** (usuário de administração, SSH só por chave, firewall, Docker, usuário `deploy`, Nginx base e Certbot instalados). A VPS é compartilhada entre projetos: aqui fica só o que é **do Orçô**.

## Arquivos desta pasta

| Arquivo                       | Para quê                                                                                                        |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `compose.yaml`                | Um ambiente (app, migrate, db, rustfs). Vai **dentro da imagem** e o `deploy.sh` copia para a VPS a cada deploy |
| `env.example`                 | Modelo do `.env` de cada ambiente na VPS (segredos)                                                             |
| `deploy.sh`                   | Único comando que as chaves de deploy do Orçô conseguem rodar. Instalado **à mão** em `/opt/orco/bin/`          |
| `nginx/orco.nbbrdev.com.conf` | Site do Orçô no Nginx: `orco` → `127.0.0.1:3000`, `staging.orco` → `127.0.0.1:3001`                             |
| `daily.sh`                    | Agendamento diário (NBB-62): chama `/api/cron/diario` do ambiente. Instalado **à mão** em `/opt/orco/bin/`      |
| `orco.cron`                   | Os horários do `daily.sh` (9h de São Paulo). Instalado **à mão** em `/etc/cron.d/orco`                          |

## Como um deploy acontece

1. Merge na `main` → CI verde → `staging.yml` chama a receita comum `deploy-vps.yml`, que constrói a imagem `ghcr.io/nbbrdev/orco:staging-<commit>` e envia ao GHCR.
2. O workflow conecta por SSH com a **chave do staging** e manda só `staging-<commit>@sha256:<digest>`.
3. Na VPS, essa chave só consegue rodar `/opt/orco/bin/deploy.sh staging`, que:
   - valida o pedido (formato da etiqueta + digest);
   - baixa a imagem e copia de dentro dela o `compose.yaml` e o bootstrap do banco para `/opt/orco/staging/`;
   - grava a versão em `image.env`;
   - aplica as migrations e sobe a nova versão.

A produção segue o mesmo caminho a partir de uma release `vX.Y.Z` (`production.yml` → `deploy-vps.yml`), com a sua própria chave e a pasta `/opt/orco/production/`. Passo a passo em **Produção**, abaixo.

O que é do Orçô na VPS:

```
/opt/orco/
├── bin/deploy.sh          ← dono root; o usuário deploy só executa
├── staging/               ← dono deploy, chmod 700
│   ├── .env               ← segredos do staging (você cria, chmod 600)
│   ├── image.env          ← versão no ar (deploy.sh)
│   ├── compose.yaml       ← da imagem da versão no ar
│   ├── init.sh, roles.sql ← idem (criam as roles na primeira subida do banco)
└── production/            ← mesma estrutura

/etc/nginx/sites-available/orco.nbbrdev.com   ← o site (deste repositório)
/home/deploy/.ssh/authorized_keys             ← duas linhas do Orçô (staging e produção)
Portas: 3000 (produção) e 3001 (staging), só em 127.0.0.1
```

---

## Configurar o Orçô na VPS (uma vez)

Troque `IP_DA_VPS` pelo IP e `CHAVE_DA_VPS` pela sua chave de administração. No Windows, use o **Git Bash** e barras normais (`/`). Nos testes de SSH, use sempre `-o IdentitiesOnly=yes` (explicação no guia do `nbbrdev/vps`).

### 1. DNS

Na zona `nbbrdev.com` da Hostinger (hPanel → Domínios → DNS), dois registros **A** apontando para o IP da VPS (só IPv4):

- `orco`
- `staging.orco`

Se existirem registros antigos com esses nomes (ex.: CNAME da época da Vercel), apague antes. **Não mexa** nos registros do Resend (`resend._domainkey.orco`, `send.orco`, `_dmarc`). Confira do PC: `nslookup orco.nbbrdev.com` e `nslookup staging.orco.nbbrdev.com`.

### 2. Chaves de deploy do Orçô

No **seu PC**, uma chave por ambiente, **sem passphrase** (aperte Enter duas vezes; o GitHub Actions não teria como digitá-la):

```bash
ssh-keygen -t ed25519 -C "orco-staging-deploy" -f ~/.ssh/orco-staging-deploy
ssh-keygen -t ed25519 -C "orco-production-deploy" -f ~/.ssh/orco-production-deploy
```

Cada comando gera a **privada** (vai para o secret do GitHub) e a **pública** `.pub` (vai para a VPS). Na VPS, acrescente uma linha por chave no `authorized_keys` do `deploy` (dono root, criado pelo guia da VPS):

```bash
sudo nano /home/deploy/.ssh/authorized_keys
```

```
command="/opt/orco/bin/deploy.sh staging",restrict ssh-ed25519 AAAA... orco-staging-deploy
command="/opt/orco/bin/deploy.sh production",restrict ssh-ed25519 AAAA... orco-production-deploy
```

Cada linha: as opções, um espaço e o conteúdo inteiro do `.pub` (`cat ~/.ssh/orco-staging-deploy.pub` no PC), **numa linha só**.

- `command="…"`: a VPS ignora o que o cliente pediu e roda sempre este comando. O pedido original chega ao script em `$SSH_ORIGINAL_COMMAND`.
- `restrict`: sem terminal interativo, sem túneis, sem repasse de chaves.

### 3. Pastas e o `deploy.sh`

```bash
sudo install -d -o root -g root -m 755 /opt/orco /opt/orco/bin
sudo install -d -o deploy -g deploy -m 700 /opt/orco/staging /opt/orco/production
```

Do **PC**, na pasta deste repositório:

```bash
scp -i ~/.ssh/CHAVE_DA_VPS -o IdentitiesOnly=yes deploy/deploy.sh default@IP_DA_VPS:/tmp/deploy.sh
```

Na VPS:

```bash
sudo install -o root -g root -m 755 /tmp/deploy.sh /opt/orco/bin/deploy.sh
rm /tmp/deploy.sh
bash -n /opt/orco/bin/deploy.sh && echo "sintaxe ok"
```

> O `deploy.sh` **não se atualiza sozinho**, de propósito: ele é a barreira de segurança das chaves de deploy. Quando um PR mudar o `deploy/deploy.sh`, repita estes comandos.

**Teste da trava**, do PC:

| Teste                    | Comando                                                                                                              | Esperado                                                    |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Outro comando            | `ssh -i ~/.ssh/orco-staging-deploy -o IdentitiesOnly=yes deploy@IP_DA_VPS "ls"`                                      | `deploy: pedido recusado`                                   |
| Chave do ambiente errado | `ssh -i ~/.ssh/orco-production-deploy -o IdentitiesOnly=yes deploy@IP_DA_VPS "staging-<40 zeros>@sha256:<64 zeros>"` | `pedido recusado … production`                              |
| Pedido válido            | `ssh -i ~/.ssh/orco-staging-deploy -o IdentitiesOnly=yes deploy@IP_DA_VPS "staging-<40 zeros>@sha256:<64 zeros>"`    | `deploy: falta /opt/orco/staging/.env` (até criar o `.env`) |

### 4. `.env` do staging

A partir de `deploy/env.example`. Gere cada senha com `openssl rand -hex 32` (só letras e números: as do banco entram nas URLs de conexão) e guarde todas no gerenciador de senhas.

```bash
sudo -u deploy nano /opt/orco/staging/.env      # sudo -u deploy: o arquivo já nasce do deploy
sudo chmod 600 /opt/orco/staging/.env
sudo ls -la /opt/orco/staging                   # -rw------- deploy deploy .env
```

`APP_ENV=staging`, `SITE_URL=https://staging.orco.nbbrdev.com`, `APP_PORT=3001`, `DB_PORT=5434`, senhas do banco e do RustFS, `BETTER_AUTH_SECRET` (assina as sessões; trocar desloga todo mundo), e `STAGING_BASIC_AUTH_USER`/`PASSWORD` (o login que o navegador pede no staging). A senha do SMTP fica vazia até a M2.

### 5. Site no Nginx e certificado

Do PC:

```bash
scp -i ~/.ssh/CHAVE_DA_VPS -o IdentitiesOnly=yes deploy/nginx/orco.nbbrdev.com.conf default@IP_DA_VPS:/tmp/
```

Na VPS:

```bash
sudo install -o root -g root -m 644 /tmp/orco.nbbrdev.com.conf /etc/nginx/sites-available/orco.nbbrdev.com
rm /tmp/orco.nbbrdev.com.conf
sudo ln -s /etc/nginx/sites-available/orco.nbbrdev.com /etc/nginx/sites-enabled/orco.nbbrdev.com
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d orco.nbbrdev.com -d staging.orco.nbbrdev.com
```

- `sites-available/` guarda os sites; o link em `sites-enabled/` é o que **ativa** um site.
- O Certbot pede um e-mail (avisos de expiração), prova ao Let's Encrypt que o domínio aponta para a VPS (pela porta 80), emite o certificado, adiciona o HTTPS a este arquivo na VPS e renova sozinho.
- Até o primeiro deploy, os domínios respondem **502** (o Nginx funciona, mas ainda não há app nas portas 3000/3001).

### 6. GitHub

**Settings → Environments** → `staging`, com _Deployment branches and tags_ → **Selected branches and tags** → `main`, e estes secrets:

| Secret            | Valor                                                         |
| ----------------- | ------------------------------------------------------------- |
| `VPS_HOST`        | IP da VPS                                                     |
| `VPS_USER`        | `deploy`                                                      |
| `VPS_SSH_KEY`     | conteúdo inteiro do arquivo **privado** `orco-staging-deploy` |
| `VPS_KNOWN_HOSTS` | saída de `ssh-keyscan -t ed25519 IP_DA_VPS` (no seu PC)       |

Antes de colar o `VPS_KNOWN_HOSTS`, confira que é a sua VPS: `ssh-keyscan -t ed25519 IP_DA_VPS | ssh-keygen -lf -` deve mostrar a mesma impressão digital anotada no guia da VPS.

Depois:

1. Apague as chaves **privadas** de deploy do seu PC depois de cadastrá-las (se perder, gere outras e troque).

2. **Primeiro deploy:** Actions → **Staging** → _Run workflow_ (branch `main`).

3. **Pacote público:** depois do primeiro build, em github.com/nbbrdev → **Packages** → `orco` → _Package settings_ → _Change visibility_ → **Public**. Sem isso, a VPS não consegue baixar a imagem. Rode o workflow de novo.

4. Abra `https://staging.orco.nbbrdev.com`: pede a senha do Basic Auth e mostra `staging-<commit>` no rodapé.

---

## Produção

Com o staging funcionando, a produção reaproveita a mesma VPS, o mesmo `deploy.sh` e o mesmo site do Nginx. Muda a pasta, o `.env`, a chave e o environment.

### 1. `.env` da produção

A partir de `deploy/env.example`, com **senhas diferentes das do staging** (gere cada uma com `openssl rand -hex 32`):

```bash
sudo -u deploy nano /opt/orco/production/.env
sudo chmod 600 /opt/orco/production/.env
```

Valores que mudam em relação ao staging:

```
APP_ENV=production
SITE_URL=https://orco.nbbrdev.com
APP_PORT=3000
DB_PORT=5433
BETTER_AUTH_SECRET=   # gerado só para a produção, diferente do staging
STAGING_BASIC_AUTH_USER=
STAGING_BASIC_AUTH_PASSWORD=
```

A linha da chave `orco-production-deploy` já está no `authorized_keys` (passo 2).

### 2. Environment `production` no GitHub

**Settings → Environments** → `production`, com _Deployment branches and tags_ → **Selected branches and tags** → **Add deployment branch or tag rule** → _Ref type_ **Tag**, padrão `v*`. Assim, só releases (tags `vX.Y.Z`) conseguem usar a chave da produção. Sem aprovação manual: criar a release já é a aprovação.

Secrets: os mesmos quatro do staging (`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`), mas com o `VPS_SSH_KEY` = conteúdo da chave **privada** `orco-production-deploy`.

> Sem esses secrets, o `production.yml` fica **vermelho** (no staging, ele só avisa e pula). Uma release precisa chegar ao ar.

### 3. Primeira versão

Com o CI da `main` verde:

```bash
gh release create v0.1.0 --target main --generate-notes
```

O `production.yml` confere a tag, constrói a imagem `v0.1.0`, aplica as migrations no banco da produção e sobe o app. Abra `https://orco.nbbrdev.com`: a página mostra `v0.1.0`.

Próximas versões: **antes de cada release, faça o backup da produção** (seção abaixo) e veja `docs/06-regras-dev.md` §4.1 (como escolher o número).

---

## Login com Google

O botão "Continuar com Google" precisa de um **cliente OAuth** no Google Cloud por ambiente (local, staging e produção; NBB-40). O app não sobe sem o `GOOGLE_CLIENT_ID` e o `GOOGLE_CLIENT_SECRET`.

### 1. Projeto e tela de consentimento (uma vez)

1. Em [console.cloud.google.com](https://console.cloud.google.com), crie o projeto **Orçô**.
2. **Google Auth Platform** (no menu antigo: _APIs e serviços → Tela de consentimento OAuth_) → **Começar**:
   - nome do app **Orçô**, e-mail de suporte e e-mail de contato do desenvolvedor: os seus;
   - público: **Externo**.
3. **Público-alvo**: deixe em **Teste** e adicione como **usuários de teste** as contas Google que vão entrar (a sua e de quem for testar). Em Teste, só elas conseguem entrar com o Google.
4. **Acesso a dados** (escopos): não precisa adicionar nada. O Better Auth pede só `openid`, `email` e `profile`, que não exigem verificação.

> **Publicar o app** (sair do modo Teste) fica para a M7: o Google exige os links de termos de uso e de política de privacidade, que ainda não existem (P-07).

### 2. Um cliente por ambiente

**Clientes** → **Criar cliente** → tipo **Aplicativo da Web**, três vezes:

| Nome              | URIs de redirecionamento autorizados                        |
| ----------------- | ----------------------------------------------------------- |
| `orco-local`      | `http://localhost:3000/api/auth/callback/google`            |
| `orco-staging`    | `https://staging.orco.nbbrdev.com/api/auth/callback/google` |
| `orco-production` | `https://orco.nbbrdev.com/api/auth/callback/google`         |

As "Origens JavaScript autorizadas" ficam vazias: o navegador não fala com o Google direto, só o servidor.

Ao criar, o Google mostra o **ID do cliente** e a **chave secreta**. Guarde a chave no gerenciador de senhas: depois, o painel não mostra mais o valor inteiro.

### 3. Onde colocar

- **Local:** no `.env.local`, os dois valores do `orco-local`.
- **VPS:** no `/opt/orco/staging/.env` e no `/opt/orco/production/.env`, os valores do cliente de cada ambiente (`GOOGLE_CLIENT_ID=` e `GOOGLE_CLIENT_SECRET=`). Vale no próximo deploy.

---

## Backup pelo DBeaver

Não há backup automático (decisão de 2026-09-30: projeto pequeno). O backup é **manual**, pelo DBeaver, e é **obrigatório antes de cada release a partir da `v1.0.0`** (uma release aplica migrations no banco da produção). Antes dela, a produção não tem usuários reais, e o backup é opcional (decisão do usuário em 2026-10-05). Só o banco: os logos do RustFS ficam fora (se a VPS for perdida, são enviados de novo).

**Como o DBeaver alcança o banco:** o Postgres de cada ambiente escuta só em `127.0.0.1` da VPS (`DB_PORT`: 5433 na produção, 5434 no staging). A internet não alcança essas portas. O DBeaver entra na VPS por um **túnel SSH** com a sua chave de administração e, de dentro dela, conversa com o banco.

### Conexão (uma vez por ambiente)

Nova conexão → **PostgreSQL**:

| Aba  | Campo               | Valor                                                                               |
| ---- | ------------------- | ----------------------------------------------------------------------------------- |
| Main | Host                | `localhost` (é o "localhost" **da VPS**, do outro lado do túnel)                    |
| Main | Port                | `5433` (produção) ou `5434` (staging)                                               |
| Main | Database            | `orco`                                                                              |
| Main | Username / Password | `postgres` / a `POSTGRES_PASSWORD` do `.env` do ambiente (do gerenciador de senhas) |
| SSH  | Use SSH Tunnel      | ligado                                                                              |
| SSH  | Host / Port         | `IP_DA_VPS` / `22`                                                                  |
| SSH  | User Name           | `default`                                                                           |
| SSH  | Authentication      | **Public Key**, com o arquivo da sua chave de administração (`~/.ssh/CHAVE_DA_VPS`) |

Use o superusuário `postgres`: o backup precisa ler tudo (produto, login, funções). As roles do app (`app_user`, `app_auth`) não servem, porque a RLS esconderia os dados.

### Fazer o backup

1. Botão direito no banco `orco` **da conexão de produção** → **Tools → Backup**. Confira no cabeçalho da tela que é a conexão com a porta `5433` e o túnel SSH, e não a do banco local (`127.0.0.1:55432`): o engano já aconteceu (2026-10-05).
2. Marque **todos os schemas** (`public`, `app`, `auth` e o `drizzle`, que guarda o controle das migrations).
3. **Format: Custom** (compactado; é o que o restore usa).
4. Deixe **desligados** o "Do not backup privileges" e o "Discard objects owner": sem os GRANTs, o app não acessa nada depois de restaurar; sem os donos, as funções `SECURITY DEFINER` passariam a ser do `postgres`, que ignora a RLS.
5. Escolha a pasta e um nome com a data (ex.: `orco-production-2026-10-01.backup`) → **Start**.

O DBeaver usa o `pg_dump` **do seu PC**. Na primeira vez, ele pede o "local client": aponte para (ou deixe o DBeaver baixar) as ferramentas do **PostgreSQL 17**, a mesma versão do servidor.

> O arquivo contém **dados de usuários reais**. Fica só no seu PC, nunca no repositório nem em nuvem. A criptografia desses arquivos será decidida depois (decisão de 2026-10-01).

### Restaurar

Num banco **novo e sem migrations** (ex.: depois de recriar o ambiente): as roles nascem pelo bootstrap (`init.sh`/`roles.sql`) na primeira subida do container, e só então **Tools → Restore** no banco `orco`, com o arquivo do backup. O `pg_dump` não leva as roles, por isso elas vêm do bootstrap, com as senhas do `.env`. Se as migrations já rodaram, as tabelas existem e o restore falha com "already exists".

- Conecte como **`postgres`**: só o superusuário consegue devolver cada objeto ao dono certo e aplicar os GRANTs das outras roles.
- **Format: Custom**; **Clean**, **Create**, **No owner** e **No privileges** desligados.

**Teste de restauração** (com o primeiro backup da produção, o da `v1.0.0`, NBB-59): restaurar no banco **local** do PC e conferir as tabelas, os dados e o app local. Prova que o backup funciona antes do dia em que ele for necessário. O banco local vazio, só com as roles, sai de:

```bash
docker compose -f compose.dev.yaml down -v   # apaga o banco local (e os arquivos do RustFS local)
docker compose -f compose.dev.yaml up -d --wait
```

Não use o `npm run db:reset`: ele também roda as migrations. Na conexão local do DBeaver, use `127.0.0.1:55432` e o `postgres` do `compose.dev.yaml`. Em 2026-10-05 (NBB-58), um backup do banco local foi restaurado assim: schemas, donos, RLS, GRANTs e as 16 migrations voltaram certos, e o `security-invariants.test.ts` passou contra o banco restaurado.

---

## Agendamento diário (lembretes e IPs)

Todo dia às 9h de São Paulo, o cron da VPS chama o `POST /api/cron/diario` de cada ambiente: o lembrete de vencimento (RN-43) e a anonimização dos IPs com mais de 12 meses (RN-37). A rota só responde com a `CRON_SECRET` certa (NBB-62).

### 1. `CRON_SECRET` de cada ambiente

Gere uma senha **por ambiente** e coloque no `.env` dele (`/opt/orco/staging/.env` e `/opt/orco/production/.env`):

```bash
openssl rand -hex 32
```

```
CRON_SECRET=<o valor gerado>
```

O app só recebe a variável depois de um deploy com o `compose.yaml` que a repassa (o do PR da NBB-62 em diante).

### 2. `daily.sh` e o cron

Do **PC**, na pasta deste repositório:

```bash
scp -i ~/.ssh/CHAVE_DA_VPS -o IdentitiesOnly=yes deploy/daily.sh deploy/orco.cron default@IP_DA_VPS:/tmp/
```

Na VPS:

```bash
sudo install -o root -g root -m 755 /tmp/daily.sh /opt/orco/bin/daily.sh
sudo install -o root -g root -m 644 /tmp/orco.cron /etc/cron.d/orco
rm /tmp/daily.sh /tmp/orco.cron
bash -n /opt/orco/bin/daily.sh && echo "sintaxe ok"
timedatectl | grep "Time zone"
```

O relógio da VPS precisa estar em **UTC** (o `orco.cron` usa 12:00 UTC = 9h em São Paulo).

### 3. Testar

Rodando à mão, como o cron faz:

```bash
sudo -u deploy /opt/orco/bin/daily.sh staging
```

Esperado: `{"reminders":0,"anonymizedIps":0,"purgedRateLimits":…,"purgedSessions":…}` (os números do dia; os dois últimos são a limpeza dos limites de uso e das sessões expiradas, NBB-30). Sem a `CRON_SECRET` no app: erro 503; com a senha errada: 401. As execuções do cron ficam no log: `journalctl -t orco-daily`.

> Como o `deploy.sh`, o `daily.sh` e o `orco.cron` **não se atualizam sozinhos**. Quando um PR mudar um deles, repita o passo 2.

---

## Operação

Comandos na VPS com o seu usuário. Atalho para não repetir as opções:

```bash
orco() { sudo docker compose --project-directory "/opt/orco/$1" -p "orco-$1" --env-file "/opt/orco/$1/.env" --env-file "/opt/orco/$1/image.env" "${@:2}"; }
```

| Tarefa                 | Comando                                |
| ---------------------- | -------------------------------------- |
| Ver o que está rodando | `orco staging ps`                      |
| Logs do app            | `orco staging logs -f app`             |
| Reiniciar o app        | `orco staging restart app`             |
| Versão no ar           | `sudo cat /opt/orco/staging/image.env` |
| Espaço em disco        | `df -h` e `sudo docker system df`      |

- **Rollback de código:** no GitHub, abra uma execução anterior do workflow (Staging ou Production) e clique em **Re-run all jobs**. Ela sobe de novo aquela imagem exata, com o `compose.yaml` dela. As migrations não voltam: por isso toda migration precisa ser compatível com a versão anterior do código.
- Comandos gerais da VPS (Nginx, firewall, certificados, reboot): guia do `nbbrdev/vps`.
