UPDATE public.alert_crm_cards c
SET crm_stage_label = p.name, updated_at = now()
FROM public.xj_deals d
JOIN public.xj_pipelines p ON p.id = d.pipeline_id
WHERE (c.crm_stage_label IS NULL OR btrim(c.crm_stage_label) = '')
  AND right(regexp_replace(d.contact_phone, '\D', '', 'g'), 8) = c.lead_phone_key
  AND coalesce(p.name, '') <> '';