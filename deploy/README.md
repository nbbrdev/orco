# Deploy na VPS

Como o Orçô é configurado na VPS e como os deploys funcionam. Decisões em [ADR-0012](../docs/decisoes/0012-hospedagem-vps.md) e [ADR-0017](../docs/decisoes/0017-sem-staging.md) (sem staging desde 2026-10-21), visão geral em [docs/08-infra-deploy.md](../docs/08-infra-deploy.md).

**Pré-requisito:** a VPS preparada pelo guia do repositório privado **`nbbrdev/vps`** (usuário de administração, SSH só por chave, firewall, Docker, usuário `deploy`, Nginx base e Certbot instalados). A VPS é compartilhada entre projetos: aqui fica só o que é **do Orçô**.

## Arquivos desta pasta

| Arquivo                       | Para quê                                                                                                       |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `compose.yaml`                | A produção (app, migrate, db, rustfs). Vai **dentro da imagem** e o `deploy.sh` copia para a VPS a cada deploy |
| `env.example`                 | Modelo do `.env` da produção na VPS (segredos)                                                                 |
| `deploy.sh`                   | Único comando que a chave de deploy do Orçô consegue rodar. Instalado **à mão** em `/opt/orco/bin/`            |
| `nginx/orco.nbbrdev.com.conf` | Site do Orçô no Nginx: `orco` → `127.0.0.1:3000`                                                               |
| `daily.sh`                    | Agendamento diário (NBB-62): chama `/api/cron/diario` da produção. Instalado **à mão** em `/opt/orco/bin/`     |
| `orco.cron`                   | O horário do `daily.sh` (9h de São Paulo). Instalado **à mão** em `/etc/cron.d/orco`                           |

## Como um deploy acontece

O merge na `main` **não publica nada**. A produção só muda quando você cria uma release:

1. `gh release create vX.Y.Z --target main --generate-notes` → o `production.yml` confere a tag (formato, commit na `main`, CI verde) e chama a receita `deploy-vps.yml`, que constrói a imagem `ghcr.io/nbbrdev/orco:vX.Y.Z` e envia ao GHCR.
2. O workflow conecta por SSH com a **chave da produção** e manda só `vX.Y.Z@sha256:<digest>`.
3. Na VPS, essa chave só consegue rodar `/opt/orco/bin/deploy.sh production`, que:
   - valida o pedido (formato da etiqueta + digest);
   - baixa a imagem e copia de dentro dela o `compose.yaml` e o bootstrap do banco para `/opt/orco/production/`;
   - grava a versão em `image.env`;
   - aplica as migrations e sobe a nova versão.

**Antes de cada release, faça o backup da produção** (seção abaixo) e veja `docs/06-regras-dev.md` §4.1 (como escolher o número). Sem staging, a release aplica as migrations direto na produção.

O que é do Orçô na VPS:

```
/opt/orco/
├── bin/deploy.sh          ← dono root; o usuário deploy só executa
├── bin/daily.sh           ← idem (agendamento diário)
└── production/            ← dono deploy, chmod 700
    ├── .env               ← segredos da produção (você cria, chmod 600)
    ├── image.env          ← versão no ar (deploy.sh)
    ├── compose.yaml       ← da imagem da versão no ar
    └── init.sh, roles.sql ← idem (criam as roles na primeira subida do banco)

/etc/nginx/sites-available/orco.nbbrdev.com   ← o site (deste repositório; o Certbot acrescenta o HTTPS)
/etc/cron.d/orco                              ← o agendamento diário (deploy/orco.cron)
/home/deploy/.ssh/authorized_keys             ← uma linha do Orçô (a chave da produção)
Porta: 3000, só em 127.0.0.1 (banco: 5433, idem)
```

---

## Configurar o Orçô na VPS (uma vez)

Troque `IP_DA_VPS` pelo IP e `CHAVE_DA_VPS` pela sua chave de administração. No Windows, use o **Git Bash** e barras normais (`/`). Nos testes de SSH, use sempre `-o IdentitiesOnly=yes` (explicação no guia do `nbbrdev/vps`).

### 1. DNS

Na zona `nbbrdev.com` da Hostinger (hPanel → Domínios → DNS), um registro **A** `orco` apontando para o IP da VPS (só IPv4). **Não mexa** nos registros do Resend (`resend._domainkey.orco`, `send.orco`, `_dmarc`). Confira do PC: `nslookup orco.nbbrdev.com`.

