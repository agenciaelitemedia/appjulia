CREATE TABLE IF NOT EXISTS public.ai_provider_keys (
  provider text PRIMARY KEY,
  api_key text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_provider_keys ENABLE ROW LEVEL SECURITY;
-- No policies: only service_role (used by the edge function) can read/write.