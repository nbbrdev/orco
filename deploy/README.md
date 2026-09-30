# Deploy na VPS

Como preparar a VPS do Orçô e como os deploys funcionam. Decisões em [ADR-0012](../docs/decisoes/0012-hospedagem-vps.md), visão geral em [docs/08-infra-deploy.md](../docs/08-infra-deploy.md).

## Arquivos desta pasta

| Arquivo           | Para quê                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------- |
| `compose.yaml`    | Um ambiente (app, migrate, db, rustfs). Vai **dentro da imagem** e o `deploy.sh` copia para a VPS a cada deploy |
| `env.example`     | Modelo do `.env` de cada ambiente na VPS (segredos)                                                             |
| `deploy.sh`       | Único comando que as chaves de deploy do GitHub conseguem rodar. Instalado **à mão** em `/opt/orco/bin/`        |
| `nginx/orco.conf` | Proxy reverso: `orco` → `127.0.0.1:3000`, `staging.orco` → `127.0.0.1:3001`                                     |

## Como um deploy acontece

1. Merge na `main` → CI verde → `staging.yml` chama a receita comum `deploy-vps.yml`, que constrói a imagem `ghcr.io/nbbrdev/orco:staging-<commit>` e envia ao GHCR.
2. O workflow conecta por SSH com a **chave do staging** e manda só `staging-<commit>@sha256:<digest>`.
3. Na VPS, essa chave só consegue rodar `/opt/orco/bin/deploy.sh staging`, que:
   - valida o pedido (formato da etiqueta + digest);
   - baixa a imagem e copia de dentro dela o `compose.yaml` e o bootstrap do banco para `/opt/orco/staging/`;
   - grava a versão em `image.env`;
   - aplica as migrations e sobe a nova versão.

A produção segue o mesmo caminho a partir de uma release `vX.Y.Z` (`production.yml` → `deploy-vps.yml`), com a sua própria chave e a pasta `/opt/orco/production/`. Passo a passo em **Produção**, abaixo.

Na VPS:

```
/opt/orco/
├── bin/deploy.sh          ← dono root; o usuário deploy só executa
├── staging/
│   ├── .env               ← segredos do staging (você cria, chmod 600)
│   ├── image.env          ← versão no ar (deploy.sh)
│   ├── compose.yaml       ← da imagem da versão no ar
│   ├── init.sh, roles.sql ← idem (criam as roles na primeira subida do banco)
└── production/            ← mesma estrutura
```

---

## Preparar a VPS (uma vez)

Hostinger KVM 1 ou 2 com **Ubuntu 24.04 LTS**. Nos comandos, troque `IP_DA_VPS` pelo IP e `SEU_USUARIO` pelo nome do seu usuário de administração.

### 1. DNS

Na zona `nbbrdev.com` da Hostinger, dois registros **A** apontando para o IP da VPS:

- `orco`
- `staging.orco`

### 2. Seu usuário de administração

Primeiro acesso como `root` (senha ou chave do painel da Hostinger):

```bash
adduser SEU_USUARIO            # cria o usuário (defina uma senha forte: usada pelo sudo)
usermod -aG sudo SEU_USUARIO   # pode usar sudo
```

No **seu PC**, se ainda não tiver uma chave SSH pessoal:

```bash
ssh-keygen -t ed25519 -C "SEU_USUARIO@orco-vps"
ssh-copy-id SEU_USUARIO@IP_DA_VPS
```

Confira que entra **sem senha** com `ssh SEU_USUARIO@IP_DA_VPS` antes de seguir.

Anote a **impressão digital** da VPS (usada no passo 8). No console da Hostinger ou já conectado:

