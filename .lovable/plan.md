# Transferência em massa de atendimentos

Hoje o sistema só permite transferir ou devolver à fila **uma conversa por vez**. O que existe em massa é apenas o **encerramento em lote**, na tela de configurações do chat (com filtros, prévia e dupla confirmação).

A proposta é criar o equivalente para transferência, no mesmo lugar e com a mesma experiência.

## O que será criado

Um novo card "Transferir atendimentos em massa" nas configurações do chat, logo acima do card de encerramento em massa.

Filtros disponíveis:
- Período (data inicial e final, opcional — em branco = todos)
- Fila (todas ou uma específica)
- Responsável atual: todos, sem responsável (Julia), ou um atendente específico
- Status: aguardando e/ou em atendimento

Destino (escolha obrigatória):
1. **Outro atendente** — define um responsável único para todas as conversas filtradas (mesma lista de equipe usada na transferência individual, com contagem de conversas por membro).
2. **Devolver para a fila** — remove o responsável e volta o status para "Aguardando".

Fluxo de uso:
1. Escolher filtros e destino.
2. Clicar em "Pré-visualizar": mostra total de conversas afetadas, quebra por fila e por responsável atual, e a conversa mais antiga/recente.
3. Confirmar em duas etapas (segunda etapa com marcação explícita de ciência), igual ao encerramento em massa.
4. Resultado: quantas foram transferidas e quantas foram ignoradas (por já terem mudado de estado no meio do processo).

Cada conversa afetada recebe um registro no histórico da conversa (transferida em lote / devolvida à fila em lote), com quem executou e o identificador do lote, para auditoria.

Acesso: mesmo critério do encerramento em massa (tela de configurações do chat), restrito ao escritório do usuário.

## Detalhes técnicos

**Nova Edge Function `chat-bulk-transfer`** (espelhando `chat-bulk-close`):
- Body: `{ action: 'preview' | 'commit', client_id, start?, end?, queue_id?, current_assignee ('all' | 'unassigned' | nome), statuses, target: { type: 'assign' | 'return_queue', assigned_to?, assigned_user_id? }, actor_* }`
- Validação de entrada explícita (400 em payload inválido), CORS em todas as respostas, service role key.
- `applyFilters` sobre `chat_conversations`: `client_id`, `status in (open,pending)` conforme seleção, faixa em `opened_at`, `queue_id`, e `assigned_to` (null / igual ao nome escolhido).
- `preview`: paginação de 1000 com cap de segurança, agrega total, por fila, por responsável atual, oldest/newest.
- `commit`: laços de lotes de 200 com guarda de status no `update`.
  - `assign`: `assigned_to`, `assigned_user_id`, `status = 'open'` quando estava `pending`, `assigned_at` atualizado (mantém o comportamento do gatilho/NRT já existente).
  - `return_queue`: `assigned_to = null`, `assigned_user_id = null`, `status = 'pending'`.
  - Insere linhas em `chat_conversation_history` com `action` `bulk_transferred` / `bulk_returned_to_queue`, `from_value`/`to_value`, `actor_name`, `user_id`, `notes` com o `batch_id`.
- Reaproveita a semântica de "Julia" (sem responsável) já usada no bulk close.

**Frontend**
- `src/hooks/useBulkTransferConversations.ts` — mutations de preview/commit + invalidação das queries de conversas (mesmas chaves do bulk close).
- `src/modules/julia-chat/pages/config/components/BulkTransferConversationsCard.tsx` — UI seguindo o padrão do `BulkCloseConversationsCard` (Calendar/Popover, Select de fila, RadioGroup de destino, `TeamMemberSelect` para atendente, `AlertDialog` de dupla confirmação, badges de prévia).
- Montagem em `ChatGeneralSettings.tsx`, antes do card de encerramento.

**Sem migração de banco**: usa apenas colunas e tabelas existentes (`chat_conversations`, `chat_conversation_history`). Não haverá tabela de log dedicada — a auditoria fica no histórico da conversa.

## Fora do escopo
- Seleção múltipla por checkbox na lista do chat (pode ser um passo seguinte).
- Mudança de fila em massa.
- Desligar/ligar a Júlia em massa nas conversas transferidas (o comportamento por conversa individual permanece inalterado).
