ALTER TABLE public.crm_deals DISABLE TRIGGER update_crm_deals_updated_at;

UPDATE public.crm_deals d
SET updated_at = COALESCE(h.last_changed_at, d.created_at)
FROM (
  SELECT deal_id, MAX(changed_at) AS last_changed_at
  FROM public.crm_deal_history
  GROUP BY deal_id
) h
WHERE h.deal_id = d.id;

UPDATE public.crm_deals
SET updated_at = created_at
WHERE id NOT IN (SELECT DISTINCT deal_id FROM public.crm_deal_history);

ALTER TABLE public.crm_deals ENABLE TRIGGER update_crm_deals_updated_at;