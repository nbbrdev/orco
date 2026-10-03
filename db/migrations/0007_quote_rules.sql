ALTER TABLE "profiles" ADD COLUMN "quotes_month" date;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "quotes_month_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_quotes_month_count_positive" CHECK ("profiles"."quotes_month_count" >= 0);
--> statement-breakpoint

-- Daqui para baixo, escrito à mão (NBB-46, PR 2): as regras dos orçamentos no banco.
--   - limite de 200 orçamentos criados por mês (RN-38, Q7-A);
--   - transições de status (RN-22 a RN-27, Q3-A) e a conferência do envio (RN-13);
--   - versão uma vez por transação (RN-24, Q4-A);
--   - trava do orçamento respondido (RN-25, Q5-A);
--   - limite de 100 itens por orçamento (RN-14, Q8-A).
-- Códigos de erro próprios (src/lib/db/errors.ts): OR003 a OR007.

-- A dona (orco_owner) lê e altera orçamentos: é quem roda a função de versão dos itens (abaixo) e as
-- funções públicas da M6 (aprovar/recusar).
CREATE POLICY quotes_select_by_owner ON public.quotes FOR SELECT TO orco_owner
  USING (true);
--> statement-breakpoint
CREATE POLICY quotes_update_by_owner ON public.quotes FOR UPDATE TO orco_owner
  USING (true)
  WITH CHECK (true);
--> statement-breakpoint

-- O app passa a mexer no status (com as regras abaixo) e marca quando viu a resposta (RN-42). O
-- sent_at e o responded_at ficam com o banco: o trigger preenche na mudança de status.
GRANT UPDATE (status, response_seen_at) ON TABLE public.quotes TO app_user;
--> statement-breakpoint

-- 1. Limite de 200 orçamentos criados por mês (RN-38, Q7-A). A numeração já trava a linha do perfil;
-- o mesmo update conta o mês (fuso de São Paulo). Excluir um orçamento não devolve a vaga. Se passar
-- do limite, o erro desfaz tudo, inclusive o número.
CREATE OR REPLACE FUNCTION app.prepare_new_quote() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  this_month constant date :=
    pg_catalog.date_trunc('month', pg_catalog.now() AT TIME ZONE 'America/Sao_Paulo')::date;
  assigned integer;
  month_count integer;
BEGIN
  IF NEW.user_id IS DISTINCT FROM app.current_user_id() THEN
    RAISE EXCEPTION 'O orçamento precisa ser da conta da transação.' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles
     SET next_quote_number = next_quote_number + 1,
         quotes_month = this_month,
         quotes_month_count = CASE WHEN quotes_month = this_month THEN quotes_month_count + 1 ELSE 1 END
   WHERE id = NEW.user_id
  RETURNING next_quote_number - 1, quotes_month_count INTO assigned, month_count;
  IF assigned IS NULL THEN
    RAISE EXCEPTION 'Perfil não encontrado para a conta.';
  END IF;
  IF month_count > 200 THEN
    RAISE EXCEPTION 'Limite de 200 orçamentos no mês atingido.' USING ERRCODE = 'OR003';
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

-- 2. Alterações de um orçamento (BEFORE UPDATE). "Conteúdo" é o que o cliente vê: tudo menos as
-- colunas da lista `untracked` (anotações internas, datas, contagem, versão e o próprio status).
CREATE FUNCTION app.check_quote_update() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
DECLARE
  untracked constant text[] := ARRAY[
    'internal_notes', 'response_seen_at', 'updated_at', 'view_count', 'first_viewed_at',
    'reminder_sent_at', 'version', 'sent_at', 'responded_at', 'status'
  ];
  content_changed constant boolean :=
    (pg_catalog.to_jsonb(NEW) - untracked) IS DISTINCT FROM (pg_catalog.to_jsonb(OLD) - untracked);
  item_count integer;
  incomplete integer;
  row_xmin xid;
