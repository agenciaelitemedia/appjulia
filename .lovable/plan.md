# Correção da lentidão na sincronização de mensagens

## Problema
- 3.500+ itens travados em `pending`, throughput próximo de zero.
- Workers bootando e dando shutdown em <1s sem processar.
- Locks órfãos acumulando porque `uazapi_pick_pending_items` não muda status para `processing` — múltiplos workers competem pelo mesmo lote e os que perdem o `SKIP LOCKED` saem sem trabalho.
- Filtro redundante no worker (`ts <= last_message_at`) descarta histórico válido como `skipped` e ainda apaga o `payload`, impedindo reprocessamento.

## Correções

### 1. Migration SQL — corrigir RPCs de lock
- **`uazapi_pick_pending_items`**: passar a marcar `status = 'processing'` (em vez de manter `pending`) e exigir `worker_id IS NULL` no `WHERE`. Isso garante exclusão real entre workers concorrentes.
- **`uazapi_release_stale_locks`**: liberar tanto `pending` com lock antigo quanto `processing` parado >2min, voltando para `pending` com `worker_id=NULL`.
- Adicionar índice parcial `(status, created_at) WHERE status='pending' AND worker_id IS NULL` para acelerar o pick.

### 2. `supabase/functions/uazapi-history-resume/index.ts`
- Remover o filtro `ts <= existingContact.last_message_at` que estava marcando histórico válido como `skipped` (a deduplicação real já é feita por `external_id`).
- Ao marcar item como `skipped`/`error`, **não apagar o payload** — manter para auditoria/reprocesso.
- Reduzir fan-out de `maybeRespawnSelf` de 4 para 1 e só respawnar se `pending > 100`.
- Adicionar `UPDATE ... SET status='ok'` explícito no fim de `processOneItem` (necessário com a mudança do RPC).

### 3. Recovery imediato (SQL data-only)
- `UPDATE uazapi_history_items SET worker_id=NULL, locked_at=NULL, status='pending' WHERE status IN ('pending','processing') AND locked_at IS NOT NULL` — libera os 242 locks órfãos atuais.
- Itens já `skipped` sem payload ficam como estão; backfill on-demand recria quando o usuário abrir a conversa.

## Fora de escopo
- Dispatcher (lógica de pool está correta).
- Filtros de grupo/duplicata recém-implementados (funcionando).

## Resultado esperado
Workers param de competir, locks param de acumular, throughput volta. Backlog de 3.5k deve drenar em <10min com 10 workers × 50 itens/lote.