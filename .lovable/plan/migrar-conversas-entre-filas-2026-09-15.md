# Migrar conversas entre filas

Novo item **"Migrar Conversas"** no menu de cada fila (na página Filas de Atendimento), visível apenas para o dono do escritório e administradores. Ele abre uma tela para mover as conversas daquela fila para outra fila do mesmo escritório.

## A tela de migração

**Origem**: a fila em que o menu foi acionado (fixa).
**Destino**: escolha entre as outras filas ativas do escritório (obrigatório).

**O que migrar**:
- Todas as conversas (encerradas/concluídas, aguardando atendimento, em atendimento), ou
- Filtrar por:
  - Status (aguardando, em atendimento, resolvida, encerrada — múltipla escolha)
  - Período (data inicial e final; em branco = sem limite)
  - Usuário atribuído (todos, sem responsável, ou um atendente específico)

**Responsável após a migração** (escolha na própria tela):
- Manter o responsável atual, ou
- Devolver para a fila (remove o responsável e volta para "Aguardando")

**Contato**: junto com as conversas, o vínculo do contato passa para a fila de destino, para que novas mensagens do lead já cheguem na fila nova.

**Fluxo**:
1. Escolher destino, filtros e o que fazer com o responsável — o botão **Analisar** fica disponível.
2. Analisar mostra: total de conversas afetadas, quebra por status e por responsável, conversa mais antiga e mais recente, e quantos contatos serão movidos.
3. Só depois da análise o botão **Migrar** é habilitado.
4. Tripla confirmação: digitar o nome da fila de origem, marcar a chave de ciência (só destrava após o nome correto) e clicar em Confirmar.
5. Resultado: quantas conversas foram migradas, quantas foram ignoradas (por já terem mudado de estado) e quantos contatos foram movidos.

Alterar filtros depois da análise desabilita o botão Migrar até uma nova análise.

## Registro e auditoria

- Nova tabela de log de migrações de fila: quem executou, data/hora, escritório, fila de origem, fila de destino, filtros usados, tratamento do responsável, quantidades (analisadas, migradas, ignoradas, contatos movidos) e identificador do lote.
- Cada conversa migrada recebe um evento no seu histórico. Ao abrir a conversa no chat, aparece na linha do tempo: "X migrou a conversa da fila A para a fila B" com data e hora.

## Detalhes técnicos

**Migração de banco** — nova tabela `chat_queue_migrations`:
- Campos: `id`, `client_id`, `from_queue_id`, `from_queue_name`, `to_queue_id`, `to_queue_name`, `actor_name`, `actor_user_id`, `filters` (jsonb), `assignee_mode` (`keep` | `return_queue`), `analyzed_count`, `migrated_count`, `skipped_count`, `contacts_moved`, `batch_id`, `created_at`, `updated_at` (com trigger de `updated_at`).
- GRANTs: `SELECT, INSERT, UPDATE, DELETE` para `authenticated`; `ALL` para `service_role`. RLS habilitada com policy de leitura/escrita para `authenticated` (o isolamento por tenant é feito na aplicação, padrão do projeto).
- Índices: `(client_id, created_at desc)`, `(from_queue_id)`, `(batch_id)`.

**Nova Edge Function `chat-queue-migrate`** (espelha `chat-bulk-transfer`, service role, CORS, validação explícita com 400):
- Body: `{ action: 'analyze' | 'commit', client_id, from_queue_id, to_queue_id, statuses[], start?, end?, assigned_filter ('all' | 'unassigned' | nome), assignee_mode ('keep' | 'return_queue'), move_contacts, actor_name, actor_user_id }`.
- Valida que ambas as filas pertencem ao `client_id` e que origem ≠ destino.
- `analyze`: paginação de 1000 com cap de segurança; agrega total, por status, por responsável, oldest/newest e contatos distintos.
- `commit`: lotes de 200 em `chat_conversations` com guarda dos filtros no `update` (`queue_id = to_queue_id`; se `assignee_mode = 'return_queue'`, zera `assigned_to`/`assigned_user_id` e status `open` → `pending`).
  - Insere em `chat_conversation_history` a ação `queue_migrated`, com `from_value` = nome da fila de origem, `to_value` = nome da fila de destino, `actor_name`, `user_id`, `notes` com o `batch_id`.
  - Quando `move_contacts`, atualiza `queue_id`/`channel_source` dos `chat_contacts` envolvidos (mesmo tenant) na fila de destino.
  - Grava a linha em `chat_queue_migrations` com totais e filtros.

**Frontend**:
- `src/pages/agente/filas/components/MigrateQueueConversationsDialog.tsx` — tela com Select de destino, checkboxes de status, Calendar/Popover de período, seletor de atendente, RadioGroup de responsável, resumo da análise em badges e a tripla confirmação (Input do nome + Switch + botão Confirmar), no padrão do `DeleteQueueDialog`.
- `src/hooks/useQueueConversationMigration.ts` — mutations de `analyze`/`commit` e invalidação das queries de conversas (mesmas chaves usadas na transferência em massa) e de `queues`.
- `QueueCard.tsx`: novo item de menu "Migrar Conversas" (ícone `ArrowRightLeft`), condicionado a `isOwnerUser(user)` ou `role === 'admin'`, apenas para filas não excluídas.
- `ConversationEvent.tsx`: rótulo/ícone para `queue_migrated` ("migrou a conversa da fila A para a fila B") e entrada em `CONVERSATION_EVENT_ACTIONS`.

## Fora do escopo
- Migração de mensagens antigas entre provedores (o conteúdo permanece igual; só o vínculo de fila muda).
- Migração agendada/recorrente.
- Tela de listagem do histórico de migrações (o log fica registrado no banco; pode ser um passo seguinte).
