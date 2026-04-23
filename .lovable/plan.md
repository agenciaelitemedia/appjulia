

# Buscar foto e dados do perfil WhatsApp ao criar contatos no /chat (Multi-Provider: UaZapi + WABA Oficial)

## Problema

Hoje os contatos do `/chat` ficam sem foto (`avatar = null`) na maioria dos casos, tanto para conexões via **UaZapi** quanto via **WABA Oficial (Meta Cloud API)**. O sistema é omnichannel e precisa enriquecer perfis usando o provedor correto da fila de origem.

## Solução

Centralizar o enriquecimento de perfil em um helper único **multi-provider** que detecta o tipo de fila (`channel_source`) e roteia para a API adequada (UaZapi ou Meta Graph API).

---

### 1. Migration — colunas extras em `chat_contacts`

| Coluna | Tipo | Origem |
|---|---|---|
| `wa_name` | text | nome de exibição público |
| `wa_verified_name` | text | nome verificado (Business) |
| `wa_business` | boolean | flag conta business |
| `wa_status` | text | recado/status |
| `lead_full_name` | text | nome completo do lead (UaZapi) |
| `lead_email` | text | email (UaZapi) |
| `lead_personalid` | text | CPF/CNPJ |
| `profile_fetched_at` | timestamptz | última vez enriquecido |
| `profile_source` | text | `uazapi` \| `waba` |

### 2. Novo helper `_shared/whatsapp-profile.ts` (multi-provider)

Função única `fetchWhatsappProfile({ queue, phone })` que detecta `queue.channel_source`:

#### A) Provider `uazapi`
1. `POST /chat/details` com `{ number, preview: true }` → `name`, `image`, `wa_*`, `lead_*`.
2. Fallback `POST /chat/GetNameAndImageURL` se `image` vazio.
3. `profile_source = 'uazapi'`.

#### B) Provider `waba` (API Oficial Meta)
A Cloud API **não expõe foto/nome de contatos arbitrários** (limitação oficial — só retorna `profile.name` no payload de mensagens recebidas). O enriquecimento usa duas estratégias:

1. **`GET /v22.0/{phone-number-id}/whatsapp_business_profile`** → busca o perfil **do próprio número business** (logo, descrição, vertical) para enriquecer contatos business da própria empresa.
2. **`POST /v22.0/{phone-number-id}/contacts`** com `{ blocking: "wait", contacts: [phone], force_check: false }` → valida se o número existe no WhatsApp e retorna `wa_id`.
3. Para o **avatar de terceiros**: como a Meta não fornece, o helper retornará `null` e o sistema cairá no fallback de iniciais. Salvamos pelo menos `wa_name` (vindo do `profile.name` no webhook de mensagem) e `wa_verified_name` quando disponível.
4. `profile_source = 'waba'`.

Retorno normalizado igual para ambos os providers:
```ts
{
  name, avatar, remoteJid, isGroup,
  waName, waVerifiedName, waBusiness, waStatus,
  leadFullName, leadEmail, leadPersonalId,
  source: 'uazapi' | 'waba',
  raw
}
```

Timeout 15s, fallback silencioso.

### 3. Integração nos webhooks em tempo real

**`uazapi-chat-webhook`**: ao criar contato novo, chama `fetchWhatsappProfile` com `queue` carregada (já tem `channel_source='uazapi'`). Para contatos existentes sem avatar, dispara enrich em background.

**`meta-webhook` / `waba-persistence`**: idem — ao processar `contacts[0].profile.name` do payload Meta, persiste já no `wa_name` e enfileira enrich via helper com `channel_source='waba'`.

### 4. Integração no backfill histórico

`uazapi-history-import` substitui o `fetchChatDetails` local pela nova função compartilhada.

### 5. Reenriquecer contatos antigos (one-shot)

Nova edge function `chat-contacts-enrich` recebe `{ client_id, queue_id?, only_missing_avatar?: true }`:
- busca contatos sem `avatar` ou `profile_fetched_at`,
- agrupa por `queue_id` para resolver o provider correto,
- chama `fetchWhatsappProfile` com a queue de cada grupo,
- atualiza o contato com colunas extras + `profile_source`.

Disparada uma vez após deploy para `client_id=30`.

### 6. UI

Sem mudanças imediatas — `ChatList` já renderiza `contact.avatar` quando presente. Para contatos WABA sem avatar (limitação da Meta), as iniciais continuam como fallback natural.

---

## Arquivos

| Arquivo | Mudança |
|---|---|
| `supabase/migrations/<new>.sql` | adiciona colunas `wa_*`, `lead_*`, `profile_fetched_at`, `profile_source` |
| `supabase/functions/_shared/whatsapp-profile.ts` | **novo** helper multi-provider (UaZapi + WABA) |
| `supabase/functions/uazapi-chat-webhook/index.ts` | enriquecer ao criar contato; background para existentes |
| `supabase/functions/meta-webhook/index.ts` (ou persistence bridge) | enriquecer contato WABA usando `profile.name` + helper |
| `supabase/functions/uazapi-history-import/index.ts` | usar helper compartilhado |
| `supabase/functions/chat-contacts-enrich/index.ts` | **novo** — reprocessa contatos sem foto agrupando por provider |

## Limitações conhecidas (WABA Oficial)

- A Meta Cloud API **não fornece** foto de perfil ou status de contatos finais (apenas do próprio número business). Para esses casos, persistimos `wa_name` (vindo do payload de mensagem) e mantemos avatar `null` → UI mostra iniciais.
- O endpoint `/contacts` (validação) consome quota e só é chamado uma vez por contato (idempotência via `profile_fetched_at`).

## Validação

1. Disparar `chat-contacts-enrich` para `client_id=30`.
2. Recarregar `/chat` → contatos UaZapi exibem foto real; contatos WABA exibem `wa_name` correto (avatar pode permanecer iniciais por limitação da Meta).
3. Receber nova mensagem em fila WABA → `profile.name` salvo automaticamente em `wa_name` e `name`.
4. Conferir no banco: `select profile_source, count(*) from chat_contacts where client_id='30' group by profile_source`.

