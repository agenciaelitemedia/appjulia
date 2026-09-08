---
name: Wavoip Call History Sync
description: Sincronização 3-camadas do histórico de chamadas Wavoip com gravação no nosso storage
type: feature
---
**Fonte da verdade**: webhook oficial da Wavoip → `wavoip_call_logs` (unique index parcial em `whatsapp_call_id`, upsert atômico).

**Arquitetura**:
1. **Webhook (primário)** — `wavoip-call-webhook` recebe `CALL` (CREATE/UPDATE), `RECORD` e `DEVICE`. Auth via `?device_token=` na query. Eventos `CALL` sem `whatsapp_call_id` são descartados (nada de linhas órfãs). `RECORD` com `record_status=READY` dispara `wavoip-fetch-recording` imediatamente. `DEVICE` atualiza `wavoip_devices.connection_status`.
2. **Auto-provisionamento** — `wavoip-configure-webhook` chama API Wavoip (PUT/POST em `/devices/webhook` com Bearer device_token) registrando endpoint `…/wavoip-call-webhook?device_token=<t>` e eventos `CALL,RECORD,DEVICE`. Disparado pelo `WavoipContext` ao montar/refrescar dispositivos.
3. **Poll (rede de segurança)** — `wavoip-sync-history` continua existindo via pg_cron 5min p/ casos raros em que o webhook falhar.
4. **Webphone (frontend)** — NÃO grava em `wavoip_call_logs` se não houver `whatsapp_call_id`. Quando o SDK expõe o id, faz upsert por `whatsapp_call_id` (idempotente com o webhook).

**Gravação**: `wavoip-fetch-recording` baixa de `storage.wavoip.com/{whatsapp_call_id}` para bucket privado `wavoip-recordings` path `{client_id}/{whatsapp_call_id}.{ext}`. `RecordingPlayer` faz polling leve a cada 20s enquanto status=pending/downloading (até 3min) e gera signed URL ao abrir popover.

**Sincronização por conta (2026-09-08)**: `GET /v2/devices/{id}/calls` retorna 401 mesmo com JWT válido — NÃO usar. O histórico oficial vem de `GET /v2/calls?limit=100&cursor=<nextCursor>` (conta inteira, `{ data:[], nextCursor }`). Item: `id` = whatsapp_call_id, `id_session` (id do device na Wavoip), `caller`, `receiver`, `status`, `duration`, `record_status`, `created_date`, `direction`. `wavoip-sync-history` agrupa devices por provedor, pagina `/v2/calls` e atribui a chamada ao device por: log existente → `id_session` (cruzado com `/v2/devices/me` via token) → últimos 8 dígitos do telefone do device. `wavoip_reconcile_queue` tem unique em `whatsapp_call_id` (antes faltava e todo upsert falhava em silêncio). Botão "Sincronizar com ZAP Call" na aba Histórico invoca a função + reconcile-runner.
