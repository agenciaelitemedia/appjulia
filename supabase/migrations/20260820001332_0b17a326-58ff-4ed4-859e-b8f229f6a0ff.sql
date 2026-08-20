UPDATE public.alert_crm_cards c
SET crm_stage_label = s.name, updated_at = now()
FROM public.crm_deals d
JOIN public.crm_pipelines s ON s.id = d.pipeline_id
WHERE (c.crm_stage_label IS NULL OR btrim(c.crm_stage_label) = '')
  AND right(regexp_replace(coalesce(d.contact_phone,''), '\D', '', 'g'), 8) = c.lead_phone_key
  AND coalesce(s.name, '') <> '';