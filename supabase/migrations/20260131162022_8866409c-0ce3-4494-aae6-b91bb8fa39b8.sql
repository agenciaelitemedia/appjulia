-- Habilitar REPLICA IDENTITY FULL para Realtime enviar dados antigos (old) no payload
ALTER TABLE video_call_records REPLICA IDENTITY FULL;