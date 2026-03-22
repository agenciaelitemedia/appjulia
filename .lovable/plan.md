

# Plano: Histórico apenas por sincronização — nunca criar registros ao discar

## Problema
O backend `api4com-proxy` action `dial` (linhas 126-149) cria registros em `phone_call_logs` tanto no sucesso quanto no erro da discagem. Isso viola a regra de que o histórico deve vir exclusivamente da sincronização.

## Correções

### 1. `api4com-proxy/index.ts` — action `dial`
- Remover os dois `insert` em `phone_call_logs` (linhas 126-136 e 139-149)
- Manter apenas a chamada REST ao `/dialer` e retornar o `call_id` ao frontend

### 2. `api4com-proxy/index.ts` — action `sync_call_history`
- Quando receber `callId`: buscar na API, e fazer **upsert** (insert se não existe, update se existe) — não apenas update
- Isso garante que a sincronização é a única fonte de criação de registros

### 3. Frontend — já está correto
- `PhoneCallDialog.tsx` e `DiscadorTab.tsx` já capturam o `call_id` e enfileiram no `syncQueue`
- O `syncQueue` já dispara a sync após 15s com o `callId`

## Arquivos alterados
- `supabase/functions/api4com-proxy/index.ts` — remover inserts do dial + upsert no sync

