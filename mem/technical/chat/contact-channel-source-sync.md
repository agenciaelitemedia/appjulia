---
name: Contact Channel Source Sync
description: Trigger sincroniza chat_contacts.channel_source com a queue_id da conversa ativa mais recente
type: feature
---
Trigger `trg_sync_contact_channel_source` em `chat_conversations` (AFTER INSERT/UPDATE OF queue_id, status), função `sync_contact_channel_source_from_conversation`:
- Quando conversa entra em status pending/open com queue_id, atualiza `chat_contacts.channel_source` (cast ::text) e `channel_type` (whatsapp_waba/whatsapp_uazapi) para refletir a fila ativa.
- Previne divergência: badge "Em Atendimento" (ChatList) conta por queue_id da conversa enquanto a lista de cards (WhatsAppDataContext.loadContacts) filtra por chat_contacts.channel_source. Sem o sync, contatos viram "fantasmas" no contador.
- Aplicado backfill retroativo na criação do trigger.