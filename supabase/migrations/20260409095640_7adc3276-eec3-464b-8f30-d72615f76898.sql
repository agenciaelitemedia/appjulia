CREATE TABLE public.support_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL,
  name text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(phone)
);

ALTER TABLE public.support_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on support_team_members"
  ON public.support_team_members FOR ALL
  USING (true) WITH CHECK (true);