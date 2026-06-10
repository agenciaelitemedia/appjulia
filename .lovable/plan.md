## Objetivo

Replicar no menu dropdown (chevron) de cada item da lista de conversas a mesma opção de ticket de suporte que existe no menu "..." do cabeçalho do chat — com idênticas regras de exibição.

## Regra (igual ao ChatHeader)

- Visível apenas quando `user.role === 'admin' || user.role === 'colaborador'`.
- Se a conversa já possui ticket vinculado (`ticketLink`): mostra **"Ver ticket de suporte #N"** (ícone `Eye`) → abre o painel lateral de detalhe do ticket.
- Caso contrário: mostra **"Abrir ticket de suporte"** (ícone `LifeBuoy`) → abre o painel lateral de novo ticket.

## Mudanças

### 1. `src/components/chat/ConversationQuickActions.tsx`
- Adicionar props opcionais: `ticketLink?: TicketConversationLink` e `onOpenTicket?: (mode: 'create' | 'detail', ticketId?: string) => void`.
- Importar `useAuth` (já existe) e `LifeBuoy`, `Eye` de lucide-react.
- Renderizar um `DropdownMenuSeparator` + o item de ticket logo após "Encerrar conversa", aplicando o gate de role e a lógica condicional ticketLink/sem ticketLink, chamando `onOpenTicket(...)`.

### 2. `src/components/chat/ChatContactItem.tsx`
- Repassar para `<ConversationQuickActions>` as props `ticketLink={ticketLink}` e `onOpenTicket={onOpenTicket}` (ambas já disponíveis no componente — usadas hoje pelo ContextMenu de clique-direito).

## Fora de escopo

- Não alterar `ChatList` (já fornece `onOpenTicketPanel` que termina em `onOpenTicket`).
- Não alterar `ChatHeader`, painéis de ticket, hooks de permissão, ou o ContextMenu existente.
- Não mexer em estilos da lista nem na lógica de assumir/transferir/encerrar.