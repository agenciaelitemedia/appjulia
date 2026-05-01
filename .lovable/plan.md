## Objetivo

Remover o nome que aparece no topo dos balões de mensagem recebida quando a conversa é individual (lead), mantendo-o apenas em conversas de grupo, onde identifica quem falou.

## Alterações

### `src/components/chat/MessageBubble.tsx`
- Adicionar prop opcional `isGroup?: boolean` ao componente.
- Renderizar o bloco do `sender_name` (linhas 574-578) apenas quando `isGroup === true`:
  ```tsx
  {!message.from_me && isGroup && message.metadata?.sender_name && ( ... )}
  ```

### `src/components/chat/ChatMessages.tsx`
- Obter o contato selecionado via `useWhatsAppData()` (ou já disponível) e passar `isGroup={selectedContact?.is_group}` ao `MessageBubble`.

## Resultado

- Chat individual (lead): balão limpo, sem nome em cima do texto.
- Chat de grupo: nome do remetente continua aparecendo normalmente.
