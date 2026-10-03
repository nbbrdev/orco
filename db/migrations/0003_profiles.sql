CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text,
	"business_name" text,
	"document" text,
	"phone" text,
	"contact_email" text,
	"logo_path" text,
	"website" text,
	"instagram" text,
	"payment_info" text,
	"default_validity_days" integer DEFAULT 15 NOT NULL,
	"default_notes" text,
	"default_payment_terms" text,
	"default_delivery_time" text,
	"next_quote_number" integer DEFAULT 1 NOT NULL,
	"email_notifications" boolean DEFAULT true NOT NULL,
	"push_prompted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_display_name_length" CHECK (char_length("profiles"."display_name") <= 80),
	CONSTRAINT "profiles_business_name_length" CHECK (char_length("profiles"."business_name") <= 120),
	CONSTRAINT "profiles_document_format" CHECK ("profiles"."document" ~ '^([0-9]{11}|[0-9A-Z]{12}[0-9]{2})$'),
	CONSTRAINT "profiles_phone_length" CHECK (char_length("profiles"."phone") <= 20),
	CONSTRAINT "profiles_contact_email_length" CHECK (char_length("profiles"."contact_email") <= 254),
	CONSTRAINT "profiles_website_format" CHECK ("profiles"."website" ~ '^https?://' and char_length("profiles"."website") <= 200),
	CONSTRAINT "profiles_instagram_length" CHECK (char_length("profiles"."instagram") <= 60),
	CONSTRAINT "profiles_payment_info_length" CHECK (char_length("profiles"."payment_info") <= 500),
	CONSTRAINT "profiles_default_validity_days_range" CHECK ("profiles"."default_validity_days" between 1 and 365),
	CONSTRAINT "profiles_default_notes_length" CHECK (char_length("profiles"."default_notes") <= 2000),
	CONSTRAINT "profiles_default_payment_terms_length" CHECK (char_length("profiles"."default_payment_terms") <= 500),
	CONSTRAINT "profiles_default_delivery_time_length" CHECK (char_length("profiles"."default_delivery_time") <= 500),
	CONSTRAINT "profiles_next_quote_number_positive" CHECK ("profiles"."next_quote_number" >= 1)
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_id_user_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint

-- Daqui para baixo, escrito à mão (NBB-42): permissões, RLS, triggers e a criação dos perfis das
-- contas que já existem.

-- Permissões: a app_user só lê e altera o próprio perfil. Não insere (o trigger cria) nem apaga (a
-- cascata apaga com a conta). No update, só as colunas que a pessoa edita: o id, o contador de
-- orçamentos (RN-12: números nunca reutilizados) e as datas ficam fora do alcance do app.
REVOKE ALL ON TABLE public.profiles FROM app_user;
--> statement-breakpoint
GRANT SELECT ON TABLE public.profiles TO app_user;
--> statement-breakpoint
GRANT UPDATE (
  display_name, business_name, document, phone, contact_email, logo_path, website, instagram,
  payment_info, default_validity_days, default_notes, default_payment_terms, default_delivery_time,
  email_notifications, push_prompted_at
) ON TABLE public.profiles TO app_user;
--> statement-breakpoint

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.profiles FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO app_user
  USING (id = app.current_user_id());
--> statement-breakpoint
CREATE POLICY profiles_update_own ON public.profiles FOR UPDATE TO app_user
  USING (id = app.current_user_id())
  WITH CHECK (id = app.current_user_id());
--> statement-breakpoint
-- A dona (orco_owner) só insere: é quem roda o trigger abaixo e o backfill desta migration.
CREATE POLICY profiles_insert_by_owner ON public.profiles FOR INSERT TO orco_owner
  WITH CHECK (true);
--> statement-breakpoint

-- updated_at mantido pelo banco (convenção do docs/05), reaproveitado pelas próximas tabelas.
CREATE FUNCTION app.set_updated_at() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := pg_catalog.now();
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
--> statement-breakpoint

-- Toda conta nova ganha um perfil vazio na mesma transação do cadastro (por e-mail ou Google, D1).
-- SECURITY DEFINER: roda como a orco_owner, porque a app_auth (que cria o usuário) não alcança
-- public.profiles.
CREATE FUNCTION app.handle_new_user() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER user_create_profile AFTER INSERT ON auth."user"
  FOR EACH ROW EXECUTE FUNCTION app.handle_new_user();
--> statement-breakpoint

-- Contas criadas antes desta migration (staging e produção) ganham o perfil agora.
INSERT INTO public.profiles (id) SELECT id FROM auth."user";