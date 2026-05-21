-- Global AI model configuration per agent (feature), with provider switching
-- (Lovable AI Gateway default + OpenRouter). client_id uses the 'GLOBAL' sentinel.

-- 1) Provider column on the selected-config table
ALTER TABLE public.client_ai_model_config
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'lovable'; -- 'lovable' | 'openrouter'

-- 2) Per-agent catalog of available models (no secrets)
CREATE TABLE IF NOT EXISTS public.client_ai_model_config_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature text NOT NULL,
  label text NOT NULL,
  model text NOT NULL,                         -- e.g. 'google/gemini-2.5-flash'
  provider text NOT NULL DEFAULT 'openrouter', -- 'lovable' | 'openrouter'
  is_default boolean NOT NULL DEFAULT false,   -- the default entry that uses the Lovable Gateway
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.client_ai_model_config_list ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_model_list open" ON public.client_ai_model_config_list;
CREATE POLICY "ai_model_list open" ON public.client_ai_model_config_list
  FOR ALL USING (true) WITH CHECK (true);

-- 3) Provider API keys (secrets) — RLS enabled with NO policies → frontend denied,
--    only service_role (edge functions) can read/write.
CREATE TABLE IF NOT EXISTS public.ai_provider_keys (
  provider text PRIMARY KEY,   -- 'openrouter'
  api_key text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.ai_provider_keys ENABLE ROW LEVEL SECURITY;
-- intentionally no policies: anon/authenticated have no access.

-- 4) Seed the per-agent catalog: Lovable default entry for every agent.
INSERT INTO public.client_ai_model_config_list (feature, label, model, provider, is_default, sort_order)
SELECT f.feature, 'Padrão (Lovable AI)', f.default_model, 'lovable', true, 0
FROM (VALUES
  ('chat_assist',           'google/gemini-2.5-flash'),
  ('chat_resume',           'google/gemini-2.5-flash'),
  ('chat_transcription',    'google/gemini-2.5-flash'),
  ('copilot_crm',           'google/gemini-2.5-flash'),
  ('copilot_chat',          'google/gemini-2.5-flash'),
  ('chat_autoreply',        'google/gemini-2.5-flash'),
  ('support_transcription', 'google/gemini-2.5-flash'),
  ('script_generation',     'google/gemini-3-flash-preview')
) AS f(feature, default_model)
WHERE NOT EXISTS (
  SELECT 1 FROM public.client_ai_model_config_list l
  WHERE l.feature = f.feature AND l.is_default = true
);

-- 5) Seed a few OpenRouter examples for text-only agents (admin can edit/remove).
INSERT INTO public.client_ai_model_config_list (feature, label, model, provider, is_default, sort_order)
SELECT f.feature, o.label, o.model, 'openrouter', false, o.sort_order
FROM (VALUES
  ('chat_assist'), ('chat_resume'), ('copilot_crm'),
  ('copilot_chat'), ('chat_autoreply'), ('script_generation')
) AS f(feature)
CROSS JOIN (VALUES
  ('GPT-4o Mini (OpenRouter)',        'openai/gpt-4o-mini',            1),
  ('GPT-4o (OpenRouter)',             'openai/gpt-4o',                 2),
  ('Claude 3.5 Sonnet (OpenRouter)',  'anthropic/claude-3.5-sonnet',   3)
) AS o(label, model, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.client_ai_model_config_list l
  WHERE l.feature = f.feature AND l.model = o.model
);
