ALTER TABLE public.crm_deals DISABLE TRIGGER update_crm_deals_updated_at;

WITH created_hist AS (
  SELECT DISTINCT ON (deal_id)
    deal_id, changed_by, changed_at
  FROM public.crm_deal_history
  WHERE action = 'created' AND changed_by IS NOT NULL AND changed_by <> ''
  ORDER BY deal_id, changed_at ASC
),
first_hist AS (
  SELECT DISTINCT ON (deal_id)
    deal_id, changed_by
  FROM public.crm_deal_history
  WHERE changed_by IS NOT NULL AND changed_by <> ''
  ORDER BY deal_id, changed_at ASC
)
UPDATE public.crm_deals d
SET created_by = COALESCE(c.changed_by, f.changed_by, d.created_by)
FROM first_hist f
LEFT JOIN created_hist c ON c.deal_id = f.deal_id
WHERE d.id = f.deal_id
  AND COALESCE(c.changed_by, f.changed_by) IS DISTINCT FROM d.created_by;

ALTER TABLE public.crm_deals ENABLE TRIGGER update_crm_deals_updated_at;