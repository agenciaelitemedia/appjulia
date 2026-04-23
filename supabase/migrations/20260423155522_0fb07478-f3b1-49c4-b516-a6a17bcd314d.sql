UPDATE public.chat_client_settings
SET settings = jsonb_set(
                 jsonb_set(settings, '{ALLOW_GROUPS}', 'false'::jsonb),
                 '{SHOW_GROUPS_TAB}', 'false'::jsonb
               ),
    updated_at = now()
WHERE client_id = '30';