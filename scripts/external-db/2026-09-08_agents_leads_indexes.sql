-- Índices para acelerar o cálculo de "Leads do mês" em /agente/meus-agentes
-- (action get_user_agents_leads no db-query)

CREATE INDEX IF NOT EXISTS log_messages_session_created_idx
  ON public.log_messages (session_id, created_at);

CREATE INDEX IF NOT EXISTS sessions_agent_id_idx
  ON public.sessions (agent_id);
