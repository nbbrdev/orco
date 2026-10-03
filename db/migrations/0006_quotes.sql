-- Orçamentos e itens (NBB-46, PR 1). Gerada pelo drizzle-kit e ajustada à mão:
--   - o token público e a extensão pgcrypto vêm antes das tabelas (o default de quotes usa a função);
--   - os UNIQUE (id, user_id) de clients e catalog_items vêm antes das FKs compostas que os usam;
--   - no fim, escrito à mão: a FK do catálogo, permissões, RLS, updated_at e a numeração.

-- Token público (RN-30, Q6-A): 32 bytes aleatórios (256 bits) em base64url, 43 caracteres. A extensão
-- fica num schema só dela, sem acesso para o app; quem a usa é a função abaixo.
CREATE SCHEMA extensions;
--> statement-breakpoint
CREATE EXTENSION pgcrypto WITH SCHEMA extensions;
--> statement-breakpoint
-- SECURITY DEFINER: roda como a orco_owner, porque a app_user não alcança o schema extensions.
CREATE FUNCTION app.generate_public_token() RETURNS text
  LANGUAGE sql
  VOLATILE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT pg_catalog.rtrim(
    pg_catalog.translate(pg_catalog.encode(extensions.gen_random_bytes(32), 'base64'), '+/', '-_'),
    '='
  )
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.generate_public_token() TO app_user;
--> statement-breakpoint

