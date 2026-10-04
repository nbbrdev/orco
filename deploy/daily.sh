#!/usr/bin/env bash
# Agendamento diário do Orçô na VPS (NBB-62, L1-A, docs/08-infra-deploy.md "Agendamentos").
#
# Chamado pelo cron do sistema (deploy/orco.cron), uma vez por dia e por ambiente. Faz um POST em
# /api/cron/diario do app do ambiente, pela porta local (só a VPS alcança), com a CRON_SECRET do .env
# dele. O app faz o lembrete de vencimento (RN-43) e a anonimização dos IPs antigos (RN-37).
#
# Instalação (deploy/README.md): /opt/orco/bin/daily.sh, dono root, modo 755. Roda como o usuário
# deploy, o único que lê os .env.
set -euo pipefail

env_name="${1:-}"
case "$env_name" in
  staging | production) ;;
  *)
    echo "daily: ambiente inválido: use staging ou production." >&2
    exit 1
    ;;
esac

readonly env_file="/opt/orco/$env_name/.env"

# O valor de uma variável do .env (a última, se repetida), sem aspas em volta.
env_value() {
  local name="$1" line value=""
  while IFS= read -r line; do
    if [[ "$line" == "$name="* ]]; then
      value="${line#"$name="}"
    fi
  done <"$env_file"
  value="${value%\"}"
  printf '%s' "${value#\"}"
}

port="$(env_value APP_PORT)"
secret="$(env_value CRON_SECRET)"
if [[ -z "$port" || -z "$secret" ]]; then
  echo "daily: defina APP_PORT e CRON_SECRET em $env_file." >&2
  exit 1
fi

# A senha vai pela entrada padrão (-H @-), e não na linha de comando, para não aparecer na lista de
# processos da VPS.
printf 'Authorization: Bearer %s\n' "$secret" |
  curl --fail --silent --show-error --max-time 300 \
    --request POST --header @- \
    "http://127.0.0.1:$port/api/cron/diario"
echo