```bash
ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

### 3. SSH só por chave, sem root

Crie `/etc/ssh/sshd_config.d/10-orco.conf` (`sudo nano …`):

```
PermitRootLogin no
PasswordAuthentication no
KbdInteractiveAuthentication no
PubkeyAuthentication yes
AllowUsers SEU_USUARIO deploy
```

```bash
sudo sshd -t && sudo systemctl restart ssh
```

**Não feche a sessão atual.** Abra outro terminal e confira que ainda entra com `ssh SEU_USUARIO@IP_DA_VPS`. Se algo der errado, a sessão antiga ainda está aberta para corrigir.

### 4. Firewall e atualizações automáticas

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y ufw unattended-upgrades
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo dpkg-reconfigure -plow unattended-upgrades   # responda "Yes"
```

> O Docker cria regras de rede próprias que **passam por cima do `ufw`** para portas publicadas. Por isso o `compose.yaml` publica o app só em `127.0.0.1` e não publica o banco nem o RustFS: nada disso fica acessível pela internet, com ou sem firewall.

### 5. Docker

Instalação oficial (repositório da Docker):

```bash
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo docker run --rm hello-world
```

### 6. Usuário `deploy` e as chaves do GitHub

O usuário `deploy` não tem senha nem terminal: só roda o `deploy.sh`.

```bash
sudo adduser --disabled-password --gecos "" deploy
sudo usermod -aG docker deploy
```

No **seu PC**, gere uma chave por ambiente, **sem senha** (o GitHub Actions não teria como digitá-la):

```bash
ssh-keygen -t ed25519 -N "" -C "orco-staging-deploy" -f orco-staging-deploy
ssh-keygen -t ed25519 -N "" -C "orco-production-deploy" -f orco-production-deploy   # usada na NBB-63
```

Cada comando gera dois arquivos: `orco-staging-deploy` (**privada**, vai para o GitHub) e `orco-staging-deploy.pub` (**pública**, vai para a VPS).

Na VPS, o `authorized_keys` do `deploy` fica com **dono root**, para que nem o próprio `deploy` consiga alterá-lo:

```bash
sudo install -d -o root -g root -m 755 /home/deploy/.ssh
sudo nano /home/deploy/.ssh/authorized_keys
sudo chown root:root /home/deploy/.ssh/authorized_keys
sudo chmod 644 /home/deploy/.ssh/authorized_keys
```

Conteúdo, **uma linha por chave**: as opções, um espaço e o conteúdo inteiro do `.pub`:

```
command="/opt/orco/bin/deploy.sh staging",restrict ssh-ed25519 AAAA... orco-staging-deploy
command="/opt/orco/bin/deploy.sh production",restrict ssh-ed25519 AAAA... orco-production-deploy
```

- `command="…"`: a VPS ignora o que o cliente pediu e roda sempre este comando. O pedido original chega ao script em `$SSH_ORIGINAL_COMMAND`.
- `restrict`: sem terminal interativo, sem túneis, sem repasse de chaves.

### 7. Pastas e o `deploy.sh`

```bash
sudo install -d -o root -g root -m 755 /opt/orco /opt/orco/bin
sudo install -d -o deploy -g deploy -m 700 /opt/orco/staging /opt/orco/production
```

Do **seu PC** (na pasta do repositório):

```bash
scp deploy/deploy.sh SEU_USUARIO@IP_DA_VPS:/tmp/deploy.sh
```

Na VPS:

```bash
sudo install -o root -g root -m 755 /tmp/deploy.sh /opt/orco/bin/deploy.sh
rm /tmp/deploy.sh
```

> O `deploy.sh` **não se atualiza sozinho**, de propósito: ele é a barreira de segurança das chaves de deploy. Quando um PR mudar o `deploy/deploy.sh`, repita estes dois comandos.

O `.env` do staging, a partir de `deploy/env.example` (gere cada senha com `openssl rand -hex 32`):

```bash
sudo -u deploy nano /opt/orco/staging/.env
sudo chmod 600 /opt/orco/staging/.env
```

Guarde uma cópia dessas senhas no seu gerenciador de senhas.

### 8. Nginx e HTTPS

```bash
sudo apt install -y nginx certbot python3-certbot-nginx
sudo rm /etc/nginx/sites-enabled/default
```

Do seu PC: `scp deploy/nginx/orco.conf SEU_USUARIO@IP_DA_VPS:/tmp/orco.conf`. Na VPS:

