-- Escrita à mão (NBB-55, E1-A): a resposta do cliente passa a devolver o que o aviso ao freelancer
-- precisa (RN-40, RN-41). Quem responde não tem login, e o app só lê os dados de uma conta pela
-- sessão dela (withUserDb). Por isso a própria função, na mesma transação e só quando a resposta deu
-- certo, entrega o e-mail da conta e a preferência de notificações. Nenhuma função nova fica exposta.
--
-- O tipo de retorno muda (text → jsonb), então a função é apagada e criada de novo. O resto é igual
-- ao da 0010:
--   { "result": "ok", "notice": { ... } } na resposta registrada;
--   { "result": "not_found" | "already_responded" | "expired" | "outdated" } nos outros casos.

DROP FUNCTION app.respond_to_quote(
  text, public.quote_event_type, integer, text, public.reject_reason, text, inet, text
);
--> statement-breakpoint

CREATE FUNCTION app.respond_to_quote(
  token text,
  decision public.quote_event_type,
  expected_version integer,
  respondent_name text,
  reason_code public.reject_reason,
  reason text,
  ip inet,
  user_agent text
) RETURNS jsonb
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  target record;
  notice jsonb;
BEGIN
  IF decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Resposta inválida: %.', decision USING ERRCODE = '22023';
  END IF;

  -- Trava a linha: duas respostas ao mesmo tempo não passam as duas.
  SELECT id, user_id, status, version, valid_until, number, client_name
    INTO target
    FROM public.quotes
   WHERE public_token = token
     AND status IN ('sent', 'approved', 'rejected')
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN pg_catalog.jsonb_build_object('result', 'not_found');
  END IF;
  IF target.status <> 'sent' THEN
    RETURN pg_catalog.jsonb_build_object('result', 'already_responded');
  END IF;
  IF target.valid_until < (pg_catalog.now() AT TIME ZONE 'America/Sao_Paulo')::date THEN
    RETURN pg_catalog.jsonb_build_object('result', 'expired');
  END IF;
  IF target.version <> expected_version THEN
    RETURN pg_catalog.jsonb_build_object('result', 'outdated');
  END IF;

  -- O trigger app.check_quote_update confere a transição e preenche o responded_at.
  UPDATE public.quotes
     SET status = decision::text::public.quote_status
   WHERE id = target.id;

  INSERT INTO public.quote_events (
    quote_id, user_id, type, quote_version, ip, user_agent, respondent_name, reason_code, reason
  ) VALUES (
    target.id,
    target.user_id,
    decision,
    target.version,
    ip,
    pg_catalog.left(user_agent, 500),
    CASE WHEN decision = 'approved' THEN respondent_name END,
    CASE WHEN decision = 'rejected' THEN reason_code END,
    CASE WHEN decision = 'rejected' THEN reason END
  );

  -- O aviso ao freelancer (RN-40, RN-41): o e-mail da conta e a preferência do perfil.
  SELECT pg_catalog.jsonb_build_object(
           'quoteId', target.id,
           'number', target.number,
           'clientName', target.client_name,
           'accountEmail', u.email,
           'emailNotifications', p.email_notifications
         )
    INTO notice
    FROM auth."user" u
    JOIN public.profiles p ON p.id = u.id
   WHERE u.id = target.user_id;

  RETURN pg_catalog.jsonb_build_object('result', 'ok', 'notice', notice);
END;
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.respond_to_quote(
  text, public.quote_event_type, integer, text, public.reject_reason, text, inet, text
) TO app_user;
