-- 1) Chave normalizada do telefone (últimos 8 dígitos) nos cards
ALTER TABLE public.alert_crm_cards
  ADD COLUMN IF NOT EXISTS lead_phone_key TEXT;

UPDATE public.alert_crm_cards
   SET lead_phone_key = right(regexp_replace(coalesce(lead_phone, ''), '\D', '', 'g'), 8)
 WHERE lead_phone_key IS NULL;

-- 2) Um único card aberto por (agente, lead) — remove duplicados mantendo o mais recente
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY cod_agent, lead_phone_key
           ORDER BY updated_at DESC, created_at DESC
         ) AS rn
    FROM public.alert_crm_cards
   WHERE status = 'open'
)
DELETE FROM public.alert_crm_cards c
 USING ranked r
 WHERE c.id = r.id AND r.rn > 1;

DROP INDEX IF EXISTS public.alert_crm_cards_open_unique;

CREATE UNIQUE INDEX alert_crm_cards_open_unique
  ON public.alert_crm_cards (cod_agent, lead_phone_key)
  WHERE status = 'open';

CREATE INDEX IF NOT EXISTS alert_crm_cards_phone_key_idx
  ON public.alert_crm_cards (lead_phone_key);

-- 3) Histórico: um registro por (agente, gatilho, dedupe, destinatário)
WITH ranked AS (
  SELECT id,
         row_number() OVER (
           PARTITION BY cod_agent, trigger_key, dedupe_key, recipient_phone
           ORDER BY created_at ASC
         ) AS rn
    FROM public.alert_notification_logs
   WHERE dedupe_key IS NOT NULL
)
DELETE FROM public.alert_notification_logs l
 USING ranked r
 WHERE l.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS alert_notification_logs_dedupe_unique
  ON public.alert_notification_logs (cod_agent, trigger_key, dedupe_key, recipient_phone)
  WHERE dedupe_key IS NOT NULL;