

## Objetivo
Na lista de conversas (badges row 3 do `ChatContactItem`), exibir um ícone de **prioridade** sempre alinhado à direita. Ao clicar, abrir um popover para definir nova prioridade — o que automaticamente recalcula o SLA (já é derivado de `priority` em `evaluateSla`).

## Diagnóstico
- `ChatContactItem` (row 3) hoje renderiza: fila → SLA → atribuído → 1 extra (incluindo "PRIORIDADE" quando high/urgent).
- `evaluateSla` em `useChatSlaConfigs` já usa `priority` como entrada — basta mudar `chat_conversations.priority` que o badge SLA recalcula automaticamente via React Query.
- Existe `useUpdateConversationPriority` (a confirmar) ou pode-se usar update direto em `chat_conversations`. Vou usar o hook existente do módulo de chat.

## Mudanças

### 1. Novo componente `PriorityBadge` (`src/components/chat/PriorityBadge.tsx`)
- Ícone clicável (`Flag` colorido por nível): cinza=low, azul=normal, âmbar=high, vermelho=urgent.
- `Popover` com 4 opções (Baixa / Normal / Alta / Urgente), cada uma com cor + label.
- Props: `conversationId`, `currentPriority`, `compact?`.
- Ao selecionar, chama `supabase.from('chat_conversations').update({ priority }).eq('id', conversationId)` e invalida queries `['chat-conversations']` / `['chat-contacts']`.
- `stopPropagation` no clique para não selecionar a conversa.

### 2. `src/components/chat/ChatContactItem.tsx`
- Remover do array `extraBadges` a entrada "PRIORIDADE" (não é mais um pill genérico).
- Na row 3, alterar layout para:
  - Container `flex items-center gap-1 w-full`
  - Esquerda (flex-1, truncável): fila → SLA → atribuído → extras (apenas tags agora).
  - Direita (`ml-auto flex-shrink-0`): `<PriorityBadge conversationId={conversation.id} currentPriority={conversation.priority} compact />`.
- Renderizar apenas se `conversation` existir.

### 3. Comportamento SLA
- Nenhuma mudança necessária: `evaluateSla` já lê `priority` da conversation; após o update, o React Query refetch dispara e o `SlaBadge` atualiza sozinho.

## Arquivos
- **Novo**: `src/components/chat/PriorityBadge.tsx`
- **Editar**: `src/components/chat/ChatContactItem.tsx`

## Resultado
- Ícone de bandeira colorida sempre à direita de cada item na lista.
- Clique abre popover → escolha nova prioridade → SLA recalcula automaticamente.
- Não interfere no clique de seleção da conversa.

