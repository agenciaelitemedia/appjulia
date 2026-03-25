

# Omnichannel Message Storage & Chat Engine — Plano Revisado

## Visao Geral

O plano do documento esta bem estruturado. Abaixo esta a versao revisada com melhorias e ajustes baseados na analise do codigo real.

## Melhorias sobre o plano original

1. **Remocao da tabela `channel_configs`**: Desnecessaria. O mapeamento `phone_number_id -> cod_agent` ja pode ser feito via a tabela `agents` no banco externo (mesmo padrao que `waba-send` e `waba-admin` ja usam). Criar outra tabela duplicaria dados e criaria risco de dessincronizacao.

2. **Coluna `processed` em webhook_logs**: Desnecessaria — ja existe `forwarded` com o mesmo proposito.

3. **`download-media-meta` como funcao separada**: Manter na propria `waba-send` que ja tem actions `send_text` e `download_media`. Adicionar action `download_and_store` que faz o download + upload no Storage. Evita criar mais uma Edge Function.

4. **Bucket `chat-media`**: O plano sugere INSERT direto em `storage.buckets` via migration — isso nao e permitido em Supabase Cloud. Usar a API de Storage ou criar via dashboard. Alternativamente, usar o bucket `creatives` ja existente (public, ja configurado).

5. **Realtime para UPDATE de status**: O listener atual so escuta INSERT. Expandir para `event: '*'` e tratar UPDATE para atualizar status de mensagens em tempo real.

---

## Execucao em 4 Fases

### FASE 1 — Banco de Dados (5 migrations)

**Migration 1: Estender chat_contacts**
```sql
ALTER TABLE public.chat_contacts
  ADD COLUMN IF NOT EXISTS channel_type TEXT NOT NULL DEFAULT 'whatsapp_uazapi',
  ADD COLUMN IF NOT EXISTS channel_source TEXT,
  ADD COLUMN IF NOT EXISTS remote_jid TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_contacts_channel
  ON public.chat_contacts (client_id, channel_source, phone)
  WHERE channel_source IS NOT NULL;
```

**Migration 2: Estender chat_messages**
```sql
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS channel_type TEXT NOT NULL DEFAULT 'whatsapp_uazapi',
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS is_forwarded BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS forwarded_score SMALLINT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS raw_payload JSONB;

CREATE UNIQUE INDEX IF NOT EXISTS idx_chat_messages_external
  ON public.chat_messages (contact_id, external_id)
  WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_chat_messages_ext_lookup
  ON public.chat_messages (external_id)
  WHERE external_id IS NOT NULL;
```

**Migration 3: Estender webhook_logs**
```sql
ALTER TABLE public.webhook_logs
  ADD COLUMN IF NOT EXISTS contact_id UUID;
```

**Migration 4: Habilitar Realtime para UPDATE em chat_messages**
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_contacts;
```

**Migration 5: Bucket chat-media**
```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat-media', 'chat-media', true, 52428800,
  ARRAY['image/jpeg','image/png','image/webp','audio/ogg','audio/mpeg','audio/mp4','video/mp4','application/pdf','application/octet-stream'])
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read chat-media" ON storage.objects
  FOR SELECT USING (bucket_id = 'chat-media');
CREATE POLICY "Authenticated write chat-media" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'chat-media');
```

---

### FASE 2 — Edge Functions

**2.1 Adaptar `meta-webhook` (existente)**

Adicionar apos os inserts em webhook_queue/webhook_logs, ANTES do return response, em try/catch SEPARADO:

- `saveMessageToChat(supabase, wabaId, phoneNumberId, message, contacts)`:
  - Buscar `cod_agent` e `client_id` via query no banco externo (Pool pg, mesmo padrao `waba-send`) usando `phone_number_id`
  - UPSERT `chat_contacts` com `channel_type: 'whatsapp_official'`, `channel_source: phoneNumberId`
  - Normalizar tipo de mensagem Meta -> `chat_messages` (text, image, audio, ptt, video, document, sticker, location, contact, reaction, interactive)
  - INSERT `chat_messages` com `external_id: message.id`, `on conflict DO NOTHING`
  - Para midia: fire-and-forget fetch para `waba-send` com action `download_and_store`

- `updateMessageStatus(supabase, statusObj)`:
  - UPDATE `chat_messages SET status` WHERE `external_id = statusObj.id`
  - Se `status='read'`: UPDATE `chat_contacts SET unread_count = 0`

**2.2 Criar `uazapi-webhook` (nova)**

Endpoint de entrada para webhooks do servidor UazAPI/Evolution:
- URL: `https://{ref}.supabase.co/functions/v1/uazapi-webhook?instance={nome}`
- Recebe payload Baileys, identifica mensagem ou status update
- Buscar `cod_agent`/`client_id` via banco externo usando `instance`
- UPSERT `chat_contacts`, INSERT `chat_messages` (mesmo padrao da meta-webhook)
- Para midia UazAPI: a URL ja vem no payload (`message.imageMessage.url` etc), gravar direto no `media_url`
- Config em `supabase/config.toml`: `[functions.uazapi-webhook] verify_jwt = false`

