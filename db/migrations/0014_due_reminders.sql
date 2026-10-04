-- Escrita à mão (NBB-62, L4-A): o lembrete de vencimento (RN-43). O agendamento diário da VPS chama
-- a rota /api/cron/diario, que não tem a sessão de ninguém. Como na resposta e na visualização (P3-A,
-- migrations 0011 a 0013), esta função entrega o que o aviso precisa, e só o que ela mesma separou.
--
-- Numa operação só, ela pega os orçamentos enviados, sem resposta, que vencem AMANHÃ (dia de São
-- Paulo) e ainda sem lembrete nesta validade, e marca o `reminder_sent_at`. Rodar duas vezes no mesmo
-- dia não manda de novo: a segunda já encontra tudo marcado (e, rodando ao mesmo tempo, espera a
-- trava da linha e pula). Se o envio falhar depois, não há nova tentativa (RN-42). Prorrogar a
-- validade zera o `reminder_sent_at` (trigger app.check_quote_update, 0007), e o orçamento pode
-- receber outro lembrete.
--
-- Devolve uma lista JSON, um item por orçamento: id, número, cliente, validade, e-mail da conta, a
-- preferência de e-mail (RN-41) e as assinaturas de push (RN-45).

CREATE FUNCTION app.claim_due_reminders() RETURNS jsonb
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = ''
AS $$
  WITH due AS (
    UPDATE public.quotes q
       SET reminder_sent_at = pg_catalog.now()
     WHERE q.status = 'sent'
       AND q.reminder_sent_at IS NULL
       AND q.valid_until = (pg_catalog.now() AT TIME ZONE 'America/Sao_Paulo')::date + 1
    RETURNING q.id, q.user_id, q.number, q.client_name, q.valid_until
  )
  SELECT COALESCE(
    pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
      'quoteId', due.id,
      'number', due.number,
      'clientName', due.client_name,
      'validUntil', due.valid_until,
      'accountEmail', u.email,
      'emailNotifications', p.email_notifications,
      'pushSubscriptions', COALESCE(
        (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                  'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
           FROM public.push_subscriptions s
          WHERE s.user_id = due.user_id),
        '[]'::jsonb
      )
    )),
    '[]'::jsonb
  )
    FROM due
    JOIN auth."user" u ON u.id = due.user_id
    JOIN public.profiles p ON p.id = due.user_id;
$$;
--> statement-breakpoint
-- Só a rota do agendamento chama (protegida pela CRON_SECRET), pela app_user.
GRANT EXECUTE ON FUNCTION app.claim_due_reminders() TO app_user;
