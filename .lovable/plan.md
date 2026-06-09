## Objetivo

Ajustar três pontos do fluxo de Ticket de Suporte dentro do módulo de Chat, alinhando o comportamento ao já praticado pelo bloco CRM.

---

### 1. Badge TICKET na lista de conversas: deixar de abrir link externo

**Arquivo:** `src/components/chat/ChatContactItem.tsx` (linhas 332–375)

- Remover o `role="link"`, o `onClick` que faz `window.open('/tickets/{id}')` e o `cursor-pointer` do contêiner da linha "TICKET #N · status".
- O bloco passa a ser puramente informativo (igual ao bloco CRM Builder logo acima), de forma que o clique no item da lista continue selecionando a conversa normalmente e abrindo as mensagens no chat.
- Mantém-se o Tooltip com número/assunto/status/prioridade.
- Mantém-se o menu de contexto (botão direito) com as opções "Ver ticket #N" (abre painel lateral de detalhes) e "Abrir no módulo" (nova aba), que continuam funcionando como atalhos avançados.

---

### 2. Item "Abrir ticket de suporte" não aparece no menu da lista de conversas

**Causa:** Em `ChatContactItem.tsx` o menu de contexto está gated por `hasPermission('support_tickets', 'view' | 'create')`. Para usuários cujo papel ainda não recebeu permissões finas no módulo `support_tickets` (cenário comum hoje), o menu inteiro é suprimido — mesmo para admin/colaborador, que no header já têm acesso direto via `user.role`.

**Correção em `src/components/chat/ChatContactItem.tsx`:**

- Trocar as guardas `canViewTickets` / `canCreateTickets` por uma regra equivalente à do header:
  - `canViewTickets = hasPermission('support_tickets','view') || user?.role === 'admin' || user?.role === 'colaborador'`
  - `canCreateTickets = hasPermission('support_tickets','create') || user?.role === 'admin' || user?.role === 'colaborador'`
- Assim, quando não há ticket vinculado, o item "Abrir ticket de suporte" passa a aparecer no menu de contexto para admin/colaborador, idêntico ao item já existente no header da conversa.

Observação: isto preserva o RLS do banco — a permissão fina continua sendo respeitada para perfis de equipe; apenas garantimos paridade para admin/colaborador.

---

### 3. Header do chat: "Abrir ticket de suporte" deve abrir o ticket existente

**Arquivo:** `src/components/chat/ChatHeader.tsx` (linhas 700–722 e 811–817)

Hoje o `DropdownMenuItem` "Abrir ticket de suporte" sempre abre `ChatTicketSidePanel` (modo criação), mesmo quando já existe ticket aberto vinculado à conversa.

**Mudanças:**

1. Importar e consumir `useTicketLinkedConversations` para obter o `ticketLink` da conversa selecionada (`selectedConversation?.id`).
2. Adicionar estado `showTicketDetail` (string | null) com o `ticketId` quando aberto.
3. No `DropdownMenuItem`:
   - Se `ticketLink` existe → rótulo passa a ser "Ver ticket de suporte #N" e o clique abre `ChatTicketDetailSidePanel` com `ticketId = ticketLink.ticketId`.
   - Se não existe → mantém rótulo "Abrir ticket de suporte" e abre o `ChatTicketSidePanel` atual (criação).
4. Renderizar `ChatTicketDetailSidePanel` ao lado do `ChatTicketSidePanel` no final do componente, controlado por `showTicketDetail`.

O painel de detalhes (`ChatTicketDetailSidePanel`) já é o mesmo usado pelo menu de contexto da lista, garantindo experiência consistente: o detalhe abre no mesmo "slot" lateral onde a criação apareceria.

---

### Validação

- Lista: o item da conversa com ticket exibe a linha laranja "TICKET #N · status" sem cursor de link; clique no item abre as mensagens no chat. Botão direito segue mostrando "Ver ticket / Abrir no módulo".
- Lista (sem ticket): botão direito mostra "Abrir ticket de suporte" para admin/colaborador.
- Header: ao abrir uma conversa **com** ticket aberto, o menu "⋮ → Ver ticket de suporte #N" abre o `ChatTicketDetailSidePanel`. Em conversa **sem** ticket, o mesmo menu mostra "Abrir ticket de suporte" e abre o painel de criação.

### Fora de escopo

- Nenhuma mudança em banco, edge functions ou RLS.
- Nenhuma alteração no módulo `/tickets` em si.
