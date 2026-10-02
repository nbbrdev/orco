-- Limites de uso (ADR-0004, NBB-39): contadores em janela fixa, usados primeiro pelo anti-abuso do
-- cadastro (RN-46) e depois pelo link público e pelo PDF (RN-39). Escrita à mão: tabela sem acesso
-- direto, só pela função app.check_rate_limit.

CREATE TABLE public.rate_limits (
  key text NOT NULL,
  window_start timestamptz NOT NULL,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);
--> statement-breakpoint

-- As permissões automáticas do schema public (0000) dão à app_user acesso a toda tabela nova; esta
-- tabela é a exceção: a app_user só a usa através da função.
REVOKE ALL ON TABLE public.rate_limits FROM app_user;
--> statement-breakpoint

-- RLS ligada e forçada, como em toda tabela de public. A única policy é para a dona (orco_owner), que
-- é quem a função SECURITY DEFINER usa: ninguém mais lê ou grava, nem com permissão.
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.rate_limits FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY rate_limits_owner_only ON public.rate_limits TO orco_owner USING (true) WITH CHECK (true);
--> statement-breakpoint

-- Conta mais um uso de `p_key` na janela atual e diz se ainda está dentro do limite.
-- As janelas seguem o relógio de São Paulo: com p_window_seconds = 86400, o dia vira à meia-noite de
-- Brasília (o teto diário da RN-46); com 3600, a cada hora cheia.
CREATE FUNCTION app.check_rate_limit(p_key text, p_limit int, p_window_seconds int)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_local_epoch double precision;
  v_window_start timestamptz;
  v_count int;
BEGIN
  IF p_key IS NULL OR p_key = '' OR p_limit < 1 OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'check_rate_limit: parâmetros inválidos';
  END IF;

  -- Hora de São Paulo como se fosse UTC, arredondada para baixo até o início da janela, e convertida
  -- de volta para um instante (timestamptz).
  v_local_epoch := extract(epoch FROM (now() AT TIME ZONE 'America/Sao_Paulo'));
  v_window_start := (to_timestamp(floor(v_local_epoch / p_window_seconds) * p_window_seconds)
    AT TIME ZONE 'UTC') AT TIME ZONE 'America/Sao_Paulo';

  -- Janelas antigas desta chave não servem mais.
  DELETE FROM public.rate_limits WHERE key = p_key AND window_start < v_window_start;

  INSERT INTO public.rate_limits AS r (key, window_start, count)
  VALUES (p_key, v_window_start, 1)
  ON CONFLICT (key, window_start) DO UPDATE SET count = r.count + 1
  RETURNING r.count INTO v_count;

  RETURN v_count <= p_limit;
END;
$$;
--> statement-breakpoint

GRANT EXECUTE ON FUNCTION app.check_rate_limit(text, int, int) TO app_user;