### 2. Chave de deploy

No **seu PC**, **sem passphrase** (aperte Enter duas vezes; o GitHub Actions não teria como digitá-la):

```bash
ssh-keygen -t ed25519 -C "orco-production-deploy" -f ~/.ssh/orco-production-deploy
```

O comando gera a **privada** (vai para o secret do GitHub) e a **pública** `.pub` (vai para a VPS). Na VPS, acrescente uma linha no `authorized_keys` do `deploy` (dono root, criado pelo guia da VPS):

```bash
sudo nano /home/deploy/.ssh/authorized_keys
```

```
command="/opt/orco/bin/deploy.sh production",restrict ssh-ed25519 AAAA... orco-production-deploy
```

A linha: as opções, um espaço e o conteúdo inteiro do `.pub` (`cat ~/.ssh/orco-production-deploy.pub` no PC), **numa linha só**.

- `command="…"`: a VPS ignora o que o cliente pediu e roda sempre este comando. O pedido original chega ao script em `$SSH_ORIGINAL_COMMAND`.
- `restrict`: sem terminal interativo, sem túneis, sem repasse de chaves.

### 3. Pastas e o `deploy.sh`

```bash
sudo install -d -o root -g root -m 755 /opt/orco /opt/orco/bin
sudo install -d -o deploy -g deploy -m 700 /opt/orco/production
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

> O `deploy.sh` **não se atualiza sozinho**, de propósito: ele é a barreira de segurança da chave de deploy. Quando um PR mudar o `deploy/deploy.sh`, repita estes comandos.

**Teste da trava**, do PC:

| Teste         | Comando                                                                                                  | Esperado                                                       |
| ------------- | -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Outro comando | `ssh -i ~/.ssh/orco-production-deploy -o IdentitiesOnly=yes deploy@IP_DA_VPS "ls"`                       | `deploy: pedido recusado`                                      |
| Pedido válido | `ssh -i ~/.ssh/orco-production-deploy -o IdentitiesOnly=yes deploy@IP_DA_VPS "v0.0.0@sha256:<64 zeros>"` | `deploy: falta /opt/orco/production/.env` (até criar o `.env`) |

### 4. `.env` da produção

A partir de `deploy/env.example`. Gere cada senha com `openssl rand -hex 32` (só letras e números: as do banco entram nas URLs de conexão) e guarde todas no gerenciador de senhas.

```bash
sudo -u deploy nano /opt/orco/production/.env   # sudo -u deploy: o arquivo já nasce do deploy
sudo chmod 600 /opt/orco/production/.env
sudo ls -la /opt/orco/production                # -rw------- deploy deploy .env
```

`APP_ENV=production`, `SITE_URL=https://orco.nbbrdev.com`, `APP_PORT=3000`, `DB_PORT=5433`, senhas do banco e do RustFS, `BETTER_AUTH_SECRET` (assina as sessões; trocar desloga todo mundo), o cliente do Google, a chave do Resend, as chaves VAPID e a `CRON_SECRET`.

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
sudo certbot --nginx -d orco.nbbrdev.com
```

- `sites-available/` guarda os sites; o link em `sites-enabled/` é o que **ativa** um site.
- O Certbot pede um e-mail (avisos de expiração), prova ao Let's Encrypt que o domínio aponta para a VPS (pela porta 80), emite o certificado, adiciona o HTTPS a este arquivo na VPS e renova sozinho.
- Até o primeiro deploy, o domínio responde **502** (o Nginx funciona, mas ainda não há app na porta 3000).

### 6. GitHub

**Settings → Environments** → `production`, com _Deployment branches and tags_ → **Selected branches and tags** → **Add deployment branch or tag rule** → _Ref type_ **Tag**, padrão `v*`. Assim, só releases (tags `vX.Y.Z`) conseguem usar a chave da produção. Sem aprovação manual: criar a release já é a aprovação.

| Secret            | Valor                                                            |
| ----------------- | ---------------------------------------------------------------- |
| `VPS_HOST`        | IP da VPS                                                        |
| `VPS_USER`        | `deploy`                                                         |
| `VPS_SSH_KEY`     | conteúdo inteiro do arquivo **privado** `orco-production-deploy` |
| `VPS_KNOWN_HOSTS` | saída de `ssh-keyscan -t ed25519 IP_DA_VPS` (no seu PC)          |

Antes de colar o `VPS_KNOWN_HOSTS`, confira que é a sua VPS: `ssh-keyscan -t ed25519 IP_DA_VPS | ssh-keygen -lf -` deve mostrar a mesma impressão digital anotada no guia da VPS. Sem esses secrets, o `production.yml` fica **vermelho**: uma release precisa chegar ao ar.

Depois:

1. Apague a chave **privada** de deploy do seu PC depois de cadastrá-la (se perder, gere outra e troque).
2. **Primeira versão**, com o CI da `main` verde: `gh release create v0.1.0 --target main --generate-notes`.
3. **Pacote público:** depois do primeiro build, em github.com/nbbrdev → **Packages** → `orco` → _Package settings_ → _Change visibility_ → **Public**. Sem isso, a VPS não consegue baixar a imagem. Rode a execução do `production.yml` de novo.
4. Abra `https://orco.nbbrdev.com`: a página mostra a versão.

