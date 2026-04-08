CREATE TABLE agent_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_agent text NOT NULL UNIQUE,
  alias text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE agent_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on agent_aliases" ON agent_aliases FOR ALL USING (true) WITH CHECK (true);