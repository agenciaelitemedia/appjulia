## Objetivo

No bloco de resposta do chamado, adicionar um **switch "Enviar para WhatsApp"** (default desligado). Quando ligado, a resposta é salva como mensagem pública do ticket E enviada ao WhatsApp do solicitante pela mesma fila vinculada ao chamado.

## Comportamento

- Switch fica ao lado do switch "Nota interna", apenas para agentes/admin.
- **Desabilitado automaticamente** quando:
  - O switch "Nota interna" estiver ligado (nota interna nunca vaza para o cliente).
  - O ticket não tiver `contact_id` + `queue_id` resolvíveis (sem canal WhatsApp).
  - O envio estiver em andamento.
- Tooltip explicando quando estiver desabilitado ("Chamado sem conversa de WhatsApp vinculada").
- Ao enviar:
  1. Insere a `support_ticket_messages` (resposta pública) — fluxo atual.
  2. Dispara o envio ao WhatsApp via fila resolvida.
  3. Loga evento `whatsapp_sent` no histórico (timeline) com o nome do canal/fila.
  4. Em caso de falha no envio, a resposta no chamado **permanece salva** e mostramos toast de erro citando que o WhatsApp não foi enviado (com motivo).
- Default `false` em cada novo envio (não persiste o estado anterior).

## Resolução da fila

Já existe o hook local `chatTarget` na página, que devolve `{ contactId, queueId, conversationId }` a partir de:
1. `ticket.conversation_id` → `chat_conversations.queue_id`
2. Fallback: conversa mais recente do `ticket.contact_id`.

Reutilizamos esse mesmo resultado para decidir se o switch fica habilitado e para passar `contactId` + `conversationId` + `queueId` ao envio.

## Detalhes técnicos

**`src/pages/tickets/hooks/useTickets.ts`**
- Estender a mutation `reply` para aceitar um parâmetro opcional `sendToWhatsApp?: { contactId: string; queueId: string; conversationId: string | null }`.
- Quando presente e `internal=false`:
  - Carregar `queues` (`channel_type`, `evo_url`, `evo_apikey`, `waba_token`, `waba_number_id`) e `chat_contacts.phone`.
  - Despachar o texto conforme `channel_type`:
    - `waba` → `POST https://graph.facebook.com/v22.0/{waba_number_id}/messages` (texto).
    - demais (`uazapi`) → `POST {evo_url}/message/sendText` com header `token`.
    - Mesmo padrão usado por `supabase/functions/chat-scheduler/index.ts` (referência).
  - Persistir um registro em `chat_messages` (from_me=true, sender_name do agente, `metadata.support_ticket_id` para rastreabilidade) e atualizar `last_message_at`/`last_message_text` em `chat_contacts`, para a mensagem aparecer no histórico do chat.
  - Logar `logEvent(ticketId, 'whatsapp_sent', 'Resposta enviada ao WhatsApp do solicitante via fila <nome>')`.
  - Se falhar, lançar erro tipado `WhatsappDispatchError` para a UI tratar sem perder a resposta já salva.

**`src/pages/tickets/TicketDetailPage.tsx`**
- Novo estado `sendWhatsApp: boolean` (default `false`, reset após envio).
- Renderizar `<Switch>` + `<Label>` "Enviar para WhatsApp" no rodapé do bloco de resposta, junto do toggle de nota interna.
- `disabled` quando: `internal === true`, `!chatTarget?.queueId || !chatTarget?.contactId`, `isChatTargetLoading`, ou `sending`.
- No `handleSend`, passar `sendToWhatsApp` para a mutation se `sendWhatsApp && !internal && chatTarget?.queueId && chatTarget?.contactId`.
- Capturar `WhatsappDispatchError` separadamente: `toast.success('Resposta registrada')` + `toast.error('Falha ao enviar WhatsApp: ...')`.

## Não escopo

- Envio de mídia/anexos pelo switch (apenas texto nesta entrega).
- Templates WABA fora da janela 24h (se a API recusar, mostramos o erro retornado).
- Persistir preferência do switch entre envios.