**2.3 Estender `waba-send` — nova action `download_and_store`**

Adicionar action que:
1. Busca `waba_token` no banco externo (ja existe esse padrao)
2. GET media URL via Graph API
3. Download do binario
4. Upload para Storage bucket `chat-media`
5. UPDATE `chat_messages SET media_url` com a URL publica

---

### FASE 3 — Frontend

**3.1 Estender `src/types/chat.ts`**
- Adicionar tipo `ChannelType`
- Adicionar `'interactive_reply' | 'template'` ao `MessageType`
- Adicionar campos opcionais em `ChatContact`: `channel_type`, `channel_source`, `remote_jid`
- Adicionar campos opcionais em `ChatMessage`: `channel_type`, `external_id`, `is_forwarded`, `raw_payload`

**3.2 Adaptar `WhatsAppDataContext.tsx`**
- `syncContacts`: adicionar `channel_type: 'whatsapp_uazapi'`, `channel_source: user.evo_instance`
- `sendMessage`/`sendMedia`: adicionar `channel_type: contact.channel_type || 'whatsapp_uazapi'`
- Realtime listener: expandir de `event: 'INSERT'` para `event: '*'` e tratar UPDATE (atualizar status)

**3.3 `ChatContactItem.tsx` — Badge de canal**
- Adicionar icone pequeno (WA verde para uazapi, WA azul para oficial, etc) no avatar

**3.4 `ChatHeader.tsx` — Exibir canal**
- Adicionar label discreto ("WA Oficial" / "WhatsApp") abaixo do telefone

**3.5 `MessageBubble.tsx` — Novos tipos**
- Adicionar cases `interactive_reply` e `template`
- Indicador de mensagem encaminhada (`is_forwarded`)
- Tooltip em status `failed` com erro

**3.6 `ChatMessages.tsx` — Realtime status**
- Listener para UPDATE que atualiza status das mensagens no state

---

### FASE 4 — Configuracao e Testes

- Configurar webhook URL no Meta for Developers (ja feito — meta-webhook ja existe)
- Configurar webhook URL no servidor UazAPI para cada instance apontando para `uazapi-webhook`
- Testar todos os tipos: texto, imagem, audio, video, documento, localizacao, contato
- Testar status updates (delivered, read) em tempo real

---

## Arquivos Modificados

| Arquivo | Acao |
|---|---|
| 5 migrations SQL | Criar |
| `supabase/functions/meta-webhook/index.ts` | Modificar (adicionar saveMessageToChat + updateMessageStatus) |
| `supabase/functions/uazapi-webhook/index.ts` | Criar |
| `supabase/functions/waba-send/index.ts` | Modificar (adicionar action download_and_store) |
| `supabase/config.toml` | Adicionar entry uazapi-webhook |
| `src/types/chat.ts` | Estender |
| `src/contexts/WhatsAppDataContext.tsx` | Modificar |
| `src/components/chat/ChatContactItem.tsx` | Modificar |
| `src/components/chat/ChatHeader.tsx` | Modificar |
| `src/components/chat/MessageBubble.tsx` | Modificar |
| `src/components/chat/ChatMessages.tsx` | Modificar |

## Ordem de Execucao

Seguir estritamente: FASE 1 (todas as migrations) -> FASE 2 (edge functions) -> FASE 3 (frontend) -> FASE 4 (testes). Cada fase depende da anterior.

Sugiro implementar uma fase por vez para evitar erros em cascata. Comecar pela FASE 1?

