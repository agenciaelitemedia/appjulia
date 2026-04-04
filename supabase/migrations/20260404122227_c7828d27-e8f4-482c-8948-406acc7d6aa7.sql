
-- Add unique constraint for proper upsert on chat_messages
-- Using external_id (provider message ID) + contact_id to avoid duplicates per contact
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_messages_contact_external 
ON public.chat_messages (contact_id, external_id) 
WHERE external_id IS NOT NULL;

-- Also add unique on phone+client_id for chat_contacts upsert
CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_contacts_phone_client 
ON public.chat_contacts (phone, client_id);
