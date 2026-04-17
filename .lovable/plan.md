
User wants:
1. Replace hardcoded "SUPORTE" badge with the actual **queue name** the conversation belongs to
2. Queue selector should support "All queues" as default + ability to filter by a specific queue
3. Keep the message-loading fix from previous plan

## Plano consolidado

### 1. Badge da fila no card de conversa
- Em `src/components/chat/ChatContactItem.tsx`:
  - Remover badges hardcoded "SUPORTE" (linhas 86–91)
  - Adicionar um badge derivado do `queueName` (já recebido via prop) — exibido com cor neutra/azul ao lado do nome ou abaixo
  - Manter badges reais de `tags` e `priority`
- O `queueName` precisa refletir a fila **da conversa específica** (não a fila selecionada no filtro). Para isso:
  - Em `ChatList.tsx`, ao passar `queueName` para o item, resolver pelo `conversation.queue_id` consultando a lista de `activeQueues` (não usar `selectedQueue.name`)

### 2. Filtro de filas com opção "Todas"
- Em `src/contexts/WhatsAppDataContext.tsx`:
  - Permitir `selectedQueue = null` significar "todas as filas do cliente"
  - Ajustar queries de `contacts`, `conversations` e `messages` para:
    - Quando `selectedQueue` definido → filtrar por `queue_id`
    - Quando `null` (Todas) → não aplicar filtro de queue, retornar tudo do `client_id`
  - Remover o auto-select da primeira fila (deixar "Todas" como default)
- Em `src/components/chat/ChatList.tsx`:
  - Adicionar item `<SelectItem value="__all__">Todas as filas</SelectItem>` no topo
  - Tratar valor `__all__` como `setSelectedQueue(null)`
  - Mostrar label "Todas as filas" no trigger quando nada selecionado
  - Atualizar empty-state: remover bloqueio "Selecione uma fila" — mostrar lista mesmo sem fila selecionada

### 3. Correção das mensagens não carregando (do plano anterior)
- Em `src/contexts/WhatsAppDataContext.tsx` — função `loadMessages`:
  - Remover early-return em `if (!clientId)` (a query filtra por `contact_id`, não precisa de clientId)
  - Adicionar logs temporários (`[loadMessages]` entrada/resultado/erro)
- Em `src/components/chat/ChatMessages.tsx`:
  - Confirmar que `useEffect` dispara `loadMessages(contactId)` quando contato muda
  - Adicionar log para validar trigger

### Arquivos a editar
- `src/contexts/WhatsAppDataContext.tsx` — suporte a "todas as filas", remover auto-select, fix loadMessages
- `src/components/chat/ChatList.tsx` — opção "Todas" no Select, resolver queueName por conversa, remover bloqueio empty-state
- `src/components/chat/ChatContactItem.tsx` — remover SUPORTE, adicionar badge da fila

### Validação
- Recarregar `/chat` → "Todas as filas" selecionado por padrão, todas conversas visíveis
- Cards mostram nome da fila correta (não "SUPORTE")
- Trocar para fila específica → filtra conversas
- Clicar em conversa → mensagens carregam
