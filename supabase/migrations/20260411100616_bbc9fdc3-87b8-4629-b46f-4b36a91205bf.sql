
CREATE TABLE public.queue_providers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  provider_type text NOT NULL,
  name text NOT NULL,
  evo_url text,
  evo_apikey text,
  meta_app_id text,
  meta_app_secret text,
  waba_business_id text,
  waba_token text,
  instagram_page_id text,
  instagram_user_id text,
  page_access_token text,
  page_name text,
  webchat_config_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.queue_providers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on queue_providers" ON public.queue_providers FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_queue_providers_updated_at
  BEFORE UPDATE ON public.queue_providers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_chat_contacts_updated_at();