CREATE TYPE "public"."discount_type" AS ENUM('percent', 'amount');--> statement-breakpoint
CREATE TYPE "public"."quote_status" AS ENUM('draft', 'sent', 'approved', 'rejected');--> statement-breakpoint
CREATE TABLE "quote_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"quote_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"catalog_item_id" uuid,
	"description" text DEFAULT '' NOT NULL,
	"unit" text,
	"quantity" numeric(12, 3) DEFAULT '1' NOT NULL,
	"unit_price_cents" bigint,
	"gross_cents" bigint DEFAULT 0 NOT NULL,
	"discount_type" "discount_type",
	"discount_value" bigint DEFAULT 0 NOT NULL,
	"discount_cents" bigint DEFAULT 0 NOT NULL,
	"line_total_cents" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quote_items_position_positive" CHECK ("quote_items"."position" >= 0),
	CONSTRAINT "quote_items_description_length" CHECK (char_length("quote_items"."description") <= 500),
	CONSTRAINT "quote_items_unit_length" CHECK (char_length("quote_items"."unit") <= 10),
	CONSTRAINT "quote_items_quantity_positive" CHECK ("quote_items"."quantity" > 0),
	CONSTRAINT "quote_items_unit_price_range" CHECK ("quote_items"."unit_price_cents" between 0 and 999999999),
	CONSTRAINT "quote_items_discount" CHECK (("quote_items"."discount_type" is null and "quote_items"."discount_value" = 0) or ("quote_items"."discount_type" = 'percent' and "quote_items"."discount_value" between 0 and 10000) or ("quote_items"."discount_type" = 'amount' and "quote_items"."discount_value" >= 0)),
	CONSTRAINT "quote_items_totals" CHECK ("quote_items"."gross_cents" >= 0 and "quote_items"."discount_cents" between 0 and "quote_items"."gross_cents" and "quote_items"."line_total_cents" = "quote_items"."gross_cents" - "quote_items"."discount_cents")
);
--> statement-breakpoint
CREATE TABLE "quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"number" integer NOT NULL,
	"status" "quote_status" DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"client_id" uuid,
	"client_name" text,
	"client_email" text,
	"client_phone" text,
	"client_document" text,
	"client_address" text,
	"discount_type" "discount_type",
	"discount_value" bigint DEFAULT 0 NOT NULL,
	"subtotal_cents" bigint DEFAULT 0 NOT NULL,
	"discount_cents" bigint DEFAULT 0 NOT NULL,
	"total_cents" bigint DEFAULT 0 NOT NULL,
	"valid_until" date NOT NULL,
	"payment_terms" text,
	"delivery_time" text,
	"notes" text,
	"internal_notes" text,
	"public_token" text DEFAULT app.generate_public_token() NOT NULL,
	"sent_at" timestamp with time zone,
	"responded_at" timestamp with time zone,
	"first_viewed_at" timestamp with time zone,
	"response_seen_at" timestamp with time zone,
	"reminder_sent_at" timestamp with time zone,
	"view_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "quotes_user_id_number_key" UNIQUE("user_id","number"),
	CONSTRAINT "quotes_public_token_key" UNIQUE("public_token"),
	CONSTRAINT "quotes_id_user_id_key" UNIQUE("id","user_id"),
	CONSTRAINT "quotes_number_positive" CHECK ("quotes"."number" >= 1),
	CONSTRAINT "quotes_version_positive" CHECK ("quotes"."version" >= 1),
	CONSTRAINT "quotes_client_name_length" CHECK (char_length("quotes"."client_name") <= 120),
	CONSTRAINT "quotes_client_email_length" CHECK (char_length("quotes"."client_email") <= 254),
	CONSTRAINT "quotes_client_phone_length" CHECK (char_length("quotes"."client_phone") <= 20),
	CONSTRAINT "quotes_client_document_format" CHECK ("quotes"."client_document" ~ '^([0-9]{11}|[0-9A-Z]{12}[0-9]{2})$'),
	CONSTRAINT "quotes_client_address_length" CHECK (char_length("quotes"."client_address") <= 300),
	CONSTRAINT "quotes_discount" CHECK (("quotes"."discount_type" is null and "quotes"."discount_value" = 0) or ("quotes"."discount_type" = 'percent' and "quotes"."discount_value" between 0 and 10000) or ("quotes"."discount_type" = 'amount' and "quotes"."discount_value" >= 0)),
	CONSTRAINT "quotes_totals" CHECK ("quotes"."subtotal_cents" >= 0 and "quotes"."discount_cents" between 0 and "quotes"."subtotal_cents" and "quotes"."total_cents" = "quotes"."subtotal_cents" - "quotes"."discount_cents"),
	CONSTRAINT "quotes_payment_terms_length" CHECK (char_length("quotes"."payment_terms") <= 500),
	CONSTRAINT "quotes_delivery_time_length" CHECK (char_length("quotes"."delivery_time") <= 500),
	CONSTRAINT "quotes_notes_length" CHECK (char_length("quotes"."notes") <= 2000),
	CONSTRAINT "quotes_internal_notes_length" CHECK (char_length("quotes"."internal_notes") <= 2000),
	CONSTRAINT "quotes_public_token_format" CHECK ("quotes"."public_token" ~ '^[A-Za-z0-9_-]{43}$'),
	CONSTRAINT "quotes_view_count_positive" CHECK ("quotes"."view_count" >= 0)
);
--> statement-breakpoint
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_id_user_id_key" UNIQUE("id","user_id");--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_id_user_id_key" UNIQUE("id","user_id");--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quote_items" ADD CONSTRAINT "quote_items_quote_id_user_id_fk" FOREIGN KEY ("quote_id","user_id") REFERENCES "public"."quotes"("id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quotes" ADD CONSTRAINT "quotes_client_id_user_id_fk" FOREIGN KEY ("client_id","user_id") REFERENCES "public"."clients"("id","user_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quote_items_quote_id_position_idx" ON "quote_items" USING btree ("quote_id","position");--> statement-breakpoint
CREATE INDEX "quote_items_catalog_item_id_idx" ON "quote_items" USING btree ("catalog_item_id");--> statement-breakpoint
CREATE INDEX "quotes_user_id_status_idx" ON "quotes" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "quotes_user_id_created_at_idx" ON "quotes" USING btree ("user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "quotes_client_id_idx" ON "quotes" USING btree ("client_id");--> statement-breakpoint

-- Daqui para baixo, escrito à mão (NBB-46, PR 1).

-- Origem no catálogo (RN-11): o item precisa ser da mesma conta. Excluir o item do catálogo não
-- altera o orçamento: só a coluna catalog_item_id vira nula (SET NULL com lista de colunas, PG15+),
-- e o user_id fica.
ALTER TABLE public.quote_items ADD CONSTRAINT quote_items_catalog_item_id_user_id_fk
  FOREIGN KEY (catalog_item_id, user_id) REFERENCES public.catalog_items (id, user_id)
  ON DELETE SET NULL (catalog_item_id);
--> statement-breakpoint

-- Permissões dos orçamentos: a app_user lê, cria e apaga (as permissões automáticas da 0000). O
-- insert continua liberado em todas as colunas, porque o Drizzle sempre lista todas (com DEFAULT nas
-- que o app não preenche); quem garante o número, o status inicial, a versão, o token e as datas da
-- M6 é o trigger app.prepare_new_quote, no fim deste arquivo. No update, só as colunas que o app
-- preenche: ficam de fora o id, o dono, o número, o token, a versão, as datas e o que só as funções
-- públicas da M6 mexem. O status, o sent_at e o response_seen_at entram no PR 2, junto com o trigger
-- de transições (Q3-A).
REVOKE UPDATE ON TABLE public.quotes FROM app_user;
--> statement-breakpoint
GRANT UPDATE (
  client_id, client_name, client_email, client_phone, client_document, client_address,
  discount_type, discount_value, subtotal_cents, discount_cents, total_cents, valid_until,
  payment_terms, delivery_time, notes, internal_notes
) ON TABLE public.quotes TO app_user;
--> statement-breakpoint

-- Permissões dos itens: o orçamento de um item e o dono não mudam depois de criado.
REVOKE UPDATE ON TABLE public.quote_items FROM app_user;
--> statement-breakpoint
GRANT UPDATE (
  position, catalog_item_id, description, unit, quantity, unit_price_cents, gross_cents,
  discount_type, discount_value, discount_cents, line_total_cents
) ON TABLE public.quote_items TO app_user;
--> statement-breakpoint

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.quotes FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY quotes_own ON public.quotes FOR ALL TO app_user
  USING (user_id = app.current_user_id())
  WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.quote_items FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY quote_items_own ON public.quote_items FOR ALL TO app_user
  USING (user_id = app.current_user_id())
  WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint

CREATE TRIGGER quotes_set_updated_at BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
--> statement-breakpoint
CREATE TRIGGER quote_items_set_updated_at BEFORE UPDATE ON public.quote_items
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
--> statement-breakpoint

-- Orçamento novo: numeração (RN-12, Q2-A) e valores iniciais.
--   - Nº 1, 2, 3… por conta, sem reaproveitar: trava a linha do perfil e incrementa o contador, então
--     dois orçamentos criados ao mesmo tempo nunca recebem o mesmo número.
--   - Todo orçamento nasce rascunho, na versão 1, com um token novo (RN-30) e sem as datas e a
--     contagem que só a M6 mexe, não importa o que o app mande.
-- SECURITY DEFINER: o contador fica fora do GRANT UPDATE da app_user (0003), de propósito. Por isso
-- a função confere que o orçamento é mesmo da conta da transação.
CREATE POLICY profiles_select_by_owner ON public.profiles FOR SELECT TO orco_owner
  USING (true);
--> statement-breakpoint
CREATE POLICY profiles_update_by_owner ON public.profiles FOR UPDATE TO orco_owner
  USING (true)
  WITH CHECK (true);
--> statement-breakpoint
CREATE FUNCTION app.prepare_new_quote() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  assigned integer;
BEGIN
  IF NEW.user_id IS DISTINCT FROM app.current_user_id() THEN
    RAISE EXCEPTION 'O orçamento precisa ser da conta da transação.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
     SET next_quote_number = next_quote_number + 1
   WHERE id = NEW.user_id
  RETURNING next_quote_number - 1 INTO assigned;
  IF assigned IS NULL THEN
    RAISE EXCEPTION 'Perfil não encontrado para a conta.';
  END IF;

  NEW.number := assigned;
  NEW.status := 'draft';
  NEW.version := 1;
  NEW.public_token := app.generate_public_token();
  NEW.sent_at := NULL;
  NEW.responded_at := NULL;
  NEW.first_viewed_at := NULL;
  NEW.response_seen_at := NULL;
  NEW.reminder_sent_at := NULL;
  NEW.view_count := 0;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER quotes_prepare_new BEFORE INSERT ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION app.prepare_new_quote();
