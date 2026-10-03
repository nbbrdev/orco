CREATE TABLE "catalog_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"unit" text,
	"unit_price_cents" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_items_name_length" CHECK (char_length("catalog_items"."name") between 1 and 200),
	CONSTRAINT "catalog_items_unit_length" CHECK (char_length("catalog_items"."unit") <= 10),
	CONSTRAINT "catalog_items_unit_price_range" CHECK ("catalog_items"."unit_price_cents" between 0 and 999999999)
);
--> statement-breakpoint
ALTER TABLE "catalog_items" ADD CONSTRAINT "catalog_items_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalog_items_user_id_name_idx" ON "catalog_items" USING btree ("user_id","name");
--> statement-breakpoint

-- Daqui para baixo, escrito à mão (NBB-45), no mesmo padrão dos clientes (0004): permissões, RLS,
-- updated_at e o limite de itens.

-- Permissões: a app_user cria, lê e apaga (as permissões automáticas da 0000). No update, só as
-- colunas que a pessoa edita: o id, o dono e as datas ficam fora do alcance do app.
REVOKE UPDATE ON TABLE public.catalog_items FROM app_user;
--> statement-breakpoint
GRANT UPDATE (name, unit, unit_price_cents) ON TABLE public.catalog_items TO app_user;
--> statement-breakpoint

ALTER TABLE public.catalog_items ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE public.catalog_items FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY catalog_items_own ON public.catalog_items FOR ALL TO app_user
  USING (user_id = app.current_user_id())
  WITH CHECK (user_id = app.current_user_id());
--> statement-breakpoint

CREATE TRIGGER catalog_items_set_updated_at BEFORE UPDATE ON public.catalog_items
  FOR EACH ROW EXECUTE FUNCTION app.set_updated_at();
--> statement-breakpoint

-- Limite de 500 itens por conta (RN-38, NBB-45 I1-A), como o dos clientes: trava a linha do perfil
-- da pessoa antes de contar, para dois cadastros ao mesmo tempo entrarem em fila. O app traduz o
-- código OR002 na mensagem da tela (src/features/catalog/catalog.ts). O número 500 é o mesmo de
-- MAX_CATALOG_ITEMS_PER_USER.
CREATE FUNCTION app.enforce_catalog_item_limit() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
BEGIN
  PERFORM 1 FROM public.profiles WHERE id = NEW.user_id FOR UPDATE;
  IF (SELECT pg_catalog.count(*) FROM public.catalog_items WHERE user_id = NEW.user_id) >= 500 THEN
    RAISE EXCEPTION 'Limite de 500 itens de catálogo atingido.' USING ERRCODE = 'OR002';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER catalog_items_enforce_limit BEFORE INSERT ON public.catalog_items
  FOR EACH ROW EXECUTE FUNCTION app.enforce_catalog_item_limit();