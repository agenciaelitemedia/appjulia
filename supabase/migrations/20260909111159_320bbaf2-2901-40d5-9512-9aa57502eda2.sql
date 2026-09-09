UPDATE public.chat_messages
SET text = '🕐 Aguardando esta mensagem. Isso pode demorar um pouco.'
WHERE text = '🔒 Mensagem não pôde ser descriptografada. Peça ao cliente para reenviar.';