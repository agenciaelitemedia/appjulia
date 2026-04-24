---
name: ticket-channel-isolation
description: Tickets (chat_conversations) são únicos por (contact_id, queue_id, channel) — webhooks nunca reaproveitam ticket de outro canal/fila
type: feature
---
Ao receber mensagem em um webhook (meta-webhook, uazapi-chat-webhook, instagram-webhook), a busca por conversa aberta para reaproveitamento DEVE filtrar por:
- contact_id
- client_id
- queue_id (= queueInfo.id da fila atual)
- channel (whatsapp_waba | whatsapp_uazapi | instagram | webchat)
- status IN ('pending','open')

Se nenhum match → criar novo ticket com a fila/canal corretos. Isso garante que o mesmo contato pode ter tickets paralelos (omnichannel) — um por canal/fila — em vez de ter mensagens de canais diferentes coladas no mesmo protocolo.

Bug histórico (abr/2026): meta-webhook reaproveitava ticket UaZapi pré-existente, fazendo mensagens WABA aparecerem na fila errada. Corrigido em supabase/functions/meta-webhook/index.ts e supabase/functions/uazapi-chat-webhook/index.ts (filtros .eq('queue_id', ...).eq('channel', ...) adicionados).

Regra adicional (abr/2026): mensagens com from_me=true (echoes de envios externos via API/n8n/app oficial) também DEVEM resolver/criar conversation_id — nunca persistir chat_messages com conversation_id=null. No uazapi-chat-webhook a guarda `else if (!fromMe)` foi removida; echoes anexam à conversa ativa ou criam nova (não reabrem resolved sozinhos — apenas inbound do cliente reabre).