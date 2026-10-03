-- Lista de orçamentos (NBB-48, F-09). Escrita à mão (migration custom do drizzle-kit):
--   - índice da ordem por última atividade (L2-A);
--   - busca pelo nome do cliente sem acentos (L5-A), com a extensão unaccent;
--   - o updated_at de quotes deixa de mudar quando só mudam os campos de acompanhamento.

CREATE INDEX "quotes_user_id_updated_at_idx" ON "quotes" USING btree ("user_id","updated_at" DESC NULLS LAST);
--> statement-breakpoint

-- 1. Busca sem acentos nem maiúsculas (L5-A), igual à busca de clientes no navegador
-- (src/lib/search.ts). A unaccent fica no schema extensions, que o app não alcança (como a pgcrypto,
-- 0006); a app_user usa só esta função.
CREATE EXTENSION unaccent WITH SCHEMA extensions;
--> statement-breakpoint
-- SECURITY DEFINER: roda como a orco_owner, que alcança o schema extensions.
CREATE FUNCTION app.normalize_search(value text) RETURNS text
  LANGUAGE sql
  STABLE
  SECURITY DEFINER
  SET search_path = ''
AS $$
  SELECT pg_catalog.lower(extensions.unaccent('extensions.unaccent'::regdictionary, value));
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.normalize_search(text) TO app_user;
--> statement-breakpoint

-- 2. "Última atividade" (L2-A). A lista ordena pelo updated_at, então marcar a resposta como vista
-- (RN-42, L4-A) e, na M6, registrar visualizações (RN-35) e lembretes (RN-43) não podem mexer nele:
-- senão a lista se reordena sem ninguém ter editado nada. Qualquer outra mudança, inclusive um
-- salvamento que só mexeu nos itens (e regrava os totais iguais), conta como atividade.
CREATE FUNCTION app.set_quote_updated_at() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
DECLARE
  tracking constant text[] := ARRAY['view_count', 'first_viewed_at', 'response_seen_at', 'reminder_sent_at'];
  old_row jsonb := pg_catalog.to_jsonb(OLD) - 'updated_at';
  new_row jsonb := pg_catalog.to_jsonb(NEW) - 'updated_at';
BEGIN
  IF new_row IS DISTINCT FROM old_row AND (new_row - tracking) = (old_row - tracking) THEN
    NEW.updated_at := OLD.updated_at;
  ELSE
    NEW.updated_at := pg_catalog.now();
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DROP TRIGGER quotes_set_updated_at ON public.quotes;
--> statement-breakpoint
CREATE TRIGGER quotes_set_updated_at BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION app.set_quote_updated_at();
