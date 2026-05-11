-- ============================================================
-- Performance & Scalability Improvements — 2026-05-11
--
-- A1: Função RPC atômica para incremento de unread_count
--     Elimina race condition quando múltiplos agentes estão
--     online e ambos processam a mesma mensagem.
--
-- A5: Índice composto em chat_conversation_history(conversation_id, action)
--     Acelera o NOT EXISTS na RPC get_return_chat_candidates()
--     que roda a cada minuto via cron.
--
-- A6: Índice composto em chat_conversations(client_id, assigned_to)
--     Acelera o filtro "Minhas conversas" (assigned_to = user)
--     sem full table scan em 100k+ conversas.
-- ============================================================

-- ── A1: Incremento atômico de unread_count ──────────────────

CREATE OR REPLACE FUNCTION public.increment_contact_unread(
  p_contact_id uuid,
  p_preview    text,
  p_last_at    timestamptz
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.chat_contacts
  SET
    unread_count     = COALESCE(unread_count, 0) + 1,
    last_message_text = COALESCE(p_preview, last_message_text),
    last_message_at   = COALESCE(p_last_at, last_message_at)
  WHERE id = p_contact_id;
$$;

-- ── A5: Índice em chat_conversation_history ──────────────────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_conv_history_conv_action
  ON public.chat_conversation_history(conversation_id, action);

-- ── A6: Índice parcial em chat_conversations(assigned_to) ────

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chat_conversations_client_assigned
  ON public.chat_conversations(client_id, assigned_to)
  WHERE assigned_to IS NOT NULL
    AND status IN ('open', 'pending');
