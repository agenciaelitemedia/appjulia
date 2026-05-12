-- Add updated_by column to crm_deals
ALTER TABLE public.crm_deals ADD COLUMN IF NOT EXISTS updated_by text;

-- Extend crm_deal_history action constraint to include 'archived'
ALTER TABLE public.crm_deal_history DROP CONSTRAINT IF EXISTS crm_deal_history_action_check;
ALTER TABLE public.crm_deal_history ADD CONSTRAINT crm_deal_history_action_check
  CHECK (action = ANY (ARRAY['created'::text, 'moved'::text, 'updated'::text, 'note_added'::text, 'won'::text, 'lost'::text, 'archived'::text]));

-- Backfill created_by from first 'created' history entry
UPDATE public.crm_deals d
SET created_by = h.changed_by
FROM (
  SELECT DISTINCT ON (deal_id) deal_id, changed_by
  FROM public.crm_deal_history
  WHERE action = 'created' AND changed_by IS NOT NULL
  ORDER BY deal_id, changed_at ASC
) h
WHERE h.deal_id = d.id AND d.created_by IS NULL;

-- Backfill updated_by from most recent history entry
UPDATE public.crm_deals d
SET updated_by = h.changed_by
FROM (
  SELECT DISTINCT ON (deal_id) deal_id, changed_by
  FROM public.crm_deal_history
  WHERE changed_by IS NOT NULL
  ORDER BY deal_id, changed_at DESC
) h
WHERE h.deal_id = d.id AND d.updated_by IS NULL;