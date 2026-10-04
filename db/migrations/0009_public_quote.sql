CREATE TYPE "public"."quote_event_type" AS ENUM('viewed', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."reject_reason" AS ENUM('price', 'deadline', 'gave_up', 'other');--> statement-breakpoint
CREATE TABLE "quote_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quote_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "quote_event_type" NOT NULL,
	"quote_version" integer NOT NULL,
	"ip" "inet",
	"user_agent" text,
	"respondent_name" text,
	"reason_code" "reject_reason",
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_events_version_positive" CHECK ("quote_events"."quote_version" >= 1),
	CONSTRAINT "quote_events_user_agent_length" CHECK (char_length("quote_events"."user_agent") <= 500),
	CONSTRAINT "quote_events_respondent_name_length" CHECK (char_length("quote_events"."respondent_name") <= 120),
	CONSTRAINT "quote_events_reason_length" CHECK (char_length("quote_events"."reason") <= 1000)
);
--> statement-breakpoint
ALTER TABLE "quote_events" ADD CONSTRAINT "quote_events_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_events" ADD CONSTRAINT "quote_events_quote_id_user_id_fk" FOREIGN KEY ("quote_id","user_id") REFERENCES "public"."quotes"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quote_events_quote_id_created_at_idx" ON "quote_events" USING btree ("quote_id","created_at");--> statement-breakpoint
CREATE INDEX "quote_events_created_at_idx" ON "quote_events" USING btree ("created_at");
--> statement-breakpoint

-- Daqui para baixo, escrito à mão (NBB-52, PR 1): o acesso público por token (ADR-0005, ADR-0014).
-- O cliente final não tem conta: o servidor chama estas funções `SECURITY DEFINER` (donas: orco_owner,
-- EXECUTE só para a app_user), que devolvem só o mínimo. O banco não tem porta pública.

-- 1. Eventos: só as funções escrevem. A app_user lê os eventos dos próprios orçamentos, sem o IP
-- (D8-A): o IP é dado pessoal do cliente final e fica só para o administrador.
REVOKE ALL ON TABLE public.quote_events FROM app_user;
--> statement-breakpoint
GRANT SELECT (
  id, quote_id, user_id, type, quote_version, user_agent, respondent_name, reason_code, reason,
  created_at
) ON TABLE public.quote_events TO app_user;
--> statement-breakpoint
ALTER TABLE public.quote_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.quote_events FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY quote_events_select_own ON public.quote_events FOR SELECT TO app_user
  USING (user_id = app.current_user_id());
--> statement-breakpoint
-- A dona grava os eventos (funções abaixo) e, no PR 2, apaga os IPs antigos (RN-37).
CREATE POLICY quote_events_by_owner ON public.quote_events FOR ALL TO orco_owner
  USING (true)
  WITH CHECK (true);
--> statement-breakpoint
-- Com FORCE RLS, nem a dona lê os itens sem uma policy: a leitura pública precisa deles.
CREATE POLICY quote_items_select_by_owner ON public.quote_items FOR SELECT TO orco_owner
  USING (true);
--> statement-breakpoint

-- 2. Leitura pública (D2-A, D4-A, RN-31): o orçamento do token, num único JSON, só se estiver enviado,
-- aprovado ou recusado ("expirado" é um enviado vencido, RN-26). Rascunho, excluído ou token inválido
-- devolvem nulo, sem distinção. Só lê: nunca registra visualização.
-- Sai só o que o cliente vê: nada de ids, user_id, e-mail da conta (D3-B), anotações internas,
-- contagem de visualizações ou token. Os totais são recalculados no servidor, pelo money.ts.
CREATE FUNCTION app.get_public_quote(token text) RETURNS jsonb
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT pg_catalog.jsonb_build_object(
    'number', q.number,
    'status', q.status,
    'version', q.version,
    'validUntil', q.valid_until,
    'sentAt', q.sent_at,
    'respondedAt', q.responded_at,
    'client', CASE WHEN q.client_name IS NULL THEN NULL ELSE pg_catalog.jsonb_build_object(
      'name', q.client_name,
      'email', q.client_email,
      'phone', q.client_phone,
      'document', q.client_document,
      'address', q.client_address
    ) END,
    'discountType', q.discount_type,
    'discountValue', q.discount_value,
    'paymentTerms', q.payment_terms,
    'deliveryTime', q.delivery_time,
    'notes', q.notes,
    'items', COALESCE((
      SELECT pg_catalog.jsonb_agg(
        pg_catalog.jsonb_build_object(
          'description', i.description,
          'quantity', i.quantity::text,
          'unit', i.unit,
          'unitPriceCents', i.unit_price_cents,
          'discountType', i.discount_type,
          'discountValue', i.discount_value
        ) ORDER BY i.position, i.created_at
      )
      FROM public.quote_items i
      WHERE i.quote_id = q.id
    ), '[]'::jsonb),
    'issuer', pg_catalog.jsonb_build_object(
      'businessName', p.business_name,
      'displayName', p.display_name,
      'phone', p.phone,
      'contactEmail', p.contact_email,
      'website', p.website,
      'instagram', p.instagram,
      'document', p.document,
      'paymentInfo', p.payment_info,
      'logoPath', p.logo_path
    )
  )
  FROM public.quotes q
  JOIN public.profiles p ON p.id = q.user_id
  WHERE q.public_token = token
    AND q.status IN ('sent', 'approved', 'rejected');
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.get_public_quote(text) TO app_user;
--> statement-breakpoint

-- 3. Visualização (RN-35, D2-A): cada abertura conta mais uma; a primeira registra o evento "viewed"
-- com IP e navegador. Quem decide se conta (não é robô de pré-visualização nem o dono logado) é a
-- página. Não muda o updated_at nem a versão (migration 0008 e a trava da 0007 já ignoram essas
-- colunas). Devolve `true` só na primeira visualização (para o aviso ao freelancer, NBB-61).
CREATE FUNCTION app.register_quote_view(token text, ip inet, user_agent text) RETURNS boolean
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  target record;
BEGIN
  -- Trava a linha: duas aberturas ao mesmo tempo contam as duas, e só uma é a "primeira".
  SELECT id, user_id, version, first_viewed_at
    INTO target
    FROM public.quotes
   WHERE public_token = token
     AND status IN ('sent', 'approved', 'rejected')
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  UPDATE public.quotes
     SET view_count = view_count + 1,
         first_viewed_at = COALESCE(first_viewed_at, pg_catalog.now())
   WHERE id = target.id;

  IF target.first_viewed_at IS NOT NULL THEN
    RETURN false;
  END IF;
  INSERT INTO public.quote_events (quote_id, user_id, type, quote_version, ip, user_agent)
  VALUES (target.id, target.user_id, 'viewed', target.version, ip, pg_catalog.left(user_agent, 500));
  RETURN true;
END;
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.register_quote_view(text, inet, text) TO app_user;