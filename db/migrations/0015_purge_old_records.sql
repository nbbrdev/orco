-- Escrita à mão (NBB-30, T4-A): minimização de dados (LGPD). Duas tabelas guardavam IP sem prazo:
-- - public.rate_limits: as chaves dos limites de uso têm o IP (ex.: signup:ip:<ip>), e a
--   app.check_rate_limit só limpava as janelas antigas da MESMA chave; um IP que aparecia uma vez
--   ficava para sempre;
-- - auth.session: cada login guarda o IP e o navegador, e a sessão expirada continuava no banco.
-- A política de privacidade promete: IP dos limites até 2 dias, sessões expiradas apagadas todo dia.
--
-- A tarefa diária (/api/cron/diario, NBB-62) chama esta função pela app_user, que não alcança a
-- rate_limits (só pela função dela) nem o schema auth; por isso, SECURITY DEFINER. Só apaga: janelas
-- com mais de 2 dias, de qualquer chave, e sessões que já expiraram (quem está logado não é afetado).
-- Devolve quantas linhas saíram de cada tabela.

CREATE FUNCTION app.purge_old_records() RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  rate_limits_removed integer;
  sessions_removed integer;
BEGIN
  DELETE FROM public.rate_limits
   WHERE window_start < pg_catalog.now() - INTERVAL '2 days';
  GET DIAGNOSTICS rate_limits_removed = ROW_COUNT;

  DELETE FROM auth.session
   WHERE expires_at < pg_catalog.now();
  GET DIAGNOSTICS sessions_removed = ROW_COUNT;

  RETURN pg_catalog.jsonb_build_object(
    'rateLimits', rate_limits_removed,
    'sessions', sessions_removed
  );
END;
$$;
--> statement-breakpoint
-- Só a tarefa diária chama (protegida pela CRON_SECRET), pela app_user.
GRANT EXECUTE ON FUNCTION app.purge_old_records() TO app_user;
