

# Melhorar a sincronização de histórico: nome real do lead + mídia baixada para o storage

## Contexto

Hoje o `uazapi-history-import` cria contatos usando `pushName` da primeira mensagem (que muitas vezes é vazio, número cru, ou nome de quem enviou em grupo) e salva mensagens de mídia com a `media_url` original do WhatsApp (`.enc` criptografada, que não funciona ao ser exibida no chat).

A UaZapi já oferece dois endpoints corretos para resolver isso, ambos já mapeados no projeto:

- `POST /chat/details` → retorna `name`, `lead_name`, `lead_fullName`, `wa_name`, `wa_contactName`, `image` (avatar), etc.
- `POST /message/download` → decripta a mídia e devolve `fileURL`/`base64` + `mimetype` (já encapsulado pela edge function `chat-media-download`).

## Mudanças (todas em `supabase/functions/uazapi-history-import/index.ts`)

### 1. Buscar nome real via `/chat/details` ao criar contato

Antes de inserir o contato (apenas quando ele ainda não existe), chamar `/chat/details` na instância UaZapi do job:

```ts
async function fetchChatDetails(job, phone) {
  const url = `${job.evo_url.replace(/\/$/, '')}/chat/details`;
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', token: job.evo_token },
    body: JSON.stringify({ number: phone, preview: true }),
    signal: AbortSignal.timeout(15000),
  });
  if (!resp.ok) return null;
  return await resp.json();
}
```

Resolver o nome com a hierarquia:
`lead_fullName → lead_name → name → wa_name → wa_contactName → pushName da msg → phone`

E também aproveitar para popular:
- `avatar` ← `image` / `profilePictureUrl`
- `is_group` ← `wa_isGroup`
- `remote_jid` ← `wa_chatid` (se vier; senão mantém `${phone}@s.whatsapp.net`)
- `metadata.lead_*` (notas/tags do lead) preservados em `chat_contacts.metadata`

Em caso de falha (timeout/404), faz fallback silencioso para o comportamento atual (`pushName`/phone) — não quebra o backfill.

### 2. Baixar mídia para o storage durante a importação

Após inserir cada mensagem com `type ∈ {image, video, audio, ptt, document, sticker}` que tenha `media_url`, chamar a edge function existente `chat-media-download` por `messageId`:

```ts
if (mediaTypes.has(type) && mediaUrl) {
  // disparado em background, não bloqueia o loop principal
  supabase.functions.invoke('chat-media-download', {
    body: { messageId: insertedRow.id, queueId: job.queue_id },
  }).catch((e) => console.warn('[backfill] media download failed', messageId, e));
}
```

A função `chat-media-download` já:
- chama `POST /message/download` na UaZapi com o `external_id` real,
- decripta o `.enc`,
- faz upload no bucket `chat-media`,
- atualiza `chat_messages.media_url` com a URL pública persistente,
- é idempotente (`isPersistedUrl` evita refazer).

**Importante:** o `external_id` que `chat-media-download` usa para chamar o endpoint UaZapi é `msg.message_id || messageId`. Como hoje gravamos o `message_id` com prefixo `backfill:contactId:...`, ele falharia. Solução: passar o ID real do WhatsApp via campo separado.

A função `chat-media-download` faz lookup por `id` UUID **ou** por `message_id` (string). Vou alterar levemente o select dela para também considerar `metadata->>original_message_id` quando o `message_id` armazenado começa com `backfill:`. Isso preserva idempotência sem mexer no schema.

### 3. Concorrência e throttle

- `/chat/details`: 1 chamada por contato novo (cap baixíssimo).
- `/message/download`: invocado em background (fire-and-forget) com `Promise.all` limitado pelo `BATCH=3` já existente para não sobrecarregar a instância UaZapi.

### 4. Logs

Adicionar contadores no log do job:
- `contacts_enriched` (quantos receberam nome via `/chat/details`)
- `media_downloads_queued` (quantas mídias foram enfileiradas para download)

Esses contadores ficam em `whatsapp_sync_jobs.metadata` (jsonb) sem precisar de migration.

## Arquivos a editar

| Arquivo | Mudança |
|---|---|
| `supabase/functions/uazapi-history-import/index.ts` | Adicionar `fetchChatDetails`, usar resultado ao montar `chat_contacts.insert`, disparar `chat-media-download` para mensagens de mídia inseridas |
| `supabase/functions/chat-media-download/index.ts` | Ajustar a resolução do `external_id` para usar `metadata.original_message_id` quando `message_id` começa com `backfill:` |

Sem migrations. Sem mudanças no `/chat`. Sem impacto em webhooks de tempo real.

## Como validar depois do deploy

1. Limpar contatos do cliente (já feito).
2. Disparar uma nova sincronização em `/configuracoes`.
3. Verificar nos logs do job: `contacts_enriched > 0` e `media_downloads_queued > 0`.
4. Abrir `/chat` → contatos devem ter o **nome real do lead** (não mais "5511999..."), e mensagens de imagem/áudio devem carregar visualmente (URL `chat-media` no storage).

