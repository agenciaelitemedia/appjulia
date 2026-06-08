Ajustar o botão de menu de ações em `src/components/chat/ConversationQuickActions.tsx` para não ocupar espaço quando o mouse não estiver sobre a conversa.

Mudança única no `className` do `Button` (trigger do DropdownMenu):

- Remover: `opacity-0 group-hover:opacity-100 focus-visible:opacity-100`
- Adicionar: largura colapsada por padrão e expansão no hover/focus/aberto:
  - base: `h-5 w-0 p-0 overflow-hidden opacity-0 transition-[width,opacity] duration-150`
  - hover/foco no grupo: `group-hover:w-5 group-hover:opacity-100 focus-visible:w-5 focus-visible:opacity-100`
  - estado aberto: `open && 'w-5 opacity-100'`

Resultado: sem hover, o chevron some completamente e os ícones (PriorityBadge etc.) ficam encostados à direita. Ao passar o mouse, o botão aparece à direita do PriorityBadge.

Nada mais é alterado (lógica, dialogs, estilos do item, comportamento de clique permanecem iguais).