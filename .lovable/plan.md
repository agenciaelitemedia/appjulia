

User quer que fila e time apareçam SEMPRE na lista (não remover). Apenas SLA/prioridade/tags podem sair? Reli o pedido original: "informações de fila e time só aparecem quando clica no contato". Era reclamação de que NÃO aparecem na lista. Então o ajuste é o oposto do que propus: garantir que apareçam sempre na lista.

Hoje em `ChatContactItem.tsx`, `ConversationBadges` já renderiza `queueName` quando passado. O problema é que `ChatList.tsx` só passa `queueName` se encontra uma conversa com status `pending`/`open` para o contato. Se a conversa está `resolved`/`closed` ou se o lookup falha, fila some.

Sobre "time": não há campo de time/agente assigned exibido hoje na lista. Precisamos adicionar.

## Ajustes ao plano

### 1. Fila e time SEMPRE visíveis na lista de chat
**`src/components/chat/ChatList.tsx`** — ampliar lookup de conversa:
- Hoje filtra `['pending', 'open'].includes(c.status)`. Trocar por: pegar a conversa mais recente do contato (qualquer status), ordenando por `updated_at` desc. Assim fila aparece mesmo em conversas resolvidas.
- Passar também o nome do agente atribuído (`assigned_to`) — resolver via lookup em `agents`/membros do time.

**`src/components/chat/ChatContactItem.tsx`**:
- Manter `<ConversationBadges>` (fila + tags + prioridade) e `<SlaBadge>` na linha 2 (não remover como eu havia proposto).
- Adicionar badge de "Time/Agente" ao lado da fila, ex.: badge cinza com nome do responsável (ou "Não atribuído" se vazio).
- Nova prop `assignedAgentName?: string`.

### 2. Sobrescrever nome do contato quando atual for telefone
**`supabase/functions/uazapi-chat-webhook/index.ts`** (sem mudanças vs. plano anterior):
- Detectar "nome é telefone" via: `name === senderPhone` OR `normalizePhone(name) === senderPhone` OR regex `^[\d\s+\-()]+$`.
- Se verdadeiro E `pushName` existe E `!fromMe` → sobrescrever com `pushName`.
- Continuar nunca sobrescrevendo em `fromMe=true`.

### Validação
1. Lista deve mostrar badge da fila e do time atribuído em TODOS os contatos com conversa (incluindo resolvidas).
2. Contato sem atribuição mostra "Não atribuído".
3. Receber mensagem de contato cujo nome é o telefone → atualiza para `pushName`.
4. `fromMe=true` nunca altera nome do contato.

### Arquivos a editar
- `src/components/chat/ChatList.tsx` — lookup de conversa mais recente + resolver nome do agente atribuído.
- `src/components/chat/ChatContactItem.tsx` — adicionar prop `assignedAgentName` e badge de time; manter badges de fila/SLA.
- `supabase/functions/uazapi-chat-webhook/index.ts` — ampliar detecção "nome é telefone".

