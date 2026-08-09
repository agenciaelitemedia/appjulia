UPDATE public.xj_agents
SET activation = jsonb_set(coalesce(activation, '{}'::jsonb), '{only_campaign}', 'false'::jsonb, true)
WHERE client_id = '405';