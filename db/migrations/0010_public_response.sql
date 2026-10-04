-- Escrita à mão (NBB-52, PR 2): a resposta do cliente, o novo link e a anonimização dos IPs (ADR-0005,
-- RN-32 a RN-37). Mesmo padrão da 0009: funções `SECURITY DEFINER` (donas: orco_owner,
-- `search_path = ''`), com EXECUTE só para a app_user, chamadas só pelo servidor.

-- 1. O token deixa de ser "conteúdo" (R1-A): gerar um novo link (RN-36) vale em qualquer status,
-- inclusive aprovado e recusado (a trava deixa passar), e não sobe a versão de um enviado (o cliente
-- não vê nada diferente). O resto da função é igual à da 0007.
CREATE OR REPLACE FUNCTION app.check_quote_update() RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
DECLARE
  untracked constant text[] := ARRAY[
    'internal_notes', 'response_seen_at', 'updated_at', 'view_count', 'first_viewed_at',
    'reminder_sent_at', 'version', 'sent_at', 'responded_at', 'status', 'public_token'
  ];
  content_changed constant boolean :=
    (pg_catalog.to_jsonb(NEW) - untracked) IS DISTINCT FROM (pg_catalog.to_jsonb(OLD) - untracked);
  item_count integer;
  incomplete integer;
  row_xmin xid;
BEGIN
  -- Trava (RN-25, Q5-A): respondido, só as anotações internas (RN-20a), o "visto" (RN-42), a
  -- contagem de visualizações (RN-35) e o token (RN-36, R1-A) mudam. A resposta é definitiva (RN-32).
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
      -- Só a app.respond_to_quote (dona: orco_owner), chamada pela página do cliente. O freelancer
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

-- 2. A resposta do cliente (RN-32 a RN-34). Devolve o resultado em texto:
--   'ok', 'not_found' (rascunho, excluído ou token inválido, RN-31), 'already_responded' (a resposta
--   é única, RN-32), 'expired' (validade vencida, no dia de São Paulo, RN-26) ou 'outdated' (o
--   orçamento mudou depois que a página abriu, R2-A).
-- Aprovar aceita só o nome; recusar, só o motivo (RN-33). Tudo numa transação: status + evento.
CREATE FUNCTION app.respond_to_quote(
  token text,
  decision public.quote_event_type,
  expected_version integer,
  respondent_name text,
  reason_code public.reject_reason,
  reason text,
  ip inet,
  user_agent text
) RETURNS text
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  target record;
BEGIN
  IF decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Resposta inválida: %.', decision USING ERRCODE = '22023';
  END IF;

  -- Trava a linha: duas respostas ao mesmo tempo não passam as duas.
  SELECT id, user_id, status, version, valid_until
    INTO target
    FROM public.quotes
   WHERE public_token = token
     AND status IN ('sent', 'approved', 'rejected')
     FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;
  IF target.status <> 'sent' THEN
    RETURN 'already_responded';
  END IF;
  IF target.valid_until < (pg_catalog.now() AT TIME ZONE 'America/Sao_Paulo')::date THEN
    RETURN 'expired';
  END IF;
  IF target.version <> expected_version THEN
    RETURN 'outdated';
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
  RETURN 'ok';
END;
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.respond_to_quote(
  text, public.quote_event_type, integer, text, public.reject_reason, text, inet, text
) TO app_user;
--> statement-breakpoint

-- 3. Novo link (RN-36, R1-A): troca o token na hora; o anterior para de funcionar. Só o dono, pela
-- conta da transação (withUserDb). Devolve o token novo, ou nulo se o orçamento não é da conta.
-- SECURITY DEFINER porque a app_user não altera o token (fica fora do GRANT UPDATE, 0006).
CREATE FUNCTION app.regenerate_public_token(quote_id uuid) RETURNS text
  LANGUAGE sql
  SECURITY DEFINER
  SET search_path = ''
AS $$
  UPDATE public.quotes
     SET public_token = app.generate_public_token()
   WHERE id = quote_id
     AND user_id = app.current_user_id()
  RETURNING public_token;
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.regenerate_public_token(uuid) TO app_user;
--> statement-breakpoint

-- 4. Anonimização (RN-37, D5-A, D6-A): apaga o IP dos eventos com mais de 12 meses. Chamada pelo
-- agendamento diário da VPS (NBB-62). Devolve quantos eventos mudaram.
CREATE FUNCTION app.anonymize_old_event_ips() RETURNS integer
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = ''
AS $$
DECLARE
  changed integer;
BEGIN
  UPDATE public.quote_events
     SET ip = NULL
   WHERE ip IS NOT NULL
     AND created_at < pg_catalog.now() - INTERVAL '12 months';
  GET DIAGNOSTICS changed = ROW_COUNT;
  RETURN changed;
END;
$$;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION app.anonymize_old_event_ips() TO app_user;
