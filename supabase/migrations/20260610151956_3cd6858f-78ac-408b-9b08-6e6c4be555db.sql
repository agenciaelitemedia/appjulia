CREATE TABLE public.help_studio_editors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id bigint NOT NULL UNIQUE,
  user_name text,
  user_email text,
  added_by bigint,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.help_studio_editors TO anon, authenticated;
GRANT ALL ON public.help_studio_editors TO service_role;

ALTER TABLE public.help_studio_editors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on help_studio_editors" ON public.help_studio_editors FOR ALL USING (true) WITH CHECK (true);