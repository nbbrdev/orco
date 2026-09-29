#!/usr/bin/env bash
# Deploy de um ambiente do Orçô na VPS (ADR-0012, docs/08-infra-deploy.md).
#
# É o ÚNICO comando que as chaves SSH de deploy do GitHub conseguem rodar. No authorized_keys do
# usuário deploy, cada chave fica presa a um ambiente:
#   command="/opt/orco/bin/deploy.sh staging",restrict ssh-ed25519 AAAA... orco-staging-deploy
#   command="/opt/orco/bin/deploy.sh production",restrict ssh-ed25519 AAAA... orco-production-deploy
#
# O ambiente vem da chave ($1). O workflow só escolhe QUAL imagem subir: o pedido chega em
# $SSH_ORIGINAL_COMMAND no formato <tag>@sha256:<digest>, e qualquer outra coisa é recusada.
# Os arquivos de deploy (compose.yaml, init.sh, roles.sql) saem de dentro da imagem, nunca do SSH.
#
# Instalação (deploy/README.md): /opt/orco/bin/deploy.sh, dono root, modo 755. O usuário deploy
# roda o script, mas não consegue alterá-lo.
set -euo pipefail

readonly REGISTRY="ghcr.io/nbbrdev/orco"
readonly ROOT="/opt/orco"

fail() {
  echo "deploy: $*" >&2
  exit 1
}

env_name="${1:-}"
request="${SSH_ORIGINAL_COMMAND:-}"

# Formato da etiqueta aceito em cada ambiente.
case "$env_name" in
  staging) tag_pattern='staging-[0-9a-f]{40}' ;;
  production) tag_pattern='v[0-9]+\.[0-9]+\.[0-9]+' ;;
  *) fail "ambiente inválido: use staging ou production." ;;
esac

# Pedido inteiro validado: etiqueta do ambiente + digest (a impressão digital exata da imagem).
readonly request_pattern="^${tag_pattern}@sha256:[0-9a-f]{64}\$"
if ! [[ "$request" =~ $request_pattern ]]; then
  fail "pedido recusado. Formato esperado para $env_name: <tag>@sha256:<digest>."
fi

readonly image="${REGISTRY}:${request}"
readonly dir="${ROOT}/${env_name}"
[[ -f "$dir/.env" ]] || fail "falta $dir/.env (veja deploy/README.md)."

# Um deploy por vez neste ambiente.
exec 9>"$dir/.deploy.lock"
flock -n 9 || fail "outro deploy de $env_name está em andamento."

echo "==> Baixando $image"
docker pull --quiet "$image"

echo "==> Copiando os arquivos de deploy de dentro da imagem"
# `docker create` prepara um container sem ligá-lo, só para ler os arquivos da imagem.
container="$(docker create "$image")"
trap 'docker rm -f "$container" >/dev/null 2>&1 || true' EXIT
docker cp "$container:/app/deploy/." "$dir/"

# A versão fica gravada na pasta: qualquer comando futuro (backup, reinício) usa esta mesma imagem.
printf 'ORCO_IMAGE=%s\n' "$image" >"$dir/image.env"

compose() {
  docker compose \
    --project-directory "$dir" \
    --file "$dir/compose.yaml" \
    --project-name "orco-$env_name" \
    --env-file "$dir/.env" \
    --env-file "$dir/image.env" \
    "$@"
}

# Primeiro o banco, depois o código (as migrations precisam ser compatíveis com a versão anterior).
echo "==> Aplicando as migrations"
compose run --rm migrate

echo "==> Subindo a nova versão"
compose up --detach --remove-orphans

# Imagens sem uso há mais de 7 dias. As versões continuam no GHCR para um rollback.
echo "==> Limpando imagens antigas"
docker image prune --all --force --filter "until=168h" >/dev/null

echo "Deploy de $env_name concluído: $request"
