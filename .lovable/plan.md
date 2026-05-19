## Encerramento em lote de conversas — v2

Card novo em **Configurações do Chat → Geral** que permite encerrar várias conversas de uma vez, com pré-visualização, dupla confirmação, registro por conversa e log de auditoria dedicado.

### Fluxo de uso

1. Usuário escolhe **data início** e **data fim** (intervalo de `opened_at`).
2. Escolhe o escopo: **Todos**, **Apenas Julia (IA)** ou **Apenas atendimento humano**.
3. Escolhe a **fila** (uma específica ou Todas).
4. Clica em **Analisar conversas** → mostra totais (geral, por escopo, por fila, mais antiga / mais recente). Nenhuma escrita.
5. Botão **Encerrar conversas** abre **popup de dupla confirmação** com alerta explícito de que as conversas sairão da lista de "Em aberto".
6. Após confirmar, executa em lotes e mostra toast com total encerrado.

### Banco de dados (nova migração)

Tabela `chat_bulk_close_logs`:

- `id` uuid pk
- `client_id` text
- `actor_identifier` text (cod_agent ou e-mail)
- `actor_name` text
- `conversation_id` uuid
- `protocol` text
- `contact_id` uuid
- `queue_id` uuid (nullable)
- `assignment_type` text (`julia` | `human`)
- `previous_status` text
- `previous_assigned_to` text (nullable)
- `batch_id` uuid (identifica a operação em lote)
- `filters` jsonb (start, end, queue, scope aplicados)
- `closed_at` timestamptz default now()

Índices: `(client_id, closed_at desc)`, `(batch_id)`, `(conversation_id)`.

RLS: habilitada. SELECT por `client_id` do usuário autenticado; INSERT apenas via service-role (a edge function escreve).

### Edge function `chat-bulk-close`

Ações:

- `preview` (somente SELECT, agregações):
  - filtros: `client_id`, `status IN ('open','pending')`, `opened_at BETWEEN :start AND :end`, `queue_id` opcional, escopo (Julia = `assigned_to IS NULL`, humano = `assigned_to IS NOT NULL`).
  - retorna `{ total, byAssignment, byQueue, oldest, newest }`.

- `commit`:
  - valida JWT, exige permissão admin (`cod_agent` + check em `admin_agents`), valida Zod (datas, escopo, queue).
  - gera `batch_id` (uuid).
  - busca IDs em páginas de 200 (`SELECT id, queue_id, contact_id, assigned_to, status, protocol`), aplicando o **mesmo `WHERE status IN ('open','pending')` em cada update** para evitar race.
  - para cada lote:
    1. `UPDATE chat_conversations SET status='closed', closed_at=now(), close_reason='bulk_close', close_note='Encerrado em lote por <actor_name>', updated_at=now() WHERE id = ANY(...) AND status IN ('open','pending')` (RETURNING ids efetivamente fechados).
    2. `INSERT chat_conversation_history` por conversa fechada, com `action='bulk_closed'`, `actor_name`, `notes='Encerrado em lote por <actor_name> (batch <batch_id>)'`.
    3. `INSERT chat_bulk_close_logs` (uma linha por conversa fechada, com `batch_id`, filtros e snapshot do estado anterior).
  - retorna `{ batch_id, closed: <n>, skipped: <n> }`.

Garantias de não-quebra:
- Apenas escreve em `chat_conversations`, `chat_conversation_history` e `chat_bulk_close_logs`.
- Não toca em `chat_messages`, `chat_contacts`, CRM, bots, webhooks.
- Triggers existentes (`sync_conversation_to_deal`, `auto_open_on_assignment`) não disparam para mudança de `status` para `closed` sem alteração de `assigned_to`/`priority`.
- Lotes de 200 evitam locks longos.
- Guarda `WHERE status IN ('open','pending')` previne fechar conversa que já foi reaberta entre preview e commit.

### Frontend

Arquivos novos:

- `src/pages/chat/components/BulkCloseConversationsCard.tsx` — UI do card (DatePicker com shadcn `Popover`+`Calendar`, seletor de escopo (RadioGroup), seletor de fila, botões Analisar/Encerrar, painel de resultado do preview, `AlertDialog` de dupla confirmação no padrão `mem://ui/patterns/secure-deletion-workflow`).
- `src/hooks/useBulkCloseConversations.ts` — `previewMutation` e `commitMutation` via `supabase.functions.invoke('chat-bulk-close', …)`, com invalidação de `['chat-conversations']`, `['chat-conversation-list']` e `['audit-log']` após commit.

Edição:

- `src/pages/chat/components/ChatGeneralSettings.tsx` — adiciona `<BulkCloseConversationsCard />` abaixo do bloco "Retornar Chat".

### Plano de entrega

1. Migração: cria `chat_bulk_close_logs` + índices + RLS.
2. Edge function `chat-bulk-close` (`preview` + `commit`).
3. Hook + card + integração no `ChatGeneralSettings`.
4. Teste manual: preview com diferentes escopos, commit pequeno (2-3 conversas), conferir entradas em `chat_conversation_history` e `chat_bulk_close_logs`, e que a conversa some da lista "Em aberto".
