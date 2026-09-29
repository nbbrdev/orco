-- Base de segurança do banco (ADR-0014). Aplicada pela orco_owner, depois do db/bootstrap/roles.sql.

-- public: tabelas do produto. Só a app_user usa, sempre com RLS.
REVOKE ALL ON SCHEMA public FROM PUBLIC;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO app_user;
--> statement-breakpoint

-- auth: tabelas de login do Better Auth (NBB-39). Só a app_auth usa.
CREATE SCHEMA auth;
--> statement-breakpoint
GRANT USAGE ON SCHEMA auth TO app_auth;
--> statement-breakpoint

-- app: funções auxiliares das policies.
CREATE SCHEMA app;
--> statement-breakpoint
GRANT USAGE ON SCHEMA app TO app_user;
--> statement-breakpoint

-- Permissões automáticas para tudo que a orco_owner criar daqui em diante. Toda tabela nova em
-- public já nasce acessível à app_user (e só a ela); em auth, só à app_auth. Sem RLS e policies, a
-- app_user continua sem enxergar nada, porque as tabelas usam FORCE ROW LEVEL SECURITY.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA auth
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_auth;
--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA auth GRANT USAGE, SELECT ON SEQUENCES TO app_auth;
--> statement-breakpoint

-- Funções: ninguém executa por padrão. Cada função concede EXECUTE só à role que precisa.
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
--> statement-breakpoint

-- Usuário da requisição, definido por withUserDb com set_config('app.user_id', …, true).
-- Sem ele (fora de withUserDb), retorna NULL: `user_id = NULL` nunca é verdadeiro, então nenhuma
-- linha aparece. Fecha por padrão.
CREATE FUNCTION app.current_user_id() RETURNS uuid
  LANGUAGE sql
  STABLE
  SET search_path = ''
AS $$
  SELECT nullif(pg_catalog.current_setting('app.user_id', true), '')::uuid
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.current_user_id() TO app_user;