---

## Remover o staging (uma vez, 2026-10-21)

Desde o [ADR-0017](../docs/decisoes/0017-sem-staging.md), não há staging. Este passo a passo desmonta o que existia dele. **Siga a ordem**: o certificado do HTTPS cobre os dois nomes (`orco` e `staging.orco`), e ele precisa ser refeito só com o `orco` **antes** de o registro DNS do staging sumir. Senão, a renovação automática do certificado da **produção** passa a falhar.

Faça depois do merge do PR que remove o staging (NBB-122): a partir dele, nada mais publica no staging.

### 1. Parar e apagar o staging na VPS

Na VPS, com o seu usuário (o staging só tem dados fictícios):

```bash
sudo docker compose --project-directory /opt/orco/staging -p orco-staging \
  --env-file /opt/orco/staging/.env --env-file /opt/orco/staging/image.env \
  down -v --remove-orphans
sudo docker ps -a --filter name=orco-staging      # vazio
sudo docker volume ls --filter name=orco-staging  # vazio
sudo rm -rf /opt/orco/staging
```

`down -v` para e apaga os containers, a rede e os volumes (o banco e os logos) do staging. A produção é outro projeto (`orco-production`), com rede e volumes próprios, e não é tocada.

### 2. Nginx e certificado

O arquivo no ar foi alterado pelo Certbot (ele acrescentou os blocos do HTTPS), então **não** copie o arquivo deste repositório por cima. Edite o que está na VPS:

```bash
sudo cp /etc/nginx/sites-available/orco.nbbrdev.com ~/orco.nbbrdev.com.antes   # cópia de segurança
sudo nano /etc/nginx/sites-available/orco.nbbrdev.com
```

Apague **todos** os blocos `server { … }` que têm `server_name staging.orco.nbbrdev.com` (o da porta 80 e o da 443, que o Certbot criou). Os blocos do `orco.nbbrdev.com` ficam como estão. Depois:

```bash
sudo nginx -t && sudo systemctl reload nginx
sudo certbot certificates                                    # veja o "Certificate Name" do Orçô
sudo certbot --nginx --cert-name orco.nbbrdev.com -d orco.nbbrdev.com
sudo certbot certificates                                    # Domains: só orco.nbbrdev.com
sudo certbot renew --dry-run                                 # a renovação passa
```

Se o `Certificate Name` no primeiro `certbot certificates` não for `orco.nbbrdev.com`, use o nome que aparecer no `--cert-name`. Confira `https://orco.nbbrdev.com` no navegador. Se algo der errado, a cópia está em `~/orco.nbbrdev.com.antes`.

### 3. `deploy.sh`, `daily.sh` e o cron

Reinstale os três, que agora só aceitam a produção (os passos de "Configurar", passo 3, e de "Agendamento diário", passo 2):

```bash
scp -i ~/.ssh/CHAVE_DA_VPS -o IdentitiesOnly=yes deploy/deploy.sh deploy/daily.sh deploy/orco.cron default@IP_DA_VPS:/tmp/
```

Na VPS:

```bash
sudo install -o root -g root -m 755 /tmp/deploy.sh /opt/orco/bin/deploy.sh
sudo install -o root -g root -m 755 /tmp/daily.sh /opt/orco/bin/daily.sh
sudo install -o root -g root -m 644 /tmp/orco.cron /etc/cron.d/orco
rm /tmp/deploy.sh /tmp/daily.sh /tmp/orco.cron
bash -n /opt/orco/bin/deploy.sh && bash -n /opt/orco/bin/daily.sh && echo "sintaxe ok"
cat /etc/cron.d/orco                                         # só a linha da produção
```

