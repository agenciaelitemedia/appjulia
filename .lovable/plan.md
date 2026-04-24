## 🐛 Diagnóstico

**Caso reproduzido:** contato `553488860163` (cliente 30) enviou mensagem para a fila **WABA "Meta Official"** (`f81446ce...`), mas o ticket aberto está vinculado à fila **UaZapi "mario"** (`03b1b983...`).

Estado real no banco:

| Campo | Valor |
|---|---|
| `chat_contacts.channel_type` | `whatsapp_waba` ✅ |
| `chat_contacts.channel_source` | fila WABA ✅ |
| `chat_conversations.channel` | `whatsapp_uazapi` ❌ |
| `chat_conversations.queue_id` | fila **UaZapi** ❌ |

### Causa raiz (em `supabase/functions/meta-webhook/index.ts`, linhas 220-247)

A lógica que garante o ticket aberto faz:
```ts
.from('chat_conversations')
.select('id, queue_id')
.eq('contact_id', contactId)
.eq('client_id', effectiveClientId)
.in('status', ['pending','open'])
```

**Não filtra por `channel` nem por `queue_id`.** Assim:
1. Já existia uma conversa aberta criada antes pelo `uazapi-chat-webhook` (canal UaZapi, queue mario).
2. Quando o cliente respondeu pela WABA, o `meta-webhook` encontrou aquela conversa aberta e **reaproveitou** sem trocar `queue_id` nem `channel` (o `else if (!openConv.queue_id)` só atualiza se `queue_id` for nulo — não é o caso).
3. Mensagem WABA acabou anexada ao ticket UaZapi.

O mesmo bug existe espelhado no `uazapi-chat-webhook` (que provavelmente também não filtra por canal ao buscar a conversa aberta).

---

## ✅ Plano de correção

### 1. `supabase/functions/meta-webhook/index.ts` (linhas 220-247)
Filtrar a busca da conversa aberta **pelo canal e pela fila**:
```ts
const { data: openConv } = await supabase
  .from('chat_conversations')
  .select('id, queue_id')
  .eq('contact_id', contactId)
  .eq('client_id', effectiveClientId)
  .eq('queue_id', queueInfo.id)        // ✅ mesma fila
  .eq('channel', 'whatsapp_waba')      // ✅ mesmo canal
  .in('status', ['pending', 'open'])
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle();
```
Assim, se o contato tiver ticket aberto pela UaZapi, será criado um **novo ticket WABA** paralelo (omnichannel correto: cada canal tem seu protocolo).

### 2. `supabase/functions/uazapi-chat-webhook/index.ts`
Aplicar o mesmo filtro espelhado: `eq('channel','whatsapp_uazapi')` + `eq('queue_id', queueInfo.id)` ao buscar conversa aberta antes de criar/reaproveitar.

### 3. Recovery do caso atual (cliente 30 / contato `a3e8c2d7...`)
Migration única para corrigir tickets já bagunçados onde `chat_contacts.channel_source` aponta para uma fila com `channel_type` diferente do `chat_conversations.queue_id` correspondente:

```sql
-- Para o ticket atual: redirecionar para a fila WABA correta
UPDATE chat_conversations
SET queue_id = 'f81446ce-e830-47cc-8a5d-4f08b0984614',
    channel = 'whatsapp_waba'
WHERE id = '1ec8f2ae-9498-4e68-a676-e98d73270f28';
```
(Opcional: varrer todos os clientes procurando esse mismatch e logar.)

### 4. Memória
Atualizar `mem://features/chat/omnichannel-ticketing-system-v3` com a regra:
> **Tickets são por (contact_id, queue_id, channel)** — webhooks de canais diferentes nunca reaproveitam ticket de outro canal; cada canal abre seu próprio protocolo.

---

## 📊 Impacto
- Mensagens WABA passam a ir para tickets WABA, mesmo quando há ticket UaZapi aberto para o mesmo contato.
- Cliente vê dois tickets/protocolos separados (um por canal) = comportamento omnichannel correto.
- Sem mudança de schema; só um filtro adicional + 1 UPDATE de recuperação.

Confirma para implementar?