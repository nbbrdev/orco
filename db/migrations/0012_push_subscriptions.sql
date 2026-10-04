CREATE TABLE "push_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint"),
	CONSTRAINT "push_subscriptions_endpoint_format" CHECK ("push_subscriptions"."endpoint" ~ '^https://' and char_length("push_subscriptions"."endpoint") <= 1000),
	CONSTRAINT "push_subscriptions_keys_length" CHECK (char_length("push_subscriptions"."p256dh") <= 200 and char_length("push_subscriptions"."auth") <= 200),
	CONSTRAINT "push_subscriptions_user_agent_length" CHECK (char_length("push_subscriptions"."user_agent") <= 500)
);
--> statement-breakpoint
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions" USING btree ("user_id");
--> statement-breakpoint

-- Daqui para baixo, escrito à mão (NBB-61): permissões, RLS e as funções do push (RN-45, P3-A, P4-A).

-- Permissões: a app_user lê e apaga as assinaturas da própria conta. Gravar é pela função
-- app.save_push_subscription (abaixo), e ninguém altera uma assinatura depois de gravada.
REVOKE INSERT, UPDATE ON TABLE public.push_subscriptions FROM app_user;
--> statement-breakpoint

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.push_subscriptions FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY push_subscriptions_own ON public.push_subscriptions FOR ALL TO app_user
  USING (user_id = app.current_user_id())
  WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
-- A dona grava (save), entrega as assinaturas no aviso da resposta e apaga as vencidas (funções abaixo).
CREATE POLICY push_subscriptions_by_owner ON public.push_subscriptions FOR ALL TO orco_owner
  USING (true)
  WITH CHECK (true);
--> statement-breakpoint

-- 1. Gravar a assinatura deste aparelho na conta logada (withUserDb). O endereço é único: se o mesmo
-- navegador já estava em outra conta (trocou de login), a assinatura passa para a conta atual, que é
-- quem está com o aparelho. A RLS não deixaria a app_user mexer na linha da outra conta, por isso a
-- função é SECURITY DEFINER.
CREATE FUNCTION app.save_push_subscription(
  endpoint text,
  p256dh text,
  auth text,
  user_agent text
) RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  owner_id constant uuid := app.current_user_id();
BEGIN
  IF owner_id IS NULL THEN
    RAISE EXCEPTION 'Sem conta na transação.' USING ERRCODE = '42501';
  END IF;
  INSERT INTO public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  VALUES (owner_id, endpoint, p256dh, auth, pg_catalog.left(user_agent, 500))
  ON CONFLICT ON CONSTRAINT push_subscriptions_endpoint_unique DO UPDATE
     SET user_id = EXCLUDED.user_id,
         p256dh = EXCLUDED.p256dh,
         auth = EXCLUDED.auth,
         user_agent = EXCLUDED.user_agent,
         created_at = pg_catalog.now();
END;
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.save_push_subscription(text, text, text, text) TO app_user;
--> statement-breakpoint

-- 2. Apagar uma assinatura vencida (o serviço de push respondeu 404 ou 410), sem a sessão do dono:
-- acontece durante a resposta do cliente (P3-A). Só o endereço exato, que é longo e secreto.
CREATE FUNCTION app.delete_push_subscription(endpoint text) RETURNS void
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = ''
AS $$
  DELETE FROM public.push_subscriptions s WHERE s.endpoint = delete_push_subscription.endpoint;
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.delete_push_subscription(text) TO app_user;
--> statement-breakpoint

-- 3. O aviso da resposta (0011) passa a levar também as assinaturas da conta (P3-A). Mesmo tipo de
-- retorno, então basta substituir a função. O resto é igual ao da 0011.
CREATE OR REPLACE FUNCTION app.respond_to_quote(
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

  -- O aviso ao freelancer (RN-40, RN-41, RN-45): o e-mail da conta, a preferência do perfil e as
  -- assinaturas de push dos aparelhos.
  SELECT pg_catalog.jsonb_build_object(
           'quoteId', target.id,
           'number', target.number,
           'clientName', target.client_name,
           'accountEmail', u.email,
           'emailNotifications', p.email_notifications,
           'pushSubscriptions', COALESCE(
             (SELECT pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                       'endpoint', s.endpoint, 'p256dh', s.p256dh, 'auth', s.auth))
                FROM public.push_subscriptions s
               WHERE s.user_id = target.user_id),
             '[]'::jsonb
           )
         )
    INTO notice
    FROM auth."user" u
    JOIN public.profiles p ON p.id = u.id
   WHERE u.id = target.user_id;

  RETURN pg_catalog.jsonb_build_object('result', 'ok', 'notice', notice);
END;
$$;