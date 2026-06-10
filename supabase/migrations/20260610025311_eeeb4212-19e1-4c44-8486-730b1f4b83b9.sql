CREATE TABLE public.user_avatars (
  user_id    bigint PRIMARY KEY,
  photo_url  text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_avatars TO authenticated;
GRANT SELECT ON public.user_avatars TO anon;
GRANT ALL ON public.user_avatars TO service_role;

ALTER TABLE public.user_avatars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_avatars read"  ON public.user_avatars FOR SELECT USING (true);
CREATE POLICY "user_avatars write" ON public.user_avatars FOR ALL USING (true) WITH CHECK (true);