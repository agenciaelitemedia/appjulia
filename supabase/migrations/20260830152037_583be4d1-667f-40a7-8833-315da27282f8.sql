CREATE TABLE public.cop_write_audit (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id text NOT NULL,
  token_id uuid,
  actor_email text,
  approved_by text,
  action text NOT NULL,
  target_table text NOT NULL,
  target_id text,
  idempotency_key text NOT NULL,
  reason text,
  dry_run boolean NOT NULL DEFAULT true,
  applied boolean NOT NULL DEFAULT false,
  before_data jsonb,
  after_data jsonb,
  result text,
  request_id text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT ALL ON public.cop_write_audit TO service_role;

ALTER TABLE public.cop_write_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cop_write_audit_service_only"
ON public.cop_write_audit FOR ALL
TO service_role
USING (true) WITH CHECK (true);

CREATE UNIQUE INDEX cop_write_audit_idem_applied_idx
ON public.cop_write_audit (client_id, action, idempotency_key)
WHERE applied = true;

CREATE INDEX cop_write_audit_client_created_idx
ON public.cop_write_audit (client_id, created_at DESC);