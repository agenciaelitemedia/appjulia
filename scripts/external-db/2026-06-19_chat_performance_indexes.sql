-- ============================================================================
-- Fase 2 · itens 11 e 12
-- Índices funcionais e colunas geradas para acelerar as consultas do /chat
-- Aplicar manualmente no banco externo (fora do Supabase) porque as
-- migrações do Supabase não têm alcance nesse DB.
--
-- Ganho esperado: consultas por telefone deixam de fazer SeqScan +
-- regexp_replace em toda a tabela e passam a usar Index Scan direto.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) campaing_ads  ·  matched_phone (Meta Ads)
--    A query do aggregator faz:
--      regexp_replace(COALESCE((campaign_data::jsonb)->>'phone',
--                              s.whatsapp_number::text, ''),
--                     '\D', '', 'g') = ANY($1)
--    Sem índice funcional é O(N) por chamada. Índice funcional resolve.
-- ---------------------------------------------------------------------------

-- (a) índice no phone extraído do JSON — cobre a grande maioria dos casos.
CREATE INDEX IF NOT EXISTS idx_campaing_ads_phone_digits
  ON campaing_ads (
    (regexp_replace(COALESCE((campaign_data::jsonb)->>'phone', ''), '\D', '', 'g'))
  );

-- (b) índice em sessions.whatsapp_number normalizado — para o fallback
--     via LEFT JOIN quando campaign_data->>'phone' é NULL.
CREATE INDEX IF NOT EXISTS idx_sessions_whatsapp_number_digits
  ON sessions (
    (regexp_replace(whatsapp_number::text, '\D', '', 'g'))
  );

-- (c) ordenação por matched_phone + created_at DESC — cobre o DISTINCT ON
CREATE INDEX IF NOT EXISTS idx_campaing_ads_created_at_desc
  ON campaing_ads (created_at DESC);

-- ---------------------------------------------------------------------------
-- 2) crm_atendimento_cards  ·  whatsapp_number + updated_at
--    A query CRM faz:
--      WHERE whatsapp_number = ANY($1)
--      ORDER BY whatsapp_number, updated_at DESC
--    Compound index acelera tanto o filtro quanto o DISTINCT ON.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_crm_cards_whatsapp_updated
  ON crm_atendimento_cards (whatsapp_number, updated_at DESC NULLS LAST);

-- ---------------------------------------------------------------------------
-- 3) sessions  ·  agent_id + created_at DESC
--    Query de status bate em (whatsapp_number, agent_id) e faz
--    DISTINCT ON escolhendo o registro mais novo. Índice combinado acelera.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_sessions_agent_created
  ON sessions (agent_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Verificação: rode EXPLAIN ANALYZE nas 3 queries do chat_bootstrap
-- para confirmar que os planos passaram a Index Scan/Bitmap Index Scan.
-- ---------------------------------------------------------------------------