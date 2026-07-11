
CREATE TABLE public.wavoip_device_queues (
  device_id uuid NOT NULL REFERENCES public.wavoip_devices(id) ON DELETE CASCADE,
  queue_id uuid NOT NULL REFERENCES public.queues(id) ON DELETE CASCADE,
  client_id bigint NOT NULL,
  created_by bigint,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (device_id, queue_id)
);

CREATE INDEX wavoip_device_queues_queue_id_idx ON public.wavoip_device_queues (queue_id);
CREATE INDEX wavoip_device_queues_client_id_idx ON public.wavoip_device_queues (client_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wavoip_device_queues TO authenticated;
GRANT ALL ON public.wavoip_device_queues TO service_role;

ALTER TABLE public.wavoip_device_queues ENABLE ROW LEVEL SECURITY;

CREATE POLICY wavoip_device_queues_all ON public.wavoip_device_queues FOR ALL USING (true) WITH CHECK (true);
