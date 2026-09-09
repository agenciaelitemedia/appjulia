UPDATE public.chat_messages
SET text = '🔒 Mensagem não pôde ser descriptografada. Peça ao cliente para reenviar.'
WHERE coalesce(text, '') = ''
  AND type = 'text'
  AND from_me = false
  AND raw_payload->>'text' ILIKE '[Undecryptable]%';