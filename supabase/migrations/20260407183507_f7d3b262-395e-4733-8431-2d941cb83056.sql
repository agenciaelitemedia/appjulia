CREATE TABLE contract_deletion_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cod_document text NOT NULL,
  cod_agent text,
  signer_name text,
  whatsapp text,
  previous_status text,
  deleted_by text,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  reason text
);
ALTER TABLE contract_deletion_audit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on contract_deletion_audit" ON contract_deletion_audit FOR ALL USING (true) WITH CHECK (true);