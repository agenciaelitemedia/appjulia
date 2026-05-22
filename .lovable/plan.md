## Problemas reportados

1. **Edição duplica a mensagem** — o texto é atualizado corretamente na bolha original, mas em seguida o provedor (UaZapi) reenvia a mensagem como um novo evento de upsert, e o webhook a insere como nova linha em `chat_messages` → realtime push → bolha duplicada.
2. **Vistos/ticks não evoluem** — a bolha fica com 1 check (`sent`) e nunca migra para `delivered`/`read`, mesmo quando o destinatário lê.

---

## Diagnóstico

### 1. Duplicação na edição

Fluxo atual:

```text
ChatInput → editMessage (WhatsAppDataContext)
  ├─ optimistic update local (text + edited_at) ✓
  ├─ POST /message/edit (uazapi-proxy)            ✓
  └─ UPDATE chat_messages SET text, edited_at     ✓

UaZapi posteriormente envia DOIS eventos:
  • messages.update  → webhook detecta `editedText` e faz UPDATE   ✓
  • messages.upsert  → contém `protocolMessage.editedMessage` OU
                        um envelope com o texto novo e um NOVO key.id
                        → webhook (linha ~974) não acha duplicata pelo
                          message_id e INSERE nova linha → duplica.
```

O dedup do upsert (`uazapi-chat-webhook` linhas 977‑988) só compara `message_id` do envelope atual. Como o provedor gera um stanza-id novo para a edição, o teste passa e a linha é inserida.

### 2. Ticks não atualizam

O bloco `messages.update` (linhas 783‑822) mapeia status corretamente, mas faz o UPDATE filtrando por `message_id.eq.X OR external_id.eq.X`. Hipóteses:

- O id que o provedor envia nas atualizações de status é o `key.id` do WhatsApp (ex.: `3EB0…`), enquanto no envio salvamos `proxyData.key.id || proxyData.id || proxyData.messageId` (linha 1437). Quando o UaZapi retorna apenas `messageid` (id interno do uazapi), gravamos esse valor e o evento de status posterior chega com o `key.id` real → não bate → nenhum update.
- Realtime UPDATE de `chat_messages` está ativo (migração já aplicada), então quando o UPDATE no DB roda, a UI atualiza. Logo o problema é o match do id, não o transporte.

---

## Plano de correção

### A. Webhook `uazapi-chat-webhook` — tratar edição no upsert

Antes do dedup por `message_id` (~linha 977), detectar se o evento é uma edição e fazer UPDATE na linha original em vez de inserir nova:

1. Extrair o id original do envelope quando existir:
   - `msg.message?.protocolMessage?.key?.id` (tipo 14 = MESSAGE_EDIT)
   - `msg.message?.editedMessage?.message?.protocolMessage?.key?.id`
   - `msg.edited?.id` / `msg.editedMessageId`
2. Extrair o novo texto:
   - `msg.message?.protocolMessage?.editedMessage?.conversation`
   - `msg.message?.protocolMessage?.editedMessage?.extendedTextMessage?.text`
   - `msg.message?.editedMessage?.message?.conversation`
3. Se ambos existirem:
   - `UPDATE chat_messages SET text = <novo>, edited_at = now() WHERE client_id = ? AND (message_id = <orig> OR external_id = <orig>)`
   - `continue` (não inserir).
4. Como **fallback de segurança** (provedores que omitem o protocolMessage e mandam apenas um upsert "puro" com texto novo): após o insert ter ocorrido, comparar com a última mensagem `from_me` do mesmo contato nos últimos N segundos; se o texto for igual ao novo e diferente do anterior, marcar como duplicata. Manter este fallback opcional — começar só pelos passos 1‑3, que cobrem o caso real do UaZapi.

### B. Webhook — robustecer o match de status (ticks)

No bloco `messages.update` (linhas 784‑822):

1. Coletar candidatos de id: `messageid`, `id`, `key.id`, `wa_messageid`, `update.key.id`.
2. Construir UPDATE com filtro `message_id IN (lista) OR external_id IN (lista)`.
3. Logar quando nenhum id bateu (`affected rows = 0`) para diagnóstico.

### C. Envio outbound — gravar todos os ids retornados pelo provedor

Em `WhatsAppDataContext.sendMessage` (linhas 1414‑1465) e `sendMedia` (linhas ~1750):

1. Capturar **ambos** os ids retornados pelo UaZapi: `proxyData.key?.id` (WA stanza id) e `proxyData.id || proxyData.messageid` (id interno).
2. Persistir:
   - `message_id` = WA stanza id (preferencial — é o que o provedor usa nos eventos de status/edit).
   - `external_id` = id interno do UaZapi (fallback).
3. Mesma alteração no `editMessage` para atualizar `message_id` se a resposta do `/message/edit` trouxer um novo stanza id.

### D. Front — UPDATE realtime preservar campos não retornados

No handler UPDATE de `chat_messages` (linhas 2391‑2408), fazer merge em vez de substituir, para não perder `metadata`/`media_url` enriquecidos em memória:

```ts
prev[updated.contact_id].map(m =>
  m.id === updated.id ? { ...m, ...updated, metadata: { ...m.metadata, ...updated.metadata } } : m
)
```

### E. Validação

1. Editar uma mensagem outbound em conversa UaZapi → confirmar que **não** aparece bolha duplicada e o texto atualiza com indicador "editada".
2. Enviar mensagem e aguardar leitura no celular → ticks devem evoluir `sent → delivered → read` (cor primary no duplo-check).
3. Inspecionar logs do edge `uazapi-chat-webhook` para confirmar:
   - Branch de edição no upsert ativado (`[edit-detected]`).
   - `messages.update` aplicando status (`affected=1`).

---

## Arquivos a alterar

- `supabase/functions/uazapi-chat-webhook/index.ts` — branches A e B.
- `src/contexts/WhatsAppDataContext.tsx` — itens C e D (`sendMessage`, `sendMedia`, `editMessage`, handler realtime UPDATE).

Nenhuma migration de banco é necessária (colunas `edited_at`, `message_id`, `external_id` já existem; realtime UPDATE já está habilitado).