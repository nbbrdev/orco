-- Roles do Orçô (ADR-0014). Roda UMA vez por banco novo, como superusuário, via psql:
--   psql -v owner_password=… -v app_user_password=… -v app_auth_password=… -f roles.sql
-- Localmente é chamado pelo db/bootstrap/init.sh (compose.dev.yaml); no CI, pelo ci.yml; na VPS,
-- pelo mesmo init.sh do container db. O resto da estrutura (schemas, permissões, funções) fica nas
-- migrations, aplicadas pela orco_owner.

\set ON_ERROR_STOP on

-- Dona do banco e de tudo que as migrations criarem. Só as migrations usam esta role.
CREATE ROLE orco_owner LOGIN PASSWORD :'owner_password';

-- Conexões do app. Sem SUPERUSER, CREATEDB, CREATEROLE nem BYPASSRLS (padrões do Postgres):
-- a RLS sempre vale para elas.
CREATE ROLE app_user LOGIN NOINHERIT PASSWORD :'app_user_password';
CREATE ROLE app_auth LOGIN NOINHERIT PASSWORD :'app_auth_password';

-- O banco passa a pertencer à orco_owner. No Postgres 15+, o schema public pertence ao dono do
-- banco (pg_database_owner), então a orco_owner também controla o public.
SELECT format('ALTER DATABASE %I OWNER TO orco_owner', current_database()) \gexec

-- Só as três roles conectam neste banco.
SELECT format('REVOKE ALL ON DATABASE %I FROM PUBLIC', current_database()) \gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO app_user, app_auth', current_database()) \gexec
