#!/bin/sh
# Chamado pelo container oficial do Postgres na primeira inicialização (volume vazio).
# Repassa as senhas das roles, vindas das variáveis do container, para o roles.sql.
set -eu

psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
  -v owner_password="$ORCO_OWNER_PASSWORD" \
  -v app_user_password="$APP_USER_PASSWORD" \
  -v app_auth_password="$APP_AUTH_PASSWORD" \
  -f /bootstrap/roles.sql
