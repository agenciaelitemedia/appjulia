CREATE TABLE IF NOT EXISTS public.link_preview_cache (
  url_hash text PRIMARY KEY,
  url text NOT NULL,
  title text,
  description text,
  image_url text,
  site_name text,
  domain text,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days')
);

CREATE INDEX IF NOT EXISTS idx_link_preview_cache_expires_at ON public.link_preview_cache (expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.link_preview_cache TO authenticated;
GRANT ALL ON public.link_preview_cache TO service_role;

ALTER TABLE public.link_preview_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read link previews" ON public.link_preview_cache FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert link previews" ON public.link_preview_cache FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update link previews" ON public.link_preview_cache FOR UPDATE TO authenticated USING (true) WITH CHECK (true);