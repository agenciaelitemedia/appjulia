-- Adicionar novas colunas para controle de fila e gravacao
ALTER TABLE video_call_records 
ADD COLUMN IF NOT EXISTS lead_waiting_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS operator_joined_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS recording_url TEXT;

-- Indice para otimizar consultas de fila
CREATE INDEX IF NOT EXISTS idx_video_call_records_queue 
ON video_call_records (cod_agent, status, lead_waiting_at) 
WHERE operator_joined_at IS NULL;

-- Indice para busca por recording_id
CREATE INDEX IF NOT EXISTS idx_video_call_records_recording 
ON video_call_records (recording_id) 
WHERE recording_id IS NOT NULL;

-- HABILITAR REALTIME para a tabela
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_call_records;