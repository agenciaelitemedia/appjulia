

## Diagnóstico: por que apenas 4 workers ativos (e não 10)

Investiguei os logs em tempo real e o código atual. O problema **não é a vazão por worker** — cada um está processando 50 items em ~1.5s (excelente!). O problema é que o **dispatcher não consegue manter 10 workers vivos simultaneamente**.

### Evidências dos logs (últimos 30s)
- **uazapi-history-resume**: dezenas de invocações, cada uma `picked=50` em ~500ms-1.5s — worker está rápido
- **uazapi-history-dispatcher**: apenas 2 invocações registradas no período, `worker=1` e `worker=5` durando 50s cada
- **`inserted=0` ou `inserted=1`** em quase todos os lotes: 98% das mensagens já são duplicatas (deduplicação por `message_id`)

### As 4 causas reais (medidas)

| # | Causa | Evidência |
|---|---|---|
| 1 | **Dispatcher dispara só 6 workers no máximo** | `ensurePool` tem `target=6` se `pending>1000`, só vai a 10 se `pending>5000`. Com 9k pending caiu pra 6 |
| 2 | **Auto-respawn só dispara 1 worker** | No fim do `drainLoop`, worker faz fire-and-forget de **1 nova invocação de si mesmo** (mesmo `worker_id`), não preenche os outros slots |
| 3 | **Dispatcher é stateless entre invocações** | Cada chamada do heartbeat (1/min) cria nova instância do Edge → `state.busy` zera → não sabe que workers estão rodando → pode disparar duplicatas ou ficar sem disparar |
| 4 | **Heartbeat roda só a cada 60s** | Entre ticks, se workers terminam, ninguém repõe. Auto-respawn cobre parcialmente mas com apenas 1 worker |

### Por que está "lento" mesmo com 50 items/1.5s por worker
- 4 workers × 33 items/s = **133 items/s = 8.000/min teórico**
- Mas como `inserted=0` na maioria, o trabalho útil é menor que o overhead de I/O
- Cada `picked=50` lida 50 mensagens do DB, faz dedup, descarta — gasta tempo de banco mas não gera progresso visível

## Correções

### 1. Pool agressivo desde o início
No `ensurePool` do dispatcher:
```ts
let target = MAX_WORKERS; // sempre 10 se houver backlog
if (pending < 100) target = 2;
if (pending < 500) target = 5;
```
Elimina o "ramp up" tímido.

### 2. Auto-respawn em fan-out (não 1, mas N)
No `uazapi-history-resume`, ao terminar, se `pending > 200`, dispara **fan-out de 3 invocações paralelas** (workers diferentes) via `EdgeRuntime.waitUntil`. Mantém pool cheio sem depender do dispatcher.

### 3. Dispatcher com self-tick rápido
Após disparar workers, o dispatcher agenda **auto-tick de 10s** (via `setTimeout` + `EdgeRuntime.waitUntil`) enquanto a instância estiver viva. Reduz o gap de 60s do heartbeat para 10s.

### 4. Lock de slot via DB (não memória)
Substituir `state.busy: Set<number>` por consulta real ao DB:
```sql
SELECT DISTINCT worker_id FROM uazapi_history_items 
WHERE status='pending' AND locked_at > now() - interval '30 seconds'
```
Dispatcher pega só worker_ids livres → nunca dispara duplicado, nunca deixa slot vazio. Funciona mesmo se a instância reiniciar.

### 5. Reduzir trabalho desperdiçado em duplicatas
No worker, antes de processar payload, fazer **batch-check de message_ids existentes** com `SELECT id FROM messages WHERE message_id = ANY($1)` e descartar duplicatas em uma query só (em vez de 50 INSERTs que falham no UNIQUE constraint).

## Capacidade projetada

| Métrica | Hoje | Após correções |
|---|---|---|
| Workers simultâneos | 2-4 | **8-10 sustentado** |
| Gap entre ciclos | 60s (heartbeat) | 10s (self-tick) |
| Items/min reais | ~318 | **~3.000** |
| Tempo dedup (inserted=0) | 1.5s/lote | 0.3s/lote |

## Arquivos afetados
- `supabase/functions/uazapi-history-dispatcher/index.ts` — `ensurePool` agressivo, lock via DB, self-tick de 10s
- `supabase/functions/uazapi-history-resume/index.ts` — fan-out de 3 no auto-respawn, batch-check de duplicatas antes de INSERT

## Resultado esperado
- Pool real de 8-10 workers ativos visível na aba Monitor
- Vazão sustentada de ~3.000 items/min mesmo com alta taxa de duplicatas
- Drenagem dos pendentes atuais em poucos minutos

