ALTER TABLE public.support_team_members 
ADD COLUMN IF NOT EXISTS user_id integer,
ADD COLUMN IF NOT EXISTS email text DEFAULT '',
ADD COLUMN IF NOT EXISTS role text DEFAULT '';