## Objetivo

Substituir o popup de "Abrir chamado" disparado no chat por um painel lateral à direita que:
- Convive com a área de mensagens (sem bloquear cópia/edição/envio);
- Só fecha pelo botão "Fechar" (sem clique-fora/ESC);
- Sempre carrega os dados do contato/conversa que acionou (sem resíduo);
- Permite escolher o "Responsável pelo atendimento" reaproveitando a lista de membros da equipe já usada nos filtros de atendimento, com o usuário logado pré-selecionado;
- Preserva o vínculo direto com `contact_id` (e sinaliza grupo quando aplicável) para que o detalhe do chamado consiga abrir a conversa correta no mesmo painel lateral usado pelos cards do CRM.

Nada do fluxo atual do `/tickets` (página, kanban, dashboard, criação fora do chat) muda.

## Mudanças

### 1. Novo componente `ChatTicketSidePanel` (em `src/components/chat/`)
- Render como `Sheet` lateral direito, `modal={false}` e bloqueando `onPointerDownOutside`/`onEscapeKeyDown` (`e.preventDefault()`), de forma que o usuário continue interagindo com `ChatMessages`/`ChatInput`.
- Cabeçalho próprio com título "Abrir chamado" e botão X que é o **único** caminho de fechamento.
- Largura ~`w-[440px]`/`sm:w-[480px]`, sem overlay escuro.
- Reaproveita o formulário do `NewTicketDialog` (mover o corpo para um `<ChatTicketForm>` interno), com o seguinte ajuste de estado:
  - `key={contact.id + '|' + (conversation?.id ?? '')}` para resetar o formulário sempre que mudar o contato/conversa de origem (corrige "dados antigos").
  - Novo campo **Responsável pelo atendimento** (`assigned_to`) usando `useTeamByClient()` (mesma fonte do filtro de atendimentos / `TransferDialog`). Default = usuário logado (`user.id` se aparecer na lista, senão `user.name`).
  - Detectar grupo via `contact.is_group` (ou `remote_jid` terminando em `@g.us`) e, ao submeter, enviar `metadata: { is_group: true, group_jid: contact.remote_jid }` para `support_tickets`.
  - Sempre enviar `contact_id: contact.id` e `conversation_id: selectedConversation?.id ?? null` (vindo do `prefill`).

### 2. Integração no chat
Em `src/components/chat/ChatHeader.tsx`:
- Trocar `<NewTicketDialog ... />` (linhas 811-821) por `<ChatTicketSidePanel open={showNewTicket} onClose={() => setShowNewTicket(false)} contact={contact} conversation={selectedConversation} />`.
- Manter o item do menu "Abrir ticket de suporte" como está.

Como o painel não é modal, a área de mensagens (`ChatMessages`/`ChatInput`) continua clicável. Não precisa redimensionar o `ChatContainer`: o painel passa a coexistir sobre o lado direito da viewport e, em viewports menores, o usuário pode rolar/usar normalmente — mesmo padrão visual do `ChatSidePanel` já usado pelo CRM.

### 3. Persistência do "responsável" e do "grupo"
No `useTicketMutations().create` (em `src/pages/tickets/hooks/useTickets.ts`):
- Aceitar e gravar `assigned_to` (+ `assigned_to_name` resolvido pelo nome do membro selecionado) na criação.
- Aceitar e mesclar `metadata` (jsonb) ao insert do ticket. Se o schema atual não contiver coluna `metadata`/`assigned_to_name`, ajustar para usar as colunas já existentes (`assigned_to` já existe em `support_tickets`; `assigned_to_name` também). A flag `is_group` vai em `metadata` (criar a coluna se ainda não existir via migration adicionando `metadata jsonb default '{}'::jsonb`).

### 4. `TicketDetailPage` — abrir conversa no painel lateral igual ao do CRM
Em `src/pages/tickets/TicketDetailPage.tsx`:
- Substituir o botão atual "Abrir conversa no WhatsApp" (que faz `navigate('/chat')`) por um botão que abre o componente reusável `ChatSidePanel` (`src/components/chat/ChatSidePanel.tsx`).
- Montar o `target` a partir do ticket:
  - `contactId = ticket.contact_id`
  - `conversationId = ticket.conversation_id`
  - `queueId`: resolver via consulta `chat_conversations.queue_id` quando houver `conversation_id`; senão, buscar a conversa mais recente do contato (`chat_conversations` por `contact_id` ordenado por `updated_at desc`) para obter `queue_id`. Encapsular num hook local `useTicketChatTarget(ticket)`.
- Botão fica desabilitado quando `ticket.contact_id` é nulo.

### 5. Limpeza
- `NewTicketDialog` continua existindo e sendo usado apenas em `TicketsPage` (botão global "Abrir chamado"). Nenhuma mudança visual ali.

## Detalhes técnicos

- **Sheet não-modal**: `radix-ui/react-dialog` (base do `Sheet`) aceita `modal={false}`. Vamos passar a prop direto no `SheetPrimitive.Root` via um wrapper local (ou usar `Popover`/`<div className="fixed">` se a propriedade não estiver exposta no `Sheet` atual). Implementação preferida: `Sheet open ... modal={false}` + `SheetContent onInteractOutside={(e)=>e.preventDefault()} onEscapeKeyDown={(e)=>e.preventDefault()}`.
- **Resetar estado entre aberturas**: usar `key` no `<ChatTicketForm>` derivado de `contact.id + conversation.id`, garantindo `useState` zerado em cada novo alvo.
- **Lista de equipe**: `useTeamByClient()` retorna o mesmo array usado em `ChatList`/`TransferDialog`, garantindo paridade com o filtro de atendimentos. Pré-seleção: procurar item cujo `id === user.id` (ou `name === user.name` como fallback).
- **Vínculo com grupo**: além de `metadata.is_group`, manter `contact_id` (já é a chave usada por `ChatSidePanel`) — o painel do CRM resolve o contato/queue sem depender do tipo individual vs grupo.
- **Sem regressões**: nenhuma mudança em `TicketsPage`, kanban, dashboard, lista, settings, edge functions ou triggers de `support_tickets`.

## Arquivos afetados

- `src/components/chat/ChatTicketSidePanel.tsx` (novo)
- `src/components/chat/ChatHeader.tsx` (troca do dialog pelo side panel)
- `src/pages/tickets/hooks/useTickets.ts` (aceitar `assigned_to`, `assigned_to_name`, `metadata` no `create`)
- `src/pages/tickets/TicketDetailPage.tsx` (botão "Abrir conversa" → `ChatSidePanel`)
- `src/components/chat/index.ts` (export do novo componente, se aplicável)
- Migration opcional adicionando `metadata jsonb` em `support_tickets` se ainda não existir.

## Critérios de aceite

1. Clicar em "Abrir ticket de suporte" no menu do chat abre um painel lateral à direita; mensagens continuam clicáveis, selecionáveis e enviáveis.
2. Painel só fecha pelo botão X. Cliques fora e ESC não fecham.
3. Mudar de conversa e abrir o painel novamente mostra os dados do novo contato (nada residual).
4. Há um campo "Responsável" cuja lista é igual à dos filtros de atendimento e vem com o usuário atual selecionado.
5. Tickets criados a partir de grupo guardam `is_group=true` em `metadata` e o `contact_id` correto.
6. Em `/tickets/:id`, o botão de abrir conversa abre o mesmo `ChatSidePanel` lateral usado pelos cards do CRM, com a conversa do contato vinculado.
