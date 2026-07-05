# Corrigir gravação de número, finalização e dispositivo

## Diagnóstico

Últimos 6 registros em `wavoip_call_logs`:
- `from_number`, `to_number`, `started_at`, `ended_at` **nulos** e `duration_seconds = 0`, mesmo com o `metadata` mostrando a resposta oficial da Wavoip (`caller: 553488860163`, `receiver: 553497221869`, `duration`, `status: 'CANCELLED'`, `created_date`, `last_updated_date`).
- Todos com `metadata.source = 'fetch-call-details'`.
- `device_id` fixo em `c5acf958-…` — quando o usuário escolhe outro dispositivo no modal, ainda assim o log pode aparecer com o dispositivo errado.

Causas:

1. `supabase/functions/wavoip-fetch-call-details/index.ts` faz `payload = detailsJson?.data ?? detailsJson` e lê `payload.from / payload.to / payload.duration / payload.started_at`. A resposta real é `{ type: 'success', result: [ { caller, receiver, duration, status, created_date, last_updated_date, direction: 'OUTCOMING', ... } ] }`. Nenhum campo bate → tudo grava nulo e sobrescreve o que o webphone/webhook já tinha gravado.
2. A mesma função resolve `device` com um fallback agressivo ("qualquer dispositivo global com provider_id") e depois faz `device_id: device.id` no upsert — isso pode trocar o dispositivo correto (o que o usuário selecionou no modal) por um qualquer.
3. A `wavoip-reconcile-call` já parseia certo, mas só roda quando a chamada é enfileirada; hoje o `call:ended` chama só a `fetch-call-details`.

## Correção

### 1) `supabase/functions/wavoip-fetch-call-details/index.ts` — parser correto
Alinhar com `wavoip-reconcile-call`:
- `const item = detailsJson?.result?.[0] ?? detailsJson?.data ?? detailsJson;`
- Mapear:
  - `from_number ← item.caller`
  - `to_number ← item.receiver`
  - `duration_seconds ← Number(item.duration) || 0`
  - `direction`: `item.direction` começando com `IN` → `inbound`, senão `outbound`
  - `status`: aplicar o mesmo `STATUS_CANON` do reconcile (`CANCELLED → cancelled`, `ENDED → ended`, `NOT_ANSWERED → not_answered`, etc.)
  - `end_reason ← item.status` (raw)
  - `started_at ← item.created_date` (ISO)
  - `ended_at ← item.last_updated_date` (ISO)
- Só sobrescrever `from_number/to_number/started_at/ended_at/duration_seconds` quando o novo valor for válido (não zerar o que o webphone/webhook gravou).
- Manter preservação de `recording_status/recording_url`.
- `metadata.source = 'fetch-call-details'`, `metadata.details = item`.

### 2) `supabase/functions/wavoip-fetch-call-details/index.ts` — não trocar o dispositivo
- Ler `device_id` existente do log antes do upsert.
- **Só** setar `device_id: device.id` no upsert quando o log ainda não tiver `device_id`. Se já tiver, preservar.
- Idem para `client_id` e `app_user_id`: preservar os valores existentes se já preenchidos.
- Remover o fallback "qualquer dispositivo global com provider_id"; manter só (a) `device_token` do body, (b) dispositivo referenciado pelo `wavoip_call_logs.device_id`, (c) qualquer dispositivo do mesmo `client_id`. Se nada bater → responder `no_device` (sem tocar na linha).

### 3) Enfileirar reconciliação
No fim do `wavoip-fetch-call-details`, upsert em `wavoip_reconcile_queue` (`onConflict: 'whatsapp_call_id'`, `run_after = now + 60s`, `status = 'pending'`), para o runner de 1 min completar `duration/recording` quando ainda estiverem pendentes. Isso também alimenta o botão "Processar fila pendente".

### 4) Backfill
Rodar `wavoip-reconcile-call` para cada `whatsapp_call_id` dos 6 registros afetados, para popular `from_number/to_number/started_at/ended_at/duration/status`. `device_id` permanece o que já está gravado.

## Fora de escopo
Migrations, mudanças de UI, `WavoipContext`, `wavoip-call-webhook`.

## Arquivos afetados
- editar `supabase/functions/wavoip-fetch-call-details/index.ts`
- backfill via chamadas à edge `wavoip-reconcile-call`
