

## Diagnóstico dos gargalos remanescentes

### Vazão real medida (não a teórica)
- **Atual**: ~318 items/min (3.500 items em 11 min)
- **Pendente**: 9.007 items → ETA real **~28 minutos** (não os 5.000/min projetados)
- **Pool subutilizado**: dispatcher dispara 10 workers, mas apenas 4 mantêm locks ativos a cada momento

### Os 5 gargalos reais (medidos, não suposições)

| # | Gargalo | Evidência | Impacto |
|---|---|---|---|
| 1 | **N+1 sequencial dentro do worker** | 200 items em 32s = 160ms/item, com 7 queries cada = 22ms/query serializadas | Worker fica 90% do tempo aguardando round-trip |
| 2 | **Items minúsculos** | Média de **1.5 mensagens por item** (max 11) | Overhead de orquestração 5× maior que o trabalho útil |
| 3 | **Pool ocioso entre ticks** | Heartbeat dispara workers a cada 60s; workers terminam em ~32s e ficam ociosos 28s | 47% de idle time |
| 4 | **Heartbeat com vazão quebrada** | DB mostra `items_per_min: 0` mesmo com 318/min real | Monitor mente, dispatcher não escala pool corretamente |
| 5 | **`finalizeRunIfDone` chamado por run tocada** | Cada lote toca ~50 runs → 50 queries extras de agregação | 15-20% do tempo do worker desperdiçado |

## Correções

### 1. Paralelismo intra-worker (concurrency 5)
No `drainBatch`, substituir `for (const item of list)` por processamento em **chunks paralelos de 5**:
```ts
const CONCURRENCY = 5;
for (let i = 0; i < list.length; i += CONCURRENCY) {
  const chunk = list.slice(i, i + CONCURRENCY);
  const results = await Promise.all(chunk.map(item => processOneItem(...)));
}
```
**Ganho estimado**: 5× a vazão por worker (de 6 items/s para ~30 items/s).

### 2. Auto-respawn do worker (sem esperar próximo tick)
No fim do `drainLoop`, se ainda houver `pending > 0`, o worker **dispara fire-and-forget** uma nova invocação de si mesmo via `fetch` (com `EdgeRuntime.waitUntil`) antes de retornar. Elimina o gap de 28s entre ciclos.

### 3. Coalescência de finalize de runs
Trocar `for (const runId of touchedRuns) await finalizeRunIfDone(...)` por uma **única query agregada** que verifica todas as runs tocadas em um SELECT e finaliza só as que zeraram. Reduz 50 queries para 1.

### 4. Compactação de items no webhook (próximas reconexões)
Atualizar `uazapi-chat-webhook` → `enqueueHistoryRun` para **agrupar mensagens do mesmo `remote_jid` em um único item** dentro do batch recebido. Hoje cria 1 item por mensagem; passará a criar 1 item por chat. Reduz volume de items em ~40% (média de 1.5 msg/item subirá pra ~10).

### 5. Heartbeat com vazão real
Substituir `processedWindow` (que conta invocações de worker) por **leitura direta do DB** a cada heartbeat:
```ts
SELECT COUNT(*) FROM uazapi_history_items 
WHERE status='ok' AND processed_at > now() - interval '1 minute'
```
Permite que o dispatcher tome decisões corretas de scaling.

### 6. Bug de UI: `forwardRef` no `ItemStatusBadge`
Console mostra warning React em `UazapiHistoryTab.tsx:108` — `ItemStatusBadge` é usado dentro de `<Tooltip>` que precisa de ref. Envolver com `React.forwardRef`.

## Capacidade projetada após correções

| Métrica | Hoje (medido) | Após correções | Ganho |
|---|---|---|---|
| Items/seg por worker | 6 | 30 | 5× |
| Workers efetivos simultâneos | 4 | 8-10 | 2× |
| Idle time entre ciclos | 28s | <1s | ∞ |
| Vazão total | 318/min | **~3.000/min** | 9× |
| 9k items pending | ~28 min | **~3 min** | 9× |
| 240k items (20 clientes) | ~13h | **~80 min** | 10× |

## Arquivos afetados
- `supabase/functions/uazapi-history-resume/index.ts` — concurrency intra-worker, auto-respawn, finalize coalescido
- `supabase/functions/uazapi-history-dispatcher/index.ts` — leitura real de vazão do DB no heartbeat
- `supabase/functions/uazapi-chat-webhook/index.ts` — agrupar items por `remote_jid` no enqueue
- `src/pages/configuracoes/components/UazapiHistoryTab.tsx` — corrigir `forwardRef` no `ItemStatusBadge`

## Resultado esperado
- Drenagem dos 9k items atuais em **~3 minutos** após deploy (vs 28 min de ETA atual)
- Vazão sustentada de **~3.000 items/min** com pool real de 8-10 workers ativos
- Heartbeat passa a refletir a vazão verdadeira (hoje mostra zero)
- Reconexões futuras geram 40% menos items, baixando custo de I/O do banco

