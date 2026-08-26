CREATE TABLE public.dsp_provider_defaults (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id text NOT NULL,
  provider text NOT NULL CHECK (provider IN ('uazapi','meta_cloud')),
  max_per_minute integer NOT NULL DEFAULT 4,
  max_per_hour integer NOT NULL DEFAULT 60,
  max_per_day integer NOT NULL DEFAULT 300,
  max_unique_recipients_per_day integer NOT NULL DEFAULT 300,
  min_seconds_between_messages integer NOT NULL DEFAULT 12,
  max_seconds_between_messages integer NOT NULL DEFAULT 45,
  block_size integer NOT NULL DEFAULT 20,
  block_pause_seconds integer NOT NULL DEFAULT 300,
  daily_ramp_percent integer NOT NULL DEFAULT 20,
  max_consecutive_failures integer NOT NULL DEFAULT 5,
  cooldown_after_disconnect_minutes integer NOT NULL DEFAULT 60,
  marketing_enabled boolean NOT NULL DEFAULT true,
  send_window_start text DEFAULT '08:00',
  send_window_end text DEFAULT '20:00',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, provider)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.dsp_provider_defaults TO authenticated;
GRANT ALL ON public.dsp_provider_defaults TO service_role;

ALTER TABLE public.dsp_provider_defaults ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dsp_provider_defaults_app_access" ON public.dsp_provider_defaults
FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER trg_dsp_provider_defaults_updated_at
BEFORE UPDATE ON public.dsp_provider_defaults
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

INSERT INTO public.dsp_provider_defaults (
  client_id, provider, max_per_minute, max_per_hour, max_per_day,
  max_unique_recipients_per_day, min_seconds_between_messages, max_seconds_between_messages,
  block_size, block_pause_seconds, daily_ramp_percent
)
SELECT DISTINCT l.client_id, 'uazapi', 4, 60, 300, 300, 12, 45, 20, 300, 20
FROM public.dsp_channel_limits l
ON CONFLICT (client_id, provider) DO NOTHING;

INSERT INTO public.dsp_provider_defaults (
  client_id, provider, max_per_minute, max_per_hour, max_per_day,
  max_unique_recipients_per_day, min_seconds_between_messages, max_seconds_between_messages,
  block_size, block_pause_seconds, daily_ramp_percent
)
SELECT DISTINCT l.client_id, 'meta_cloud', 20, 600, 5000, 5000, 2, 6, 100, 30, 0
FROM public.dsp_channel_limits l
ON CONFLICT (client_id, provider) DO NOTHING;