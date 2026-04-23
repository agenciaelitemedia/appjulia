

# Download de mídia sob demanda + histórico marcado como lido

## Problema

1. Mídias do histórico (`history` / backfill) ficam com `media_url` apontando para `.enc` e não baixam de forma resiliente.
2. Mensagens importadas pelo histórico entram com status padrão (`sent`/`delivered`) e inflacionam o `unread_count` do contato/conversa, fazendo aparecer dezenas de "não lidas" sempre que um histórico novo é sincronizado.

## Solução — Parte 1: Mídia sob demanda resiliente

### Edge Function `chat-media-download`
- **Fallback `/message/find`**: quando `external_message_id` está ausente ou `/message/download` retorna 404, buscar via `chatid + messageTimestamp` no UaZapi, recuperar o ID real e persistir em `metadata.original_message_id`.
- **Classificar erros**: `503 disconnected` → `{ fallback: true, transient: true }`; `404 definitivo` → grava `metadata.media_unavailable = true` e retorna `{ fallback: true, permanent: true }`.

### Hook de download (frontend)
- Cache local `Map<messageId, { status, retryCount, lastAttempt }>`.
- Não retentar `permanent_failed`. Backoff de 30s + cap de 3 tentativas para `transient_failed`.
- Atualizar `media_url` no `WhatsAppDataContext` após sucesso (sem refetch).

### `MessageBubble` / preview de mídia
- **Loading**: spinner.
- **Transient**: ícone `WifiOff` + "WhatsApp desconectado — tentaremos novamente" + botão "Tentar agora".
- **Permanent**: ícone `ImageOff` + "Mídia não disponível neste histórico".
- Botão "Baixar" manual sempre disponível.

### (Opcional) Backfill proativo
- No `processHistorySet`, enfileirar `chat-media-download` em lotes de 5 via `EdgeRuntime.waitUntil` para mensagens com tipo de mídia.

## Solução — Parte 2: Histórico marcado como lido

### Edge Function `uazapi-chat-webhook` (`processHistorySet`)
Toda mensagem inserida pelo fluxo de histórico passa a entrar **já como lida**:

- **`chat_messages`**: `status = 'read'` em todas as mensagens do histórico (independente de `from_me`).
- **`chat_conversations`**: ao criar/associar conversa via histórico, **não incrementar `unread_count`**; se a conversa for criada do zero pelo histórico, `unread_count = 0`.
- **`chat_contacts`**: no upsert do histórico, **não tocar em `unread_count`** (preservar valor existente — só real-time `messages.upsert` incrementa).
- **`chat_conversation_participants` / presença**: marcar `last_read_at = now()` para a conversa quando criada/atualizada via histórico, garantindo que o badge de não-lidas fique zerado.

### Edge Function `uazapi-history-import` (mesma regra)
Aplicar exatamente o mesmo comportamento: `status = 'read'`, sem incremento de `unread_count`, `last_read_at = now()`.

### Backfill on-demand do `/chat` (`history-backfill-on-demand`)
Mensagens recuperadas pelo backfill 1x via `/message/find` também entram com `status = 'read'` e sem incrementar contadores.

### Distinção real-time × histórico
- Real-time (`messages.upsert` com `from_me = false`): mantém comportamento atual — incrementa `unread_count` e grava `status = 'delivered'`.
- Histórico (`history`, `messages.set`, `message.history`, backfill): sempre `status = 'read'`, sem incremento.

## Arquivos afetados

- `supabase/functions/chat-media-download/index.ts` — fallback `/message/find`, transient vs permanent.
- `supabase/functions/uazapi-chat-webhook/index.ts` — `processHistorySet`: status `read`, sem incremento, `last_read_at`.
- `supabase/functions/uazapi-history-import/index.ts` — mesma regra do histórico.
- `src/hooks/useMediaDownload.ts` (ou equivalente no `WhatsAppDataContext`) — cache de retry, classificação de erro.
- `src/components/chat/MessageBubble.tsx` (e/ou `MediaPreview`) — estados visuais + botão manual.

## Validação

1. Sincronizar histórico de uma instância UaZapi → conferir que **nenhum contato** ganhou badge de não-lidas e que mensagens vêm com `status = 'read'` em `chat_messages`.
2. Receber nova mensagem em tempo real → badge de não-lidas **incrementa normalmente**.
3. Abrir conversa com mídias `.enc` do histórico → mídias carregam progressivamente; com UaZapi offline mostra "WhatsApp desconectado" + botão "Tentar agora".
4. Mídia 404 definitiva → mostra "Mídia não disponível" sem retry em loop.
5. Reconectar UaZapi → reabrir conversa → mídias `transient_failed` baixam automaticamente.

