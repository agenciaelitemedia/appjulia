## Objetivo

Ao clicar no botão verde de "Abrir Chat" em `/contatos`, o contato deve:
1. Ter sua conversa mais recente **atribuída ao usuário que clicou**.
2. Se estiver `resolved` ou `closed`, ser **reaberta** (`status = 'open'`).
3. Aparecer selecionada na aba **"Meus atendimentos" (Em aberto)** do `/chat`, já mostrando as mensagens.

Hoje o botão só grava `chat_pending_contact_id` no sessionStorage e navega para `/chat` — não atribui, não reabre, e cai na aba padrão.

## Mudanças

### 1. `src/pages/contatos/components/ContactsTable.tsx`

Substituir o `handleOpenChat` atual por um handler assíncrono que:

- Busca em `chat_conversations` a conversa mais recente do contato (filtrando por `client_id` e `contact_id`), pegando `id, queue_id, status, assigned_to`.
- Se `status ∈ {resolved, closed}`: `UPDATE` setando `status='open'`, `resolved_at=null`, `closed_at=null`, `assigned_to=<user.name>`, `assigned_user_id=<user.id>`, `updated_at=now()`, e insere linha em `chat_conversation_history` com `action='reopened'` + `action='assigned'`.
- Se `status ∈ {pending, open}` e o `assigned_to` estiver vazio **ou** diferente do usuário atual: `UPDATE` atribuindo ao usuário atual + history `action='assigned'`.
- Se não existir conversa alguma: apenas segue o fluxo atual (o `selectContact` do contexto cria/reabre conforme a regra do webhook — não força criação artificial).
- Chama `setPendingSelection({ contactId, queueId, conversationId, tab: 'open' })` (via `@/lib/chat/pendingSelection`).
- `navigate('/chat')`.

Usar `useAuth()` para obter `user.name` / `user.id`. Toast de erro em caso de falha.

### 2. Nada mais precisa mudar

- `ChatPage.tsx` já lê `PendingSelection`, aplica `tab`, hidrata a fila e chama `selectContact` — o contato aparecerá selecionado e as mensagens carregam.
- A regra de "pending + assigned_to preenchido conta como open" (memória `chat-contact-deduplication`) garante que o contato apareça na aba "Em aberto" (Meus atendimentos).
- Não altera a lógica do webhook nem a UI de outros botões.

## Notas técnicas

- Reabrir só quando `status ∈ {resolved, closed}` — não mexer em conversas ativas com outro dono sem intenção clara. Como o pedido diz "atribuir a pessoa que clicou", vamos **sobrescrever** o `assigned_to` mesmo se já existir outro (comportamento equivalente a "transferir para mim").
- Registrar histórico (`chat_conversation_history`) para auditoria, seguindo o padrão do `assignConversation` do contexto.
- Não disparar `followup-stop` / reactive aqui: `assignConversation` do contexto já cuida disso quando o usuário interage no chat. Manter esse handler enxuto e focado em atribuir+reabrir+deep-link.
