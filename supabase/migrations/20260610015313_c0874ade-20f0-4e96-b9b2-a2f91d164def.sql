
-- 1. Coluna protocol em support_tickets
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS protocol text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_support_tickets_protocol
  ON public.support_tickets(protocol) WHERE protocol IS NOT NULL;

-- 2. Máscara configurável em support_settings
ALTER TABLE public.support_settings ADD COLUMN IF NOT EXISTS protocol_mask text NOT NULL DEFAULT 'AAAAMMDDNNNNNN';

-- 3. Contadores (mensal/diário e qualquer outro escopo)
CREATE TABLE IF NOT EXISTS public.support_protocol_counters (
  scope text PRIMARY KEY,
  last_value bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.support_protocol_counters TO authenticated;
GRANT ALL ON public.support_protocol_counters TO service_role;
ALTER TABLE public.support_protocol_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "read counters" ON public.support_protocol_counters;
CREATE POLICY "read counters" ON public.support_protocol_counters FOR SELECT TO authenticated USING (true);

-- 4. Função render
CREATE OR REPLACE FUNCTION public.generate_ticket_protocol(p_mask text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mask     text := COALESCE(NULLIF(p_mask, ''), 'AAAAMMDDNNNNNN');
  v_now      timestamptz := now();
  v_brt      timestamp := (v_now AT TIME ZONE 'America/Sao_Paulo');
  v_yyyy     text := to_char(v_brt, 'YYYY');
  v_yy       text := to_char(v_brt, 'YY');
  v_mm       text := to_char(v_brt, 'MM');
  v_dd       text := to_char(v_brt, 'DD');
  v_hh       text := to_char(v_brt, 'HH24');
  v_ii       text := to_char(v_brt, 'MI');
  v_scope_m  text := 'M:' || to_char(v_brt, 'YYYY-MM');
  v_scope_d  text := 'D:' || to_char(v_brt, 'YYYY-MM-DD');
  v_seq_m    bigint;
  v_seq_d    bigint;
  v_out      text := '';
  v_i        int  := 1;
  v_len      int  := length(v_mask);
  v_ch       text;
  v_run      text;
  v_run_len  int;
BEGIN
  -- Pre-incrementa SEMPRE os contadores do mês/dia (apenas se a máscara contiver S/N).
  IF v_mask ~ 'S' THEN
    INSERT INTO public.support_protocol_counters(scope, last_value)
    VALUES (v_scope_m, 1)
    ON CONFLICT (scope) DO UPDATE SET last_value = public.support_protocol_counters.last_value + 1, updated_at = now()
    RETURNING last_value INTO v_seq_m;
  END IF;
  IF v_mask ~ 'N' THEN
    INSERT INTO public.support_protocol_counters(scope, last_value)
    VALUES (v_scope_d, 1)
    ON CONFLICT (scope) DO UPDATE SET last_value = public.support_protocol_counters.last_value + 1, updated_at = now()
    RETURNING last_value INTO v_seq_d;
  END IF;

  WHILE v_i <= v_len LOOP
    v_ch := substr(v_mask, v_i, 1);

    -- AAAA / AA
    IF v_ch = 'A' THEN
      IF substr(v_mask, v_i, 4) = 'AAAA' THEN
        v_out := v_out || v_yyyy; v_i := v_i + 4; CONTINUE;
      ELSIF substr(v_mask, v_i, 2) = 'AA' THEN
        v_out := v_out || v_yy; v_i := v_i + 2; CONTINUE;
      END IF;
    ELSIF v_ch = 'M' AND substr(v_mask, v_i, 2) = 'MM' THEN
      v_out := v_out || v_mm; v_i := v_i + 2; CONTINUE;
    ELSIF v_ch = 'D' AND substr(v_mask, v_i, 2) = 'DD' THEN
      v_out := v_out || v_dd; v_i := v_i + 2; CONTINUE;
    ELSIF v_ch = 'H' AND substr(v_mask, v_i, 2) = 'HH' THEN
      v_out := v_out || v_hh; v_i := v_i + 2; CONTINUE;
    ELSIF v_ch = 'I' AND substr(v_mask, v_i, 2) = 'II' THEN
      v_out := v_out || v_ii; v_i := v_i + 2; CONTINUE;
    ELSIF v_ch = 'S' THEN
      v_run_len := 0;
      WHILE (v_i + v_run_len) <= v_len AND substr(v_mask, v_i + v_run_len, 1) = 'S' LOOP
        v_run_len := v_run_len + 1;
      END LOOP;
      v_out := v_out || lpad(v_seq_m::text, v_run_len, '0');
      v_i := v_i + v_run_len; CONTINUE;
    ELSIF v_ch = 'N' THEN
      v_run_len := 0;
      WHILE (v_i + v_run_len) <= v_len AND substr(v_mask, v_i + v_run_len, 1) = 'N' LOOP
        v_run_len := v_run_len + 1;
      END LOOP;
      v_out := v_out || lpad(v_seq_d::text, v_run_len, '0');
      v_i := v_i + v_run_len; CONTINUE;
    END IF;

    -- literal
    v_out := v_out || v_ch;
    v_i := v_i + 1;
  END LOOP;

  RETURN v_out;
END;
$$;

-- 5. Trigger BEFORE INSERT em support_tickets
CREATE OR REPLACE FUNCTION public.set_support_ticket_protocol()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_mask text;
BEGIN
  IF NEW.protocol IS NULL OR NEW.protocol = '' THEN
    SELECT protocol_mask INTO v_mask FROM public.support_settings WHERE id = 'global';
    NEW.protocol := public.generate_ticket_protocol(COALESCE(v_mask, 'AAAAMMDDNNNNNN'));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_support_ticket_protocol ON public.support_tickets;
CREATE TRIGGER trg_set_support_ticket_protocol
BEFORE INSERT ON public.support_tickets
FOR EACH ROW EXECUTE FUNCTION public.set_support_ticket_protocol();

-- 6. Coluna espelho em chat_conversations
ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS active_ticket_protocol text;

-- 7. Atualiza sync trigger para refletir protocolo
CREATE OR REPLACE FUNCTION public.sync_conversation_active_ticket()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_open_statuses constant text[] := ARRAY['open','pending','in_progress','waiting_customer'];
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.conversation_id IS NOT NULL THEN
      UPDATE public.chat_conversations
         SET active_ticket_id = NULL,
             active_ticket_number = NULL,
             active_ticket_protocol = NULL
       WHERE id = OLD.conversation_id
         AND active_ticket_id = OLD.id;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE'
     AND OLD.conversation_id IS DISTINCT FROM NEW.conversation_id
     AND OLD.conversation_id IS NOT NULL THEN
    UPDATE public.chat_conversations
       SET active_ticket_id = NULL,
           active_ticket_number = NULL,
           active_ticket_protocol = NULL
     WHERE id = OLD.conversation_id
       AND active_ticket_id = NEW.id;
  END IF;

  IF NEW.conversation_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status = ANY (v_open_statuses) THEN
    UPDATE public.chat_conversations
       SET active_ticket_id = NEW.id,
           active_ticket_number = NEW.number,
           active_ticket_protocol = NEW.protocol
     WHERE id = NEW.conversation_id
       AND (active_ticket_id IS NULL OR active_ticket_id = NEW.id);
  ELSE
    UPDATE public.chat_conversations
       SET active_ticket_id = NULL,
           active_ticket_number = NULL,
           active_ticket_protocol = NULL
     WHERE id = NEW.conversation_id
       AND active_ticket_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;
