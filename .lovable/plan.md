

## Corrigir reações nas conversas — envio e recebimento

### Problema

**1. Envio (handleReact)**: Em `src/components/chat/ChatMessages.tsx:171`, o handler exige `selectedQueue` (seletor global de fila). No módulo `/chat` omnichannel, não existe fila global selecionada — cada conversa já carrega sua própria `queue_id`. Resultado: ao clicar num emoji, aparece o toast "Selecione uma fila para reagir" e a reação não é enviada.

**2. Recebimento**: Em `supabase/functions/uazapi-chat-webhook/index.ts`, quando chega um `reactionMessage` da UaZapi, ele é apenas classificado como `type='reaction'` e salvo como uma mensagem normal (gera o `💬 Reação` no last_message), mas **nunca é persistido em `chat_message_reactions`** ligado à mensagem alvo. Por isso a reação não aparece visualmente no balão da mensagem original.

### Correção

**Arquivo: `src/components/chat/ChatMessages.tsx`**

Resolver `queue_id` a partir da conversa selecionada (e fallbacks), sem depender de `selectedQueue`:

1. Prioridade de resolução em `handleReact`:
   - `selectedConversation?.queue_id` (caso principal — conversa atual já tem fila)
   - `contact.channel_source` se for UUID válido
   - Fallback final: `selectedQueue?.id`
2. Se ainda assim não encontrar fila (caso raríssimo), exibir toast claro. Caso contrário, prosseguir com o envio normalmente.
3. Manter `contact_phone = contact.phone` e `reactor = user.id`.

**Arquivo: `supabase/functions/uazapi-chat-webhook/index.ts`**

Quando uma mensagem de tipo `reaction` for recebida:

1. Extrair do payload UaZapi:
   - `target_external_id` = `msg.message.reactionMessage.key.id` (ou variações `reactionMessage.id`, dependendo do shape)
   - `emoji` = `msg.message.reactionMessage.text` (string vazia = remoção)
   - `reactor` = `participant`/`sender` ou `from_me` se aplicável
2. Localizar a `chat_messages.id` interna pelo `message_id = target_external_id` no mesmo `client_id`/`contact_id`.
3. Se encontrada:
   - Se `emoji` for vazio → `DELETE FROM chat_message_reactions WHERE message_id = ... AND reactor = ...`
   - Senão → upsert (delete + insert) na tabela `chat_message_reactions` com `{ message_id, external_message_id, reactor, emoji, from_me }`.
4. **Não** inserir a reação como uma `chat_messages` separada — para evitar poluir a timeline com cards "💬 Reação" vazios. Em vez disso, atualizar somente `chat_contacts.last_message_text` opcionalmente (manter como está hoje só para preview do contato é aceitável, mas a entrada em `chat_messages` deve ser ignorada para reactions).
5. Se a mensagem alvo ainda não existir localmente (chegou antes do backfill), gravar uma fila órfã em memória ou simplesmente ignorar — o realtime do `useMessageReactions` reconciliará no próximo carregamento.

### Resultado esperado

- Clicar em um emoji no balão envia a reação imediatamente (sem pedir fila), aparece em tempo real no próprio balão.
- Reações recebidas do WhatsApp aparecem ancoradas no balão da mensagem original (via `chat_message_reactions`) e não mais como cards isolados na timeline.

### Arquivos alterados

- `src/components/chat/ChatMessages.tsx` — resolver `queue_id` da conversa selecionada com fallbacks; remover dependência rígida de `selectedQueue`.
- `supabase/functions/uazapi-chat-webhook/index.ts` — tratar `reactionMessage` persistindo em `chat_message_reactions` ligado à mensagem alvo, em vez de criar uma `chat_messages` do tipo `reaction`.

