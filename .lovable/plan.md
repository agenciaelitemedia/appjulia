# Omnichannel Message Storage & Chat Engine

## Status: ✅ Implementado (FASES 1-3)

## O que foi feito

### FASE 1 — Banco de Dados (5 migrations)
- ✅ `chat_contacts` estendida: `channel_type`, `channel_source`, `remote_jid` + índice único
- ✅ `chat_messages` estendida: `channel_type`, `external_id`, `is_forwarded`, `forwarded_score`, `raw_payload` + índices
- ✅ `webhook_logs` estendida: `contact_id`
- ✅ Realtime habilitado para `chat_messages` e `chat_contacts` (já existiam)
- ✅ Bucket `chat-media` criado com políticas de leitura pública e escrita

### FASE 2 — Edge Functions
- ✅ `meta-webhook` atualizada: `saveMessageToChat()` + `updateMessageStatus()` — persiste mensagens WABA nas tabelas `chat_contacts`/`chat_messages` com dedup por `external_id`, fire-and-forget para download de mídia
- ✅ `uazapi-webhook` criada: recebe payloads Baileys, resolve agente por `instance` ou `cod_agent`, UPSERT contatos e INSERT mensagens, forward para N8N
- ✅ `waba-send` estendida: nova action `download_and_store` — baixa mídia da Graph API, faz upload no Storage `chat-media`, atualiza `media_url` na `chat_messages`

### FASE 3 — Frontend
- ✅ `src/types/chat.ts` estendido: `ChannelType`, novos `MessageType`s, campos omnichannel em `ChatContact`/`ChatMessage`
- ✅ `WhatsAppDataContext.tsx` — Realtime expandido de `INSERT` para `*` (INSERT + UPDATE) com dedup e atualização de status em tempo real
- ✅ `ChatHeader.tsx` — Label de canal ("WA Oficial" / "WhatsApp")
- ✅ `MessageBubble.tsx` — Indicador de mensagem encaminhada
- ✅ `ChatContactItem.tsx` — Sem mudanças visuais necessárias (badge já funciona)

### FASE 4 — Configuração pendente
- Configurar webhook URL no servidor UazAPI apontando para `uazapi-webhook?instance={nome}&c={cod_agent}`
- Meta webhook já configurado (meta-webhook existente)
