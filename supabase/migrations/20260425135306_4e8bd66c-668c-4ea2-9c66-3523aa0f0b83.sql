UPDATE public.chat_conversations
SET status = 'resolved',
    resolved_at = now(),
    close_reason = 'duplicate',
    close_note = 'Conversa duplicada — atendimento ativo em #2026-008553',
    updated_at = now()
WHERE id = '276eb73e-22fb-4e13-9c18-973ea9d56109';