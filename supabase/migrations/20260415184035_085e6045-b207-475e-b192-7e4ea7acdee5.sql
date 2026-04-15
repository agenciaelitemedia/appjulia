
CREATE TABLE agent_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id integer NOT NULL,
  cod_agent text NOT NULL,
  action text NOT NULL DEFAULT 'update',
  changed_by text,
  changed_by_id integer,
  change_summary text,
  snapshot jsonb,
  changes jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE agent_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all on agent_change_log" ON agent_change_log FOR ALL USING (true) WITH CHECK (true);

CREATE INDEX idx_agent_change_log_agent_id ON agent_change_log(agent_id);
CREATE INDEX idx_agent_change_log_cod_agent ON agent_change_log(cod_agent);
CREATE INDEX idx_agent_change_log_created_at ON agent_change_log(created_at DESC);