### 4. Chave de deploy do staging

Na VPS, apague a linha com `deploy.sh staging` (comentário `orco-staging-deploy`) do `authorized_keys`, sem tocar na da produção:

```bash
sudo nano /home/deploy/.ssh/authorized_keys
```

Se a chave privada `~/.ssh/orco-staging-deploy` ainda existir no seu PC, apague também.

### 5. DNS

Só agora, com o certificado já refeito: na zona `nbbrdev.com` da Hostinger, apague o registro **A** `staging.orco`. Não mexa no `orco` nem nos do Resend.

### 6. GitHub, Google, Resend e gerenciador de senhas

- **GitHub:** Settings → Environments → `staging` → **Delete environment** (os secrets dele vão junto).
- **GHCR (opcional):** em Packages → `orco`, as versões com etiqueta `staging-<commit>` podem ser apagadas. As `vX.Y.Z` ficam, para rollback.
- **Google Cloud:** Google Auth Platform → Clientes → apague o cliente `orco-staging`.
- **Resend:** API Keys → apague a chave do staging.
- **Gerenciador de senhas:** apague os segredos do staging.

---

## Login com Google

O botão "Continuar com Google" precisa de um **cliente OAuth** no Google Cloud por ambiente (local e produção; NBB-40). O app não sobe sem o `GOOGLE_CLIENT_ID` e o `GOOGLE_CLIENT_SECRET`.

### 1. Projeto e tela de consentimento (uma vez)

