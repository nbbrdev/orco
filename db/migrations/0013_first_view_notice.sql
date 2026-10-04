-- Escrita à mão (NBB-61, PR 2, N4): a primeira visualização do link passa a devolver o aviso de push
-- ao freelancer (RN-35, RN-45): "👀 Maria abriu o orçamento Nº 0012". Mesmo padrão da resposta (P3-A,
-- migrations 0011 e 0012): quem abre o link não tem login, então a própria função entrega as
-- assinaturas da conta, só na primeira visualização e na mesma transação. Visualização não gera
-- e-mail (RN-40), por isso o aviso não leva o e-mail da conta.
--
-- O tipo de retorno muda (boolean → jsonb), então a função é apagada e criada de novo. O resto é
-- igual ao da 0009:
--   { "first": true, "notice": { ... } } na primeira visualização;
--   { "first": false } nas outras (e no token que não existe).

DROP FUNCTION app.register_quote_view(text, inet, text);
--> statement-breakpoint

CREATE FUNCTION app.register_quote_view(token text, ip inet, user_agent text) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  target record;
BEGIN
  -- Trava a linha: duas aberturas ao mesmo tempo contam as duas, e só uma é a "primeira".
  SELECT id, user_id, version, first_viewed_at, number, client_name
    INTO target
    FROM public.quotes
   WHERE public_token = token
     AND status IN ('sent', 'approved', 'rejected')
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('first', false);
  END IF;

  UPDATE public.quotes
     SET view_count = view_count + 1,
         first_viewed_at = COALESCE(first_viewed_at, pg_catalog.now())
   WHERE id = target.id;

  IF target.first_viewed_at IS NOT NULL THEN
    RETURN pg_catalog.jsonb_build_object('first', false);
  END IF;
  INSERT INTO public.quote_events (quote_id, user_id, type, quote_version, ip, user_agent)
  VALUES (target.id, target.user_id, 'viewed', target.version, ip, pg_catalog.left(user_agent, 500));

  RETURN pg_catalog.jsonb_build_object(
    'first', true,
    'notice', pg_catalog.jsonb_build_object(
      'quoteId', target.id,
      'number', target.number,
      'clientName', target.client_name,
      'pushSubscriptions', COALESCE(
        (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                  'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
           FROM public.push_subscriptions s
          WHERE s.user_id = target.user_id),
        '[]'::jsonb
      )
    )
  );
END;
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.register_quote_view(text, inet, text) TO app_user;
