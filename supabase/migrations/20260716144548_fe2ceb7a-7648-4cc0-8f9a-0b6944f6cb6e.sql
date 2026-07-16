-- Fase 3: acelerar a consulta hot-path do webhook uazapi-chat-webhook.
-- A refatoração no código passou a usar `.in()` exato (btree já existente),
-- mas mantemos um fallback ILIKE para IDs prefixados por alguns provedores.
-- Esses índices trigrama garantem que o fallback também use índice.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_chat_messages_message_id_trgm
  ON public.chat_messages USING gin (message_id gin_trgm_ops)
  WHERE message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_external_id_trgm
  ON public.chat_messages USING gin (external_id gin_trgm_ops)
  WHERE external_id IS NOT NULL;