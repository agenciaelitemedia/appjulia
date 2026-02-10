
-- Create table for monitored processes
CREATE TABLE public.datajud_monitored_processes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id INTEGER NOT NULL,
  process_number TEXT NOT NULL,
  process_number_formatted TEXT NOT NULL,
  name TEXT NOT NULL,
  client_phone TEXT,
  tribunal TEXT,
  last_known_movements JSONB DEFAULT '[]'::jsonb,
  last_check_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create table for notification config
CREATE TABLE public.datajud_notification_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  default_agent_cod TEXT,
  office_phones TEXT[] DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create table for alerts
CREATE TABLE public.datajud_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  process_id UUID NOT NULL REFERENCES public.datajud_monitored_processes(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  movement_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT false,
  whatsapp_sent BOOLEAN NOT NULL DEFAULT false,
  whatsapp_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.datajud_monitored_processes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datajud_notification_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datajud_alerts ENABLE ROW LEVEL SECURITY;

-- RLS policies (same pattern as CRM tables - open access, auth handled at app level)
CREATE POLICY "Allow all operations on datajud_monitored_processes"
  ON public.datajud_monitored_processes FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on datajud_notification_config"
  ON public.datajud_notification_config FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on datajud_alerts"
  ON public.datajud_alerts FOR ALL USING (true) WITH CHECK (true);

-- Enable realtime on alerts table
ALTER PUBLICATION supabase_realtime ADD TABLE public.datajud_alerts;

-- Create indexes
CREATE INDEX idx_datajud_monitored_user ON public.datajud_monitored_processes(user_id);
CREATE INDEX idx_datajud_monitored_status ON public.datajud_monitored_processes(status);
CREATE INDEX idx_datajud_alerts_process ON public.datajud_alerts(process_id);
CREATE INDEX idx_datajud_alerts_user_read ON public.datajud_alerts(user_id, is_read);

-- Trigger for updated_at on monitored_processes
CREATE TRIGGER update_datajud_monitored_updated_at
  BEFORE UPDATE ON public.datajud_monitored_processes
  FOR EACH ROW EXECUTE FUNCTION public.update_crm_updated_at();

-- Trigger for updated_at on notification_config
CREATE TRIGGER update_datajud_config_updated_at
  BEFORE UPDATE ON public.datajud_notification_config
  FOR EACH ROW EXECUTE FUNCTION public.update_crm_updated_at();
