# syntax=docker/dockerfile:1
# Imagem do Orçô (ADR-0012, docs/08-infra-deploy.md). Construída pelo GitHub Actions e publicada no
# GHCR (pública). Nenhum segredo entra aqui: eles chegam na hora de rodar, pelo .env da VPS.
#
# Uma imagem leva tudo de uma versão:
#   /app            o app (Next standalone), rodando como usuário não-root
#   /app/migrator   as migrations e o script que as aplica (serviço `migrate` do compose)
#   /app/deploy     compose.yaml e bootstrap do banco, copiados para a VPS pelo deploy.sh

# 1. Dependências completas (inclui as de desenvolvimento, necessárias para o build).
FROM node:24.21.0-alpine3.24 AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# 2. Build do Next. Variáveis NEXT_PUBLIC_* são gravadas no código do navegador nesta etapa.
FROM node:24.21.0-alpine3.24 AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_APP_VERSION=dev
ENV NEXT_PUBLIC_APP_VERSION=$NEXT_PUBLIC_APP_VERSION
RUN npm run build

# 3. Só as dependências de produção, nas versões do lockfile, para o migrator.
FROM node:24.21.0-alpine3.24 AS migrator
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

# 4. Imagem final.
FROM node:24.21.0-alpine3.24 AS runner
LABEL org.opencontainers.image.source="https://github.com/nbbrdev/orco"
LABEL org.opencontainers.image.description="Orçô: orçamentos simples para freelancers."
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000

# Os arquivos ficam com dono root: o usuário `node`, que roda o app, só consegue lê-los.
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public

# Migrator: o script, as migrations e só os dois pacotes que ele usa (nenhum tem dependências).
COPY --from=migrator /app/node_modules/drizzle-orm ./migrator/node_modules/drizzle-orm
COPY --from=migrator /app/node_modules/postgres ./migrator/node_modules/postgres
COPY scripts/migrate.mts ./migrator/scripts/migrate.mts
COPY db/migrations ./migrator/db/migrations

# Arquivos de deploy desta versão.
COPY deploy/compose.yaml ./deploy/compose.yaml
COPY --chmod=0755 db/bootstrap/init.sh ./deploy/init.sh
COPY db/bootstrap/roles.sql ./deploy/roles.sql

USER node
EXPOSE 3000
CMD ["node", "server.js"]
