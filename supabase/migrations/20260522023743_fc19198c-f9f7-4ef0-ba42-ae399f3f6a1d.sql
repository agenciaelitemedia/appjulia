ALTER TABLE public.ai_usage_logs
  ADD COLUMN IF NOT EXISTS cost_usd      numeric(12,6),
  ADD COLUMN IF NOT EXISTS audio_seconds numeric(10,2);

COMMENT ON COLUMN public.ai_usage_logs.cost_usd      IS 'Custo informado pelo provedor (USD), quando disponível (ex.: OpenRouter usage.cost).';
COMMENT ON COLUMN public.ai_usage_logs.audio_seconds IS 'Duração do áudio transcrito (segundos). Apenas para features de transcrição.';