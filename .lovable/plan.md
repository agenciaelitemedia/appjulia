## Objetivo
Quando o usuário envia a primeira mensagem pelo diálogo "Nova conversa" no /chat, a conversa já deve aparecer imediatamente na lista e na aba **Meu atendimento**, atribuída ao usuário que iniciou.

## Diagnóstico
Em `src/components/chat/NewConversationDialog.tsx`, o fluxo **sem conflito** (`handleSend`) hoje apenas dispara `sendUaZapiMessage()` e espera o webhook do UaZapi criar contato + conversa. Resultado: a conversa entra como `pending` sem `assigned_to`, então não aparece em "Meu atendimento" e demora para surgir.

O fluxo de conflito (`handleCloseAndStartNew`) já faz exatamente o que queremos: garante contato, cria `chat_conversations` com `status='open'`, `assigned_to`, `assigned_user_id` e foca a conversa. Vamos reaproveitar essa lógica no caminho normal.

## Mudanças

### `src/components/chat/NewConversationDialog.tsx` — `handleSend`
Após o pré-check de conflito (mantido) e antes de enviar a mensagem, executar a mesma sequência usada em `handleCloseAndStartNew` (sem o passo 1 de encerramento):

1. Garantir contato (`chat_contacts` find-or-create por `client_id` + `channel_source=queueId` + `phone`).
2. Inserir `chat_conversations` com:
   - `client_id`, `contact_id`, `queue_id`, `channel='whatsapp_uazapi'`
   - `status='open'`
   - `assigned_to = currentUser.name`
   - `assigned_user_id = Number(currentUser.id)`
   - `opened_at = now`, `protocol=''` (trigger preenche)
3. Enviar a mensagem via `sendUaZapiMessage()`.
4. Chamar `goToChatWithSelection(contact_id, queue_id)` para focar a nova conversa.
5. Toast de sucesso e fechar diálogo.

Guardas:
- Só executa a criação up-front quando `clientId` e `currentUser?.codAgent` estiverem disponíveis (props já existentes). Sem eles, mantém o comportamento legado de só enviar a mensagem (fallback seguro).
- Refatorar a parte de "garantir contato + criar conversa atribuída" em uma helper interna compartilhada por `handleSend` e `handleCloseAndStartNew` para evitar duplicação.

## Resultado esperado
- A conversa aparece instantaneamente na lista do `/chat`.
- Já entra na aba **Meu atendimento** porque `assigned_to`/`assigned_user_id` apontam para o usuário atual.
- O trigger `auto_open_on_insert_assignment` mantém `status='open'`.
- O webhook subsequente do UaZapi só atualiza a conversa existente (mesma fila + contato), sem duplicar.
