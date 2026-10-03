CREATE TABLE "clients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"document" text,
	"address" text,
	"internal_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "clients_name_length" CHECK (char_length("clients"."name") between 1 and 120),
	CONSTRAINT "clients_email_length" CHECK (char_length("clients"."email") <= 254),
	CONSTRAINT "clients_phone_length" CHECK (char_length("clients"."phone") <= 20),
	CONSTRAINT "clients_document_format" CHECK ("clients"."document" ~ '^([0-9]{11}|[0-9A-Z]{12}[0-9]{2})$'),
	CONSTRAINT "clients_address_length" CHECK (char_length("clients"."address") <= 300),
	CONSTRAINT "clients_internal_notes_length" CHECK (char_length("clients"."internal_notes") <= 2000)
);
--> statement-breakpoint
ALTER TABLE "clients" ADD CONSTRAINT "clients_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "clients_user_id_name_idx" ON "clients" USING btree ("user_id","name");
--> statement-breakpoint

-- Daqui para baixo, escrito à mão (NBB-44): permissões, RLS, updated_at e o limite de clientes.

-- Permissões: a app_user cria, lê e apaga (as permissões automáticas da 0000). No update, só as
-- colunas que a pessoa edita: o id, o dono e as datas ficam fora do alcance do app.
REVOKE UPDATE ON TABLE public.clients FROM app_user;
--> statement-breakpoint
GRANT UPDATE (name, email, phone, document, address, internal_notes)
  ON TABLE public.clients TO app_user;
--> statement-breakpoint

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.clients FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY clients_own ON public.clients FOR ALL TO app_user
  USING (user_id = app.current_user_id())
  WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint

CREATE TRIGGER clients_set_updated_at BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
--> statement-breakpoint

-- Limite de 1.000 clientes por conta (RN-38, NBB-44 K3-B), garantido pelo banco. Antes de contar,
-- trava a linha do perfil da pessoa (K8-A): dois cadastros ao mesmo tempo entram em fila, e o
-- segundo já conta o primeiro. O app traduz o código OR001 na mensagem da tela
-- (src/features/clients/clients.ts). O número 1000 é o mesmo de MAX_CLIENTS_PER_USER.
CREATE FUNCTION app.enforce_client_limit() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
BEGIN
  PERFORM 1 FROM public.profiles WHERE id = NEW.user_id FOR UPDATE;
  IF (SELECT pg_catalog.count(*) FROM public.clients WHERE user_id = NEW.user_id) >= 1000 THEN
    RAISE EXCEPTION 'Limite de 1000 clientes atingido.' USING ERRCODE = 'OR001';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER clients_enforce_limit BEFORE INSERT ON public.clients
  FOR EACH ROW EXECUTE FUNCTION app.enforce_client_limit();