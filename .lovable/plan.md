

## Plano: Migrar Chat para Arquitetura de Filas + Criar Webhook UaZapi

### Situação Atual

O chat (/chat) depende de **agentes** (tabela externa `agents` via `useMyAgents`) para funcionar. O usuário precisa selecionar um agente, e todo o fluxo (carregar contatos, enviar mensagens, sincronizar) usa `cod_agent` e o `UaZapiContext` do frontend. **Não existe uma Edge Function de webhook para receber mensagens da UaZapi** — as mensagens só são carregadas via polling da API.

### O Que Muda

1. O chat passa a usar **filas** (`queues` table) como fonte de dados em vez de agentes
2. Uma nova Edge Function `uazapi-chat-webhook` recebe mensagens em tempo real
3. O webhook é configurado automaticamente na criação da instância com todos os eventos necessários
4. O envio de mensagens usa o `uazapi-proxy` com credenciais da fila (server-side)

### Arquitetura

```text
WhatsApp → UaZapi Server → Webhook (Edge Function) → Supabase Tables → Realtime → Chat UI
                                                         ↓
                                              chat_contacts + chat_messages + chat_conversations
                                                         ↑
Chat UI → Send → uazapi-proxy (com credenciais da fila) → UaZapi Server → WhatsApp
```

---

### 1. Nova Edge Function: `uazapi-chat-webhook`

Recebe eventos do WhatsApp via UaZapi e persiste no banco.

**URL**: `/functions/v1/uazapi-chat-webhook?queue_id={queue_id}`

**Eventos processados**:
- `messages` — mensagens recebidas (texto, mídia, áudio, localização, contato, sticker)
- `messages.update` — status de entrega (sent, delivered, read, failed)
- `messages.delete` — mensagens apagadas pelo remetente
- `contacts.update` — atualização de nome/foto do contato
- `chats.update` — arquivamento, mute, unread count
- `connection.update` — mudanças de status da conexão (online/offline)
- `groups.update` — eventos de grupo (para futura expansão)

**Lógica principal**:
- Resolve `queue_id` do query param para obter `client_id` da fila
- Upsert em `chat_contacts` (cria contato se não existir, atualiza nome/avatar)
- Insert em `chat_messages` com deduplicação por `message_id`
- Auto-cria `chat_conversation` no status `pending` para novas conversas
- Atualiza `last_message_at` e `last_message_text` no contato
- Incrementa `unread_count` para mensagens recebidas
- Processa status updates (delivered/read) atualizando `chat_messages.status`
- Salva `raw_payload` para debug
- Filtra mensagens de grupo (`isGroup`)

### 2. Atualizar `uazapi-instance-manager` — Webhook Completo

Atualizar a configuração do webhook na ação `create` para:
- URL: `{SUPABASE_URL}/functions/v1/uazapi-chat-webhook?queue_id={queue_id}`
- Eventos completos: `messages`, `messages.update`, `messages.delete`, `contacts.update`, `chats.update`, `connection.update`
- Remover `excludeMessages: ['isGroupYes']` (filtragem será feita no webhook)
- Receber o `queue_id` como parâmetro na ação `create`

### 3. Atualizar `queue-management` — Passar queue_id ao criar instância

Após inserir a fila no banco, passar o `queue_id` para o `uazapi-instance-manager` para que o webhook seja configurado com a URL correta contendo o ID da fila.

### 4. Refatorar `WhatsAppDataContext` — Usar Filas

**Remover**:
- Dependência de `useUaZapi` (context do frontend)
- Dependência de `useMyAgents` / `selectedAgent` / `cod_agent`
- Chamadas diretas à API UaZapi via client-side SDK

**Adicionar**:
- `selectedQueue` em vez de `selectedAgent`
- `useQueues()` para listar filas do usuário
- Envio via `supabase.functions.invoke('uazapi-proxy')` com credenciais da fila (busca `evo_url`, `evo_apikey` da fila selecionada)
- Contatos filtrados por `channel_source` (queue_id) em vez de `cod_agent`

**Consultas**:
- `chat_contacts` filtrado por `client_id` + `channel_source = queue_id`
- `chat_messages` já funciona via realtime (sem mudança)
- `chat_conversations` filtrado por `queue_id`

### 5. Atualizar `ChatList` — Seletor de Filas

Substituir o seletor de agentes por um seletor de filas:
- Usa `useQueues()` para listar filas ativas
- Mostra nome da fila + tipo de canal (badge colorido)
- Mostra status de conexão (online/offline) baseado no último `connection.update`
- Ao selecionar fila, filtra contatos/conversas por `queue_id`

### 6. Atualizar tabela `chat_contacts` — Campo `channel_source`

O campo `channel_source` já existe na tabela. Será usado para armazenar o `queue_id`, vinculando cada contato à fila que o originou.

---

### Arquivos

| Tipo | Arquivo |
|------|---------|
| Novo | `supabase/functions/uazapi-chat-webhook/index.ts` |
| Editado | `supabase/functions/uazapi-instance-manager/index.ts` |
| Editado | `supabase/functions/queue-management/index.ts` |
| Editado | `src/contexts/WhatsAppDataContext.tsx` |
| Editado | `src/components/chat/ChatList.tsx` |
| Editado | `src/components/chat/ChatInput.tsx` |
| Editado | `src/pages/chat/ChatPage.tsx` |

### Detalhes Técnicos

- O webhook usa `SUPABASE_SERVICE_ROLE_KEY` para escrita direta (bypass RLS)
- Deduplicação de mensagens via campo `message_id` (ID do WhatsApp)
- O campo `channel_source` em `chat_contacts` armazena o `queue_id` para filtragem
- O campo `queue_id` em `chat_conversations` já existe e será preenchido
- O envio de mensagens será feito via edge function `uazapi-proxy` passando `token` e `baseUrl` da fila selecionada
- Realtime já está configurado para `chat_contacts` e `chat_messages` — sem mudanças necessárias