```bash
sudo install -o root -g root -m 644 /tmp/orco.conf /etc/nginx/sites-available/orco
sudo ln -s /etc/nginx/sites-available/orco /etc/nginx/sites-enabled/orco
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d orco.nbbrdev.com -d staging.orco.nbbrdev.com
```

O Certbot pede um e-mail (avisos de expiração), emite os certificados, adiciona o HTTPS ao `orco.conf` e agenda a renovação automática (`systemctl list-timers | grep certbot`).

### 9. GitHub

**Settings → Environments → New environment** `staging`, com _Deployment branches and tags_ → **Selected branches and tags** → `main`, e estes secrets:

| Secret            | Valor                                                         |
| ----------------- | ------------------------------------------------------------- |
| `VPS_HOST`        | IP da VPS                                                     |
| `VPS_USER`        | `deploy`                                                      |
| `VPS_SSH_KEY`     | conteúdo inteiro do arquivo **privado** `orco-staging-deploy` |
| `VPS_KNOWN_HOSTS` | saída de `ssh-keyscan -t ed25519 IP_DA_VPS` (no seu PC)       |

Antes de colar o `VPS_KNOWN_HOSTS`, confira que é a sua VPS: `ssh-keyscan -t ed25519 IP_DA_VPS | ssh-keygen -lf -` deve mostrar a mesma impressão digital anotada no passo 2.

Depois:

1. Apague as chaves **privadas** de deploy do seu PC depois de cadastrá-las (se perder, gere outras e troque).

2. **Primeiro deploy:** Actions → **Staging** → _Run workflow_ (branch `main`).

3. **Pacote público:** depois do primeiro build, em github.com/nbbrdev → **Packages** → `orco` → _Package settings_ → _Change visibility_ → **Public**. Sem isso, a VPS não consegue baixar a imagem. Rode o workflow de novo.

4. Abra `https://staging.orco.nbbrdev.com`: pede a senha do Basic Auth e mostra `staging-<commit>` no rodapé.

---

## Produção

Com o staging funcionando, a produção reaproveita a mesma VPS, o mesmo `deploy.sh` e o mesmo Nginx. Muda a pasta, o `.env`, a chave e o environment.

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
STAGING_BASIC_AUTH_USER=
STAGING_BASIC_AUTH_PASSWORD=
```

A linha da chave `orco-production-deploy` já está no `authorized_keys` (passo 6).

### 2. Environment `production` no GitHub

**Settings → Environments → New environment** `production`, com _Deployment branches and tags_ → **Selected branches and tags** → **Add deployment branch or tag rule** → _Ref type_ **Tag**, padrão `v*`. Assim, só releases (tags `vX.Y.Z`) conseguem usar a chave da produção. Sem aprovação manual: criar a release já é a aprovação.

Secrets: os mesmos quatro do staging (`VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_KNOWN_HOSTS`), mas com o `VPS_SSH_KEY` = conteúdo da chave **privada** `orco-production-deploy`.

> Sem esses secrets, o `production.yml` fica **vermelho** (no staging, ele só avisa e pula). Uma release precisa chegar ao ar.

### 3. Primeira versão

Com o CI da `main` verde:

```bash
gh release create v0.1.0 --target main --generate-notes
```

O `production.yml` confere a tag, constrói a imagem `v0.1.0`, aplica as migrations no banco da produção e sobe o app. Abra `https://orco.nbbrdev.com`: a página mostra `v0.1.0`.

Próximas versões: ver `docs/06-regras-dev.md` §4.1 (como escolher o número).

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

- **Rollback de código:** no GitHub, abra uma execução anterior do workflow (Staging, ou Production na NBB-63) e clique em **Re-run all jobs**. Ela sobe de novo aquela imagem exata, com o `compose.yaml` dela. As migrations não voltam: por isso toda migration precisa ser compatível com a versão anterior do código.
- **Testar a trava da chave:** `ssh -i orco-staging-deploy deploy@IP_DA_VPS "ls"` deve responder `deploy: pedido recusado`.
