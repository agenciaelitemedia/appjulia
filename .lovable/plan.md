## Objetivo
Ao clicar no botão "Abrir no Chat" (ícone ExternalLink) do `ChatSidePanel`, navegar para `/chat` já com o lead selecionado, a aba de status correta ativa e a conversa/mensagens carregadas.

## Mapeamento status → aba
- `pending` → aba **Aguardando Atendimento**
- `open` (atribuído) → aba **Em Atendimento** (`open`)
- `resolved` ou `closed` → aba **Resolvido e Concluído** (`resolved_closed`)
- Sem `conversationId` (só contato) → mantém padrão `open`

## Mudanças

### 1. `src/lib/chat/pendingSelection.ts`
Adicionar campo opcional `tab` (`'pending' | 'open' | 'resolved_closed'`) na `PendingSelection`:
- Nova chave `chat_pending_tab` no sessionStorage.
- `setPendingSelection` aceita `tab?`; `readPendingSelection` devolve `tab: PendingTab | null`; `clearPendingSelection` limpa a nova chave.

### 2. `src/components/chat/ChatSidePanel.tsx` (botão linha 111)
Transformar o `onClick` em handler assíncrono:
1. Se houver `target.conversationId`, buscar `status` em `chat_conversations` (`select('status').eq('id', conversationId).maybeSingle()`).
2. Derivar `tab`:
   - `status === 'pending'` → `'pending'`
   - `status === 'open'` → `'open'`
   - `status === 'resolved' || status === 'closed'` → `'resolved_closed'`
   - fallback → `'open'`
3. `setPendingSelection({ contactId, queueId, conversationId, tab })`.
4. `navigate('/chat')`.

Para evitar atraso visível, desabilitar o botão brevemente (state `isOpening`) e mostrar spinner opcional; a query é apenas 1 campo/1 linha, ~50–150 ms.

### 3. `src/pages/chat/ChatPage.tsx`
- Importar `setConversationStatusFilter` do `useWhatsAppData`.
- Antes de `selectContact(pending.contactId)` (etapa 2 do efeito), se `pending.tab`, chamar `setConversationStatusFilter(pending.tab)`.
- A limpeza do pending já ocorre depois via `clearPendingSelection()`.

### 4. Comportamento resultante
- A aba correta é ativada antes da seleção do contato, então a `ChatList` renderiza no filtro certo.
- `selectContact` aciona o carregamento de mensagens da conversa (fluxo já existente).
- Se o usuário não tiver acesso à fila, o fluxo atual de aviso segue funcionando.

## Detalhes técnicos
- Nenhuma alteração de schema/RLS.
- TTL de 60s do pending continua válido para `tab`.
- Sem alteração no `NewConversationDialog` (usa `setPendingSelection` sem tab; permanecerá `'open'` por padrão).
