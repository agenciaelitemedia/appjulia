---
name: Chat Contact Deduplication
description: Lista de /chat deduplica contatos pela conversa líder (mais recente) e usa o status efetivo dela para decidir em qual aba o contato aparece.
type: feature
---

Na UI da lista do chat (`WhatsAppDataContext.tsx` → `filteredContacts`), cada contato aparece em **uma única aba** de status, decidida pela "conversa líder":

- **Conversa líder** = conversa de maior `updated_at` para `(contact_id, client_id)`, considerando todas as filas e canais. Desempate: `opened_at` desc → `created_at` desc.
- Status efetivo do líder: `pending` + `assigned_to` preenchido → tratado como `open`. Demais valores mantidos.
- Mapeamento aba: `pending`/`open` → "Em aberto"; `resolved` → "Resolvidos"; `closed` → "Fechados"; "Resolvidos/Fechados" aceita ambos.

A `selectedConversation` exibida ao clicar no contato é a líder (não mais "primeira pending/open"), garantindo que o atendente veja o ticket mais atual independente da fila.

**Implementação:** `src/hooks/useContactLatestConversation.ts` carrega todas as conversas do client (lean) + assinatura `postgres_changes` filtrada por `client_id`, e expõe `Map<contact_id, leader>`. O contexto consome esse map em `filteredContacts`, `selectedConversation` e `convCounts`.

**Importante:** o modelo de tickets por fila no banco **NÃO mudou** — cada combinação `(contact + client + queue + channel)` continua sendo um ticket separado e ainda pode ser inspecionado/manipulado individualmente. A dedupe é puramente visual.
