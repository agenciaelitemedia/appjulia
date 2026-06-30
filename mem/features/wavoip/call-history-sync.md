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
