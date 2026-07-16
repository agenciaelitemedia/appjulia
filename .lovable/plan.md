## Diagnóstico

O board `45639dc4-…` ("Salário maternidade- follow up") tem **1295 deals ativos** carregados de uma só vez. A lentidão é causada por 3 amplificadores que se multiplicam por esse total:

### 1. Fetch pesado de deals — `useCRMDeals.fetchDeals`
`select('*')` traz **todas** as colunas de `crm_deals` (incluindo o `custom_fields` jsonb, que carrega `links`, contexto Julia etc.) para as 1295 linhas em uma resposta única. Muito payload, muito parse.

### 2. N+1 de queries por card — `DealCard.tsx`
Cada `<DealCard/>` dispara individualmente:
- `useDealConversation(deal)` — 1 request/card (é este que aparece spam no console: `AbortError: signal is aborted without reason` — o React Query cancela quando o card é reordenado / desmontado / o filtro muda, e refaz tudo em seguida).
- `useDealJuliaContext(deal)`
- `useJuliaCardPreview(juliaLink)`
- `useChatContactConversationStatus(deal.contact_phone)` (quando não há link de chat)

Com 1295 cards isso vira ~4–5 mil requests por render/scroll — o navegador enfileira, aborta e refaz.

### 3. Realtime + task counts globais — `useCRMBoardTaskCounts`
- Canal realtime **sem filtro** (`crm-board-task-counts` em `crm_checklist_items` para `event: '*'`) — qualquer checklist item de qualquer board dispara refetch com `IN (…1295 ids…)`.
- A dependência do effect é `dealIds.join(',')` — qualquer reorder ou update pontual reconstrói a string e re-fetcha os 1295.

Somando: cada movimentação de card faz N updates paralelos (`Promise.all` em `moveDeal`), cada update gera evento realtime, o listener é debounced mas ainda re-fetcha os 1295 com `select('*')`, e no re-render 1295 `DealCard` disparam suas queries.

Não é problema de índice no Postgres — os índices existentes cobrem o `WHERE board_id + client_id + status`. O gargalo é **volume de payload + N+1 no front + realtime largo**.

## Correção proposta

Foco no board pesado sem mudar UX. Trabalho só em `src/pages/crm-builder/`.

### A. Enxugar o fetch de deals
Em `useCRMDeals.fetchDeals`, trocar `select('*')` por uma **lista explícita** de colunas usadas no card:
```
id, board_id, pipeline_id, position, title, description, value, priority, status,
contact_name, contact_phone, contact_email, assigned_to, assigned_user_id,
tags, due_date, expected_close_date, stage_entered_at, created_at, updated_at,
custom_fields
```
(mantém `custom_fields` porque `DealCard` lê `links.chat` e `links.julia`; o ganho vem de eliminar o resto.)

Bônus: pré-derivar `hasChatLink` / `hasJuliaLink` no reducer para evitar recomputar em cada render.

### B. Virtualização + gating dos hooks por card
No `DealCard`, transformar as queries por card em opt-in:
- `useDealConversation` / `useDealJuliaContext` / `useChatContactConversationStatus` só disparam quando o card estiver **visível no viewport** (`IntersectionObserver`) ou quando o usuário hover/abrir. Enquanto invisíveis, mostrar apenas o link estático de `custom_fields`.
- Aumentar `staleTime` desses hooks para `5 min` e `gcTime` para `10 min` para evitar refetch em reorder.
- Isso mata o spam de AbortError e os 4×1295 requests iniciais.

### C. Consertar `useCRMBoardTaskCounts`
- Filtrar o canal realtime por `board_id` (filtro server-side em `crm_checklist_items` com um índice se já não existe; caso `crm_checklist_items` não tenha `board_id`, joinar via `deal_id` = `ANY(dealIds)` e trocar o listener para escutar `crm_deals` do board — na prática, basta remover o listener global e refetcher apenas ao abrir o `DealDetailsSheet`, já que o badge muda pouco).
- Estabilizar o cache: usar React Query com chave `['task-counts', boardId]` em vez de state local dependente de `dealIds.join(',')`.

### D. Realtime de deals
Manter o canal já filtrado por `board_id`, mas:
- Após `moveDeal`, evitar o refetch completo: o próprio estado otimista já é a verdade; o `isMovingRef` cobre isso, mas ampliar a janela para 1500 ms e ignorar eventos cujo `id` já esteja no `dealsRef` com o mesmo `position`+`pipeline_id`.

## Detalhes técnicos

Arquivos a alterar:
- `src/pages/crm-builder/hooks/useCRMDeals.ts` — select explícito + supressão de refetch redundante.
- `src/pages/crm-builder/hooks/useCRMBoardTaskCounts.ts` — remover canal global, usar React Query com invalidate manual no dialog.
- `src/pages/crm-builder/components/deals/DealCard.tsx` — `IntersectionObserver` para habilitar as 4 queries de enriquecimento; `enabled: isVisible && …`.
- (Opcional, se ainda ficar pesado) `BoardPage.tsx` — virtualização vertical das colunas com `@tanstack/react-virtual` (colunas ≥100 cards).

Sem migrações de banco. Sem mudanças de schema. Sem alterações de UI/UX além do carregamento progressivo dos badges de conversa/Julia por card (que hoje já pisca por causa do abort).

## Verificação
- Abrir o board no preview e medir tempo até primeiro render + número de requests no Network para `/rest/v1/chat_conversations` e `/rest/v1/chat_contacts` (deve cair de milhares para dezenas).
- Confirmar que o console não spammeia mais `[useDealConversation] lookup by id error … AbortError`.
- Drag & drop de um card continua funcionando e não dispara refetch completo dos 1295.
