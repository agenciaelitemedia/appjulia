## Objetivo

Na lista de conversas (`/chat`), permitir abrir um ticket de suporte (ou visualizar/editar o ticket já vinculado) diretamente a partir de cada conversa, via menu de contexto (clique direito) + botão de atalho no hover. O comportamento deve espelhar o fluxo já existente no `ChatHeader > Abrir ticket de suporte`, e só aparecer para usuários com permissão no módulo `support_tickets`.

## Comportamento

1. **Gatilho na lista** (`ChatContactItem`):
   - **Clique direito** sobre o item da conversa abre um menu (`ContextMenu` do shadcn).
   - Também adicionar um botão discreto no hover (ícone `LifeBuoy`) ao lado dos QuickActions já existentes, para descoberta.
   - Item do menu:
     - Se a conversa **não tem ticket aberto** (`ticketLink` ausente): "Abrir ticket de suporte".
     - Se a conversa **tem ticket aberto** (`ticketLink` presente): "Ver ticket #N (status)".
   - Em ambos os casos, ao clicar:
     1. Seleciona o contato (`selectContact(contact.id)`) → mensagens carregam normalmente no painel central.
     2. Abre o painel lateral de ticket (mesmo painel já usado pelo header).

2. **Visibilidade (permissão)**:
   - Usar `hasPermission('support_tickets', 'view')` do `AuthContext`.
   - Sem permissão: nem o item do menu de contexto, nem o botão de hover aparecem.
   - Para "Abrir ticket" (criar), exigir `hasPermission('support_tickets', 'create')`; sem create mas com view, só permitir "Ver ticket #N".

3. **Painel lateral**:
   - **Modo criar** (sem ticket vinculado): reutilizar `ChatTicketSidePanel` atual, sem alterações.
   - **Modo visualizar/editar** (ticket já vinculado): novo componente `ChatTicketDetailSidePanel` com a mesma "casca" (portal lateral 460px, header com X) usada pelo `ChatTicketSidePanel`. Conteúdo: formulário equivalente ao `NewTicketDialog` mas pré-carregado a partir de `useTicket(id)` e usando as mutations existentes (`update`, `changeStatus`, `assign`, `csat`, `delete`) de `useTickets.ts`. Campos editáveis: assunto, descrição, prioridade, departamento, categoria, responsável, status. Botões: "Salvar", "Resolver", "Fechar", "Reabrir" (conforme status atual).
   - Ambos os painéis convivem com a área de chat (não-modal), iguais ao atual.

4. **Estado/onde mora**:
   - Estado `ticketPanel: { mode: 'create' | 'detail', ticketId?: string } | null` no `ChatContainer` (acima de `ChatList` e da área de chat), passado para `ChatList` via prop `onOpenTicketPanel(contact, mode, ticketId)` e renderizado lá no topo.
   - O `ChatList` já tem o `ticketLinkMap`; decide `mode`/`ticketId` ao chamar.
   - Quando o usuário clica em "Abrir/Ver ticket": (a) chama `selectContact(contact.id)`, (b) chama `setTicketPanel(...)`.

5. **Vínculo automático**:
   - A criação via painel já preenche `conversation_id` → trigger DB existente atualiza `active_ticket_id` em `chat_conversations`, e o `useTicketLinkedConversations` reflete em tempo real (badge laranja já implementado). Nada a mudar aqui.
   - Ao fechar/resolver pelo novo painel de detalhes, o mesmo trigger limpa o vínculo.

## Arquivos afetados

- **Editar** `src/components/chat/ChatContactItem.tsx`
  - Envolver o `<div>` raiz com `<ContextMenu>` / `<ContextMenuTrigger>` / `<ContextMenuContent>`.
  - Adicionar prop `onOpenTicket?: (mode: 'create' | 'detail', ticketId?: string) => void`.
  - Renderizar itens do menu conforme `ticketLink` e permissões (`useAuth().hasPermission`).
  - (Opcional) botão `LifeBuoy` no hover, ao lado dos QuickActions.

- **Editar** `src/components/chat/ChatList.tsx`
  - Receber `onOpenTicketPanel(contact, mode, ticketId?)` via prop.
  - Repassar `onOpenTicket` para cada `ChatContactItem`, montando o handler que (a) `selectContact`, (b) chama `onOpenTicketPanel` com base no `ticketLinkMap`.

- **Editar** `src/components/chat/ChatContainer.tsx`
  - Estado local `ticketPanel`.
  - Passar `onOpenTicketPanel={(c, mode, id) => setTicketPanel({ contact: c, mode, ticketId: id })}` para `<ChatList />`.
  - Renderizar condicionalmente `<ChatTicketSidePanel>` (mode=create) ou `<ChatTicketDetailSidePanel>` (mode=detail) no nível do container.

- **Criar** `src/components/chat/ChatTicketDetailSidePanel.tsx`
  - Reaproveita a casca em `createPortal` do `ChatTicketSidePanel` (extrair um wrapper `<TicketSidePanelShell title onClose>` em arquivo compartilhado seria ideal, mas para minimizar risco mantemos casca duplicada).
  - Usa `useTicket(ticketId)`, `useTicketMutations`, `useSupportConfig`, `useTeamByClient`.
  - Formulário pré-preenchido + ações (Salvar / Resolver / Fechar / Reabrir / Excluir, esta última só com `delete` permission).
  - Toasts + invalidações já cuidadas pelas mutations existentes.

- **Sem alterações** em DB, em `useTickets.ts`, em `useTicketLinkedConversations.ts`, em `ChatHeader.tsx`.

## Riscos e mitigação

- **Conflito de UI** com `ConversationQuickActions` no hover: manter o novo botão pequeno (ícone-only) e atrás de `hasPermission`. Pode ser deixado só no context menu para reduzir poluição visual.
- **Painel concorrente**: garantir que abrir o painel lateral fecha o que estiver aberto (state único `ticketPanel` no container resolve).
- **Stale link**: depois de fechar/resolver o ticket pelo novo painel, o trigger limpa `active_ticket_id`; o realtime de `useTicketLinkedConversations` atualiza o badge automaticamente.
- **Permissões**: gating no item do menu impede ação; rotas de mutação no `useTickets` já são protegidas pelo módulo.

## Fora de escopo

- Mudanças no esquema de banco.
- Mudanças no header da conversa.
- Mudanças no módulo `/tickets`.
