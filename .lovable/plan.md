
## Objetivo

Deixar o histórico `/wavoip` refletindo o que realmente aconteceu com a chamada (ENCERRADA / CANCELADA / NÃO ATENDIDA / REJEITADA / FALHOU / OCUPADA REMOTAMENTE), usar o endpoint oficial `GET {base_url}/calls/whatsapp/:call_id` como fonte de verdade após 1 min, e disponibilizar a gravação como link **público** com UI clara (play / relógio / círculo-com-X).

---

## 1. Nova edge function: `wavoip-reconcile-call`

Endpoint: `GET https://api.wavoip.com/calls/whatsapp/{whatsapp_call_id}` com Bearer `device_token`.

Fluxo por chamada:

1. Ler `wavoip_call_logs` pelo `whatsapp_call_id` (pega `device_id` → `device_token` do `wavoip_devices`).
2. Chamar o endpoint. Do payload (`result[0]`) mapear:
   - `status` cru → `status` canônico (mesmo map do webhook + `end_reason` = valor cru).
   - `duration` (string em segundos, pode ter decimal) → `duration_seconds = Math.round(Number(duration))`.
   - `ended_at`: se ainda nulo, usar `last_updated_date`.
   - `started_at`: se nulo, usar `created_date`.
   - `answered_at`: se `duration > 0` e nulo, usar `created_date`.
   - `from_number`/`to_number`: `caller`/`receiver`.
   - `direction`: `IN*` → inbound, resto outbound.
   - `metadata.reconciled_payload = result[0]`, `metadata.reconciled_at = now`.
3. Regras de gravação:
   - Se `duration > 0` e `record_status = READY` → invocar `wavoip-fetch-recording` (será público agora).
   - Se `duration > 0` e `record_status != READY` → agendar novo reconcile em 1 min (contador `metadata.reconcile_attempts`, máx **5**). Marcar `recording_status='pending'`.
   - Se `duration = 0` → sem gravação. Setar `recording_status='none'`.

Aceita `POST { whatsapp_call_id }` ou `POST { call_log_id }`.

---

## 2. Agendamento pós-terminal (1 min)

No `wavoip-call-webhook`, quando `isTerminal`:

- **Remover** o `triggerFetchRecording` imediato.
- Em vez disso: agendar reconcile após 60s. Como Edge Functions não têm setTimeout confiável entre requests, usar tabela leve `wavoip_reconcile_queue (whatsapp_call_id, run_after, attempts, last_error)` + pg_cron a cada 1 min chamando `wavoip-reconcile-runner` que puxa itens vencidos e invoca `wavoip-reconcile-call` para cada um (reagenda se `record_status != READY` e attempts < 5).

Migração:
- Criar `wavoip_reconcile_queue` com GRANTs + RLS (service_role only).
- pg_cron 1 min → `wavoip-reconcile-runner`.

---

## 3. Gravação pública

Alterar bucket `wavoip-recordings` para **público** (via `supabase--storage_update_bucket`). Se a política workspace bloquear, avisar usuário.

`wavoip-fetch-recording`:
- Nome do arquivo fixo: `{client_id}/{whatsapp_call_id}.mp3` (sempre `.mp3`, `contentType: audio/mpeg`).
- Após upload, salvar em `recording_url` a **URL pública** (`storage.from(BUCKET).getPublicUrl(path).data.publicUrl`) — não mais o path.
- `recording_status='available'` só quando o arquivo estiver no storage.

Adicionar policy pública de SELECT em `storage.objects` para o bucket `wavoip-recordings`.

---

## 4. Status legível (UI)

`CallHistoryTab.tsx`: mapear `status` para label PT-BR (badge com cor):

| status canônico   | label           | cor          |
|-------------------|-----------------|--------------|
| ended             | ENCERRADA       | emerald      |
| cancelled         | CANCELADA       | amber        |
| rejected          | REJEITADA       | rose         |
| not_answered      | NÃO ATENDIDA    | rose         |
| missed            | PERDIDA         | rose         |
| failed            | FALHOU          | destructive  |
| handled_remotely  | ATENDIDA EM OUTRO DISPOSITIVO | slate |
| active            | EM CURSO        | blue         |
| calling/ringing/connecting | CHAMANDO | blue         |

---

## 5. `RecordingPlayer` — 3 estados visuais

Baseado em `recording_status` + `duration_seconds`:

- `available` + `recording_url`: ícone **Play verde**, tooltip "Ouvir gravação". Audio direto na URL pública (sem signed URL).
- `none` (sem áudio, `duration=0` ou marcado explicitamente): ícone **círculo com X** (`CircleX`) cinza, `disabled`, tooltip "Sem gravação disponível".
- pending / downloading / recording ainda esperando: ícone **relógio** (`Clock`), tooltip "Aguardando gravação (tentativa X/5)".
- error: `AlertCircle`, tooltip com mensagem.

Remover polling do front — o reconcile-runner é quem baixa.

---

## 6. Backfill dos registros existentes

Script one-shot invocando `wavoip-reconcile-call` para todo log com `whatsapp_call_id` não nulo e (`status` cru / duração inconsistente / gravação não `available`). Isso corrige históricos antigos.

Re-upload das gravações já baixadas: como o bucket vai virar público e o nome muda para `.mp3`, apenas atualizar `recording_url` para a URL pública equivalente (o arquivo já existe no path `{client_id}/{whatsapp_call_id}.{ext}`); para os `.ogg`/`.webm` antigos, deixar como está — o Player toca qualquer content-type via URL pública.

---

## Detalhes técnicos (resumo dev)

**Novos artefatos**
- `supabase/functions/wavoip-reconcile-call/index.ts`
- `supabase/functions/wavoip-reconcile-runner/index.ts`
- Migração: tabela `wavoip_reconcile_queue`, pg_cron 1 min, policy pública em `storage.objects` para bucket `wavoip-recordings`, `storage_update_bucket` para tornar público.

**Alterados**
- `wavoip-call-webhook/index.ts`: substitui trigger imediato por `INSERT INTO wavoip_reconcile_queue (run_after = now()+60s)` no terminal.
- `wavoip-fetch-recording/index.ts`: força `.mp3`, salva URL pública em `recording_url`.
- `src/pages/wavoip/components/RecordingPlayer.tsx`: 3 estados + tooltip, sem polling, usa URL pública direta.
- `src/pages/wavoip/components/CallHistoryTab.tsx`: helper `statusLabel/statusVariant` para o Badge.
- `src/pages/wavoip/hooks/useWavoipCallHistory.ts`: garantir que retorna `recording_status`, `recording_url`, `duration_seconds`, `status`.

**Fora do escopo**
- Alterar SDK/webphone.
- Trocar bucket privado por outro; só flip para público.
