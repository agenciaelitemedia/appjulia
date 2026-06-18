## Objetivo

Adicionar um ícone de WhatsApp (verde) em cada linha das três listagens do drawer de desempenho da equipe:

- `UserConversationsDialog` (Atendimentos)
- `UserOutcomesDialog` (Desfechos)
- `UserCallsDialog` (Ligações)

Ao clicar, abre o **`ChatSidePanel`** (omnichannel, mesmo painel reusado pelo CRM Builder/Contratos). Esse painel **não exige `cod_agent`** — funciona com `{ contactId, queueId, conversationId }` resolvidos pela própria conversa, e suporta chats que não têm agente IA vinculado.

## Mudanças por arquivo

### 1. Hooks de listagem — incluir IDs necessários
`src/pages/equipe/hooks/useTeamPerformance.ts`
- `UserConversationRow` e `UserOutcomeRow`: adicionar `contact_id: string | null` e `conversation_id: string` ao tipo e ao retorno (já são selecionados internamente — só passar adiante).
- `UserCallRow`: já tem `called`/`caller`; nada a alterar nas queries.

### 2. Novo hook `src/pages/equipe/hooks/useChatTargetByPhone.ts`
Resolve um `ChatSidePanelTarget` a partir de um telefone (usado pelas Ligações, que só têm número):
1. Normaliza o telefone (`phoneNormalize`).
2. Busca em `chat_contacts` por `phone` no `client_id` atual → pega `contact_id`.
3. Busca em `chat_conversations` a conversa mais recente para esse `contact_id` → pega `conversation_id` e `queue_id`.
4. Retorna `{ contactId, queueId, conversationId } | null`.
- `staleTime: 60s`, `enabled: !!phone`, fetch só dispara quando o sheet abre.

### 3. Novo hook `src/pages/equipe/hooks/useChatTargetByConversation.ts`
Para Atendimentos/Desfechos que já têm `conversation_id`:
- Lê `chat_conversations` (`id, contact_id, queue_id`) e retorna o target. Mais barato que passar pelo telefone.

### 4. Componente compartilhado `src/pages/equipe/components/OpenChatButton.tsx`
- Botão `rounded-full`, ícone `MessageCircle` em verde (`text-green-600 hover:bg-green-50`), tooltip "Abrir conversa".
- Props (uma das duas formas):
  - `{ conversationId: string }` → usa `useChatTargetByConversation`
  - `{ phone: string | null }` → usa `useChatTargetByPhone`
- Estado local `open`. Hooks com `enabled: open` (lazy).
- Renderiza `<ChatSidePanel open={open} onOpenChange={setOpen} target={target} isLoading={isLoading} />`.
- Desabilita quando não há entrada (sem phone e sem conversationId).
- Se o resolver retornar `null`, o próprio `ChatSidePanel` já exibe "não encontrada" (via `emptyDescription`) — sem toast custom.

### 5. `UserConversationsDialog.tsx`
- Adicionar coluna "Ações" à direita.
- Em cada `<TableRow>`: `<OpenChatButton conversationId={r.id} />` (já que `id` é o `conversation_id`).

### 6. `UserOutcomesDialog.tsx`
- Mesmo padrão: coluna "Ações" + `<OpenChatButton conversationId={r.conversation_id} />`.

### 7. `UserCallsDialog.tsx`
- Coluna "Ações" + `<OpenChatButton phone={r.called || r.caller} />`.
- Ligações não têm vínculo direto com conversa, então o lookup vai pelo telefone.

## Por que `ChatSidePanel` e não `WhatsAppMessagesDialog`

- `WhatsAppMessagesDialog` é amarrado ao mundo de **agente IA** (`cod_agent` obrigatório, `useAgentQueueLink`, `SessionStatusDialog`). Quebra para conversas sem agente vinculado, conversas humanas, ou números fora do CRM.
- `ChatSidePanel` é o painel omnichannel padrão (mesmo usado em `CRMLeadCard` linhas 432-437 e `BoardChatSidePanel`): só precisa de `contactId` + `queueId` + `conversationId`, respeita `useUserQueueAccess` e dá botão "Abrir no Chat".

## Observações

- Nenhuma migração de banco.
- Memória [Standard Actions](mem://features/estrategico/standardized-lead-actions-v3): ícone WhatsApp verde, `rounded-full`.
- Lazy lookup garante que listagens grandes não disparem N queries — só quando o usuário clicar.
