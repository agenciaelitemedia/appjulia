CREATE TABLE IF NOT EXISTS public.crm_board_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL,
  client_id text NOT NULL,
  subject_type text NOT NULL CHECK (subject_type IN ('user','role')),
  subject_id text NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_create boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT crm_board_permissions_unique UNIQUE (board_id, subject_type, subject_id)
);

CREATE INDEX IF NOT EXISTS crm_board_permissions_board_idx ON public.crm_board_permissions (board_id);
CREATE INDEX IF NOT EXISTS crm_board_permissions_client_idx ON public.crm_board_permissions (client_id, subject_type, subject_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_board_permissions TO authenticated, anon;
GRANT ALL ON public.crm_board_permissions TO service_role;

ALTER TABLE public.crm_board_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_board_permissions_all"
ON public.crm_board_permissions
FOR ALL
USING (true)
WITH CHECK (true);

CREATE TRIGGER trg_crm_board_permissions_updated_at
BEFORE UPDATE ON public.crm_board_permissions
FOR EACH ROW EXECUTE FUNCTION public.update_crm_updated_at();