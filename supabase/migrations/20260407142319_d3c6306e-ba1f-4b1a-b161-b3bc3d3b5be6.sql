
CREATE TABLE vellip_call_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_agent text,
  phone text,
  cd_id text,
  cd_date text,
  cd_time text,
  cd_time_start text,
  cd_time_end text,
  cd_time_sec integer,
  cd_time_sec2 integer,
  cd_price text,
  cd_value text,
  cd_name text,
  cd_route text,
  cd_called_status text,
  cd_resp1 text,
  saldo text,
  raw_payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE vellip_call_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on vellip_call_logs" ON vellip_call_logs FOR ALL USING (true) WITH CHECK (true);
