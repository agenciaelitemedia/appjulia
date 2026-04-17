
## Diagnóstico

**Problema 1 — Contagem de não lidas some ao clicar em conversa não atribuída:**
Em `WhatsAppDataContext.tsx`, `selectContact` chama `markAsRead` imediatamente, zerando `unread_count` no banco e no state. Como o usuário ainda não "assumiu" a conversa, a contagem deveria continuar visível na lista.

**Problema 2 — Input de mensagem habilitado mesmo sem assumir:**
Em `ChatInput.tsx` e `ChatHeader.tsx`, o campo de texto, anexos, áudio e botão de envio sempre aparecem ativos. Hoje só temos `canTakeOver` no header (mostra botão "Assumir"), mas o input não é bloqueado.

## Solução

### 1. Não marcar como lida automaticamente ao selecionar
**`src/contexts/WhatsAppDataContext.tsx`** — em `selectContact`, **remover** a chamada automática a `markAsRead(contactId)`. A marcação como lida passa a ocorrer somente quando o atendente clicar em "Assumir" (já chama `assignConversation`).

Adicionar `markAsRead` dentro do fluxo de assumir: criar wrapper `claimConversation(conversationId)` que faz:
- `assignConversation(conversationId, currentUserName)`
- `updateConversationStatus(... 'open')` se estava `pending`
- `markAsRead(contactId)` para zerar o badge

Atualizar `ChatHeader.handleTakeOver` para usar esse fluxo unificado (ou manter no header e apenas chamar `markAsRead` lá após o assign).

### 2. Bloquear input até a conversa ser assumida
**`src/components/chat/ChatInput.tsx`** — calcular `isAssignedToMe`:

```ts
const currentUserName = user?.name || (user?.id ? String(user.id) : '');
const isAssignedToMe = !!selectedConversation?.assigned_to 
  && selectedConversation.assigned_to === currentUserName;
const canSend = isAssignedToMe && ['pending','open'].includes(selectedConversation?.status ?? '');
```

Comportamento:
- Se `!canSend` e a conversa **não está encerrada/resolvida**, exibir um banner discreto no topo do input: *"Assuma esta conversa para responder"* + botão "Assumir" (atalho para o mesmo fluxo do header).
- `Textarea`, botões de anexo, emoji, áudio, agendamento e envio recebem `disabled={!canSend || isSending}`.
- Manter a Nota Interna (`StickyNote`) **habilitada** mesmo sem assumir — notas internas devem poder ser registradas por qualquer atendente que está observando.
- Conversas `closed`/`resolved` continuam com o comportamento atual (sem alteração — input pode ficar visível porém o header já mostra "Reabrir").

### 3. Garantir que o badge de não lidas siga visível na lista
Como `markAsRead` deixa de ser chamado em `selectContact`, o `unread_count` permanece em `chat_contacts` até o atendente assumir. O `ChatContactItem` já renderiza o badge vermelho redondo quando `unread_count > 0` — sem mudanças no componente.

## Arquivos a editar

1. `src/contexts/WhatsAppDataContext.tsx` — remover `markAsRead` do `selectContact`.
2. `src/components/chat/ChatHeader.tsx` — chamar `markAsRead(contact.id)` ao final de `handleTakeOver`.
3. `src/components/chat/ChatInput.tsx` — adicionar guard `canSend`, banner "Assumir para responder" com botão de assumir, e `disabled` nos controles de envio (mantendo Nota Interna habilitada).

## Fluxo final

```text
Clicar conversa não atribuída
  → mensagens carregam (visualização total)
  → badge de não lidas permanece
  → input bloqueado + banner "Assumir para responder"
Clicar "Assumir" (header ou banner)
  → assigned_to = eu, status = open
  → markAsRead zera badge
  → input desbloqueia
```
