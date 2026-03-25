

# Problema: Chat WABA carrega de `webhook_logs` em vez de `chat_messages`

## Diagnóstico

O sistema tem **dois fluxos separados** e o popup do CRM (`WhatsAppMessagesDialog`) está lendo do lugar errado:

| Componente | Onde lê mensagens | Correto? |
|---|---|---|
| Chat principal (`WhatsAppDataContext`) | `chat_messages` | ✅ Sim |
| Popup CRM - UazAPI (`WhatsAppMessagesDialog`) | API UazAPI `/message/find` | ✅ Sim |
| Popup CRM - WABA (`WhatsAppMessagesDialog`) | **`webhook_logs`** | ❌ **ERRADO** |

A `meta-webhook` já salva corretamente em `chat_messages` (linha 249). O `uazapi-webhook` também salva em `chat_messages`. Portanto, **ambos os provedores já persistem na tabela correta**.

O problema é que o popup WABA ignora `chat_messages` e lê de `webhook_logs`, que é temporária.

## Solução

Alterar `WhatsAppMessagesDialog.tsx` para que o fluxo WABA leia de `chat_messages` em vez de `webhook_logs`, usando o mesmo padrão que o `WhatsAppDataContext` já usa.

### Alterações em `WhatsAppMessagesDialog.tsx`

**1. `loadWabaMessages()`** — Substituir query de `webhook_logs` por query em `chat_messages`:
- Buscar por `client_id` do agente + filtro por contato (via `contact_id` ou join com `chat_contacts` por phone)
- Manter ordenação por `timestamp DESC`, limit 50
- Mapear campos de `chat_messages` para o formato `Message` do dialog (id, text, type, from_me, status, media_url, timestamp, etc.)

**2. `loadMoreMessages()` (branch WABA)** — Mesma mudança: paginar de `chat_messages` com `range(offset, offset+49)`

**3. `parseWabaPayload()`** — Substituir por um mapper simples de `chat_messages` row → `Message` object (os campos já são compatíveis: text, type, from_me, media_url, status, timestamp)

**4. Realtime listener WABA** — Escutar INSERT em `chat_messages` filtrado por `contact_id` para novas mensagens em tempo real (mesmo padrão do `WhatsAppDataContext`)

**5. Resolver `contact_id`** — Ao abrir o popup WABA, buscar o `contact_id` em `chat_contacts` por `client_id` + `phone`. Se não existir, o chat fica vazio (sem erro).

### O que NÃO muda
- Edge functions (`meta-webhook`, `uazapi-webhook`, `waba-send`) — já gravam corretamente em `chat_messages`
- Fluxo UazAPI no popup — continua usando a API direta
- `WhatsAppDataContext` — já funciona corretamente com `chat_messages`
- Tabelas/migrations — nenhuma alteração necessária

### Arquivo alterado
| Arquivo | O que muda |
|---|---|
| `src/pages/crm/components/WhatsAppMessagesDialog.tsx` | `loadWabaMessages`, `loadMoreMessages` (branch WABA) e realtime listener passam a ler de `chat_messages` em vez de `webhook_logs` |

