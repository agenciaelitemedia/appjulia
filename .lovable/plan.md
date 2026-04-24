

## Diagnóstico: por que cron não escala para 20 clientes

### Estado atual (1 cliente = 12k items)
- Cron `pg_cron` dispara **a cada 60s** (mínimo do Postgres)
- Worker pega lote de **5 items** → ~5 items/min = **300 items/hora**
- 12k items = **40 horas** para drenar

### Projeção para 20 clientes simultâneos
- 20 × 12k = **240.000 items** por rajada de reconexão
- No ritmo atual: **800 horas** (33 dias) — completamente inviável
- `pg_cron` não tem granularidade sub-minuto → impossível ir mais rápido com cron

### Por que cron é o modelo errado
Cron é **pull-based com janela fixa**: a fila fica ociosa 59s entre cada tick. Para 20 clientes, precisamos **push-based em tempo real**: assim que um item entra em `pending`, um worker pega imediatamente.

## Arquitetura nova: realtime push-based com backpressure

```text
                    ┌─────────────────────────────────────────────┐
                    │  uazapi-chat-webhook (recebe burst UaZapi)  │
                    └──────────────────┬──────────────────────────┘
                                       │ INSERT items (pending)
                                       ▼
                    ┌─────────────────────────────────────────────┐
                    │  uazapi_history_items (tabela com trigger)  │
                    └──────────────────┬──────────────────────────┘
                                       │ AFTER INSERT trigger
                                       │ pg_notify('history_pending', payload)
                                       ▼
                    ┌─────────────────────────────────────────────┐
                    │  uazapi-history-dispatcher (sempre ativo)   │
                    │  • escuta pg_notify via Realtime postgres   │
                    │  • controla pool de workers (max 10)        │
                    │  • dispara worker assim que chega item      │
                    └──────────────────┬──────────────────────────┘
                                       │ invoke parallel
                                       ▼
                    ┌─────────────────────────────────────────────┐
                    │  uazapi-history-resume (worker)             │
                    │  • lote de 50 items, loop até 25s           │
                    │  • SELECT FOR UPDATE SKIP LOCKED            │
                    └─────────────────────────────────────────────┘
```

### Componentes

#### 1. Trigger + Realtime (substitui cron)
- Trigger `AFTER INSERT` em `uazapi_history_items` chama `pg_notify('history_pending', client_id)`
- Tabela adicionada à publication `supabase_realtime` para emitir eventos no canal Postgres Changes
- Latência: **<500ms** entre INSERT e início do processamento (vs 60s do cron)

#### 2. Dispatcher (Edge Function persistente em tempo real)
Nova função `uazapi-history-dispatcher`:
- Conecta ao Supabase Realtime e escuta INSERTs em `uazapi_history_items`
- Mantém um **pool de até 10 workers concorrentes** (semáforo interno)
- Ao receber evento, dispara `invoke('uazapi-history-resume')` se houver slot livre
- Implementa **debounce de 2s** para agrupar bursts (evita 200 invokes em 1 segundo)
- Auto-mantém-se ativo via heartbeat (cron a cada 5min reinicia se cair)

#### 3. Worker turbinado com lock pessimista
`uazapi-history-resume` reescrito:
- Aceita parâmetro `worker_id` (0-9) para particionar trabalho
- `SELECT ... FOR UPDATE SKIP LOCKED LIMIT 50` — pega lote sem conflito entre workers paralelos
- Processa em loop até **25s** ou esgotar pendências (~250 items por invocação)
- Capacidade: **10 workers × 250 items × 30s ciclo = 5.000 items/min**

#### 4. Particionamento por cliente (fairness)
Sem isso, 1 cliente com 200k items bloquearia os outros. Solução:
- Worker escolhe próximo lote com `ORDER BY client_id, created_at` rotacionando
- View materializada `uazapi_history_pending_by_client` atualizada a cada minuto mostra distribuição
- Dispatcher distribui workers proporcionalmente (round-robin entre clientes ativos)

#### 5. Cron de segurança (safety net, não primário)
Mantém o `pg_cron` existente, mas:
- Roda a cada **5min** (não 1min)
- Só dispara se houver pendências há mais de 2min (sinal de que dispatcher caiu)
- Função: garantir que nunca fique pending órfão se o realtime falhar

#### 6. Throttling para a UaZapi
Se 20 clientes reconectam ao mesmo tempo, são 20 × 40 = 800 webhooks chegando. Adicionar:
- Rate limit no webhook: max 50 INSERTs/seg por cliente (drop com 429 se exceder, UaZapi reenvia)
- Configurar `keep_history_items_for_days = 7` (auto-cleanup de items processados)

### Capacidade comparada

| Métrica | Hoje (cron) | Novo (realtime) | Ganho |
|---|---|---|---|
| Latência primeiro item | 0–60s | <1s | 60× |
| Vazão por cliente | 5/min | 5.000/min | 1.000× |
| 20 clientes (240k items) | 800h | **~50min** | 960× |
| Workers paralelos | 1 | 10 | 10× |
| Lote por worker | 5 | 50 | 10× |
| Frequência | 60s | contínuo | ∞ |

## Arquivos afetados

**Backend (novos)**
- `supabase/functions/uazapi-history-dispatcher/index.ts` — dispatcher persistente com pool de workers e Realtime listener
- `supabase/migrations/<ts>_realtime_pipeline.sql`:
  - Trigger `AFTER INSERT` em `uazapi_history_items` com `pg_notify`
  - Adicionar `uazapi_history_items` em `supabase_realtime` publication
  - Coluna `worker_id` (smallint) e `locked_at` (timestamptz) em `uazapi_history_items`
  - Índice parcial `(status, created_at) WHERE status = 'pending'`
  - View `uazapi_history_pending_by_client` para fairness
  - Atualizar `pg_cron` existente para rodar a cada 5min como safety net

**Backend (atualizados)**
- `supabase/functions/uazapi-history-resume/index.ts` — `SELECT FOR UPDATE SKIP LOCKED LIMIT 50`, loop de 25s, parâmetro `worker_id`
- `supabase/functions/uazapi-chat-webhook/index.ts` — rate limit 50 INSERTs/seg/cliente
- `supabase/functions/uazapi-history-dispatcher-heartbeat/index.ts` (novo) — cron a cada 5min para reiniciar dispatcher se cair

**Frontend**
- `src/pages/configuracoes/components/UazapiHistoryTab.tsx`:
  - Banner com vazão real-time (items/min) e ETA por cliente
  - Indicador de saúde do dispatcher (verde/amarelo/vermelho)
  - Botão "Reiniciar dispatcher" (admin)
- `src/pages/configuracoes/hooks/useUazapiHistoryRuns.ts` — hook `useDispatcherHealth` (consulta heartbeat)

**Tabela auxiliar nova**
- `dispatcher_heartbeat` (id, last_seen_at, workers_active, items_per_min) — atualizada pelo dispatcher a cada 10s

## Resultado esperado para 20 clientes

- **Latência**: novo item entra em processamento em <1 segundo (vs até 60s hoje)
- **Vazão sustentada**: ~5.000 items/min com 10 workers paralelos
- **Burst de 240k items**: drenado em ~50 minutos (vs 33 dias hoje)
- **Fairness**: nenhum cliente monopoliza; round-robin garante progresso para todos
- **Resiliência**: cron de 5min como safety net; heartbeat detecta dispatcher caído
- **Sem saturação**: pool de 10 workers + lock SKIP LOCKED elimina race conditions

