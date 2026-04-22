-- Cleanup backfilled contacts/messages/conversations for client 300 (last failed import)
DELETE FROM public.chat_messages 
WHERE contact_id IN (
  SELECT id FROM public.chat_contacts 
  WHERE client_id = '300' AND history_backfilled = true
);

DELETE FROM public.chat_conversations 
WHERE contact_id IN (
  SELECT id FROM public.chat_contacts 
  WHERE client_id = '300' AND history_backfilled = true
);

DELETE FROM public.chat_contacts 
WHERE client_id = '300' AND history_backfilled = true;