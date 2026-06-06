# Encerrar conversa pelo menu da lista = mesma ação do header

Hoje o item "Encerrar conversa" do menu da lista (`ConversationQuickActions`) chama direto `updateConversationStatus('closed')`. O header da mensagem usa um fluxo mais rico via `CSATDialog`, com nota interna e pesquisa de satisfação. Vou unificar: o item do menu abre o mesmo `CSATDialog` e executa o mesmo `handleConfirmClose` usado no `ChatHeader`.

## Alteração

**`src/components/chat/ConversationQuickActions.tsx`** (edição)

- Remover `handleClose` direto e o item de menu disparar `setCloseOpen(true)` para abrir o `CSATDialog`.
- Importar `CSATDialog` e o hook `useAutoSummaryOnStatusChange`.
- Pegar `sendInternalNote` do `useWhatsAppData()` (já disponível).
- Implementar `handleConfirmClose(closeNote, _sendSurvey)` idêntico ao do `ChatHeader`:
  1. Se houver `closeNote.trim()`, chama `sendInternalNote(contact_id, note, currentUserName||'Sistema', { noteType: 'urgent', extraMetadata: { closure_note: true } })` com try/catch que apenas loga.
  2. `await updateConversationStatus(conversation.id, 'closed', closeNote || undefined)`.
  3. `triggerAutoSummary(conversation.id, 'auto_close')`.
  4. Toast de sucesso.
- Renderizar `<CSATDialog>` com props: `open`, `onOpenChange`, `conversationId={conversation.id}`, `contactId={conversation.contact_id}`, `clientId={conversation.client_id}`, `codAgent={conversation.cod_agent}`, `onConfirm={handleConfirmClose}`.

## Fora de escopo

- Nenhuma mudança em backend, schema, hooks ou no `ChatHeader`.
- Itens "Assumir" e "Transferir" do menu permanecem como estão.
