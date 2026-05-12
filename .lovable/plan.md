## Contexto

No painel lateral de conversa do card (CRM Builder → `BoardChatSidePanel`), dois problemas distintos acontecem:

1. **Header vazio em alguns cards** — O `ChatHeader` depende fortemente de `selectedConversation` vindo do `WhatsAppDataContext` (status, prioridade, fila, protocolo, atribuição, ações de resolver/transferir, badges SLA, CRM, etc.). Dentro do provider isolado do painel, o `selectedConversation` é um `useMemo` que filtra a lista `conversations` por `selectedContactId`. Se a conversa do deal não cair na primeira página de `loadConversations` (filtros, paginação, ordenação) ela nunca entra no array e o header fica sem dados — mesmo com o contato hidratado corretamente pelo nosso fix anterior.

2. **Botão "Abrir no Chat" perde contexto** — Hoje o `ExternalLink` no cabeçalho do painel apenas chama `navigate('/chat')`. O usuário precisa selecionar manualmente a fila e o contato de novo. O `ChatPage` já tem suporte a deep-link de contato via `sessionStorage('chat_pending_contact_id')`, mas não trata fila.

## Mudanças

### 1. Hidratar a conversa do deal direto no provider isolado

Em `src/contexts/WhatsAppDataContext.tsx`:

- Expor um novo método `upsertConversation(conv: ChatConversation)` no contexto que faz `setConversations(prev => merge by id)`. Isso permite injetar a conversa específica do deal sem depender da paginação/filtro do bootstrap.

Em `src/pages/crm-builder/components/deals/BoardChatSidePanel.tsx` (`ScopedChat`):

- Adicionar um `useQuery` paralelo (`['side-panel-conversation', conversationId]`) que faz `supabase.from('chat_conversations').select('*').eq('id', conversationId).maybeSingle()` usando o `conv.conversationId` já disponível via `useDealConversation`.
- Quando a row chegar, chamar `upsertConversation(row)` para que o `selectedConversation` derivado pelo `useMemo` do contexto encontre a conversa pelo `contact_id`.
- Passar `conversationId` como prop adicional para o `ScopedChat` (já temos via `conv.conversationId` no pai).

Resultado: o header recebe `selectedConversation` populado em todos os cards, independentemente do que veio na primeira página de conversas da fila.

### 2. Deep-link completo no botão "Abrir no Chat"

Em `src/pages/crm-builder/components/deals/BoardChatSidePanel.tsx`:

- Antes de `navigate('/chat')`, gravar em `sessionStorage`:
  - `chat_pending_contact_id` = `conv.contactId` (já existente)
  - `chat_pending_queue_id` = `conv.queueId`
  - `chat_pending_conversation_id` = `conv.conversationId`

Em `src/pages/chat/ChatPage.tsx`:

- Estender o `useEffect` de bootstrap para também ler `chat_pending_queue_id`. Antes de aplicar o `selectContact`, buscar a row da fila (`queues` por id) e chamar `setSelectedQueue(...)` se ainda não estiver selecionada. Só então aplicar o `selectContact(pending)` (após `loadContacts` da fila correta concluir — já controlado pelo `isReady && contacts.length > 0`).
- Limpar todas as chaves após uso.

### 3. Sem mudanças de schema, edge functions ou regras de negócio

Apenas frontend e camada de presentation/data fetching client-side.

## Arquivos afetados

- `src/contexts/WhatsAppDataContext.tsx` — novo `upsertConversation` exportado pelo contexto.
- `src/pages/crm-builder/components/deals/BoardChatSidePanel.tsx` — fetch direto de `chat_conversations`, injeção via `upsertConversation`, gravação de chaves de deep-link no `sessionStorage` antes do `navigate('/chat')`.
- `src/pages/chat/ChatPage.tsx` — leitura de `chat_pending_queue_id` no bootstrap e `setSelectedQueue` antes de selecionar o contato.

## Validação

- Abrir um card cujo contato cai fora da primeira página da fila → header agora mostra fila, status, badges, ações.
- Clicar no `ExternalLink` no cabeçalho do painel → `/chat` abre já com a fila correta selecionada e a conversa aberta com mensagens carregadas.
- Cards que já funcionavam continuam funcionando (merge é idempotente).