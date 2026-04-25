CREATE TABLE IF NOT EXISTS public.crm_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  cod_agent text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  entity_name text,
  action text NOT NULL,
  changes jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_audit_log_client_created
  ON public.crm_audit_log(client_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_audit_log_entity
  ON public.crm_audit_log(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_crm_audit_log_client_entity
  ON public.crm_audit_log(client_id, entity_type, created_at DESC);