BEGIN
  -- Trava (RN-25, Q5-A): respondido, só as anotações internas (RN-20a), o "visto" (RN-42) e a
  -- contagem de visualizações da M6 (RN-35) mudam. A resposta é definitiva (RN-32).
  IF OLD.status IN ('approved', 'rejected') THEN
    IF content_changed OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.version IS DISTINCT FROM OLD.version THEN
      RAISE EXCEPTION 'Orçamento respondido: só as anotações internas podem mudar.'
        USING ERRCODE = 'OR006';
    END IF;
    RETURN NEW;
  END IF;

  -- Transições (Q3-A). Expirado não é guardado: é enviado com a validade vencida (RN-26).
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF OLD.status = 'draft' AND NEW.status = 'sent' THEN
      -- RN-13: ao menos 1 item, todos com descrição e valor (a quantidade > 0 já é um check).
      SELECT pg_catalog.count(*),
             pg_catalog.count(*) FILTER (
               WHERE pg_catalog.btrim(description) = '' OR unit_price_cents IS NULL
             )
        INTO item_count, incomplete
        FROM public.quote_items
       WHERE quote_id = NEW.id;
      IF item_count = 0 OR incomplete > 0 THEN
        RAISE EXCEPTION 'Para enviar, o orçamento precisa de ao menos 1 item, todos com descrição e valor.'
          USING ERRCODE = 'OR007';
      END IF;
      NEW.sent_at := pg_catalog.now();
    ELSIF OLD.status = 'sent' AND NEW.status IN ('approved', 'rejected')
          AND CURRENT_USER <> 'app_user' THEN
      -- Só as funções da M6 (donas: orco_owner), chamadas pela página do cliente. O freelancer
      -- nunca aprova o próprio orçamento.
      NEW.responded_at := pg_catalog.now();
    ELSE
      RAISE EXCEPTION 'Mudança de status não permitida: % → %.', OLD.status, NEW.status
        USING ERRCODE = 'OR005';
    END IF;
  END IF;

  -- Prorrogar a validade libera um novo lembrete de vencimento (RN-43).
  IF NEW.valid_until IS DISTINCT FROM OLD.valid_until THEN
    NEW.reminder_sent_at := NULL;
  END IF;

  -- Versão (RN-24, Q4-A): editar o conteúdo de um orçamento enviado sobe a versão, uma vez por
  -- transação (um "salvar" do editor mexe em várias linhas). Se a linha já foi alterada nesta
  -- transação, o xmin dela é o id da transação atual, e a versão já subiu.
  IF OLD.status = 'sent' AND NEW.status = 'sent' AND content_changed THEN
    SELECT xmin INTO row_xmin FROM public.quotes WHERE id = OLD.id;
    IF row_xmin IS DISTINCT FROM pg_catalog.pg_current_xact_id()::xid THEN
      NEW.version := OLD.version + 1;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER quotes_check_update BEFORE UPDATE ON public.quotes
  FOR EACH ROW EXECUTE FUNCTION app.check_quote_update();
--> statement-breakpoint

-- 3. Itens (BEFORE INSERT/UPDATE/DELETE): trava do orçamento respondido (RN-25) e limite de 100 itens
-- (RN-14, Q8-A). Trava a linha do orçamento antes de contar, para dois itens ao mesmo tempo entrarem
-- em fila (o mesmo padrão dos limites da M3).
CREATE FUNCTION app.check_quote_item_change() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
DECLARE
  parent_status public.quote_status;
  item_count integer;
BEGIN
  SELECT status INTO parent_status
    FROM public.quotes
   WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.quote_id ELSE NEW.quote_id END
     FOR UPDATE;

  -- Orçamento não encontrado: é a cascata de quem está sendo excluído (RN-29, RN-06). A FK cuida do
  -- resto.
  IF NOT FOUND THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  -- A trava vale para o app. As cascatas (exclusão da conta, RN-06) rodam como a dona da tabela e
  -- podem apagar os itens antes do orçamento: elas passam.
  IF parent_status IN ('approved', 'rejected') AND CURRENT_USER = 'app_user' THEN
    RAISE EXCEPTION 'Orçamento respondido: só as anotações internas podem mudar.'
      USING ERRCODE = 'OR006';
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT pg_catalog.count(*) INTO item_count FROM public.quote_items WHERE quote_id = NEW.quote_id;
    IF item_count >= 100 THEN
      RAISE EXCEPTION 'Limite de 100 itens por orçamento atingido.' USING ERRCODE = 'OR004';
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER quote_items_check_change BEFORE INSERT OR UPDATE OR DELETE ON public.quote_items
  FOR EACH ROW EXECUTE FUNCTION app.check_quote_item_change();
--> statement-breakpoint

-- 4. Versão pelos itens (RN-24, Q4-A): mexer num item de um orçamento enviado também é editar o
-- conteúdo. Sobe a versão do orçamento, uma vez por transação (mesma regra do xmin). SECURITY
-- DEFINER: a app_user não pode alterar a coluna version.
CREATE FUNCTION app.bump_quote_version_from_item() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
BEGIN
  UPDATE public.quotes
     SET version = version + 1
   WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.quote_id ELSE NEW.quote_id END
     AND user_id = app.current_user_id()
     AND status = 'sent'
     AND xmin <> pg_catalog.pg_current_xact_id()::xid;
  RETURN NULL;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER quote_items_bump_version AFTER INSERT OR UPDATE OR DELETE ON public.quote_items
  FOR EACH ROW EXECUTE FUNCTION app.bump_quote_version_from_item();
