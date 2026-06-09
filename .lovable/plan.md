# Corrigir eventos do webhook UaZapi

## Problema

A documentação oficial (https://docs.uazapi.com/endpoint/post/webhook) lista um conjunto fechado de nomes de evento. A maior parte do que estamos enviando hoje usa "dot notation" (ex.: `chats.update`, `contacts.upsert`, `messages.delete`) que **não consta na lista oficial** — esses eventos são silenciosamente ignorados pelo servidor UaZapi, o que explica por que atualizações de perfil/foto/contato não chegavam de forma consistente.

## Comparação

**Eventos válidos segundo a doc:**
`connection`, `history`, `messages`, `messages_update`, `newsletter_messages`, `call`, `contacts`, `presence`, `groups`, `labels`, `chats`, `chat_labels`, `blocks`, `sender`

**O que enviamos hoje (`uazapi-instance-manager/index.ts` linhas 14-29):**

| Evento atual          | Status                              |
| --------------------- | ----------------------------------- |
| `messages`            | OK                                  |
| `messages.set`        | Inválido (não existe)               |
| `history`             | OK                                  |
| `messages.update`     | Inválido — o correto é `messages_update` |
| `messages_update`     | OK                                  |
| `messages.delete`     | Inválido (não existe evento próprio) |
| `chats.update`        | Inválido — usar `chats`             |
| `chats.upsert`        | Inválido — usar `chats`             |
| `contacts.update`     | Inválido — usar `contacts`          |
| `contacts.upsert`     | Inválido — usar `contacts`          |
| `groups.update`       | Inválido — usar `groups`            |
| `connection.update`   | Inválido — usar `connection`        |
| `presence.update`     | Inválido — usar `presence`          |

## Sobre `excludeMessages`

A doc recomenda `excludeMessages: ["wasSentByApi"]` para evitar loops. **Não vamos aplicar.** Verificação no `uazapi-chat-webhook/index.ts` (linhas 1644, 1664-1665) confirma que mensagens `fromMe` enviadas pela Julia via API são gravadas em `chat_messages` com `from_me: true` e `status: 'sent'`. Esse fluxo é o que mantém o histórico do chat completo. Se filtrássemos `wasSentByApi`, perderíamos essas mensagens no histórico do operador.

A proteção contra eco já é feita em outra camada (memória `chat/anti-echo-self-conversation` — descarte de mensagens entre duas filas do mesmo cliente). Logo, **vamos enviar `excludeMessages: []`** (ou omitir o campo) e manter o comportamento atual.

## Mudanças

### 1. `supabase/functions/uazapi-instance-manager/index.ts`

Substituir `DEFAULT_WEBHOOK_EVENTS` pelo conjunto canônico:

```ts
const DEFAULT_WEBHOOK_EVENTS = [
  'connection',      // estado da conexão
  'messages',        // mensagens recebidas/enviadas (incluindo fromMe via API)
  'messages_update', // edição/status/delete
  'history',         // backfill on-demand
  'chats',           // eventos de conversas
  'contacts',        // atualizações de contato + foto de perfil
  'groups',          // mudanças em grupo, inclusive foto
  'presence',        // presença
  'call',            // chamadas VoIP
];
```

Manter o body do POST `/webhook` **sem** `excludeMessages` (preservar comportamento atual de receber mensagens da API).

### 2. `supabase/functions/uazapi-admin/index.ts`

Linhas 152-153 e 354-355 — alinhar com a nova lista. Remover `excludeMessages: ['isGroupYes']` (derrubaria mensagens de grupo e impede receber foto de grupo).

### 3. `src/config/chat.ts`

Atualizar `UAZAPI_DEFAULT_WEBHOOK_EVENTS` (constante de referência usada no frontend/admin) com a mesma lista canônica acima.

### 4. Handler do webhook (`supabase/functions/uazapi-chat-webhook/index.ts`)

Os eventos chegarão como `contacts`, `chats`, `groups`, `presence`, `connection`, `messages_update`. Ajustar o roteamento por `EventType` para reconhecer essas chaves canônicas, mantendo um fallback defensivo aceitando os formatos antigos (`contacts.update`, etc.) durante a transição — assim não há perda de payloads em voo nem regressão se alguma instância demorar para receber a reconfiguração.

A lógica de avatar (em `contacts` / `groups`) e atualização de fila em tempo real continua a mesma — muda apenas o nome do evento que ativa o handler.

### 5. Reaplicação

Sem migração nem mudança de UI. O usuário aciona o botão **"Reaplicar webhooks (UaZapi)"** já existente em `/admin/chat` (aba Provedores) para propagar o novo set para todas as instâncias ativas. Novas filas criadas após o deploy já nascem com os eventos corretos.

## Validação

1. Após deploy, clicar "Reaplicar webhooks (UaZapi)" e confirmar `ok` em todos os resultados.
2. Conferir via `GET /webhook` em uma instância que `events` contém os 9 nomes canônicos e que `excludeMessages` está vazio.
3. Enviar uma mensagem pela Julia (via API) e confirmar que ela aparece normalmente no histórico do chat (regressão de `fromMe`).
4. Trocar foto de perfil de um contato no WhatsApp e confirmar nos logs de `uazapi-chat-webhook` o recebimento do evento `contacts` e o refresh do avatar no Storage.
5. Trocar foto de um grupo e confirmar evento `groups` + refresh do avatar do grupo.
