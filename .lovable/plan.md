

# Plano: Fila de sincronização por call_id + limpeza do histórico

## Contexto
- Chamadas REST (`/dialer`) já criam registro com `call_id` no banco — manter isso.
- Chamadas SIP não passam pelo `/dialer`, então não têm `call_id` disponível imediatamente.
- O sistema precisa de uma fila no frontend que acumula `call_id`s e dispara syncs sequenciais com delay de 15s, sem sobrecarregar a infra.

## Mudanças

### 1. Limpar tabela `phone_call_logs`
- Executar `DELETE FROM phone_call_logs` via insert tool.

### 2. Backend `api4com-proxy` — action `dial`
- Já cria registro com `call_id` no banco — **manter sem mudança**.
- Retornar `call_id` na resposta ao frontend (já retorna via `result`).

### 3. Backend `api4com-proxy` — action `sync_call_history`
- Quando receber `callId`: buscar apenas `GET /calls?page=1`, filtrar pelo `call_id`, e fazer **UPDATE** (nunca INSERT).
- Se não encontrar o CDR na API (chamada muito recente), retornar `{ synced: 0, notFound: true }` para o frontend saber que deve retentar.

### 4. Frontend — Fila de sincronização (`useSyncQueue` hook)
Novo hook `src/pages/telefonia/hooks/useSyncQueue.ts`:
- Mantém uma fila (`queue: { callId: string, scheduledAt: number }[]`) via `useRef`.
- Método `enqueue(callId)`: adiciona item com `scheduledAt = Date.now() + 15000`.
- Um `setInterval` (a cada 5s) verifica se há itens prontos (`scheduledAt <= now`).
- Processa **um item por vez** (sequencial), chama `sync_call_history` com o `callId`.
- Se retorno `notFound`, re-enfileira com novo delay de 10s (máximo 3 tentativas).
- Remove do queue após sucesso ou max tentativas.
- Invalida query `my-call-history` após cada sync bem-sucedido.

### 5. Frontend — `DiscadorTab.tsx`
- Ao discar via REST: capturar `call_id` do retorno do `dial.mutate` e chamar `syncQueue.enqueue(callId)`.
- Ao discar via SIP: no `handleCallEnded`, chamar `syncCallHistory` com `since` dos últimos 5 minutos (SIP não tem call_id).
- Remover `setTimeout` atual.

### 6. Frontend — `PhoneCallDialog.tsx`
- Mesmo padrão: capturar `call_id` do dial REST e enfileirar, ou usar `since` para SIP.
- Remover `setTimeout` de sync atual.

### 7. `useTelefoniaData.ts`
- Sem mudanças estruturais, `syncCallHistory` já aceita `callId` e `since`.

## Arquivos alterados
- `src/pages/telefonia/hooks/useSyncQueue.ts` — novo hook de fila
- `src/pages/telefonia/components/DiscadorTab.tsx` — usar fila
- `src/pages/crm/components/PhoneCallDialog.tsx` — usar fila
- `supabase/functions/api4com-proxy/index.ts` — sync por callId faz UPDATE only

## Detalhes técnicos da fila
```text
enqueue(callId) → queue: [{callId, scheduledAt: now+15s, retries: 0}]
                          ↓
               setInterval(5s) verifica scheduledAt <= now
                          ↓
               sync_call_history({callId}) → UPDATE no banco
                          ↓
               notFound? re-enqueue (+10s, max 3x) : done + invalidate query
```
- Sem workers ou processos extras — roda no browser como interval leve.
- Múltiplas chamadas = múltiplos items na fila, processados sequencialmente.
- O interval se auto-limpa no unmount do hook.

