
## Objetivo

Ajustar o diálogo **Novo atendimento** (`src/components/chat/NewConversationDialog.tsx` + gatilho em `ChatList.tsx`) para (1) listar só filas conectadas, (2) não quebrar por unique constraint de contato, e (3) tratar conflitos com a mesma lógica do botão "Abrir Chat" do contato.

## Diagnóstico

- **Erro `duplicate key ... idx_chat_contacts_phone_client`**: existe um índice único em `chat_contacts (phone, client_id)`. O dialog tenta `INSERT` em `chat_contacts` quando a busca por `(client_id, channel_source, phone)` não acha nada — mas o contato já existe vinculado a outra fila. Precisamos buscar/reutilizar contato por `(client_id, phone)` (variantes BR) e nunca criar duplicado.
- **Filas desconectadas aparecem**: o `Select` usa `activeQueues.filter(channel_type==='uazapi')`. Não há filtro por conexão.
- **Fluxo de conflito atual**: mostra lista de conversas ativas e pede confirmação para "encerrar e iniciar nova" em qualquer caso — sem diferenciar status, fila ou responsável.

## Mudanças

### 1. `ChatList.tsx` — filtrar filas conectadas antes de passar ao dialog
- Reutilizar `useQueueConnectionStatusesBatch(queues)` (já existe) e passar somente `q.channel_type === 'uazapi'` cujo `statusMap.get(q.id) === true`.
- Se lista final for vazia, o `Select` já mostra "Nenhuma fila WhatsApp disponível".

### 2. `NewConversationDialog.tsx` — reescrever `ensureContactAndAssignedConversation` e o fluxo de envio

**Resolução de contato (fix do unique constraint):**
- Buscar contato via `brPhoneVariants(cleanPhone)` filtrando só por `client_id` (não por `channel_source`).
- Se achar: reutilizar `id`; se `channel_source` estiver vazio ou diferente da fila alvo, apenas atualizar `channel_source`/`channel_type` para a nova fila (o trigger `sync_contact_channel_source_from_conversation` também cobre isso, mas fazemos update explícito para consistência imediata).
- Se não achar: `INSERT` normal (aí sim único por telefone).

**Fluxo de envio (`handleSend`) — nova lógica de conflito:**

Depois de resolver `contactId` pelo telefone, buscar conversas do contato em `chat_conversations` com `status in ('pending','open')` (mesmo `client_id`), ordenadas por `updated_at desc`. Aplicar regras na ordem, sempre pela conversa mais recente:

| Situação da conversa existente | Ação |
|---|---|
| Nenhuma pending/open | Criar nova conversa `open` atribuída ao usuário atual → enviar mensagem → focar. |
| `status='open'` **e** `assigned_to` preenchido e diferente do usuário atual | **Bloquear**. Toast/inline error: "Este contato está em atendimento por **{assigned_to}**. Para falar com este número, peça ao atendente **{assigned_to}** para transferir a conversa para você." Sem enviar mensagem, sem criar nada. |
| `status='open'` sem responsável **ou** atribuído ao próprio usuário | Se `queue_id === selectedQueueId`: apenas focar a conversa (sem criar nova) e enviar a mensagem. Se `queue_id !== selectedQueueId`: atualizar `queue_id` para a fila alvo, garantir `assigned_to=usuário atual`, enviar mensagem e focar. |
| `status='pending'` (qualquer responsável) | Atualizar `queue_id` para a fila alvo, `status='open'`, `assigned_to`/`assigned_user_id` = usuário atual, `opened_at=now()`, enviar mensagem, focar. |
| Existe apenas conversa `resolved`/`closed` (nenhuma ativa) | Cai no caso "nenhuma pending/open" → criar nova conversa `open` atribuída ao usuário na fila solicitada. |

- Histórico: gravar em `chat_conversation_history` quando trocar de fila (`action='queue_switched_manual'`), reabrir/atribuir (`action='reassigned_manual'`) ou criar nova (`action='created_manual'`).
- Enviar mensagem via `sendUaZapiMessage()` só **depois** que a linha em `chat_conversations` estiver no estado esperado (evita mensagem sem ticket).

**UI:**
- Remover a tela intermediária de "Atendimento já existe" com botão "Encerrar e iniciar nova" (não é mais necessária). Substituir pela regra automática acima.
- Caso "bloqueado por atendente atual": exibir um `Alert` destructive dentro do próprio dialog com o texto acima e botão "OK" (fecha). Não navegar.
- Nos demais casos, seguir o padrão do botão "Abrir Chat" do contato: `setPendingSelection({ contactId, queueId })` + `navigate('/chat')` + toast de sucesso.

### 3. Sem mudanças de schema
Nenhuma migration necessária — o índice `idx_chat_contacts_phone_client` é intencional e a correção é aplicativa (reutilizar contato).

## Detalhes técnicos

- `currentUser` já é passado ao dialog em `ChatList.tsx` (verificar; se não, propagar do `AuthContext`).
- Comparação de responsável: normalizar por `assigned_user_id` quando existir, senão por `assigned_to` (nome). O usuário atual expõe ambos via `AuthContext`.
- Ao mudar `queue_id` de conversa existente, o trigger `trg_sync_contact_channel_source` já atualiza `chat_contacts.channel_source` — não duplicamos o update.
- `updated_at` na finalização de conversas antigas não é mais tocado (não usamos mais o "encerrar em massa").

## Verificação

- Build via harness.
- Playwright opcional: abrir `/chat`, clicar "Novo atendimento", validar que só filas com badge conectado aparecem; testar telefone que já tem contato em outra fila (não deve mais dar `duplicate key`).
