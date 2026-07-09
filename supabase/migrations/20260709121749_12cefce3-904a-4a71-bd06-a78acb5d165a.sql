CREATE TABLE public.wavoip_device_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id uuid NOT NULL REFERENCES public.wavoip_devices(id) ON DELETE CASCADE,
  app_user_id bigint NOT NULL,
  granted_by bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (device_id, app_user_id)
);

CREATE INDEX idx_wavoip_device_members_user ON public.wavoip_device_members(app_user_id);
CREATE INDEX idx_wavoip_device_members_device ON public.wavoip_device_members(device_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wavoip_device_members TO authenticated, anon;
GRANT ALL ON public.wavoip_device_members TO service_role;

ALTER TABLE public.wavoip_device_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY wavoip_device_members_all ON public.wavoip_device_members FOR ALL USING (true) WITH CHECK (true);