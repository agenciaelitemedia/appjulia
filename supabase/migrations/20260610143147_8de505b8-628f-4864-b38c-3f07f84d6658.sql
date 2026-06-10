-- Categorias da Central de Ajuda
CREATE TABLE public.help_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon text DEFAULT 'Folder',
  color text DEFAULT '#6366f1',
  position integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.help_categories TO anon, authenticated;
GRANT ALL ON public.help_categories TO service_role;
ALTER TABLE public.help_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on help_categories" ON public.help_categories FOR ALL USING (true) WITH CHECK (true);

-- Posts da Central de Ajuda
CREATE TABLE public.help_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.help_categories(id) ON DELETE SET NULL,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  summary text,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  content_html text,
  cover_image_url text,
  status text NOT NULL DEFAULT 'draft',
  is_featured boolean NOT NULL DEFAULT false,
  featured_order integer NOT NULL DEFAULT 0,
  tags text[] NOT NULL DEFAULT '{}',
  view_count integer NOT NULL DEFAULT 0,
  author_id text,
  author_name text,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.help_posts TO anon, authenticated;
GRANT ALL ON public.help_posts TO service_role;
ALTER TABLE public.help_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on help_posts" ON public.help_posts FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_help_posts_category ON public.help_posts(category_id);
CREATE INDEX idx_help_posts_status ON public.help_posts(status);

-- Visualizações (mais vistos / continue lendo)
CREATE TABLE public.help_post_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.help_posts(id) ON DELETE CASCADE,
  user_id text NOT NULL,
  viewed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (post_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.help_post_views TO anon, authenticated;
GRANT ALL ON public.help_post_views TO service_role;
ALTER TABLE public.help_post_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on help_post_views" ON public.help_post_views FOR ALL USING (true) WITH CHECK (true);
CREATE INDEX idx_help_post_views_user ON public.help_post_views(user_id, viewed_at DESC);

-- updated_at triggers
CREATE TRIGGER trg_help_categories_updated_at BEFORE UPDATE ON public.help_categories FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();
CREATE TRIGGER trg_help_posts_updated_at BEFORE UPDATE ON public.help_posts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_timestamp();

-- Incremento atômico de visualizações
CREATE OR REPLACE FUNCTION public.increment_help_post_view(p_post_id uuid, p_user_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.help_posts SET view_count = view_count + 1 WHERE id = p_post_id;
  IF p_user_id IS NOT NULL AND p_user_id <> '' THEN
    INSERT INTO public.help_post_views (post_id, user_id, viewed_at)
    VALUES (p_post_id, p_user_id, now())
    ON CONFLICT (post_id, user_id) DO UPDATE SET viewed_at = now();
  END IF;
END;
$$;