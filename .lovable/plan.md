
# Plano (revisado): erros visíveis no /chat + cache de avatares (individuais + grupos) com atualização em tempo real

Três frentes.

## 1) Mensagem de envio "rejeitada pelo WhatsApp" mais clara

Mapear códigos do provedor em mensagens acionáveis antes do toast.

- UaZapi `WHATSAPP_REACHOUT_TIMELOCK` (463) → "Número temporariamente bloqueado pelo WhatsApp. Aguarde algumas horas antes de tentar novamente."
- WABA janela 24h expirada → "Janela de 24h expirada. Envie um template aprovado para reabrir a conversa."
- Número sem WhatsApp → "Este número não possui conta WhatsApp ativa."
- Fallback → mensagem genérica + código do provedor entre parênteses.

Arquivos: `src/contexts/WhatsAppDataContext.tsx` (helper `normalizeSendError`), `src/components/chat/ChatInput.tsx` (toast).

## 2) Warning "Unknown message type: RESET_BLANK_CHECK"

Vem do iframe host do Lovable e polui o console. Adicionar listener global em `src/lib/chunkReload.ts` (já lida com mensagens do parent) que reconhece `RESET_BLANK_CHECK` e responde `RESET_BLANK_CHECK_ACK` silenciosamente.

## 3) Cache de avatares no Storage (individuais **e** grupos) + atualização em tempo real

Problema atual: gravamos a URL crua do `pps.whatsapp.net`, que expira em horas/dias → vira 403 → cada navegação dispara um refresh que pega outra URL também expirável. Loop sem fim.

Solução: persistir a imagem em `storage://avatars/...` e gravar a URL pública estável em `chat_contacts.avatar`. Detectar mudança real por hash. Reagir a eventos do webhook para invalidar o cache no momento certo.

### 3.1 Modelo de dados (chat_contacts)

Novas colunas:
- `avatar_storage_path text` — `whatsapp/{client_id}/{contact_id}.jpg`
- `avatar_source_url text` — última URL crua baixada do WhatsApp
- `avatar_source_hash text` — SHA-256 do binário, para deduplicar uploads
- `avatar_refreshed_at timestamptz`
- `avatar_refresh_requested_at timestamptz` — marcado pelo webhook quando chega evento de atualização de foto (sinaliza para o próximo refresh ignorar o hash)

`avatar` continua sendo a URL servida ao frontend (agora será sempre a pública do Storage após a migração).

### 3.2 Edge function `refresh-contact-avatar` (refatorada)

Aceita `{ contact_id, force?: boolean }`. Fluxo:

1. Resolve a queue UaZapi do client (mesma lógica de hoje).
2. Detecta `is_group` pelo `chat_contacts` / sufixo `@g.us` no `phone`:
   - Individual → `fetchUazapiProfile` (`/chat/details` + fallback `GetNameAndImageURL`).
   - Grupo → `fetchUazapiGroupProfile` (`/group/info` com `pictureUrl: true`).
3. Pega a URL crua atual. Se nada veio → mantém o que está no storage e retorna.
4. `fetch` da URL no edge (server-side, sem CORS).
5. SHA-256 do binário. Se `=== avatar_source_hash` **e** `force !== true` **e** `avatar_refresh_requested_at` não é mais novo que `avatar_refreshed_at` → só atualiza `avatar_refreshed_at` e retorna a URL pública atual.
6. Senão → `upload` em `avatars/whatsapp/{client_id}/{contact_id}.jpg` (`upsert:true`, `cacheControl:'3600'`), gera URL pública, escreve em `chat_contacts` (`avatar`, `avatar_storage_path`, `avatar_source_url`, `avatar_source_hash`, `avatar_refreshed_at`, limpa `avatar_refresh_requested_at`).
7. Se a URL do WhatsApp falhar (403/404) → mantém storage existente, **não derruba** `avatar`.

Reuso: o mesmo helper de download/hash/upload é exportado de `_shared/whatsapp-profile.ts` (nova função `persistAvatarToStorage(supabase, contact, queue)`), usado tanto pela edge `refresh-contact-avatar` quanto pela `chat-contacts-enrich` para já gravar no Storage no enriquecimento inicial.

### 3.3 Frontend (`SmartAvatarImage`)

Continua igual conceitualmente: `onError` dispara `refresh-contact-avatar`. Como o `src` passa a ser URL estável do Storage, esse `onError` praticamente só ocorre no 1º carregamento de um contato ainda não migrado, então o cooldown de 5 min basta.

