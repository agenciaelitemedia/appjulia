# Plano: Devolver conversa para a fila de aguardando atendimento

## Objetivo
Logo após o botão **Transferir** (no header da conversa), incluir um novo botão **Devolver para fila** que:
1. Abre um modal com campo opcional de **nota de atenção** + botão de confirmação.
2. Remove a atribuição (`assigned_to = null`) e volta o status para `pending`.
3. Registra um evento no histórico (`chat_conversation_history`) que aparece como badge na timeline da conversa (ex.: *"Fulano devolveu a conversa para a fila de atendimento — 06/06 08:19"*).
4. O badge é controlável pelo painel de configurações de eventos do chat (mesma lógica dos demais).

## Mudanças

### 1. Novo componente `ReturnToQueueDialog.tsx`
`src/components/chat/ReturnToQueueDialog.tsx` — espelha o `TransferDialog`:
- Textarea opcional "Nota de atenção" (placeholder: "Motivo do retorno à fila...").
- Aviso: "A atribuição atual será removida e a conversa voltará para Aguardando atendimento."
- Botões **Cancelar** / **Devolver para fila** (variant destructive/amber).

### 2. `ChatHeader.tsx`
- Importar `ReturnToQueueDialog` e ícone `Undo2` (lucide).
- Adicionar `showReturnDialog` state.
- Inserir novo botão logo após o botão de Transferir (linha ~607), cor âmbar, `title="Devolver para fila"`, desabilitado quando `!isActive` ou quando `!selectedConversation?.assigned_to`.
- Implementar `handleReturnToQueue(note?: string)`:
  1. Capturar `removedAgent = selectedConversation.assigned_to`.
  2. `UPDATE chat_conversations SET assigned_to = null, status = 'pending' WHERE id = ...` (via supabase client).
  3. Se `note` informada → `sendInternalNote(contact_id, note, currentUserName, { noteType: 'urgent' })`.
  4. `INSERT INTO chat_conversation_history` com:
     - `action: 'returned_to_queue'`
     - `actor_name: currentUserName`
     - `from_value: removedAgent`
     - `to_value: 'pending'`
     - `notes: note || null`
  5. Invalidar query da conversa/histórico; toast "Conversa devolvida à fila".
- Renderizar o `<ReturnToQueueDialog />` junto dos outros dialogs.

### 3. `ConversationEvent.tsx`
Adicionar suporte ao novo evento na timeline (badge):
- `ACTION_LABELS['returned_to_queue'] = 'devolveu a conversa para a fila de atendimento'`
- `ACTION_ICONS['returned_to_queue'] = <Undo2 className="h-3 w-3" />` (importar)
- Em `CONVERSATION_EVENT_ACTIONS` (lista canônica usada pela configuração): adicionar `{ action: 'returned_to_queue', sampleLabel: 'devolveu a conversa para a fila de atendimento' }`.
- Em `getEventConfig`, novo `case 'returned_to_queue'` retornando label *"{actor} devolveu a conversa para a fila de atendimento"*, ícone `Undo2`, cor âmbar (`text-amber-600 bg-amber-500/10 border-amber-500/20`).

A visibilidade já é controlada pelo mecanismo existente (`event_visibility` em `chat_client_settings.settings`), pois a lista canônica é a única fonte usada na tela de Configurações → Eventos. Nada novo precisa ser feito ali.

## Detalhes técnicos
- Schema: nenhuma migration necessária. `chat_conversation_history.action` é texto livre; `chat_conversations.assigned_to` aceita null; status `pending` já existe.
- Auto-open trigger: `auto_open_on_assignment` só dispara quando `assigned_to` passa a NÃO nulo, então setar `null + pending` não será revertido.
- Trigger `sync_conversation_to_deal` espelhará `assigned_to=null` no CRM — comportamento desejado.
- Permissão: mesmo gate visual usado pelo Transferir (`isActive`). Desabilita também quando não há `assigned_to`.

## Diagrama da barra de ações
```text
[ Info ] [ Snooze ] [ Transferir ] [ Devolver p/ fila ] [ Resolver ] [ Encerrar ] [ ⋮ ]
```
