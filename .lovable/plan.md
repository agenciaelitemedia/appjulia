

## Goal
Garantir que a fila usada em **toda** operação do chat (criar conversa, enviar texto/mídia, baixar mídia, marcar como lida) venha **sempre da conversa real do contato**, ignorando o filtro "Todas as filas / Fila X" do topo. O filtro deve servir apenas para **listar** conversas, não para definir a fila de operação.

## Diagnóstico
Em `src/contexts/WhatsAppDataContext.tsx`:

1. **`getEffectiveQueue(contactId)`** (linha ~122) hoje retorna `selectedQueue` se existir — ou seja, se o usuário escolher "Fila A" mas abrir um contato da "Fila B", ele opera na Fila A. Errado.
2. **`getOrCreateConversation`** (linha ~201) prioriza `currentQueueId` (filtro). Se "Todas" está selecionado → null → fallback. Mas se uma fila errada está selecionada, cria conversa nessa fila errada.
3. **`downloadMedia`** (linha ~891) usa `selectedQueue?.id` diretamente — ignora a fila do contato/conversa.
4. **`markAsRead`** (linha ~917) usa `selectedQueue.evo_apikey` direto — idem.

## Mudanças

### 1. Reescrever `getEffectiveQueue(contactId)` — fonte de verdade = conversa
Nova ordem de prioridade (filtro deixa de ter peso):
1. Conversa ativa do contato (`conversations` em estado, `pending`/`open`) → `queue_id`
2. Conversa mais recente do contato (qualquer status) com `queue_id` (busca em `chat_conversations` se não estiver em memória)
3. `contact.channel_source` (queue de origem)
4. Qualquer fila ativa que combine com `contact.channel_type`
5. **Último recurso**: `selectedQueue` (só se nada acima resolver — caso de contato totalmente novo sem conversa)

Tornar a função `async` (precisa consultar Supabase no caso 2/4) e atualizar quem a usa para `await`.

### 2. Reescrever resolução em `getOrCreateConversation`
Inverter prioridade:
1. Conversa anterior do contato (qualquer status) com `queue_id` ← **primeiro**
2. `contact.channel_source`
3. Qualquer fila ativa do `channel_type` do contato
4. `selectedQueue` (só se contato é novo e nada acima resolveu)

Manter o toast de erro se nada resolver.

### 3. `sendMessage` / `sendMedia`
Trocar a chamada síncrona `getEffectiveQueue(contactId)` por `await getEffectiveQueue(contactId)`. Lógica restante já consome `queue.*` corretamente — não muda.

### 4. `downloadMedia(messageId)`
Hoje recebe só `messageId`. Precisa descobrir a fila da **conversa daquela mensagem**:
- Buscar `chat_messages` → `conversation_id` → `chat_conversations.queue_id` (uma única query). 
- Passar esse `queueId` para a edge function `chat-media-download`.
- Fallback final: `selectedQueue?.id` (mantém compat).

### 5. `markAsRead(contactId)`
Trocar `selectedQueue` por `await getEffectiveQueue(contactId)`. Só executar o POST `/chat/markRead` se `queue.channel_type === 'uazapi'` e tiver `evo_apikey`/`evo_url`.

### 6. Limpeza de dependências dos `useCallback`
Atualizar arrays de deps onde `selectedQueue` deixa de ser usado e onde `getEffectiveQueue` virou async.

## Arquivos
- `src/contexts/WhatsAppDataContext.tsx` (única mudança de código)

## Fora de escopo
- UI do seletor de fila no topo continua igual (filtro de listagem).
- `syncContacts` continua usando `selectedQueue` (é uma ação manual de sincronização de uma fila específica, não operação sobre conversa existente).
- Tag de fila no `ChatList` (já corrigida na rodada anterior).

## Validação
Após aplicar:
1. Selecionar "Todas as filas", abrir contato cuja conversa veio da Fila A → enviar texto e mídia → checar nas Edge Function logs que o token usado é o da Fila A.
2. Selecionar "Fila B", abrir o mesmo contato (conversa = Fila A) → enviar mensagem → deve continuar usando Fila A.
3. Baixar áudio antigo de contato em outra fila → deve descriptografar com o token correto.
4. Contato totalmente novo (sem conversa) com "Fila B" selecionada → cria conversa em Fila B (fallback funcionando).

