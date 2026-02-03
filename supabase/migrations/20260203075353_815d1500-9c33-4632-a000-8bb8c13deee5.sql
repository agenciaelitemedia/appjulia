-- Alterar client_id de UUID para TEXT em chat_contacts
ALTER TABLE public.chat_contacts 
  ALTER COLUMN client_id TYPE TEXT;

-- Alterar client_id de UUID para TEXT em chat_messages
ALTER TABLE public.chat_messages 
  ALTER COLUMN client_id TYPE TEXT;