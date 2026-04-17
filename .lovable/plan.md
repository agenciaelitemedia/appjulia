

## Diagnóstico

Após adicionarmos "Todas as filas" como default (`selectedQueue = null`), duas coisas quebraram:

### 1. Não envia mensagem
`sendMessage` e `sendMedia` em `WhatsAppDataContext.tsx` (linhas 497 e 634) fazem `if (!contact || !selectedQueue) return;` — silenciosamente abortam quando nenhuma fila está selecionada. Como o default agora é null, **nenhuma mensagem é enviada**.

### 2. Não "assume" a conversa
Hoje não há nenhuma lógica que atribua (`assigned_to`) a conversa ao agente atual ao clicar. A função `assignConversation` existe mas só é chamada manualmente via `ChatHeader`. Resultado: o ticket fica em `pending` sem dono.

## Plano de correção

### A) Resolver a fila pela conversa do contato (não pela seleção global)

Em `WhatsAppDataContext.tsx`, criar helper `resolveQueueForContact(contactId)`:
- Busca a `conversation` ativa do contato (`pending`/`open`)
- Pega o `queue_id` dela
- Carrega da lista `useQueues` (precisa expor via contexto OU consultar `chat_queues` pontualmente)

Mais simples: já temos `conversations[]` no estado e o contato sabe seu `channel_source` (= queue_id). Vou:
- Adicionar `queues: Queue[]` ao contexto (carregar 1x via `useQueues` no Provider)
- Helper `getEffectiveQueue(contactId)`: 
  1. Se `selectedQueue` definido → usa ele
  2. Senão → resolve via `contact.channel_source` ou `conversation.queue_id` na lista `queues`

### B) Aplicar fila resolvida em `sendMessage` e `sendMedia`

- Trocar `if (!selectedQueue) return` por `const queue = getEffectiveQueue(contactId); if (!queue) { toast.error('Sem fila ativa para este contato'); return; }`
- Usar `queue.evo_url`, `queue.evo_apikey`, `queue.channel_type` para o envio
- Mesmo tratamento em `sendMedia` e `sendInternalNote` (se aplicável)

### C) Auto-assumir conversa ao clicar (comportamento WhatsApp Web)

Em `selectContact` (atualmente é só `setSelectedContactId`), envolver numa função real:
1. `setSelectedContactId(id)`
2. Buscar/criar conversa do contato
3. Se `conversation.assigned_to` está vazio E `status === 'pending'`:
   - Atualizar `assigned_to = user.name` (ou `user.id`)
   - Atualizar `status = 'open'`
   - Inserir entrada em `chat_conversation_history` (`action: 'assigned'`)
   - `markAsRead(contactId)` para zerar unread

### D) Validação

- Selecionar "Todas as filas", clicar numa conversa pendente → deve abrir, marcar como lida, virar "open" e mostrar você como responsável no header
- Enviar texto → deve sair pelo provedor correto da fila daquela conversa
- Enviar mídia/áudio → mesmo comportamento
- Trocar para fila específica e repetir → continua funcionando

### Arquivos a editar

- `src/contexts/WhatsAppDataContext.tsx`
  - Carregar `queues` (via supabase ou hook) e expor no contexto
  - Helper `getEffectiveQueue(contactId)`
  - Refatorar `sendMessage`, `sendMedia`, `sendInternalNote` para usar fila resolvida
  - Substituir alias `selectContact: setSelectedContactId` por função que auto-assume conversa
- `src/components/chat/ChatHeader.tsx` — confirmar que mostra `assigned_to` corretamente após auto-assign (pode já funcionar via realtime)