1. Em [console.cloud.google.com](https://console.cloud.google.com), crie o projeto **Orçô**.
2. **Google Auth Platform** (no menu antigo: _APIs e serviços → Tela de consentimento OAuth_) → **Começar**:
   - nome do app **Orçô**, e-mail de suporte e e-mail de contato do desenvolvedor: os seus;
   - público: **Externo**.
3. **Público-alvo**: publicado (em produção) desde o go-live (NBB-59).
4. **Acesso a dados** (escopos): não precisa adicionar nada. O Better Auth pede só `openid`, `email` e `profile`, que não exigem verificação.

### 2. Um cliente por ambiente

**Clientes** → **Criar cliente** → tipo **Aplicativo da Web**:

| Nome              | URIs de redirecionamento autorizados                |
| ----------------- | --------------------------------------------------- |
| `orco-local`      | `http://localhost:3000/api/auth/callback/google`    |
| `orco-production` | `https://orco.nbbrdev.com/api/auth/callback/google` |

As "Origens JavaScript autorizadas" ficam vazias: o navegador não fala com o Google direto, só o servidor.

Ao criar, o Google mostra o **ID do cliente** e a **chave secreta**. Guarde a chave no gerenciador de senhas: depois, o painel não mostra mais o valor inteiro.

### 3. Onde colocar

- **Local:** no `.env.local`, os dois valores do `orco-local`.
- **VPS:** no `/opt/orco/production/.env`, os valores do `orco-production` (`GOOGLE_CLIENT_ID=` e `GOOGLE_CLIENT_SECRET=`). Vale no próximo deploy.

---

## Backup pelo DBeaver

Não há backup automático (decisão de 2026-09-30: projeto pequeno). O backup é **manual**, pelo DBeaver, e é **obrigatório antes de cada release a partir da primeira depois da `v1.0.0`** (uma release aplica migrations no banco da produção). Até a `v1.0.0`, inclusive, a produção não tinha usuários reais, e o backup foi opcional (decisões do usuário em 2026-10-05). Com os primeiros cadastros reais, faça o primeiro backup mesmo sem release (NBB-96). Só o banco: os logos do RustFS ficam fora (se a VPS for perdida, são enviados de novo).

**Como o DBeaver alcança o banco:** o Postgres da produção escuta só em `127.0.0.1` da VPS (`DB_PORT`: 5433). A internet não alcança essa porta. O DBeaver entra na VPS por um **túnel SSH** com a sua chave de administração e, de dentro dela, conversa com o banco.

### Conexão (uma vez)

Nova conexão → **PostgreSQL**:

| Aba  | Campo               | Valor                                                                               |
| ---- | ------------------- | ----------------------------------------------------------------------------------- |
| Main | Host                | `localhost` (é o "localhost" **da VPS**, do outro lado do túnel)                    |
| Main | Port                | `5433`                                                                              |
| Main | Database            | `orco`                                                                              |
| Main | Username / Password | `postgres` / a `POSTGRES_PASSWORD` do `.env` da produção (do gerenciador de senhas) |
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

> O arquivo contém **dados de usuários reais**. Fica só no seu PC, nunca no repositório nem em nuvem. Sem criptografia, por decisão de 2026-10-06 (risco aceito, NBB-77).

### Restaurar

Num banco **novo e sem migrations** (ex.: depois de recriar o ambiente): as roles nascem pelo bootstrap (`init.sh`/`roles.sql`) na primeira subida do container, e só então **Tools → Restore** no banco `orco`, com o arquivo do backup. O `pg_dump` não leva as roles, por isso elas vêm do bootstrap, com as senhas do `.env`. Se as migrations já rodaram, as tabelas existem e o restore falha com "already exists".

- Conecte como **`postgres`**: só o superusuário consegue devolver cada objeto ao dono certo e aplicar os GRANTs das outras roles.
- **Format: Custom**; **Clean**, **Create**, **No owner** e **No privileges** desligados.

**Teste de restauração** (feito em 2026-10-06 com o primeiro backup da produção, NBB-96): restaurar no banco **local** do PC e conferir as tabelas, os dados e o app local. Prova que o backup funciona antes do dia em que ele for necessário. O banco local vazio, só com as roles, sai de:

```bash
docker compose -f compose.dev.yaml down -v   # apaga o banco local (e os arquivos do RustFS local)
docker compose -f compose.dev.yaml up -d --wait
```

Não use o `npm run db:reset`: ele também roda as migrations. Na conexão local do DBeaver, use `127.0.0.1:55432` e o `postgres` do `compose.dev.yaml`. Em 2026-10-05 (NBB-58), um backup do banco local foi restaurado assim: schemas, donos, RLS, GRANTs e as 16 migrations voltaram certos, e o `security-invariants.test.ts` passou contra o banco restaurado.

---

## Agendamento diário (lembretes e IPs)

Todo dia às 9h de São Paulo, o cron da VPS chama o `POST /api/cron/diario` da produção: o lembrete de vencimento (RN-43) e a anonimização dos IPs com mais de 12 meses (RN-37). A rota só responde com a `CRON_SECRET` certa (NBB-62).

### 1. `CRON_SECRET`

Gere uma senha e coloque no `/opt/orco/production/.env`:

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
sudo -u deploy /opt/orco/bin/daily.sh production
```

Esperado: `{"reminders":0,"anonymizedIps":0,"purgedRateLimits":…,"purgedSessions":…}` (os números do dia; os dois últimos são a limpeza dos limites de uso e das sessões expiradas, NBB-30). Sem a `CRON_SECRET` no app: erro 503; com a senha errada: 401. As execuções do cron ficam no log: `journalctl -t orco-daily`.

> Como o `deploy.sh`, o `daily.sh` e o `orco.cron` **não se atualizam sozinhos**. Quando um PR mudar um deles, repita o passo 2.

---

## Operação

Comandos na VPS com o seu usuário. Atalho para não repetir as opções:

```bash
orco() { sudo docker compose --project-directory /opt/orco/production -p orco-production --env-file /opt/orco/production/.env --env-file /opt/orco/production/image.env "$@"; }
```

| Tarefa                 | Comando                                   |
| ---------------------- | ----------------------------------------- |
| Ver o que está rodando | `orco ps`                                 |
| Logs do app            | `orco logs -f app`                        |
| Reiniciar o app        | `orco restart app`                        |
| Versão no ar           | `sudo cat /opt/orco/production/image.env` |
| Espaço em disco        | `df -h` e `sudo docker system df`         |

- **Rollback de código:** no GitHub, abra a execução do `production.yml` de uma versão anterior e clique em **Re-run all jobs**. Ela sobe de novo aquela imagem exata, com o `compose.yaml` dela. As migrations não voltam: por isso toda migration precisa ser compatível com a versão anterior do código.
- Comandos gerais da VPS (Nginx, firewall, certificados, reboot): guia do `nbbrdev/vps`.