### 3.4 Reatividade em tempo real (webhook UaZapi)

UaZapi envia eventos de presença/perfil quando a foto muda. Os mais usados:

- `messages.update` / `contacts.update` com `profilePictureUrl` ou `imgUrl` novos.
- Para grupos: `groups.update` (mudança de subject, picture, descrição).
- `presence.update` em alguns deployments traz `profilePictureUrl`.

No webhook `supabase/functions/uazapi-chat-webhook/index.ts`, depois de identificar `client_id` e `contact_id`/`group_id`:

1. Se o payload contém qualquer campo que indique mudança de foto (`profilePictureUrl`, `imgUrl`, `picture`, ou `event` ∈ `{contacts.update, groups.update, profile.update}` com a foto diferente da armazenada em `avatar_source_url`):
   - `UPDATE chat_contacts SET avatar_refresh_requested_at = now() WHERE id = ?`
   - Enfileira (fire-and-forget, `EdgeRuntime.waitUntil`) chamada à `refresh-contact-avatar` com `{ contact_id, force: true }`.
2. Para eventos de grupo (`groups.update`, ou mensagem nova em chat `@g.us` cujo contato ainda não tem `avatar_storage_path`): mesma rotina apontando para o contato-grupo.
3. Deduplicação: se `avatar_refresh_requested_at` já é mais recente que 60s, não enfileira de novo.

Frontend recebe automaticamente o avatar novo via Realtime já existente em `chat_contacts` (canal de update).

### 3.5 Suporte explícito a grupos

- `chat-contacts-enrich` e `refresh-contact-avatar` passam a rotear para `/group/info` quando `is_group=true` ou `phone` termina em `@g.us` (helper já existe em `_shared/whatsapp-profile.ts`).
- Path no Storage diferencia por id, então grupos não colidem com individuais.
- `SmartAvatarImage` não precisa mudar — recebe igual a foto pública do bucket.

### 3.6 Cron de revalidação (rede de segurança)

`pg_cron` diário invoca `chat-contacts-enrich` por client com filtro `avatar_refreshed_at < now() - interval '7 days'` (inclui grupos). O hash evita re-upload se a foto não mudou.

### 3.7 Migração

- Migration 1: adicionar as colunas novas + índice em `avatar_refreshed_at`.
- Migration 2: agendar o cron diário.
- Backfill: rodar `chat-contacts-enrich` 1x por client logo após a migration; a nova lógica já grava no Storage. Avatares antigos continuam funcionando até serem regravados (`SmartAvatarImage` tolera 403).

## Arquivos afetados

- `src/contexts/WhatsAppDataContext.tsx` — `normalizeSendError`.
- `src/components/chat/ChatInput.tsx` — toast usa a mensagem amigável.
- `src/lib/chunkReload.ts` — handler `RESET_BLANK_CHECK`.
- `supabase/functions/_shared/whatsapp-profile.ts` — nova função `persistAvatarToStorage` (download + hash + upload) reaproveitável.
- `supabase/functions/refresh-contact-avatar/index.ts` — usa Storage, suporta `force`, suporta grupos.
- `supabase/functions/chat-contacts-enrich/index.ts` — chama `persistAvatarToStorage` no enriquecimento, inclui grupos.
- `supabase/functions/uazapi-chat-webhook/index.ts` — detecta `profile/group picture update` e dispara refresh em tempo real (`fire-and-forget`).
- Nova migration: colunas + cron diário.

## Fluxo final

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Webhook UaZapi (profile/group update)                                    │
│   → marca avatar_refresh_requested_at                                    │
│   → invoca refresh-contact-avatar (force=true) em background             │
└─────────────────────────┬────────────────────────────────────────────────┘
                          ▼
        refresh-contact-avatar  ──► UaZapi /chat/details ou /group/info
                          │                ▼
                          │           binário foto
                          │                ▼
                          │           sha256 == anterior?  ── sim ──► só atualiza timestamp
                          │                │ não
                          ▼                ▼
                Storage avatars/whatsapp/{client}/{contact}.jpg (upsert)
                          │
                          ▼
              chat_contacts.avatar = URL pública (estável)
                          │
                          ▼ Realtime
                       Frontend SmartAvatarImage (sem 403)
```

## Fora de escopo

- Mudar a lógica de envio em si (rejeição é do lado do WhatsApp).
- Proxy/cache para mídias de mensagens (só fotos de perfil aqui).
- WABA: Meta não expõe foto de terceiros; cross-provider fallback para UaZapi já existe e continua.
