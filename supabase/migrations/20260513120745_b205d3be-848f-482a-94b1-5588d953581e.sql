ALTER TABLE public.crm_deals DISABLE TRIGGER update_crm_deals_updated_at;

WITH last_hist AS (
  SELECT DISTINCT ON (deal_id)
    deal_id,
    changed_at,
    changed_by
  FROM public.crm_deal_history
  ORDER BY deal_id, changed_at DESC
)
UPDATE public.crm_deals d
SET updated_at = h.changed_at,
    updated_by = COALESCE(h.changed_by, d.updated_by)
FROM last_hist h
WHERE d.id = h.deal_id;

UPDATE public.crm_deals
SET updated_at = created_at,
    updated_by = COALESCE(updated_by, created_by)
WHERE id NOT IN (SELECT deal_id FROM public.crm_deal_history);

ALTER TABLE public.crm_deals ENABLE TRIGGER update_crm_deals_updated_at;