# Plano: Aba "Manutenção de Filas" em /configuracoes

## Visão geral
Adicionar nova aba na página `/configuracoes` com um wizard em 3 passos:
1. **Buscar fila** (por nome da fila e/ou client_id)
2. **Selecionar ação** (na primeira versão: "Excluir todas as mensagens e arquivos")
3. **Confirmar e executar** (com dupla confirmação seguindo o padrão do projeto)

## UX / Fluxo

```text
┌──────────────────────────────────────────────────┐
│ [Provedores] [Chat] [IA's] [History] [Monitor]   │
│ [Manutenção de Filas]  ← NOVA ABA                │
├──────────────────────────────────────────────────┤
│ Passo 1 — Buscar Fila                            │
│  Cliente: [select com client_ids]                │
│  Nome:    [input busca: "marcia"]                │
│  Resultados:                                      │
│   ○ COMERCIAL MÁRCIA CANUTO  · client #270       │
│   ○ Agente Principal         · client #30        │
│   [Avançar →]                                    │
├──────────────────────────────────────────────────┤
│ Passo 2 — Ações disponíveis                      │
│  Fila: COMERCIAL MÁRCIA CANUTO (client #270)     │
│  ┌──────────────────────────────────────────┐    │
│  │ 🗑  Excluir todas as mensagens e arquivos │    │
│  │     Remove conversas, mensagens, mídias,  │    │
│  │     reações, menções, históricos e arqs   │    │
│  │     do bucket chat-media desta fila.      │    │
│  │     [Selecionar]                          │    │
│  └──────────────────────────────────────────┘    │
│  (espaço reservado p/ próximas ações)            │
├──────────────────────────────────────────────────┤
│ Passo 3 — Confirmação                            │
│  ⚠ Ação irreversível                             │
│  Será apagado X conversas, Y mensagens, Z arqs.  │
│  [Switch: "Confirmo a exclusão definitiva"]      │
│  Digite o nome da fila p/ confirmar: [____]      │
│  [Cancelar] [Excluir Tudo]                       │
└──────────────────────────────────────────────────┘
```

## Arquivos a criar / editar

### Frontend
1. **`src/pages/configuracoes/components/QueueMaintenanceTab.tsx`** (novo)
   - Wizard com `step` controlado (1/2/3).
   - Passo 1: combo de clientes (reaproveita `chat-reset` action `list_clients`) + input com debounce; lista filas via supabase client (`queues` filtradas por `client_id` e ILIKE `name`).
   - Passo 2: cards com ações disponíveis (apenas 1 por enquanto).
   - Passo 3: chama `queue-maintenance` action `preview` (contagens) e ao confirmar chama action `purge_messages_and_media`.

2. **`src/pages/configuracoes/ConfiguracoesPage.tsx`** (editar)
   - Adicionar `<TabsTrigger value="maintenance">` com ícone `Wrench` e `<TabsContent>` renderizando `QueueMaintenanceTab`.

### Backend
3. **`supabase/functions/queue-maintenance/index.ts`** (nova edge function)
   - Actions:
     - `search_queues` `{ client_id?, name? }` → lista filas (id, name, client_id, channel_type, is_deleted).
     - `preview` `{ queue_id }` → conta `chat_conversations`, `chat_messages`, mídias (mensagens com `media_url`).
     - `purge_messages_and_media` `{ queue_id, confirm_name }` → valida nome, executa exclusão na ordem correta:
       1. Coleta `conversation_ids` via `chat_conversations.queue_id`.
       2. Coleta `message_ids` via `chat_messages.queue_id` (e/ou `conversation_id`).
       3. Coleta `media_url`s das mensagens da fila.
       4. Remove arquivos do bucket `chat-media` (extrai path da URL pública/assinada, remove em lotes de 100).
       5. DELETE em cascata: `chat_message_reactions` (por message_id), `chat_mentions`, `chat_conversation_history/tags/participants/presence/summaries` (por conversation_id), `chat_messages` (por queue_id), `chat_conversations` (por queue_id), `chat_csat_responses`, `chat_ai_classifications`, `chat_ai_autoreply_logs`, `chat_automation_logs`, `chat_call_logs`, `chat_crm_links`, `chat_scheduled_messages`, `chat_webhook_deliveries` (filtrados por conv/msg/queue).
       6. Opcional: `uazapi_history_items` ligados às conversas.
     - Retorna `{ deleted: { table: count }, files_deleted, total_files }`.
   - CORS padrão; usa `SUPABASE_SERVICE_ROLE_KEY`.
   - **Não** apaga a própria `queues` nem `queue_agent_links` (preserva a configuração da fila — só limpa os dados gerados).

## Detalhes técnicos

- **Busca de filas**: query direta `supabase.from('queues').select(...).ilike('name', \`%${term}%\`)` + filtro opcional `eq('client_id', ...)`. Inclui filas com `is_deleted=true` para permitir limpeza pós-soft-delete.
- **Extração de path do bucket**: tratar URLs como `…/storage/v1/object/public/chat-media/<path>` ou `…/object/sign/chat-media/<path>?token=…`; pegar tudo após `/chat-media/` antes de `?`.
- **Padrão de UI**: seguir `secure-deletion-workflow` (switch + digitação do nome) já usado em outras telas críticas.
- **Permissão**: aba visível apenas para admin (mesma checagem usada em outras abas sensíveis em `ConfiguracoesPage`). Verificar `useAuth().isAdmin` e ocultar `TabsTrigger` se necessário.
- **Toasts e invalidação**: invalida `['queues']`, `['chat-conversations']`, `['chat-messages']`, `['chat-contacts']` ao concluir.
- **Logs**: console.log de cada etapa para troubleshooting via edge function logs.

## Fora do escopo (próximas ações)
- Ressincronizar fila do zero, exportar conversas antes de apagar, apagar somente período X. Cards extras no Passo 2 ficam preparados para receber essas ações depois.
